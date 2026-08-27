import pytest

from stemma.apis.request_handler import RequestHandler
from stemma.domain.errors import (
    AccessToPersonDenied,
    NoSuchPersonId,
    UnsupportedPhotoType,
)
from stemma.domain.requests import (
    DeletePersonRequest,
    DeleteStemmaRequest,
    RequestPhotoUploadUrlRequest,
    SetPersonPhotoRequest,
)
from stemma.domain.responses import PhotoUploadUrl, Stemma
from stemma.services.photo_service import S3PhotoService, photo_key
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

from tests.conftest import PHOTO_BUCKET
from tests.factories import create_jane, create_john, family


def _seed_person(storage: StorageService, email: str = "user@test.com") -> tuple[str, str, str]:
    user = storage.get_or_create_user(email)
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)())
    return user.user_id, sid, fam.parents[0]


def _put_object(s3_client, key: str) -> None:
    s3_client.put_object(Bucket=PHOTO_BUCKET, Key=key, Body=b"\xff\xd8\xff")


def _stemma_id_by_name(storage: StorageService, user_id: str, name: str) -> str:
    return next(s.id for s in storage.list_owned_stemmas(user_id) if s.name == name)


def _object_exists(s3_client, key: str) -> bool:
    response = s3_client.list_objects_v2(Bucket=PHOTO_BUCKET, Prefix=key)
    return any(o["Key"] == key for o in response.get("Contents", []))


def test_set_person_photo_persists_and_round_trips(
    storage: StorageService, s3_client
) -> None:
    user_id, sid, pid = _seed_person(storage)
    key = photo_key(sid, pid)
    _put_object(s3_client, key)

    assert storage.set_person_photo(user_id, sid, pid, key) is None
    stemma = storage.stemma(user_id, sid)
    person = next(p for p in stemma.people if p.id == pid)
    assert person.photo_url is not None
    assert key in person.photo_url


def test_set_person_photo_returns_previous_key(storage: StorageService, s3_client) -> None:
    user_id, sid, pid = _seed_person(storage)
    first_key = "old_key"
    storage.set_person_photo(user_id, sid, pid, first_key)
    second_key = "new_key"
    previous = storage.set_person_photo(user_id, sid, pid, second_key)
    assert previous == first_key


def test_set_person_photo_to_none_clears(storage: StorageService) -> None:
    user_id, sid, pid = _seed_person(storage)
    storage.set_person_photo(user_id, sid, pid, "some_key")
    assert storage.set_person_photo(user_id, sid, pid, None) == "some_key"
    stemma = storage.stemma(user_id, sid)
    person = next(p for p in stemma.people if p.id == pid)
    assert person.photo_url is None


def test_set_person_photo_requires_owner(storage: StorageService) -> None:
    owner_id, sid, pid = _seed_person(storage)
    intruder = storage.get_or_create_user("intruder@test.com")
    with pytest.raises(AccessToPersonDenied):
        storage.set_person_photo(intruder.user_id, sid, pid, "k")


def test_update_person_preserves_existing_photo_key(storage: StorageService) -> None:
    user_id, sid, pid = _seed_person(storage)
    storage.set_person_photo(user_id, sid, pid, "kept_key")

    from stemma.domain.requests import CreateNewPerson

    storage.update_person(user_id, sid, pid, CreateNewPerson(name="John Renamed"))
    stemma = storage.stemma(user_id, sid)
    person = next(p for p in stemma.people if p.id == pid)
    assert person.name == "John Renamed"
    assert person.photo_url is not None and "kept_key" in person.photo_url


def test_remove_person_returns_photo_key(storage: StorageService) -> None:
    user_id, sid, pid = _seed_person(storage)
    storage.set_person_photo(user_id, sid, pid, "k")
    assert storage.remove_person(user_id, sid, pid) == ["k"]


def test_remove_stemma_returns_all_photo_keys(storage: StorageService) -> None:
    user_id, sid, pid = _seed_person(storage)
    storage.set_person_photo(user_id, sid, pid, "k1")
    assert storage.remove_stemma(user_id, sid) == ["k1"]


def test_photo_service_rejects_unsupported_content_type(photo_store: S3PhotoService) -> None:
    with pytest.raises(UnsupportedPhotoType):
        photo_store.issue_upload_url("sid", "pid", "image/gif")


def test_photo_service_returns_signed_put_url(photo_store: S3PhotoService) -> None:
    url, fields, key = photo_store.issue_upload_url("sid", "pid", "image/jpeg")
    assert url.startswith("https://")
    assert key == photo_key("sid", "pid")
    assert isinstance(fields, dict)


def test_handler_request_photo_upload_url_owner_check(
    storage: StorageService, users: UserService, photo_store: S3PhotoService
) -> None:
    owner_id, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    intruder = storage.get_or_create_user("intruder@test.com")
    with pytest.raises(AccessToPersonDenied):
        handler.handle(
            intruder,
            RequestPhotoUploadUrlRequest(
                stemma_id=sid, person_id=pid, content_type="image/jpeg"
            ),
        )


