import base64
import hashlib
import secrets
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import AllowAnyTokenVerifier
from stemma.apps.mcp_app import DEFAULT_PROTOCOL_VERSION, build_mcp_app
from stemma.apps.mcp_identity import BypassIdentity
from stemma.services.auth_service import AuthService
from stemma.services.oauth_repo import OAuthRepo
from stemma.services.sessions import SessionRepo
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

ISSUER = "https://mcp.test"
REDIRECT_URI = "https://client.test/callback"
USER_EMAIL = "alice@example.com"


@pytest.fixture
def client(storage: StorageService, users: UserService, dynamo_table) -> TestClient:
    handler = RequestHandler(storage, users)
    auth = AuthService(verifier=AllowAnyTokenVerifier(), users=users, sessions=SessionRepo(dynamo_table))
    app = build_mcp_app(
        handler,
        auth,
        OAuthRepo(dynamo_table),
        BypassIdentity(USER_EMAIL),
        issuer_override=ISSUER,
    )
    return TestClient(app)


def _pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return verifier, challenge


def _query(location: str) -> dict[str, str]:
    return {k: v[0] for k, v in parse_qs(urlparse(location).query).items()}


def _obtain_token(client: TestClient, *, verifier: str, challenge: str) -> str:
    registration = client.post("/register", json={"redirect_uris": [REDIRECT_URI], "client_name": "test"})
    assert registration.status_code == 201
    client_id = registration.json()["client_id"]

    authorize = client.get(
        "/authorize",
        params={
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": REDIRECT_URI,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
            "state": "client-state-xyz",
        },
        follow_redirects=False,
    )
    assert authorize.status_code == 302
    idp_params = _query(authorize.headers["location"])

    callback = client.get("/oauth/callback", params=idp_params, follow_redirects=False)
    assert callback.status_code == 302
    back = _query(callback.headers["location"])
    assert back["state"] == "client-state-xyz"

    token = client.post(
        "/token",
        data={
            "grant_type": "authorization_code",
            "code": back["code"],
            "redirect_uri": REDIRECT_URI,
            "client_id": client_id,
            "code_verifier": verifier,
        },
    )
    assert token.status_code == 200, token.text
    body = token.json()
    assert body["token_type"] == "Bearer"
    return body["access_token"]


def _rpc(client: TestClient, token: str, method: str, params: dict | None = None, msg_id: int = 1) -> dict:
    message = {"jsonrpc": "2.0", "id": msg_id, "method": method}
    if params is not None:
        message["params"] = params
    response = client.post("/mcp", headers={"Authorization": f"Bearer {token}"}, json=message)
    assert response.status_code == 200, response.text
    return response.json()


def test_discovery_documents_are_served(client: TestClient) -> None:
    auth_meta = client.get("/.well-known/oauth-authorization-server").json()
    assert auth_meta["issuer"] == ISSUER
    assert auth_meta["registration_endpoint"] == f"{ISSUER}/register"
    resource_meta = client.get("/.well-known/oauth-protected-resource").json()
    assert resource_meta["resource"] == f"{ISSUER}/mcp"


def test_mcp_requires_bearer_token(client: TestClient) -> None:
    response = client.post(
        "/mcp", json={"jsonrpc": "2.0", "id": 1, "method": "tools/list"}
    )
    assert response.status_code == 401
    assert "resource_metadata=" in response.headers["www-authenticate"]


def test_full_oauth_flow_then_list_tools(client: TestClient) -> None:
    verifier, challenge = _pkce()
    token = _obtain_token(client, verifier=verifier, challenge=challenge)

    init = _rpc(client, token, "initialize", {"protocolVersion": DEFAULT_PROTOCOL_VERSION})
    assert init["result"]["protocolVersion"] == DEFAULT_PROTOCOL_VERSION
    assert init["result"]["serverInfo"]["name"] == "stemma-mcp"

    listed = _rpc(client, token, "tools/list", msg_id=2)
    names = {tool["name"] for tool in listed["result"]["tools"]}
    assert {"list_stemmas", "create_stemma", "create_person", "link_persons"} <= names


