from dataclasses import field
from datetime import date

from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class FamilyDescription:
    id: str
    parents: list[str]
    children: list[str]
    read_only: bool


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class PersonDescription:
    id: str
    name: str
    birth_date: date | None
    death_date: date | None
    bio: str | None
    read_only: bool


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class StemmaDescription:
    id: str
    name: str
    removable: bool


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class Stemma:
    people: list[PersonDescription] = field(default_factory=list)
    families: list[FamilyDescription] = field(default_factory=list)


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class OwnedStemmas:
    stemmas: list[StemmaDescription]
    first_stemma: Stemma | None


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class InviteToken:
    token: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CloneResult:
    created_stemma: Stemma
    stemmas: list[StemmaDescription]


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class TokenAccepted:
    stemmas: list[StemmaDescription]
    last_stemma: Stemma


Response = (
    OwnedStemmas
    | Stemma
    | StemmaDescription
    | FamilyDescription
    | PersonDescription
    | InviteToken
    | CloneResult
    | TokenAccepted
)
