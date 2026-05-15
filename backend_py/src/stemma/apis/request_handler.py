import logging
from collections.abc import Callable

from stemma.domain.errors import AccessToPersonDenied, ForeignInviteToken
from stemma.domain.requests import (
    BearInvitationRequest,
    CloneStemmaRequest,
    CreateFamilyRequest,
    CreateInvitationTokenRequest,
    CreateNewStemmaRequest,
    DeleteFamilyRequest,
    DeletePersonRequest,
    DeleteStemmaRequest,
    GetStemmaRequest,
    ListDescribeStemmasRequest,
    Request,
    UpdateFamilyRequest,
    UpdatePersonRequest,
)
from stemma.domain.responses import (
    CloneResult,
    InviteToken,
    OwnedStemmas,
    Response,
    Stemma,
    StemmaDescription,
    TokenAccepted,
)
from stemma.domain.user import User
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

logger = logging.getLogger(__name__)


class RequestHandler:
    def __init__(self, storage: StorageService, users: UserService) -> None:
        self._storage = storage
        self._users = users
        self._handlers: dict[type, Callable[[User, Request], Response]] = {
            ListDescribeStemmasRequest: self._list_describe_stemmas,
            CreateFamilyRequest: self._create_family,
            UpdateFamilyRequest: self._update_family,
            DeleteFamilyRequest: self._delete_family,
            CreateInvitationTokenRequest: self._create_invitation_token,
            BearInvitationRequest: self._bear_invitation,
            CreateNewStemmaRequest: self._create_new_stemma,
            GetStemmaRequest: self._get_stemma,
            DeleteStemmaRequest: self._delete_stemma,
            DeletePersonRequest: self._delete_person,
            UpdatePersonRequest: self._update_person,
            CloneStemmaRequest: self._clone_stemma,
        }

    def handle(self, user: User, request: Request) -> Response:
        handler = self._handlers.get(type(request))
        if handler is None:
            raise TypeError(f"unhandled request variant: {type(request).__name__}")
        return handler(user, request)

    def _list_describe_stemmas(self, user: User, request: ListDescribeStemmasRequest) -> OwnedStemmas:
        existing = self._storage.list_owned_stemmas(user.user_id)
        if not existing:
            new_id = self._storage.create_stemma(user.user_id, request.defaultStemmaName)
            return OwnedStemmas(
                stemmas=[StemmaDescription(id=new_id, name=request.defaultStemmaName, removable=True)],
                firstStemma=Stemma(),
            )
        first = self._storage.stemma(user.user_id, existing[0].id)
        return OwnedStemmas(stemmas=existing, firstStemma=first)

    def _bear_invitation(self, user: User, request: BearInvitationRequest) -> TokenAccepted:
        token = self._users.decode_invite_token(request.encodedToken)
        if token.inviteesEmail.strip().lower() != user.email.lower():
            raise ForeignInviteToken()
        self._storage.chown(user.user_id, token.stemmaId, token.targetPersonId)
        owned = self._storage.list_owned_stemmas(user.user_id)
        last_stemma = self._storage.stemma(user.user_id, token.stemmaId)
        return TokenAccepted(stemmas=owned, lastStemma=last_stemma)

    def _delete_stemma(self, user: User, request: DeleteStemmaRequest) -> OwnedStemmas:
        self._storage.remove_stemma(user.user_id, request.stemmaId)
        owned = self._storage.list_owned_stemmas(user.user_id)
        return OwnedStemmas(stemmas=owned, firstStemma=None)

    def _create_new_stemma(self, user: User, request: CreateNewStemmaRequest) -> StemmaDescription:
        new_id = self._storage.create_stemma(user.user_id, request.stemmaName)
        return StemmaDescription(id=new_id, name=request.stemmaName, removable=True)

    def _get_stemma(self, user: User, request: GetStemmaRequest) -> Stemma:
        return self._storage.stemma(user.user_id, request.stemmaId)

    def _delete_person(self, user: User, request: DeletePersonRequest) -> Stemma:
        self._storage.remove_person(user.user_id, request.personId)
        return self._storage.stemma(user.user_id, request.stemmaId)

    def _update_person(self, user: User, request: UpdatePersonRequest) -> Stemma:
        self._storage.update_person(user.user_id, request.personId, request.personDescr)
        return self._storage.stemma(user.user_id, request.stemmaId)

    def _create_invitation_token(self, user: User, request: CreateInvitationTokenRequest) -> InviteToken:
        if not self._storage.owns_person(user.user_id, request.targetPersonId):
            raise AccessToPersonDenied(personId=request.targetPersonId)
        token = self._users.create_invite_token(
            request.targetPersonEmail, request.stemmaId, request.targetPersonId
        )
        return InviteToken(token=token)

    def _create_family(self, user: User, request: CreateFamilyRequest) -> Stemma:
        stemma, _ = self._storage.create_family(user.user_id, request.stemmaId, request.familyDescr)
        return stemma

    def _delete_family(self, user: User, request: DeleteFamilyRequest) -> Stemma:
        self._storage.remove_family(user.user_id, request.familyId)
        return self._storage.stemma(user.user_id, request.stemmaId)

    def _update_family(self, user: User, request: UpdateFamilyRequest) -> Stemma:
        stemma, _ = self._storage.update_family(user.user_id, request.familyId, request.familyDescr)
        return stemma

    def _clone_stemma(self, user: User, request: CloneStemmaRequest) -> CloneResult:
        cloned = self._storage.clone_stemma(user.user_id, request.stemmaId, request.stemmaName)
        owned = self._storage.list_owned_stemmas(user.user_id)
        return CloneResult(createdStemma=cloned, stemmas=owned)
