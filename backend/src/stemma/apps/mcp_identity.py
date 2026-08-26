"""User authentication for the MCP OAuth flow (a transport boundary).

The MCP authorization server does not check passwords itself — it federates the login
to Google. `IdentityProvider` is the seam: `authorization_url` is where we send the
browser, `fetch_email` turns Google's callback into a verified email. `GoogleIdentity`
runs the real authorization-code exchange; `BypassIdentity` short-circuits it for local
dev / e2e (mirroring `AllowAnyTokenVerifier` + `E2E_AUTH_BYPASS` on the REST server).
"""

import logging
import os
from collections.abc import Mapping
from typing import Protocol
from urllib.parse import urlencode

import requests

from stemma.apps.auth import GoogleTokenVerifier
from stemma.services.oauth_service import OAuthError

logger = logging.getLogger(__name__)

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_TOKEN_TIMEOUT_SECONDS = 10


class IdentityProvider(Protocol):
    def authorization_url(self, *, state: str, redirect_uri: str) -> str: ...

    def fetch_email(self, *, params: Mapping[str, str], redirect_uri: str) -> str: ...


class GoogleIdentity:
    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._verifier = GoogleTokenVerifier(client_id)

    def authorization_url(self, *, state: str, redirect_uri: str) -> str:
        query = urlencode(
            {
                "client_id": self._client_id,
                "redirect_uri": redirect_uri,
                "response_type": "code",
                "scope": "openid email",
                "state": state,
                "access_type": "online",
                "prompt": "select_account",
            }
        )
        return f"{GOOGLE_AUTH_ENDPOINT}?{query}"

    def fetch_email(self, *, params: Mapping[str, str], redirect_uri: str) -> str:
        code = params.get("code")
        if not code:
            raise OAuthError("access_denied", params.get("error", "no authorization code returned"))
        response = requests.post(
            GOOGLE_TOKEN_ENDPOINT,
            data={
                "code": code,
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=GOOGLE_TOKEN_TIMEOUT_SECONDS,
        )
        if response.status_code != 200:
            logger.warning("google token exchange failed: %s", response.text)
            raise OAuthError("access_denied", "google token exchange failed")
        id_token = response.json().get("id_token")
        if not id_token:
            raise OAuthError("access_denied", "google response had no id_token")
        return self._verifier.email_from(id_token)


class BypassIdentity:
    """Skips Google entirely: the browser bounces straight back to our callback.

    Used only when `STEMMA_MCP_AUTH_BYPASS=1`. The email is taken from the `code`
    query param when present (so e2e can drive any user) else a fixed dev email.
    """

    def __init__(self, default_email: str) -> None:
        self._default_email = default_email

    def authorization_url(self, *, state: str, redirect_uri: str) -> str:
        query = urlencode({"code": self._default_email, "state": state})
        return f"{redirect_uri}?{query}"

    def fetch_email(self, *, params: Mapping[str, str], redirect_uri: str) -> str:
        return params.get("code") or self._default_email


def identity_provider_from_env() -> IdentityProvider:
    if os.environ.get("STEMMA_MCP_AUTH_BYPASS") == "1":
        email = os.environ.get("STEMMA_MCP_BYPASS_EMAIL", "mcp-dev@stemma.local")
        logger.warning("STEMMA_MCP_AUTH_BYPASS active — MCP login skips Google. Never enable in production.")
        return BypassIdentity(email)
    return GoogleIdentity(os.environ["GOOGLE_CLIENT_ID"], os.environ["GOOGLE_OAUTH_CLIENT_SECRET"])
