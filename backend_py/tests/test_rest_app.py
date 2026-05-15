from fastapi.testclient import TestClient

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import AllowAnyTokenVerifier
from stemma.apps.rest_app import build_app
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService


def _client(storage: StorageService, users: UserService) -> TestClient:
    handler = RequestHandler(storage, users)
    app = build_app(handler, AllowAnyTokenVerifier(), users, request_delay_seconds=0)
    return TestClient(app)


def test_first_request_creates_default_stemma(storage: StorageService, users: UserService) -> None:
    client = _client(storage, users)
    response = client.post(
        "/stemma",
        headers={"Authorization": "Bearer user@example.com"},
        json={"ListDescribeStemmasRequest": {"defaultStemmaName": "My Tree"}},
    )
    assert response.status_code == 200
    body = response.json()
    assert "OwnedStemmas" in body
    payload = body["OwnedStemmas"]
    assert len(payload["stemmas"]) == 1
    assert payload["stemmas"][0]["name"] == "My Tree"
    assert payload["stemmas"][0]["removable"] is True


def test_create_family_returns_stemma_with_family_and_people(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    listed = client.post(
        "/stemma",
        headers=headers,
        json={"ListDescribeStemmasRequest": {"defaultStemmaName": "Tree"}},
    ).json()
    stemma_id = listed["OwnedStemmas"]["stemmas"][0]["id"]

    response = client.post(
        "/stemma",
        headers=headers,
        json={
            "CreateFamilyRequest": {
                "stemmaId": stemma_id,
                "familyDescr": {
                    "parent1": {"CreateNewPerson": {"name": "Jane"}},
                    "parent2": {"CreateNewPerson": {"name": "John", "birthDate": "1900-01-01"}},
                    "children": [{"CreateNewPerson": {"name": "Josh"}}],
                },
            }
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert "Stemma" in body
    names = sorted(p["name"] for p in body["Stemma"]["people"])
    assert names == ["Jane", "John", "Josh"]


def test_missing_authorization_header_returns_401(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    response = client.post(
        "/stemma",
        json={"ListDescribeStemmasRequest": {"defaultStemmaName": "Tree"}},
    )
    assert response.status_code == 401


def test_malformed_request_body_returns_deserialization_error(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    response = client.post(
        "/stemma",
        headers={"Authorization": "Bearer user@example.com"},
        json={"UnknownRequest": {}},
    )
    assert response.status_code == 200
    assert "RequestDeserializationProblem" in response.json()
