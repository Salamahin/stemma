import secrets

from stemma.domain.user import User
from stemma.services.invite_tokens import InviteToken, decode_invite_token, encode_invite_token
from stemma.storage.storage_service import StorageService


class UserService:
    def __init__(self, storage: StorageService, invite_secret: str) -> None:
        self._storage = storage
        self._invite_secret = invite_secret

    def get_or_create_user(self, email: str) -> User:
        return self._storage.get_or_create_user(email)

    def create_invite_token(self, invitee_email: str, stemma_id: str, target_person_id: str) -> str:
        entropy = secrets.token_urlsafe(20)
        token = InviteToken(
            inviteesEmail=invitee_email,
            stemmaId=stemma_id,
            targetPersonId=target_person_id,
            entropy=entropy,
        )
        return encode_invite_token(self._invite_secret, token)

    def decode_invite_token(self, token: str) -> InviteToken:
        return decode_invite_token(self._invite_secret, token)
