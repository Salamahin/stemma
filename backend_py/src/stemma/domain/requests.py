from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class ExistingPerson:
    id: str


@dataclass(frozen=True)
class CreateNewPerson:
    name: str
    birthDate: date | None = None
    deathDate: date | None = None
    bio: str | None = None


PersonDefinition = ExistingPerson | CreateNewPerson


@dataclass(frozen=True)
class CreateFamily:
    parent1: PersonDefinition | None
    parent2: PersonDefinition | None
    children: list[PersonDefinition] = field(default_factory=list)


@dataclass(frozen=True)
class CreateFamilyRequest:
    stemmaId: str
    familyDescr: CreateFamily


@dataclass(frozen=True)
class UpdateFamilyRequest:
    stemmaId: str
    familyId: str
    familyDescr: CreateFamily


@dataclass(frozen=True)
class DeleteFamilyRequest:
    stemmaId: str
    familyId: str


@dataclass(frozen=True)
class CreateInvitationTokenRequest:
    stemmaId: str
    targetPersonId: str
    targetPersonEmail: str


@dataclass(frozen=True)
class BearInvitationRequest:
    encodedToken: str


@dataclass(frozen=True)
class CreateNewStemmaRequest:
    stemmaName: str


@dataclass(frozen=True)
class GetStemmaRequest:
    stemmaId: str


@dataclass(frozen=True)
class DeleteStemmaRequest:
    stemmaId: str


@dataclass(frozen=True)
class ListDescribeStemmasRequest:
    defaultStemmaName: str


@dataclass(frozen=True)
class CloneStemmaRequest:
    stemmaId: str
    stemmaName: str


@dataclass(frozen=True)
class DeletePersonRequest:
    stemmaId: str
    personId: str


@dataclass(frozen=True)
class UpdatePersonRequest:
    stemmaId: str
    personId: str
    personDescr: CreateNewPerson


Request = (
    CreateFamilyRequest
    | UpdateFamilyRequest
    | DeleteFamilyRequest
    | CreateInvitationTokenRequest
    | BearInvitationRequest
    | CreateNewStemmaRequest
    | GetStemmaRequest
    | DeleteStemmaRequest
    | ListDescribeStemmasRequest
    | CloneStemmaRequest
    | DeletePersonRequest
    | UpdatePersonRequest
)
