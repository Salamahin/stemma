import hashlib
from typing import Protocol

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token


class TokenVerifier(Protocol):
    def email_from(self, token: str) -> str: ...


class AllowAnyTokenVerifier:
    def email_from(self, token: str) -> str:
        normalized = token.strip().lower()
        if "@" in normalized:
            return normalized
        digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:12]
        return f"e2e-{digest}@stemma.local"


class GoogleTokenVerifier:
    def __init__(self, client_id: str) -> None:
        self._audience = client_id
        self._request = google_requests.Request()

    def email_from(self, token: str) -> str:
        info = id_token.verify_oauth2_token(token, self._request, self._audience)
        return info["email"]
