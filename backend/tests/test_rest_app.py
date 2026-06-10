from fastapi.testclient import TestClient

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import AllowAnyTokenVerifier
from stemma.apps.dispatch import CookieConfig
from stemma.apps.rest_app import build_app
from stemma.services.auth_service import AuthService
from stemma.services.sessions import SessionRepo
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

ALLOWED_ORIGIN = "https://stemma.example"


def _client(storage: StorageService, users: UserService, dynamo_table) -> TestClient:
    handler = RequestHandler(storage, users)
    auth = AuthService(
        verifier=AllowAnyTokenVerifier(), users=users, sessions=SessionRepo(dynamo_table)
    )
    app = build_app(
        handler,
        auth,
        allowed_origins={ALLOWED_ORIGIN},
        cookie_config=CookieConfig(secure=False),
        request_delay_seconds=0,
    )
    return TestClient(app)


def _login(client: TestClient, email: str = "user@example.com") -> None:
    response = client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json={"type": "AuthLoginRequest", "idToken": email},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "AuthLoginResponse"
    assert body["email"] == email
    assert "stemma_session" in client.cookies


def _list_payload(my_name: str = "My Stemma", kings_name: str = "European Kings") -> dict:
    return {
        "type": "ListDescribeStemmasRequest",
        "defaultStemmaName": my_name,
        "kingsOfEuropeStemmaName": kings_name,
    }


def test_first_login_seeds_my_stemma_and_european_kings(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    response = client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json=_list_payload("My Stemma", "European Kings"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "OwnedStemmas"
    names = [s["name"] for s in body["stemmas"]]
    assert sorted(names) == ["European Kings", "My Stemma"]


def test_second_login_does_not_reseed(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    first = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    first_ids = sorted(s["id"] for s in first["stemmas"])
    second = client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json=_list_payload("Ignored", "Ignored"),
    ).json()
    second_ids = sorted(s["id"] for s in second["stemmas"])
    assert first_ids == second_ids


def test_missing_cookie_returns_401(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    response = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    )
    assert response.status_code == 401


def test_foreign_origin_blocked(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    response = client.post(
        "/stemma",
        headers={"Origin": "https://attacker.example"},
        json={"type": "AuthLoginRequest", "idToken": "user@example.com"},
    )
    assert response.status_code == 403


def test_logout_clears_cookie_and_invalidates_session(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    logout = client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json={"type": "AuthLogoutRequest"},
    )
    assert logout.status_code == 200
    assert logout.json()["type"] == "AuthLogoutResponse"
    # TestClient persists cookies; clear it to simulate browser receiving Max-Age=0.
    client.cookies.clear()
    follow = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    )
    assert follow.status_code == 401


def test_malformed_request_body_returns_deserialization_error(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    response = client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json={"type": "UnknownRequest"},
    )
    assert response.status_code == 200
    assert response.json()["type"] == "RequestDeserializationProblem"


def test_warmup_does_not_require_auth(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    response = client.get("/warmup")
    assert response.status_code == 200
    assert response.json() == {"ok": True}


def test_missing_origin_blocked_when_origins_configured(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    response = client.post(
        "/stemma",
        json={"type": "AuthLoginRequest", "idToken": "user@example.com"},
    )
    assert response.status_code == 403
