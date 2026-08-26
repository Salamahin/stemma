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
        self, users: UserService, sessions: SessionRepo, verifier: TokenVerifier | None = None
    ) -> None:
        # `verifier` is only needed for `login` (cookie/Google id-token exchange). The MCP
        # surface authenticates through the OAuth flow and omits it.
        self._verifier = verifier
        self._users = users
        self._sessions = sessions

    def login(self, id_token: str) -> AuthOutcome:
        assert self._verifier is not None, "login requires a token verifier"
        return self.begin_session(self._verifier.email_from(id_token))

    def begin_session(self, email: str) -> AuthOutcome:
        """Provision a user + session for an already-verified email.

        Used by the cookie login (`login`) and by the MCP OAuth callback, which
        verifies the email through a Google authorization-code round-trip instead.
        """
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