def test_tool_call_creates_and_lists_stemmas(client: TestClient) -> None:
    verifier, challenge = _pkce()
    token = _obtain_token(client, verifier=verifier, challenge=challenge)

    listed = _rpc(
        client, token, "tools/call", {"name": "list_stemmas", "arguments": {}}
    )
    result = listed["result"]
    assert result["isError"] is False
    import json

    payload = json.loads(result["content"][0]["text"])
    assert payload["type"] == "OwnedStemmas"
    # list_stemmas must not embed the full first tree (a huge payload over MCP).
    assert "firstStemma" not in payload

    created = _rpc(
        client,
        token,
        "tools/call",
        {"name": "create_stemma", "arguments": {"name": "Ancestors"}},
        msg_id=3,
    )
    assert created["result"]["isError"] is False


def test_person_navigation_tools(client: TestClient) -> None:
    import json

    verifier, challenge = _pkce()
    token = _obtain_token(client, verifier=verifier, challenge=challenge)

    def call(name: str, args: dict) -> dict:
        reply = _rpc(client, token, "tools/call", {"name": name, "arguments": args})
        return json.loads(reply["result"]["content"][0]["text"])

    sid = call("create_stemma", {"name": "Nav"})["id"]
    call("create_person", {"stemma_id": sid, "name": "Grandpa Ivan"})
    call("create_person", {"stemma_id": sid, "name": "Dad Fedor"})

    found = call("search_people", {"stemma_id": sid, "query": "grand"})
    assert found["type"] == "PeopleSearch" and found["count"] == 1
    assert "bio" not in found["people"][0]  # search stays light
    grandpa_id = found["people"][0]["id"]
    dad_id = call("search_people", {"stemma_id": sid, "query": "dad"})["people"][0]["id"]

    call("link_persons", {"stemma_id": sid, "from_person_id": grandpa_id, "to_person_id": dad_id, "role": "child"})

    person = call("get_person", {"stemma_id": sid, "person_id": dad_id})
    assert person["type"] == "Person"
    assert [p["id"] for p in person["parents"]] == [grandpa_id]
    assert person["children"] == []

    ancestors = call("get_relatives", {"stemma_id": sid, "person_id": dad_id, "kind": "ancestors", "depth": 2})
    assert any(r["id"] == grandpa_id and r["generation"] == 1 for r in ancestors["relatives"])

    missing = call("get_person", {"stemma_id": sid, "person_id": "nope"})
    assert missing["type"] == "PersonNotFound"


def test_unknown_tool_returns_invalid_params(client: TestClient) -> None:
    verifier, challenge = _pkce()
    token = _obtain_token(client, verifier=verifier, challenge=challenge)
    reply = _rpc(client, token, "tools/call", {"name": "no_such_tool", "arguments": {}})
    assert reply["error"]["code"] == -32602


def test_token_endpoint_rejects_bad_pkce(client: TestClient) -> None:
    _verifier, challenge = _pkce()
    registration = client.post("/register", json={"redirect_uris": [REDIRECT_URI]})
    client_id = registration.json()["client_id"]
    authorize = client.get(
        "/authorize",
        params={
            "response_type": "code",
            "client_id": client_id,
            "redirect_uri": REDIRECT_URI,
            "code_challenge": challenge,
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    idp_params = _query(authorize.headers["location"])
    callback = client.get("/oauth/callback", params=idp_params, follow_redirects=False)
    code = _query(callback.headers["location"])["code"]

    token = client.post(
        "/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": REDIRECT_URI,
            "client_id": client_id,
            "code_verifier": "wrong-verifier",
        },
    )
    assert token.status_code == 400
    assert token.json()["error"] == "invalid_grant"


def test_authorize_rejects_unknown_client(client: TestClient) -> None:
    response = client.get(
        "/authorize",
        params={
            "response_type": "code",
            "client_id": "nope",
            "redirect_uri": REDIRECT_URI,
            "code_challenge": "x",
            "code_challenge_method": "S256",
        },
        follow_redirects=False,
    )
    assert response.status_code == 400
    assert response.json()["error"] == "unauthorized_client"
