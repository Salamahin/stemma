from dataclasses import dataclass

from stemma.apps.auth import TokenVerifier
from stemma.domain.user import User
from stemma.services.sessions import Session, SessionRepo
from stemma.services.user_service import UserService


@dataclass(frozen=True)
class AuthOutcome:
    session: Session
    user: User


class AuthService:
    def __init__(
        self, verifier: TokenVerifier, users: UserService, sessions: SessionRepo
    ) -> None:
        self._verifier = verifier
        self._users = users
        self._sessions = sessions

    def login(self, id_token: str) -> AuthOutcome:
        email = self._verifier.email_from(id_token)
        user = self._users.get_or_create_user(email)
        session = self._sessions.create(user.user_id, email)
        return AuthOutcome(session=session, user=user)

    def logout(self, sid: str) -> None:
        self._sessions.delete(sid)

    def resolve(self, sid: str) -> AuthOutcome | None:
        session = self._sessions.get(sid)
        if session is None:
            return None
        session = self._sessions.touch(session)
        user = self._users.get_or_create_user(session.email)
        return AuthOutcome(session=session, user=user)

    def revoke_all_for_user(self, user_id: str) -> int:
        return self._sessions.delete_all_for_user(user_id)
