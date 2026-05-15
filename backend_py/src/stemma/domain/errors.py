from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG


class StemmaError(Exception):
    pass


@dataclass(config=DOMAIN_CONFIG)
class UnknownError(StemmaError):
    cause: str


@dataclass(config=DOMAIN_CONFIG)
class RequestDeserializationProblem(StemmaError):
    descr: str


@dataclass(config=DOMAIN_CONFIG)
class NoSuchPersonId(StemmaError):
    id: str


@dataclass(config=DOMAIN_CONFIG)
class ChildAlreadyBelongsToFamily(StemmaError):
    family_id: str
    person_id: str


@dataclass(config=DOMAIN_CONFIG)
class IncompleteFamily(StemmaError):
    pass


@dataclass(config=DOMAIN_CONFIG)
class DuplicatedIds(StemmaError):
    duplicated_ids: str


@dataclass(config=DOMAIN_CONFIG)
class AccessToFamilyDenied(StemmaError):
    family_id: str


@dataclass(config=DOMAIN_CONFIG)
class AccessToPersonDenied(StemmaError):
    person_id: str


@dataclass(config=DOMAIN_CONFIG)
class AccessToStemmaDenied(StemmaError):
    stemma_id: str


@dataclass(config=DOMAIN_CONFIG)
class IsNotTheOnlyStemmaOwner(StemmaError):
    stemma_id: str


@dataclass(config=DOMAIN_CONFIG)
class InvalidInviteToken(StemmaError):
    pass


@dataclass(config=DOMAIN_CONFIG)
class ForeignInviteToken(StemmaError):
    pass


@dataclass(config=DOMAIN_CONFIG)
class StemmaHasCycles(StemmaError):
    pass
