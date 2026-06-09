import time

_LAMBDA_INIT_START = time.perf_counter()

import base64  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
import os  # noqa: E402
from functools import cache  # noqa: E402

from stemma.apis.request_handler import RequestHandler  # noqa: E402
from stemma.apps.auth import GoogleTokenVerifier  # noqa: E402
from stemma.apps.bootstrap import (  # noqa: E402
    dynamo_table_from_env,
    photo_store_from_env,
    populate_env_from_secrets,
)
from stemma.apps.dispatch import (  # noqa: E402
    CookieAction,
    CookieConfig,
    allowed_origins_from_env,
    build_clear_cookie_header,
    build_set_cookie_header,
    cookie_config_from_env,
    dispatch_payload,
    parse_cookie_header,
)
from stemma.services.auth_service import AuthService  # noqa: E402
from stemma.services.sessions import SessionRepo  # noqa: E402
from stemma.services.user_service import UserService  # noqa: E402
from stemma.storage.storage_service import StorageService  # noqa: E402

_IMPORTS_DONE = time.perf_counter()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@cache
def _build() -> tuple[RequestHandler, AuthService, CookieConfig, frozenset[str]]:
    # Cached so warm Lambda invocations reuse the table client + handler instead
    # of rebuilding (and rehitting Secrets Manager) on every request.
    build_start = time.perf_counter()
    populate_env_from_secrets()
    secrets_done = time.perf_counter()
    table = dynamo_table_from_env()
    table_done = time.perf_counter()
    photo_store = photo_store_from_env()
    storage = StorageService(table, photo_store=photo_store)
    users = UserService(storage, os.environ["INVITE_SECRET"])
    sessions = SessionRepo(table)
    verifier = GoogleTokenVerifier(os.environ["GOOGLE_CLIENT_ID"])
    auth = AuthService(verifier=verifier, users=users, sessions=sessions)
    handler = RequestHandler(storage, users, photo_store=photo_store)
    services_done = time.perf_counter()
    logger.info(
        "cold_start_phases imports_ms=%.1f secrets_ms=%.1f dynamo_ms=%.1f services_ms=%.1f init_total_ms=%.1f",
        (_IMPORTS_DONE - _LAMBDA_INIT_START) * 1000,
        (secrets_done - build_start) * 1000,
        (table_done - secrets_done) * 1000,
        (services_done - table_done) * 1000,
        (services_done - _LAMBDA_INIT_START) * 1000,
    )
    return handler, auth, cookie_config_from_env(secure_default="1"), frozenset(allowed_origins_from_env())


def lambda_handler(event: dict, context: object) -> dict:
    handler, auth, cookie_config, allowed_origins = _build()
    if event.get("rawPath", "").endswith("/warmup"):
        return {"statusCode": 200, "body": json.dumps({"ok": True})}

    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    cookies_list = event.get("cookies") or []
    cookies = parse_cookie_header("; ".join(cookies_list)) if cookies_list else parse_cookie_header(headers.get("cookie"))

    result = dispatch_payload(
        raw_body=body,
        cookies=cookies,
        origin=headers.get("origin"),
        allowed_origins=set(allowed_origins),
        auth=auth,
        handler=handler,
    )

    response: dict = {"statusCode": result.status_code}
    if result.body is not None:
        response["body"] = json.dumps(result.body)
        response["headers"] = {"content-type": "application/json"}

    if result.cookie_action == CookieAction.SET:
        assert result.session_id is not None and result.session_max_age is not None
        response["cookies"] = [
            build_set_cookie_header(result.session_id, result.session_max_age, cookie_config)
        ]
    elif result.cookie_action == CookieAction.CLEAR:
        response["cookies"] = [build_clear_cookie_header(cookie_config)]

    return response
