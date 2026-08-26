"""DynamoDB persistence for the MCP OAuth authorization server.

Mirrors `SessionRepo`: a thin boundary over the shared single table that mints ids +
TTLs itself (the pure logic in `oauth_service.py` stays free of clock and entropy).
Registered clients are durable; pending flows and issued codes carry a DynamoDB `ttl`
attribute so half-finished logins evict themselves. Authorization codes are one-time —
`take_code` reads and deletes in one step.
"""

import secrets
import time
from typing import Any

from stemma.services.oauth_service import AuthCode, OAuthClient, PendingFlow
from stemma.storage.schema import (
    ATTR_TTL,
    SK_META,
    oauth_client_pk,
    oauth_code_pk,
    oauth_flow_pk,
)

FLOW_TTL_SECONDS = 10 * 60
CODE_TTL_SECONDS = 5 * 60


class OAuthRepo:
    def __init__(self, table: Any) -> None:
        self._table = table

    def register_client(
        self, redirect_uris: tuple[str, ...], client_name: str | None
    ) -> OAuthClient:
        client_id = secrets.token_urlsafe(24)
        self._table.put_item(
            Item={
                "pk": oauth_client_pk(client_id),
                "sk": SK_META,
                "redirect_uris": list(redirect_uris),
                "client_name": client_name,
            }
        )
        return OAuthClient(client_id=client_id, redirect_uris=redirect_uris, client_name=client_name)

    def get_client(self, client_id: str) -> OAuthClient | None:
        item = self._table.get_item(Key={"pk": oauth_client_pk(client_id), "sk": SK_META}).get("Item")
        if item is None:
            return None
        return OAuthClient(
            client_id=client_id,
            redirect_uris=tuple(item["redirect_uris"]),
            client_name=item.get("client_name"),
        )

    def create_flow(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        code_challenge: str,
        client_state: str | None,
        now: int | None = None,
    ) -> PendingFlow:
        now = int(now if now is not None else time.time())
        flow_id = secrets.token_urlsafe(24)
        self._table.put_item(
            Item={
                "pk": oauth_flow_pk(flow_id),
                "sk": SK_META,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "code_challenge": code_challenge,
                "client_state": client_state,
                ATTR_TTL: now + FLOW_TTL_SECONDS,
            }
        )
        return PendingFlow(
            flow_id=flow_id,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge=code_challenge,
            client_state=client_state,
        )

    def take_flow(self, flow_id: str, now: int | None = None) -> PendingFlow | None:
        now = int(now if now is not None else time.time())
        item = self._table.get_item(Key={"pk": oauth_flow_pk(flow_id), "sk": SK_META}).get("Item")
        self._table.delete_item(Key={"pk": oauth_flow_pk(flow_id), "sk": SK_META})
        if item is None or int(item.get(ATTR_TTL, 0)) <= now:
            return None
        return PendingFlow(
            flow_id=flow_id,
            client_id=item["client_id"],
            redirect_uri=item["redirect_uri"],
            code_challenge=item["code_challenge"],
            client_state=item.get("client_state"),
        )

    def create_code(
        self,
        *,
        client_id: str,
        redirect_uri: str,
        code_challenge: str,
        session_id: str,
        now: int | None = None,
    ) -> AuthCode:
        now = int(now if now is not None else time.time())
        code = secrets.token_urlsafe(24)
        self._table.put_item(
            Item={
                "pk": oauth_code_pk(code),
                "sk": SK_META,
                "client_id": client_id,
                "redirect_uri": redirect_uri,
                "code_challenge": code_challenge,
                "session_id": session_id,
                ATTR_TTL: now + CODE_TTL_SECONDS,
            }
        )
        return AuthCode(
            code=code,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_challenge=code_challenge,
            session_id=session_id,
        )

    def take_code(self, code: str, now: int | None = None) -> AuthCode | None:
        now = int(now if now is not None else time.time())
        item = self._table.get_item(Key={"pk": oauth_code_pk(code), "sk": SK_META}).get("Item")
        self._table.delete_item(Key={"pk": oauth_code_pk(code), "sk": SK_META})
        if item is None or int(item.get(ATTR_TTL, 0)) <= now:
            return None
        return AuthCode(
            code=code,
            client_id=item["client_id"],
            redirect_uri=item["redirect_uri"],
            code_challenge=item["code_challenge"],
            session_id=item["session_id"],
        )
