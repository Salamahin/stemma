import logging

import pytest
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


def _favourite(client: TestClient, stemma_id: str | None) -> dict:
    return client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json={"type": "SetFavouriteStemmaRequest", "stemmaId": stemma_id},
    ).json()


def test_favourite_stemma_is_listed_first_and_returned_as_first_stemma(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    seeded = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    my_stemma = next(s for s in seeded["stemmas"] if s["name"] == "My Stemma")

    marked = _favourite(client, my_stemma["id"])
    assert marked == {"type": "FavouriteStemma", "stemmaId": my_stemma["id"]}

    listed = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    assert listed["favouriteStemmaId"] == my_stemma["id"]
    assert listed["stemmas"][0]["id"] == my_stemma["id"]


def test_favourite_stemma_can_be_cleared(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    seeded = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    my_stemma = next(s for s in seeded["stemmas"] if s["name"] == "My Stemma")
    _favourite(client, my_stemma["id"])

    assert _favourite(client, None) == {"type": "FavouriteStemma", "stemmaId": None}

    listed = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    assert listed["favouriteStemmaId"] is None
    # falls back to the seeded default (European Kings)
    assert listed["stemmas"][0]["name"] == "European Kings"


def test_favourite_stemma_of_a_foreign_stemma_is_denied(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client, "owner@example.com")
    seeded = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    foreign_id = seeded["stemmas"][0]["id"]

    client.cookies.clear()
    _login(client, "intruder@example.com")
    assert _favourite(client, foreign_id)["type"] == "AccessToStemmaDenied"


def test_deleting_the_favourite_stemma_clears_the_mark(
    storage: StorageService, users: UserService, dynamo_table
) -> None:
    client = _client(storage, users, dynamo_table)
    _login(client)
    seeded = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    my_stemma = next(s for s in seeded["stemmas"] if s["name"] == "My Stemma")
    _favourite(client, my_stemma["id"])

    deleted = client.post(
        "/stemma",
        headers={"Origin": ALLOWED_ORIGIN},
        json={"type": "DeleteStemmaRequest", "stemmaId": my_stemma["id"]},
    ).json()
    assert deleted["favouriteStemmaId"] is None

    listed = client.post(
        "/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload()
    ).json()
    assert listed["favouriteStemmaId"] is None


def _usage(caplog: pytest.LogCaptureFixture) -> list[tuple[str, str, str]]:
    return [
        (r.transport, r.email, r.action)  # type: ignore[attr-defined]
        for r in caplog.records
        if r.name == "stemma.usage"
    ]


def test_authenticated_requests_are_logged_with_user_email(
    storage: StorageService, users: UserService, dynamo_table, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="stemma.usage")
    client = _client(storage, users, dynamo_table)
    _login(client, "bob@example.com")
    client.post("/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload())

    assert _usage(caplog) == [
        ("api", "bob@example.com", "AuthLoginRequest"),
        ("api", "bob@example.com", "ListDescribeStemmasRequest"),
    ]


def test_unauthenticated_requests_are_not_logged(
    storage: StorageService, users: UserService, dynamo_table, caplog: pytest.LogCaptureFixture
) -> None:
    caplog.set_level(logging.INFO, logger="stemma.usage")
    client = _client(storage, users, dynamo_table)
    response = client.post("/stemma", headers={"Origin": ALLOWED_ORIGIN}, json=_list_payload())

    assert response.status_code == 401
    assert _usage(caplog) == []
