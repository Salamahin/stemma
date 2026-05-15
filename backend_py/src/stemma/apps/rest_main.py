import logging
import os

import uvicorn

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import AllowAnyTokenVerifier, GoogleTokenVerifier, TokenVerifier
from stemma.apps.bootstrap import engine_from_env, migrations_dir
from stemma.apps.rest_app import build_app
from stemma.services.user_service import UserService
from stemma.storage.migrations import run_migrations
from stemma.storage.storage_service import StorageService

logger = logging.getLogger(__name__)


def build_verifier() -> TokenVerifier:
    if os.environ.get("E2E_AUTH_BYPASS") == "1":
        return AllowAnyTokenVerifier()
    return GoogleTokenVerifier(os.environ["GOOGLE_CLIENT_ID"])


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    engine = engine_from_env()
    run_migrations(engine, migrations_dir())

    storage = StorageService(engine)
    users = UserService(storage, os.environ["INVITE_SECRET"])
    handler = RequestHandler(storage, users)
    app = build_app(handler, build_verifier(), users)
    uvicorn.run(app, host="0.0.0.0", port=8090)


if __name__ == "__main__":
    main()
