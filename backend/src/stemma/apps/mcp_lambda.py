"""AWS Lambda entrypoint for the MCP server (API Gateway HTTP API via Mangum).

The MCP app has many routes, so it is wrapped by Mangum (ASGI→Lambda) rather than
hand-decoded like `lambda_main`. `_asgi()` is `@cache`d to reuse the boto3 Table handle
and Secrets Manager lookup across warm invocations. `GOOGLE_OAUTH_CLIENT_SECRET` rides the
`prod/invite` Secrets Manager payload (`bootstrap.populate_env_from_secrets`), never the template.
"""

import os
from functools import cache

from mangum import Mangum

from stemma.apis.request_handler import RequestHandler
from stemma.apps.bootstrap import dynamo_table_from_env, photo_store_from_env, populate_env_from_secrets
from stemma.apps.mcp_app import build_mcp_app
from stemma.apps.mcp_identity import identity_provider_from_env
from stemma.services.auth_service import AuthService
from stemma.services.oauth_repo import OAuthRepo
from stemma.services.sessions import SessionRepo
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService


@cache
def _asgi() -> Mangum:
    populate_env_from_secrets()
    table = dynamo_table_from_env()
    photo_store = photo_store_from_env()
    storage = StorageService(table, photo_store=photo_store)
    users = UserService(storage, os.environ["INVITE_SECRET"])
    handler = RequestHandler(storage, users, photo_store=photo_store)
    auth = AuthService(users=users, sessions=SessionRepo(table))
    app = build_mcp_app(
        handler,
        auth,
        OAuthRepo(table),
        identity_provider_from_env(),
        issuer_override=os.environ["STEMMA_MCP_ISSUER"],
    )
    return Mangum(app, lifespan="off")


def lambda_handler(event: dict, context: object) -> dict:
    return _asgi()(event, context)  # pyright: ignore[reportArgumentType]  # Mangum wants LambdaContext
