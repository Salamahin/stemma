from dataclasses import field
from datetime import date
from typing import Annotated, Any

from pydantic import BeforeValidator, PlainSerializer, TypeAdapter
from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class ExistingPerson:
    id: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateNewPerson:
    name: str
    birth_date: date | None = None
    death_date: date | None = None
    bio: str | None = None


_PD_TYPES: dict[str, type] = {"ExistingPerson": ExistingPerson, "CreateNewPerson": CreateNewPerson}
_PD_ADAPTERS = {cls: TypeAdapter(cls) for cls in _PD_TYPES.values()}


def _validate_person_definition(value: Any) -> Any:
    if value is None or isinstance(value, (ExistingPerson, CreateNewPerson)):
        return value
    if not isinstance(value, dict) or len(value) != 1:
        raise ValueError(f"expected tagged PersonDefinition, got {value!r}")
    [(tag, inner)] = value.items()
    cls = _PD_TYPES.get(tag)
    if cls is None:
        raise ValueError(f"unknown PersonDefinition type {tag!r}")
    return _PD_ADAPTERS[cls].validate_python(inner)


def _serialize_person_definition(value: Any) -> dict[str, Any]:
    return {type(value).__name__: _PD_ADAPTERS[type(value)].dump_python(value, by_alias=True, mode="json")}


PersonDefinition = Annotated[
    ExistingPerson | CreateNewPerson,
    BeforeValidator(_validate_person_definition),
    PlainSerializer(_serialize_person_definition, return_type=dict),
]


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateFamily:
    parent1: PersonDefinition | None
    parent2: PersonDefinition | None
    children: list[PersonDefinition] = field(default_factory=list)


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateFamilyRequest:
    stemma_id: str
    family_descr: CreateFamily


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class UpdateFamilyRequest:
    stemma_id: str
    family_id: str
    family_descr: CreateFamily


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class DeleteFamilyRequest:
    stemma_id: str
    family_id: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateInvitationTokenRequest:
    stemma_id: str
    target_person_id: str
    target_person_email: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class BearInvitationRequest:
    encoded_token: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CreateNewStemmaRequest:
    stemma_name: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class GetStemmaRequest:
    stemma_id: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class DeleteStemmaRequest:
    stemma_id: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class ListDescribeStemmasRequest:
    default_stemma_name: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class CloneStemmaRequest:
    stemma_id: str
    stemma_name: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class DeletePersonRequest:
    stemma_id: str
    person_id: str


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class UpdatePersonRequest:
    stemma_id: str
    person_id: str
    person_descr: CreateNewPerson


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
