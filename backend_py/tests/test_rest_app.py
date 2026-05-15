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
        json={"type": "ListDescribeStemmasRequest", "defaultStemmaName": "My Tree"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "OwnedStemmas"
    assert len(body["stemmas"]) == 1
    assert body["stemmas"][0]["name"] == "My Tree"
    assert body["stemmas"][0]["removable"] is True


def test_create_family_returns_stemma_with_family_and_people(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    listed = client.post(
        "/stemma",
        headers=headers,
        json={"type": "ListDescribeStemmasRequest", "defaultStemmaName": "Tree"},
    ).json()
    stemma_id = listed["stemmas"][0]["id"]

    response = client.post(
        "/stemma",
        headers=headers,
        json={
            "type": "CreateFamilyRequest",
            "stemmaId": stemma_id,
            "familyDescr": {
                "parent1": {"type": "CreateNewPerson", "name": "Jane"},
                "parent2": {"type": "CreateNewPerson", "name": "John", "birthDate": "1900-01-01"},
                "children": [{"type": "CreateNewPerson", "name": "Josh"}],
            },
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "Stemma"
    names = sorted(p["name"] for p in body["people"])
    assert names == ["Jane", "John", "Josh"]


def test_missing_authorization_header_returns_401(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    response = client.post(
        "/stemma",
        json={"type": "ListDescribeStemmasRequest", "defaultStemmaName": "Tree"},
    )
    assert response.status_code == 401


def test_malformed_request_body_returns_deserialization_error(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    response = client.post(
        "/stemma",
        headers={"Authorization": "Bearer user@example.com"},
        json={"type": "UnknownRequest"},
    )
    assert response.status_code == 200
    assert response.json()["type"] == "RequestDeserializationProblem"
