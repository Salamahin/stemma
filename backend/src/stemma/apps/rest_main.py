import logging
import os

import uvicorn

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import AllowAnyTokenVerifier, GoogleTokenVerifier, TokenVerifier
from stemma.apps.bootstrap import dynamo_table_from_env, photo_store_from_env
from stemma.apps.dispatch import allowed_origins_from_env, cookie_config_from_env
from stemma.apps.rest_app import DEFAULT_REQUEST_DELAY_SECONDS, build_app
from stemma.services.auth_service import AuthService
from stemma.services.sessions import SessionRepo
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

logger = logging.getLogger(__name__)


def build_verifier() -> TokenVerifier:
    if os.environ.get("E2E_AUTH_BYPASS") == "1":
        logger.warning("E2E_AUTH_BYPASS active — accepting any token. Never enable in production.")
        return AllowAnyTokenVerifier()
    return GoogleTokenVerifier(os.environ["GOOGLE_CLIENT_ID"])


def main() -> None:
    logging.basicConfig(level=logging.INFO)
    table = dynamo_table_from_env()
    photo_store = photo_store_from_env()
    storage = StorageService(table, photo_store=photo_store)
    users = UserService(storage, os.environ["INVITE_SECRET"])
    handler = RequestHandler(storage, users, photo_store=photo_store)
    sessions = SessionRepo(table)
    auth = AuthService(verifier=build_verifier(), users=users, sessions=sessions)
    delay = float(os.environ.get("STEMMA_REQUEST_DELAY_SECONDS", DEFAULT_REQUEST_DELAY_SECONDS))
    app = build_app(
        handler,
        auth,
        allowed_origins=allowed_origins_from_env(),
        cookie_config=cookie_config_from_env(secure_default="0"),
        request_delay_seconds=delay,
    )
    uvicorn.run(app, host="0.0.0.0", port=8090)


if __name__ == "__main__":
    main()
