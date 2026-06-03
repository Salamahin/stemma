from dataclasses import field
from datetime import date
from typing import Annotated, Literal

from pydantic import Discriminator
from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class ExistingPerson:
    id: str
    type: Literal["ExistingPerson"] = "ExistingPerson"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateNewPerson:
    name: str
    birth_date: date | None = None
    death_date: date | None = None
    bio: str | None = None
    type: Literal["CreateNewPerson"] = "CreateNewPerson"


PersonDefinition = Annotated[ExistingPerson | CreateNewPerson, Discriminator("type")]


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateFamily:
    parent1: PersonDefinition | None
    parent2: PersonDefinition | None
    children: list[PersonDefinition] = field(default_factory=list)


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateFamilyRequest:
    stemma_id: str
    family_descr: CreateFamily
    type: Literal["CreateFamilyRequest"] = "CreateFamilyRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class UpdateFamilyRequest:
    stemma_id: str
    family_id: str
    family_descr: CreateFamily
    type: Literal["UpdateFamilyRequest"] = "UpdateFamilyRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class DeleteFamilyRequest:
    stemma_id: str
    family_id: str
    type: Literal["DeleteFamilyRequest"] = "DeleteFamilyRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateInvitationTokenRequest:
    stemma_id: str
    target_person_id: str
    target_person_email: str
    type: Literal["CreateInvitationTokenRequest"] = "CreateInvitationTokenRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class BearInvitationRequest:
    encoded_token: str
    type: Literal["BearInvitationRequest"] = "BearInvitationRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateNewStemmaRequest:
    stemma_name: str
    type: Literal["CreateNewStemmaRequest"] = "CreateNewStemmaRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class GetStemmaRequest:
    stemma_id: str
    type: Literal["GetStemmaRequest"] = "GetStemmaRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class DeleteStemmaRequest:
    stemma_id: str
    type: Literal["DeleteStemmaRequest"] = "DeleteStemmaRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class ListDescribeStemmasRequest:
    default_stemma_name: str
    kings_of_europe_stemma_name: str
    type: Literal["ListDescribeStemmasRequest"] = "ListDescribeStemmasRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CloneStemmaRequest:
    stemma_id: str
    stemma_name: str
    type: Literal["CloneStemmaRequest"] = "CloneStemmaRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class RenameStemmaRequest:
    stemma_id: str
    new_name: str
    type: Literal["RenameStemmaRequest"] = "RenameStemmaRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class DeletePersonRequest:
    stemma_id: str
    person_id: str
    type: Literal["DeletePersonRequest"] = "DeletePersonRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class UpdatePersonRequest:
    stemma_id: str
    person_id: str
    person_descr: CreateNewPerson
    type: Literal["UpdatePersonRequest"] = "UpdatePersonRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateOrphanPersonRequest:
    stemma_id: str
    person_descr: CreateNewPerson
    type: Literal["CreateOrphanPersonRequest"] = "CreateOrphanPersonRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class RequestPhotoUploadUrlRequest:
    stemma_id: str
    person_id: str
    content_type: str
    type: Literal["RequestPhotoUploadUrlRequest"] = "RequestPhotoUploadUrlRequest"


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class SetPersonPhotoRequest:
    stemma_id: str
    person_id: str
    photo_key: str | None
    type: Literal["SetPersonPhotoRequest"] = "SetPersonPhotoRequest"


Request = Annotated[
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
    | RenameStemmaRequest
    | DeletePersonRequest
    | UpdatePersonRequest
    | CreateOrphanPersonRequest
    | RequestPhotoUploadUrlRequest
    | SetPersonPhotoRequest,
    Discriminator("type"),
]
