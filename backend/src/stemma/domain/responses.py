from dataclasses import field
from datetime import date
from typing import Annotated, Literal

from pydantic import Discriminator
from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class FamilyDescription:
    id: str
    parents: list[str]
    children: list[str]
    read_only: bool
    type: Literal["FamilyDescription"] = "FamilyDescription"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class PersonDescription:
    id: str
    name: str
    birth_date: date | None
    death_date: date | None
    bio: str | None
    read_only: bool
    photo_url: str | None = None
    type: Literal["PersonDescription"] = "PersonDescription"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class PhotoUploadUrl:
    upload_url: str
    photo_key: str
    expires_in_seconds: int
    type: Literal["PhotoUploadUrl"] = "PhotoUploadUrl"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class StemmaDescription:
    id: str
    name: str
    removable: bool
    type: Literal["StemmaDescription"] = "StemmaDescription"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class Stemma:
    people: list[PersonDescription] = field(default_factory=list)
    families: list[FamilyDescription] = field(default_factory=list)
    type: Literal["Stemma"] = "Stemma"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class OwnedStemmas:
    stemmas: list[StemmaDescription]
    first_stemma: Stemma | None
    default_stemma_id: str | None = None
    type: Literal["OwnedStemmas"] = "OwnedStemmas"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class InviteToken:
    token: str
    type: Literal["InviteToken"] = "InviteToken"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CloneResult:
    created_stemma: Stemma
    stemmas: list[StemmaDescription]
    type: Literal["CloneResult"] = "CloneResult"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class TokenAccepted:
    stemmas: list[StemmaDescription]
    last_stemma: Stemma
    type: Literal["TokenAccepted"] = "TokenAccepted"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class AuthLoginResponse:
    user_id: str
    email: str
    type: Literal["AuthLoginResponse"] = "AuthLoginResponse"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class AuthLogoutResponse:
    type: Literal["AuthLogoutResponse"] = "AuthLogoutResponse"


Response = Annotated[
    OwnedStemmas
    | Stemma
    | StemmaDescription
    | FamilyDescription
    | PersonDescription
    | InviteToken
    | CloneResult
    | TokenAccepted
    | PhotoUploadUrl
    | AuthLoginResponse
    | AuthLogoutResponse,
    Discriminator("type"),
]
