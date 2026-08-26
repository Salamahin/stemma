"""Pure OAuth 2.1 authorization-server logic: OAuth records, PKCE verification, discovery
metadata, and request validation (raising `OAuthError`). No I/O, clock, or entropy —
those live in `services/oauth_repo.py`; the Google round-trip in `apps/mcp_identity.py`.
"""

import base64
import hashlib
import secrets
from dataclasses import dataclass

OAUTH_SCOPE = "stemma"


@dataclass(frozen=True)
class OAuthClient:
    client_id: str
    redirect_uris: tuple[str, ...]
    client_name: str | None = None


@dataclass(frozen=True)
class PendingFlow:
    flow_id: str
    client_id: str
    redirect_uri: str
    code_challenge: str
    client_state: str | None


@dataclass(frozen=True)
class AuthCode:
    code: str
    client_id: str
    redirect_uri: str
    code_challenge: str
    session_id: str


class OAuthError(Exception):
    """An OAuth protocol error. `error` is the RFC 6749 code; `status` the HTTP code."""

    def __init__(self, error: str, description: str, *, status: int = 400) -> None:
        super().__init__(f"{error}: {description}")
        self.error = error
        self.description = description
        self.status = status


def verify_pkce_s256(code_verifier: str, code_challenge: str) -> bool:
    digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode("ascii")
    return secrets.compare_digest(expected, code_challenge)


def authorization_server_metadata(issuer: str) -> dict:
    return {
        "issuer": issuer,
        "authorization_endpoint": f"{issuer}/authorize",
        "token_endpoint": f"{issuer}/token",
        "registration_endpoint": f"{issuer}/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": [OAUTH_SCOPE],
    }


def protected_resource_metadata(resource: str, issuer: str) -> dict:
    return {
        "resource": resource,
        "authorization_servers": [issuer],
        "scopes_supported": [OAUTH_SCOPE],
        "bearer_methods_supported": ["header"],
    }


def validate_redirect_uris(redirect_uris: list[str]) -> tuple[str, ...]:
    if not redirect_uris:
        raise OAuthError("invalid_client_metadata", "redirect_uris must not be empty")
    for uri in redirect_uris:
        if not uri.startswith(("http://", "https://")):
            raise OAuthError("invalid_client_metadata", f"unsupported redirect_uri scheme: {uri}")
    return tuple(redirect_uris)


def validate_authorization_request(
    client: OAuthClient | None,
    *,
    client_id: str,
    redirect_uri: str,
    response_type: str,
    code_challenge: str,
    code_challenge_method: str,
) -> OAuthClient:
    if client is None or client.client_id != client_id:
        raise OAuthError("unauthorized_client", "unknown client_id")
    if redirect_uri not in client.redirect_uris:
        raise OAuthError("invalid_request", "redirect_uri not registered for this client")
    if response_type != "code":
        raise OAuthError("unsupported_response_type", "only response_type=code is supported")
    if code_challenge_method != "S256":
        raise OAuthError("invalid_request", "only code_challenge_method=S256 is supported")
    if not code_challenge:
        raise OAuthError("invalid_request", "code_challenge is required (PKCE)")
    return client


def validate_token_request(
    code: AuthCode | None,
    *,
    client_id: str,
    redirect_uri: str,
    code_verifier: str,
) -> AuthCode:
    if code is None:
        raise OAuthError("invalid_grant", "authorization code is invalid or expired")
    if code.client_id != client_id:
        raise OAuthError("invalid_grant", "authorization code was issued to another client")
    if code.redirect_uri != redirect_uri:
        raise OAuthError("invalid_grant", "redirect_uri does not match the authorization request")
    if not code_verifier or not verify_pkce_s256(code_verifier, code.code_challenge):
        raise OAuthError("invalid_grant", "PKCE verification failed")
    return code
