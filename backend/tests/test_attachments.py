import pytest

from stemma.apis.request_handler import RequestHandler
from stemma.domain.errors import AccessToFamilyDenied, AccessToPersonDenied, InvalidAttachment, NoSuchAttachment
from stemma.domain.requests import (
    AddFileAttachmentRequest,
    AddLinkAttachmentRequest,
    DeleteFamilyRequest,
    DeletePersonRequest,
    DeleteStemmaRequest,
    RemoveAttachmentRequest,
    RequestAttachmentUploadUrlRequest,
)
from stemma.domain.responses import AttachmentUploadUrl, Stemma
from stemma.services.photo_service import S3PhotoService
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

from tests.conftest import PHOTO_BUCKET
from tests.factories import create_jane, create_john, family


def _seed(storage: StorageService, email: str = "owner@test.com"):
    user = storage.get_or_create_user(email)
    sid = storage.create_stemma(user.user_id, "s")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)())
    return user, sid, fam.parents[0], fam.id


def _upload(s3_client, key: str, content_type: str = "application/pdf", body: bytes = b"%PDF-1.4") -> None:
    s3_client.put_object(Bucket=PHOTO_BUCKET, Key=key, Body=body, ContentType=content_type)


def _exists(s3_client, key: str) -> bool:
    return s3_client.list_objects_v2(Bucket=PHOTO_BUCKET, Prefix=key).get("KeyCount", 0) > 0


@pytest.fixture
def handler(storage: StorageService, users: UserService, photo_store: S3PhotoService) -> RequestHandler:
    return RequestHandler(storage, users, photo_store=photo_store)


def test_a_link_can_be_attached_to_a_person_and_to_a_family(storage, handler) -> None:
    user, sid, pid, fid = _seed(storage)
    handler.handle(user, AddLinkAttachmentRequest(
        stemma_id=sid, owner_kind="person", owner_id=pid, title="ОБД Мемориал", url="https://obd-memorial.ru/x", note="донесение"
    ))
    stemma = handler.handle(user, AddLinkAttachmentRequest(
        stemma_id=sid, owner_kind="family", owner_id=fid, title="Запись о браке", url="http://example.org/m"
    ))
    assert isinstance(stemma, Stemma)
    by_owner = {(a.owner_kind, a.owner_id): a for a in stemma.attachments}
    person_link = by_owner[("person", pid)]
    assert (person_link.kind, person_link.title, person_link.url, person_link.note) == (
        "link", "ОБД Мемориал", "https://obd-memorial.ru/x", "донесение"
    )
    assert by_owner[("family", fid)].url == "http://example.org/m"


@pytest.mark.parametrize("url", ["javascript:alert(1)", "ftp://x", "not a url", ""])
def test_only_http_links_are_accepted(storage, handler, url: str) -> None:
    user, sid, pid, _ = _seed(storage)
    with pytest.raises(InvalidAttachment):
        handler.handle(user, AddLinkAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="x", url=url))


def test_attaching_needs_edit_rights(storage, handler) -> None:
    _, sid, pid, fid = _seed(storage)
    intruder = storage.get_or_create_user("intruder@test.com")
    with pytest.raises(AccessToPersonDenied):
        handler.handle(intruder, AddLinkAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="x", url="https://x"))
    with pytest.raises(AccessToFamilyDenied):
        handler.handle(intruder, AddLinkAttachmentRequest(stemma_id=sid, owner_kind="family", owner_id=fid, title="x", url="https://x"))


def test_a_file_is_uploaded_then_attached_and_served(storage, handler, s3_client) -> None:
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(
        stemma_id=sid, owner_kind="person", owner_id=pid, content_type="application/pdf"
    ))
    assert isinstance(upload, AttachmentUploadUrl)
    assert upload.file_key.startswith(f"stemmas/{sid}/attachments/")
    _upload(s3_client, upload.file_key)

    stemma = handler.handle(user, AddFileAttachmentRequest(
        stemma_id=sid, owner_kind="person", owner_id=pid, title="Метрика 1899", file_key=upload.file_key, content_type="application/pdf"
    ))
    [att] = stemma.attachments
    assert att.kind == "file"
    assert att.content_type == "application/pdf"
    assert att.url and att.url.startswith("https://")


def test_unsupported_file_types_are_refused(storage, handler) -> None:
    user, sid, pid, _ = _seed(storage)
    with pytest.raises(InvalidAttachment):
        handler.handle(user, RequestAttachmentUploadUrlRequest(
            stemma_id=sid, owner_kind="person", owner_id=pid, content_type="application/x-msdownload"
        ))


def test_a_file_key_from_another_stemma_is_refused(storage, handler) -> None:
    user, sid, pid, _ = _seed(storage)
    with pytest.raises(InvalidAttachment):
        handler.handle(user, AddFileAttachmentRequest(
            stemma_id=sid, owner_kind="person", owner_id=pid, title="x",
            file_key="stemmas/other/attachments/abc", content_type="application/pdf",
        ))


