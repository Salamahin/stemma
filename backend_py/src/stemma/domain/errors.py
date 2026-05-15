from typing import Annotated, Literal

from pydantic import Discriminator
from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG


class StemmaError(Exception):
    pass


@dataclass(config=DOMAIN_CONFIG)
class UnknownError(StemmaError):
    cause: str
    type: Literal["UnknownError"] = "UnknownError"


@dataclass(config=DOMAIN_CONFIG)
class RequestDeserializationProblem(StemmaError):
    descr: str
    type: Literal["RequestDeserializationProblem"] = "RequestDeserializationProblem"


@dataclass(config=DOMAIN_CONFIG)
class NoSuchPersonId(StemmaError):
    id: str
    type: Literal["NoSuchPersonId"] = "NoSuchPersonId"


@dataclass(config=DOMAIN_CONFIG)
class ChildAlreadyBelongsToFamily(StemmaError):
    family_id: str
    person_id: str
    type: Literal["ChildAlreadyBelongsToFamily"] = "ChildAlreadyBelongsToFamily"


@dataclass(config=DOMAIN_CONFIG)
class IncompleteFamily(StemmaError):
    type: Literal["IncompleteFamily"] = "IncompleteFamily"


@dataclass(config=DOMAIN_CONFIG)
class DuplicatedIds(StemmaError):
    duplicated_ids: str
    type: Literal["DuplicatedIds"] = "DuplicatedIds"


@dataclass(config=DOMAIN_CONFIG)
class AccessToFamilyDenied(StemmaError):
    family_id: str
    type: Literal["AccessToFamilyDenied"] = "AccessToFamilyDenied"


@dataclass(config=DOMAIN_CONFIG)
class AccessToPersonDenied(StemmaError):
    person_id: str
    type: Literal["AccessToPersonDenied"] = "AccessToPersonDenied"


@dataclass(config=DOMAIN_CONFIG)
class AccessToStemmaDenied(StemmaError):
    stemma_id: str
    type: Literal["AccessToStemmaDenied"] = "AccessToStemmaDenied"


@dataclass(config=DOMAIN_CONFIG)
class IsNotTheOnlyStemmaOwner(StemmaError):
    stemma_id: str
    type: Literal["IsNotTheOnlyStemmaOwner"] = "IsNotTheOnlyStemmaOwner"


@dataclass(config=DOMAIN_CONFIG)
class InvalidInviteToken(StemmaError):
    type: Literal["InvalidInviteToken"] = "InvalidInviteToken"


@dataclass(config=DOMAIN_CONFIG)
class ForeignInviteToken(StemmaError):
    type: Literal["ForeignInviteToken"] = "ForeignInviteToken"


@dataclass(config=DOMAIN_CONFIG)
class StemmaHasCycles(StemmaError):
    type: Literal["StemmaHasCycles"] = "StemmaHasCycles"


StemmaErrorUnion = Annotated[
    UnknownError
    | RequestDeserializationProblem
    | NoSuchPersonId
    | ChildAlreadyBelongsToFamily
    | IncompleteFamily
    | DuplicatedIds
    | AccessToFamilyDenied
    | AccessToPersonDenied
    | AccessToStemmaDenied
    | IsNotTheOnlyStemmaOwner
    | InvalidInviteToken
    | ForeignInviteToken
    | StemmaHasCycles,
    Discriminator("type"),
]
