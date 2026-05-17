import logging

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
    RenameStemmaRequest,
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

    def handle(self, user: User, request: Request) -> Response:
        match request:
            case ListDescribeStemmasRequest():
                return self._list_describe_stemmas(user, request)
            case CreateFamilyRequest():
                return self._create_family(user, request)
            case UpdateFamilyRequest():
                return self._update_family(user, request)
            case DeleteFamilyRequest():
                return self._delete_family(user, request)
            case CreateInvitationTokenRequest():
                return self._create_invitation_token(user, request)
            case BearInvitationRequest():
                return self._bear_invitation(user, request)
            case CreateNewStemmaRequest():
                return self._create_new_stemma(user, request)
            case GetStemmaRequest():
                return self._get_stemma(user, request)
            case DeleteStemmaRequest():
                return self._delete_stemma(user, request)
            case DeletePersonRequest():
                return self._delete_person(user, request)
            case UpdatePersonRequest():
                return self._update_person(user, request)
            case CloneStemmaRequest():
                return self._clone_stemma(user, request)
            case RenameStemmaRequest():
                return self._rename_stemma(user, request)

    def _list_describe_stemmas(self, user: User, request: ListDescribeStemmasRequest) -> OwnedStemmas:
        existing = self._storage.list_owned_stemmas(user.user_id)
        if not existing:
            new_id = self._storage.create_stemma(user.user_id, request.default_stemma_name)
            return OwnedStemmas(
                stemmas=[StemmaDescription(id=new_id, name=request.default_stemma_name, removable=True)],
                first_stemma=Stemma(),
            )
        first = self._storage.stemma(user.user_id, existing[0].id)
        return OwnedStemmas(stemmas=existing, first_stemma=first)

    def _bear_invitation(self, user: User, request: BearInvitationRequest) -> TokenAccepted:
        token = self._users.decode_invite_token(request.encoded_token)
        if token.invitees_email.strip().lower() != user.email.lower():
            raise ForeignInviteToken()
        self._storage.chown(user.user_id, token.stemma_id, token.target_person_id)
        owned = self._storage.list_owned_stemmas(user.user_id)
        last_stemma = self._storage.stemma(user.user_id, token.stemma_id)
        return TokenAccepted(stemmas=owned, last_stemma=last_stemma)

    def _delete_stemma(self, user: User, request: DeleteStemmaRequest) -> OwnedStemmas:
        self._storage.remove_stemma(user.user_id, request.stemma_id)
        owned = self._storage.list_owned_stemmas(user.user_id)
        return OwnedStemmas(stemmas=owned, first_stemma=None)

    def _create_new_stemma(self, user: User, request: CreateNewStemmaRequest) -> StemmaDescription:
        new_id = self._storage.create_stemma(user.user_id, request.stemma_name)
        return StemmaDescription(id=new_id, name=request.stemma_name, removable=True)

    def _get_stemma(self, user: User, request: GetStemmaRequest) -> Stemma:
        return self._storage.stemma(user.user_id, request.stemma_id)

    def _delete_person(self, user: User, request: DeletePersonRequest) -> Stemma:
        self._storage.remove_person(user.user_id, request.stemma_id, request.person_id)
        return self._storage.stemma(user.user_id, request.stemma_id)

    def _update_person(self, user: User, request: UpdatePersonRequest) -> Stemma:
        self._storage.update_person(
            user.user_id, request.stemma_id, request.person_id, request.person_descr
        )
        return self._storage.stemma(user.user_id, request.stemma_id)

    def _create_invitation_token(
        self, user: User, request: CreateInvitationTokenRequest
    ) -> InviteToken:
        if not self._storage.owns_person(user.user_id, request.stemma_id, request.target_person_id):
            raise AccessToPersonDenied(person_id=request.target_person_id)
        token = self._users.create_invite_token(
            request.target_person_email, request.stemma_id, request.target_person_id
        )
        return InviteToken(token=token)

    def _create_family(self, user: User, request: CreateFamilyRequest) -> Stemma:
        stemma, _ = self._storage.create_family(user.user_id, request.stemma_id, request.family_descr)
        return stemma

    def _delete_family(self, user: User, request: DeleteFamilyRequest) -> Stemma:
        self._storage.remove_family(user.user_id, request.stemma_id, request.family_id)
        return self._storage.stemma(user.user_id, request.stemma_id)

    def _update_family(self, user: User, request: UpdateFamilyRequest) -> Stemma:
        stemma, _ = self._storage.update_family(
            user.user_id, request.stemma_id, request.family_id, request.family_descr
        )
        return stemma

    def _clone_stemma(self, user: User, request: CloneStemmaRequest) -> CloneResult:
        cloned = self._storage.clone_stemma(user.user_id, request.stemma_id, request.stemma_name)
        owned = self._storage.list_owned_stemmas(user.user_id)
        return CloneResult(created_stemma=cloned, stemmas=owned)

    def _rename_stemma(self, user: User, request: RenameStemmaRequest) -> StemmaDescription:
        return self._storage.rename_stemma(user.user_id, request.stemma_id, request.new_name)