def test_removing_an_attachment_deletes_its_file(storage, handler, s3_client) -> None:
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/png"))
    assert isinstance(upload, AttachmentUploadUrl)
    _upload(s3_client, upload.file_key, "image/png")
    stemma = handler.handle(user, AddFileAttachmentRequest(
        stemma_id=sid, owner_kind="person", owner_id=pid, title="scan", file_key=upload.file_key, content_type="image/png"
    ))
    [att] = stemma.attachments
    stemma = handler.handle(user, RemoveAttachmentRequest(stemma_id=sid, attachment_id=att.id))
    assert stemma.attachments == []
    assert not _exists(s3_client, upload.file_key)
    with pytest.raises(NoSuchAttachment):
        handler.handle(user, RemoveAttachmentRequest(stemma_id=sid, attachment_id=att.id))


def test_deleting_the_owner_removes_its_attachments_and_files(storage, handler, s3_client) -> None:
    user, sid, pid, fid = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/png"))
    assert isinstance(upload, AttachmentUploadUrl)
    _upload(s3_client, upload.file_key, "image/png")
    handler.handle(user, AddFileAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="scan", file_key=upload.file_key, content_type="image/png"))
    handler.handle(user, AddLinkAttachmentRequest(stemma_id=sid, owner_kind="family", owner_id=fid, title="x", url="https://x"))

    handler.handle(user, DeleteFamilyRequest(stemma_id=sid, family_id=fid))
    stemma = handler.handle(user, DeletePersonRequest(stemma_id=sid, person_id=pid))
    assert isinstance(stemma, Stemma)
    assert stemma.attachments == []
    assert not _exists(s3_client, upload.file_key)


def test_deleting_the_stemma_removes_attachment_files(storage, handler, s3_client) -> None:
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/png"))
    assert isinstance(upload, AttachmentUploadUrl)
    _upload(s3_client, upload.file_key, "image/png")
    handler.handle(user, AddFileAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="scan", file_key=upload.file_key, content_type="image/png"))
    handler.handle(user, DeleteStemmaRequest(stemma_id=sid))
    assert not _exists(s3_client, upload.file_key)


def test_clone_gets_its_own_copies(storage, handler, s3_client) -> None:
    user, sid, pid, fid = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/png"))
    assert isinstance(upload, AttachmentUploadUrl)
    _upload(s3_client, upload.file_key, "image/png")
    handler.handle(user, AddFileAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="scan", file_key=upload.file_key, content_type="image/png"))
    handler.handle(user, AddLinkAttachmentRequest(stemma_id=sid, owner_kind="family", owner_id=fid, title="link", url="https://x"))

    clone = storage.clone_stemma(user.user_id, sid, "copy")
    clone_people = {p.id for p in clone.people}
    clone_families = {f.id for f in clone.families}
    assert len(clone.attachments) == 2
    for att in clone.attachments:
        assert att.owner_id in (clone_people if att.owner_kind == "person" else clone_families)
    clone_sid = next(s.id for s in storage.list_owned_stemmas(user.user_id) if s.name == "copy")
    copied = [k["Key"] for k in s3_client.list_objects_v2(Bucket=PHOTO_BUCKET, Prefix=f"stemmas/{clone_sid}/attachments/").get("Contents", [])]
    assert len(copied) == 1


def test_a_put_upload_is_a_single_presigned_url(storage, handler) -> None:
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(
        stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/jpeg", method="PUT"
    ))
    assert isinstance(upload, AttachmentUploadUrl)
    assert upload.method == "PUT"
    assert upload.upload_fields == {}
    assert upload.file_key in upload.upload_url and "X-Amz-Signature" in upload.upload_url


def test_attaching_a_file_that_was_never_uploaded_is_refused(storage, handler) -> None:
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/jpeg", method="PUT"))
    assert isinstance(upload, AttachmentUploadUrl)
    with pytest.raises(InvalidAttachment):
        handler.handle(user, AddFileAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="x", file_key=upload.file_key, content_type="image/jpeg"))


def test_an_oversized_upload_is_refused_and_deleted(storage, handler, s3_client, monkeypatch) -> None:
    import stemma.services.photo_service as photo_service

    monkeypatch.setattr(photo_service, "MAX_ATTACHMENT_BYTES", 4)
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/jpeg", method="PUT"))
    assert isinstance(upload, AttachmentUploadUrl)
    _upload(s3_client, upload.file_key, "image/jpeg", b"0123456789")
    with pytest.raises(InvalidAttachment):
        handler.handle(user, AddFileAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="x", file_key=upload.file_key, content_type="image/jpeg"))
    assert not _exists(s3_client, upload.file_key)


def test_an_upload_with_another_content_type_is_refused_and_deleted(storage, handler, s3_client) -> None:
    user, sid, pid, _ = _seed(storage)
    upload = handler.handle(user, RequestAttachmentUploadUrlRequest(stemma_id=sid, owner_kind="person", owner_id=pid, content_type="image/jpeg", method="PUT"))
    assert isinstance(upload, AttachmentUploadUrl)
    _upload(s3_client, upload.file_key, "text/html", b"<script>")
    with pytest.raises(InvalidAttachment):
        handler.handle(user, AddFileAttachmentRequest(stemma_id=sid, owner_kind="person", owner_id=pid, title="x", file_key=upload.file_key, content_type="image/jpeg"))
    assert not _exists(s3_client, upload.file_key)