def test_handler_request_photo_upload_url_returns_signed_url(
    storage: StorageService, users: UserService, photo_store: S3PhotoService
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")
    response = handler.handle(
        user,
        RequestPhotoUploadUrlRequest(
            stemma_id=sid, person_id=pid, content_type="image/jpeg"
        ),
    )
    assert isinstance(response, PhotoUploadUrl)
    assert response.photo_key == photo_key(sid, pid)
    assert response.upload_url.startswith("https://")
    assert isinstance(response.upload_fields, dict)


def test_handler_clearing_photo_deletes_the_object(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")

    key = photo_key(sid, pid)
    _put_object(s3_client, key)
    storage.set_person_photo(user.user_id, sid, pid, key)

    response = handler.handle(
        user, SetPersonPhotoRequest(stemma_id=sid, person_id=pid, photo_key=None)
    )
    assert isinstance(response, Stemma)
    assert not _object_exists(s3_client, key)


def test_handler_replacing_photo_keeps_the_object_it_overwrites(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")

    key = photo_key(sid, pid)
    _put_object(s3_client, key)
    storage.set_person_photo(user.user_id, sid, pid, key)

    handler.handle(user, SetPersonPhotoRequest(stemma_id=sid, person_id=pid, photo_key=key))
    assert _object_exists(s3_client, key)


def test_handler_set_person_photo_leaves_a_foreign_key_alone(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")

    foreign_key = photo_key("other-stemma", "other-person")
    _put_object(s3_client, foreign_key)
    storage.set_person_photo(user.user_id, sid, pid, foreign_key)

    handler.handle(user, SetPersonPhotoRequest(stemma_id=sid, person_id=pid, photo_key=None))
    assert _object_exists(s3_client, foreign_key)


def test_handler_delete_person_deletes_photo_from_s3(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")
    key = photo_key(sid, pid)
    _put_object(s3_client, key)
    storage.set_person_photo(user.user_id, sid, pid, key)

    handler.handle(user, DeletePersonRequest(stemma_id=sid, person_id=pid))
    assert not _object_exists(s3_client, key)


def test_handler_delete_stemma_deletes_photo_from_s3(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")
    key = photo_key(sid, pid)
    _put_object(s3_client, key)
    storage.set_person_photo(user.user_id, sid, pid, key)

    handler.handle(user, DeleteStemmaRequest(stemma_id=sid))
    assert not _object_exists(s3_client, key)


def test_handler_delete_stemma_leaves_a_foreign_key_alone(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")
    foreign_key = photo_key("other-stemma", "other-person")
    _put_object(s3_client, foreign_key)
    storage.set_person_photo(user.user_id, sid, pid, foreign_key)

    handler.handle(user, DeleteStemmaRequest(stemma_id=sid))
    assert _object_exists(s3_client, foreign_key)


def test_clone_stemma_gives_the_copy_its_own_photo_object(
    storage: StorageService, s3_client
) -> None:
    user_id, sid, pid = _seed_person(storage)
    original_key = photo_key(sid, pid)
    _put_object(s3_client, original_key)
    storage.set_person_photo(user_id, sid, pid, original_key)

    cloned = storage.clone_stemma(user_id, sid, "clone")
    cloned_id = _stemma_id_by_name(storage, user_id, "clone")
    cloned_person = next(p for p in cloned.people if p.photo_url is not None)
    assert cloned_person.photo_url is not None
    cloned_key = photo_key(cloned_id, cloned_person.id)
    assert cloned_key in cloned_person.photo_url
    assert _object_exists(s3_client, cloned_key)
    assert _object_exists(s3_client, original_key)


def test_deleting_a_clone_keeps_the_source_photo(
    storage: StorageService, users: UserService, photo_store: S3PhotoService, s3_client
) -> None:
    _, sid, pid = _seed_person(storage)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    user = storage.get_or_create_user("user@test.com")
    original_key = photo_key(sid, pid)
    _put_object(s3_client, original_key)
    storage.set_person_photo(user.user_id, sid, pid, original_key)
    storage.clone_stemma(user.user_id, sid, "clone")
    cloned_id = _stemma_id_by_name(storage, user.user_id, "clone")

    handler.handle(user, DeleteStemmaRequest(stemma_id=cloned_id))
    assert _object_exists(s3_client, original_key)
    stemma = storage.stemma(user.user_id, sid)
    person = next(p for p in stemma.people if p.id == pid)
    assert person.photo_url is not None


def test_clone_stemma_drops_the_photo_when_the_object_is_gone(
    storage: StorageService, s3_client
) -> None:
    user_id, sid, pid = _seed_person(storage)
    storage.set_person_photo(user_id, sid, pid, photo_key(sid, pid))

    cloned = storage.clone_stemma(user_id, sid, "clone")
    assert all(p.photo_url is None for p in cloned.people)


def test_set_person_photo_missing_person_raises(storage: StorageService) -> None:
    user_id, sid, _pid = _seed_person(storage)
    storage._put_stemma_owner(sid, user_id)
    storage._table.put_item(
        Item={"pk": f"STEMMA#{sid}", "sk": "OWNER#PERSON#ghost#" + user_id}
    )
    with pytest.raises(NoSuchPersonId):
        storage.set_person_photo(user_id, sid, "ghost", "k")
