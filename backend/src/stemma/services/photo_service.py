from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Protocol

from stemma.domain.errors import InvalidAttachment, UnsupportedPhotoType

MAX_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_PHOTO_CONTENT_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)
MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024
ALLOWED_ATTACHMENT_CONTENT_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"}
)
PUT_URL_EXPIRES_SECONDS = 300
GET_URL_EXPIRES_SECONDS = 3600


def photo_key(stemma_id: str, person_id: str) -> str:
    return f"stemmas/{stemma_id}/persons/{person_id}/photo"


def attachment_key(stemma_id: str, attachment_id: str) -> str:
    return f"stemmas/{stemma_id}/attachments/{attachment_id}"


def is_attachment_key_of(stemma_id: str, key: str) -> bool:
    return key.startswith(f"stemmas/{stemma_id}/attachments/")


def belongs_to_stemma(stemma_id: str, key: str) -> bool:
    """Photos are stored under a per-stemma prefix, so a key that does not carry
    it is owned by another stemma (a clone made before photos were copied) and
    must not be deleted on this stemma's behalf."""
    return key.startswith(f"stemmas/{stemma_id}/")


class PhotoStore(Protocol):
    def issue_upload_url(
        self, stemma_id: str, person_id: str, content_type: str
    ) -> tuple[str, dict[str, str], str]: ...

    def issue_attachment_upload_url(
        self, stemma_id: str, attachment_id: str, content_type: str
    ) -> tuple[str, dict[str, str], str]: ...

    def issue_attachment_put_url(self, stemma_id: str, attachment_id: str, content_type: str) -> tuple[str, str]: ...

    def object_info(self, key: str) -> tuple[int, str] | None: ...

    def issue_get_url(self, key: str) -> str: ...

    def copy(self, source_key: str, destination_key: str) -> None: ...

    def delete(self, keys: Iterable[str]) -> None: ...


@dataclass(frozen=True)
class S3PhotoService:
    s3_client: Any
    bucket: str

    def issue_upload_url(
        self, stemma_id: str, person_id: str, content_type: str
    ) -> tuple[str, dict[str, str], str]:
        if content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
            raise UnsupportedPhotoType(content_type=content_type)
        key = photo_key(stemma_id, person_id)
        response = self.s3_client.generate_presigned_post(
            self.bucket,
            key,
            Fields={"Content-Type": content_type},
            Conditions=[
                ["content-length-range", 0, MAX_PHOTO_BYTES],
                ["eq", "$Content-Type", content_type],
            ],
            ExpiresIn=PUT_URL_EXPIRES_SECONDS,
        )
        return response["url"], response["fields"], key

    def issue_attachment_upload_url(
        self, stemma_id: str, attachment_id: str, content_type: str
    ) -> tuple[str, dict[str, str], str]:
        if content_type not in ALLOWED_ATTACHMENT_CONTENT_TYPES:
            raise InvalidAttachment(reason=f"unsupported file type {content_type}")
        key = attachment_key(stemma_id, attachment_id)
        response = self.s3_client.generate_presigned_post(
            self.bucket,
            key,
            Fields={"Content-Type": content_type},
            Conditions=[
                ["content-length-range", 0, MAX_ATTACHMENT_BYTES],
                ["eq", "$Content-Type", content_type],
            ],
            ExpiresIn=PUT_URL_EXPIRES_SECONDS,
        )
        return response["url"], response["fields"], key

    def issue_attachment_put_url(self, stemma_id: str, attachment_id: str, content_type: str) -> tuple[str, str]:
        """A single presigned PUT URL. S3 can't enforce a size range on a PUT, so the
        caller must check object_info() before trusting the upload."""
        if content_type not in ALLOWED_ATTACHMENT_CONTENT_TYPES:
            raise InvalidAttachment(reason=f"unsupported file type {content_type}")
        key = attachment_key(stemma_id, attachment_id)
        url = self.s3_client.generate_presigned_url(
            "put_object",
            Params={"Bucket": self.bucket, "Key": key, "ContentType": content_type},
            ExpiresIn=PUT_URL_EXPIRES_SECONDS,
        )
        return url, key

    def object_info(self, key: str) -> tuple[int, str] | None:
        """(size in bytes, content type) of an uploaded object, or None if it doesn't exist."""
        try:
            head = self.s3_client.head_object(Bucket=self.bucket, Key=key)
        except self.s3_client.exceptions.ClientError as e:
            if e.response.get("Error", {}).get("Code") in ("404", "NoSuchKey", "NotFound"):
                return None
            raise
        return int(head["ContentLength"]), head.get("ContentType", "")

    def issue_get_url(self, key: str) -> str:
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=GET_URL_EXPIRES_SECONDS,
        )

    def copy(self, source_key: str, destination_key: str) -> None:
        self.s3_client.copy_object(
            Bucket=self.bucket,
            CopySource={"Bucket": self.bucket, "Key": source_key},
            Key=destination_key,
        )

    def delete(self, keys: Iterable[str]) -> None:
        batch = [{"Key": k} for k in keys if k]
        if not batch:
            return
        self.s3_client.delete_objects(Bucket=self.bucket, Delete={"Objects": batch})
