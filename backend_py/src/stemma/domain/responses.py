from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class FamilyDescription:
    id: str
    parents: list[str]
    children: list[str]
    readOnly: bool


@dataclass(frozen=True)
class PersonDescription:
    id: str
    name: str
    birthDate: date | None
    deathDate: date | None
    bio: str | None
    readOnly: bool


@dataclass(frozen=True)
class StemmaDescription:
    id: str
    name: str
    removable: bool


@dataclass(frozen=True)
class Stemma:
    people: list[PersonDescription] = field(default_factory=list)
    families: list[FamilyDescription] = field(default_factory=list)


@dataclass(frozen=True)
class OwnedStemmas:
    stemmas: list[StemmaDescription]
    firstStemma: Stemma | None


@dataclass(frozen=True)
class InviteToken:
    token: str


@dataclass(frozen=True)
class CloneResult:
    createdStemma: Stemma
    stemmas: list[StemmaDescription]


@dataclass(frozen=True)
class TokenAccepted:
    stemmas: list[StemmaDescription]
    lastStemma: Stemma


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
