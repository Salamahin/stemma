"""Local / self-hosted entrypoint for the Stemma MCP server (Uvicorn on :8091).

Wires the same `StorageService` / `UserService` / `RequestHandler` the REST server uses,
plus the OAuth repo and identity provider, into the MCP app. Run behind a TLS-terminating
reverse proxy for a public deployment; set `STEMMA_MCP_ISSUER` to the public base URL so
the OAuth discovery documents advertise the right endpoints.
"""

import logging
import os

import uvicorn

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import AllowAnyTokenVerifier
from stemma.apps.bootstrap import dynamo_table_from_env, photo_store_from_env
from stemma.apps.mcp_app import build_mcp_app
from stemma.apps.mcp_identity import identity_provider_from_env
from stemma.services.auth_service import AuthService
from stemma.services.oauth_repo import OAuthRepo
from stemma.services.sessions import SessionRepo
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

logger = logging.getLogger(__name__)

MCP_PORT = 8091


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    table = dynamo_table_from_env()
    photo_store = photo_store_from_env()
    storage = StorageService(table, photo_store=photo_store)
    users = UserService(storage, os.environ["INVITE_SECRET"])
    handler = RequestHandler(storage, users, photo_store=photo_store)
    # The MCP surface authenticates through the OAuth/Google flow, never `AuthService.login`,
    # so the token verifier is never exercised here.
    auth = AuthService(verifier=AllowAnyTokenVerifier(), users=users, sessions=SessionRepo(table))
    app = build_mcp_app(
        handler,
        auth,
        OAuthRepo(table),
        identity_provider_from_env(),
        issuer_override=os.environ.get("STEMMA_MCP_ISSUER"),
    )
    uvicorn.run(app, host="0.0.0.0", port=MCP_PORT)


if __name__ == "__main__":
    main()
