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


def _list_payload(my_name: str = "My Stemma", kings_name: str = "European Kings") -> dict:
    return {
        "type": "ListDescribeStemmasRequest",
        "defaultStemmaName": my_name,
        "kingsOfEuropeStemmaName": kings_name,
    }


def test_first_login_seeds_my_stemma_and_european_kings(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    response = client.post(
        "/stemma",
        headers={"Authorization": "Bearer user@example.com"},
        json=_list_payload("My Stemma", "European Kings"),
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "OwnedStemmas"
    names = [s["name"] for s in body["stemmas"]]
    assert sorted(names) == ["European Kings", "My Stemma"]
    assert body["stemmas"][0]["name"] == "European Kings"
    assert body["defaultStemmaId"] == body["stemmas"][0]["id"]
    assert len(body["firstStemma"]["people"]) > 0


def test_second_login_does_not_reseed(storage: StorageService, users: UserService) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    first = client.post("/stemma", headers=headers, json=_list_payload()).json()
    first_ids = sorted(s["id"] for s in first["stemmas"])
    second = client.post("/stemma", headers=headers, json=_list_payload("Ignored", "Ignored")).json()
    second_ids = sorted(s["id"] for s in second["stemmas"])
    assert first_ids == second_ids
    assert {s["name"] for s in second["stemmas"]} == {"My Stemma", "European Kings"}


def test_deleted_everything_user_is_not_reseeded(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    seeded = client.post("/stemma", headers=headers, json=_list_payload()).json()
    for s in seeded["stemmas"]:
        client.post(
            "/stemma",
            headers=headers,
            json={"type": "DeleteStemmaRequest", "stemmaId": s["id"]},
        )
    re_listed = client.post("/stemma", headers=headers, json=_list_payload()).json()
    assert re_listed["stemmas"] == []
    assert re_listed["firstStemma"] is None


def test_default_stemma_listed_first_even_when_renamed(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    listed = client.post("/stemma", headers=headers, json=_list_payload()).json()
    kings_id = listed["defaultStemmaId"]

    client.post(
        "/stemma",
        headers=headers,
        json={"type": "RenameStemmaRequest", "stemmaId": kings_id, "newName": "Royals"},
    )
    re_listed = client.post("/stemma", headers=headers, json=_list_payload()).json()
    assert re_listed["stemmas"][0]["id"] == kings_id
    assert re_listed["stemmas"][0]["name"] == "Royals"
    assert re_listed["defaultStemmaId"] == kings_id


def test_create_family_returns_stemma_with_family_and_people(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    listed = client.post("/stemma", headers=headers, json=_list_payload()).json()
    stemma_id = next(s["id"] for s in listed["stemmas"] if s["name"] == "My Stemma")

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


def test_rename_stemma_updates_only_callers_display_name(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    headers = {"Authorization": "Bearer user@example.com"}
    listed = client.post("/stemma", headers=headers, json=_list_payload()).json()
    stemma_id = next(s["id"] for s in listed["stemmas"] if s["name"] == "My Stemma")

    response = client.post(
        "/stemma",
        headers=headers,
        json={"type": "RenameStemmaRequest", "stemmaId": stemma_id, "newName": "My label"},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "StemmaDescription"
    assert body["name"] == "My label"

    re_listed = client.post("/stemma", headers=headers, json=_list_payload()).json()
    renamed = next(s for s in re_listed["stemmas"] if s["id"] == stemma_id)
    assert renamed["name"] == "My label"


def test_missing_authorization_header_returns_401(
    storage: StorageService, users: UserService
) -> None:
    client = _client(storage, users)
    response = client.post("/stemma", json=_list_payload())
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
