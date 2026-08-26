import base64
import hashlib

import pytest

from stemma.services.oauth_service import (
    OAUTH_SCOPE,
    AuthCode,
    OAuthClient,
    OAuthError,
    authorization_server_metadata,
    protected_resource_metadata,
    validate_authorization_request,
    validate_redirect_uris,
    validate_token_request,
    verify_pkce_s256,
)


def _challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")


def test_verify_pkce_accepts_matching_verifier() -> None:
    verifier = "a-long-enough-code-verifier-string-1234567890"
    assert verify_pkce_s256(verifier, _challenge(verifier))


def test_verify_pkce_rejects_wrong_verifier() -> None:
    assert not verify_pkce_s256("wrong", _challenge("right-verifier-value-1234567890"))


def test_metadata_advertises_pkce_and_scope() -> None:
    meta = authorization_server_metadata("https://mcp.test")
    assert meta["authorization_endpoint"] == "https://mcp.test/authorize"
    assert meta["token_endpoint"] == "https://mcp.test/token"
    assert meta["code_challenge_methods_supported"] == ["S256"]
    resource_meta = protected_resource_metadata("https://mcp.test/mcp", "https://mcp.test")
    assert resource_meta["authorization_servers"] == ["https://mcp.test"]
    assert resource_meta["scopes_supported"] == [OAUTH_SCOPE]


def test_validate_redirect_uris_rejects_empty() -> None:
    with pytest.raises(OAuthError):
        validate_redirect_uris([])


def test_validate_redirect_uris_rejects_non_http_scheme() -> None:
    with pytest.raises(OAuthError):
        validate_redirect_uris(["ftp://client.test/cb"])


def _client() -> OAuthClient:
    return OAuthClient(client_id="cid", redirect_uris=("https://client.test/cb",))


def test_validate_authorization_request_rejects_unknown_client() -> None:
    with pytest.raises(OAuthError, match="unknown client_id"):
        validate_authorization_request(
            None,
            client_id="cid",
            redirect_uri="https://client.test/cb",
            response_type="code",
            code_challenge="c",
            code_challenge_method="S256",
        )


def test_validate_authorization_request_rejects_unregistered_redirect() -> None:
    with pytest.raises(OAuthError, match="redirect_uri"):
        validate_authorization_request(
            _client(),
            client_id="cid",
            redirect_uri="https://evil.test/cb",
            response_type="code",
            code_challenge="c",
            code_challenge_method="S256",
        )


def test_validate_authorization_request_requires_s256() -> None:
    with pytest.raises(OAuthError, match="S256"):
        validate_authorization_request(
            _client(),
            client_id="cid",
            redirect_uri="https://client.test/cb",
            response_type="code",
            code_challenge="c",
            code_challenge_method="plain",
        )


def _code(challenge: str) -> AuthCode:
    return AuthCode(
        code="code123",
        client_id="cid",
        redirect_uri="https://client.test/cb",
        code_challenge=challenge,
        session_id="sid123",
    )


def test_validate_token_request_happy_path() -> None:
    verifier = "verifier-value-that-is-long-enough-000000"
    result = validate_token_request(
        _code(_challenge(verifier)),
        client_id="cid",
        redirect_uri="https://client.test/cb",
        code_verifier=verifier,
    )
    assert result.session_id == "sid123"


def test_validate_token_request_rejects_bad_pkce() -> None:
    with pytest.raises(OAuthError, match="PKCE"):
        validate_token_request(
            _code(_challenge("the-real-verifier-1234567890")),
            client_id="cid",
            redirect_uri="https://client.test/cb",
            code_verifier="not-the-verifier",
        )


def test_validate_token_request_rejects_missing_code() -> None:
    with pytest.raises(OAuthError, match="invalid or expired"):
        validate_token_request(
            None, client_id="cid", redirect_uri="https://client.test/cb", code_verifier="v"
        )
