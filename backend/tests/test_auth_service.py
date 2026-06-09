import pytest

from stemma.apps.auth import AllowAnyTokenVerifier
from stemma.services.auth_service import AuthService
from stemma.services.sessions import SessionRepo
from stemma.services.user_service import UserService


@pytest.fixture
def auth_service(dynamo_table, users: UserService) -> AuthService:
    return AuthService(
        verifier=AllowAnyTokenVerifier(), users=users, sessions=SessionRepo(dynamo_table)
    )


def test_login_creates_user_and_session(auth_service: AuthService) -> None:
    outcome = auth_service.login("alice@example.com")
    assert outcome.user.email == "alice@example.com"
    assert outcome.session.user_id == outcome.user.user_id
    resolved = auth_service.resolve(outcome.session.sid)
    assert resolved is not None
    assert resolved.user.user_id == outcome.user.user_id


def test_login_reuses_existing_user(auth_service: AuthService) -> None:
    a = auth_service.login("alice@example.com")
    b = auth_service.login("alice@example.com")
    assert a.user.user_id == b.user.user_id
    assert a.session.sid != b.session.sid


def test_resolve_returns_none_for_unknown_sid(auth_service: AuthService) -> None:
    assert auth_service.resolve("does-not-exist") is None


def test_logout_invalidates_session(auth_service: AuthService) -> None:
    outcome = auth_service.login("alice@example.com")
    auth_service.logout(outcome.session.sid)
    assert auth_service.resolve(outcome.session.sid) is None


def test_revoke_all_clears_every_session_for_user(auth_service: AuthService) -> None:
    a = auth_service.login("alice@example.com")
    b = auth_service.login("alice@example.com")
    c = auth_service.login("bob@example.com")
    removed = auth_service.revoke_all_for_user(a.user.user_id)
    assert removed == 2
    assert auth_service.resolve(a.session.sid) is None
    assert auth_service.resolve(b.session.sid) is None
    assert auth_service.resolve(c.session.sid) is not None
