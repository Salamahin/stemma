from dataclasses import dataclass


class StemmaError(Exception):
    pass


@dataclass
class UnknownError(StemmaError):
    cause: str


@dataclass
class RequestDeserializationProblem(StemmaError):
    descr: str


@dataclass
class NoSuchPersonId(StemmaError):
    id: str


@dataclass
class ChildAlreadyBelongsToFamily(StemmaError):
    familyId: str
    personId: str


@dataclass
class IncompleteFamily(StemmaError):
    pass


@dataclass
class DuplicatedIds(StemmaError):
    duplicatedIds: str


@dataclass
class AccessToFamilyDenied(StemmaError):
    familyId: str


@dataclass
class AccessToPersonDenied(StemmaError):
    personId: str


@dataclass
class AccessToStemmaDenied(StemmaError):
    stemmaId: str


@dataclass
class IsNotTheOnlyStemmaOwner(StemmaError):
    stemmaId: str


@dataclass
class InvalidInviteToken(StemmaError):
    pass


@dataclass
class ForeignInviteToken(StemmaError):
    pass


@dataclass
class StemmaHasCycles(StemmaError):
    pass
