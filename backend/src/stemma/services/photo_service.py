from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any, Protocol

from stemma.domain.errors import UnsupportedPhotoType

MAX_PHOTO_BYTES = 5 * 1024 * 1024
ALLOWED_PHOTO_CONTENT_TYPES: frozenset[str] = frozenset(
    {"image/jpeg", "image/png", "image/webp"}
)
PUT_URL_EXPIRES_SECONDS = 300
GET_URL_EXPIRES_SECONDS = 3600


def photo_key(stemma_id: str, person_id: str) -> str:
    return f"stemmas/{stemma_id}/persons/{person_id}/photo"


class PhotoStore(Protocol):
    def issue_upload_url(self, stemma_id: str, person_id: str, content_type: str) -> tuple[str, str]: ...

    def issue_get_url(self, key: str) -> str: ...

    def delete(self, keys: Iterable[str]) -> None: ...


@dataclass(frozen=True)
class S3PhotoService:
    s3_client: Any
    bucket: str

    def issue_upload_url(self, stemma_id: str, person_id: str, content_type: str) -> tuple[str, str]:
        if content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
            raise UnsupportedPhotoType(content_type=content_type)
        key = photo_key(stemma_id, person_id)
        url = self.s3_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": key,
                "ContentType": content_type,
            },
            ExpiresIn=PUT_URL_EXPIRES_SECONDS,
        )
        return url, key

    def issue_get_url(self, key: str) -> str:
        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=GET_URL_EXPIRES_SECONDS,
        )

    def delete(self, keys: Iterable[str]) -> None:
        batch = [{"Key": k} for k in keys if k]
        if not batch:
            return
        self.s3_client.delete_objects(Bucket=self.bucket, Delete={"Objects": batch})
