import time

_LAMBDA_INIT_START = time.perf_counter()

import base64  # noqa: E402
import json  # noqa: E402
import logging  # noqa: E402
import os  # noqa: E402
from functools import cache  # noqa: E402

from stemma.apis.request_handler import RequestHandler  # noqa: E402
from stemma.apps.bootstrap import (  # noqa: E402
    dynamo_table_from_env,
    photo_store_from_env,
    populate_env_from_secrets,
)
from stemma.domain.codec import decode_request, encode_error, encode_response  # noqa: E402
from stemma.domain.errors import RequestDeserializationProblem, StemmaError, UnknownError  # noqa: E402
from stemma.services.user_service import UserService  # noqa: E402
from stemma.storage.storage_service import StorageService  # noqa: E402

_IMPORTS_DONE = time.perf_counter()

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@cache
def _build() -> tuple[RequestHandler, UserService]:
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
    return handler, users


def lambda_handler(event: dict, context: object) -> str:
    handler, users = _build()
    email = event["requestContext"]["authorizer"]["jwt"]["claims"]["email"]
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")
    try:
        payload = json.loads(body)
        request = decode_request(payload)
    except (ValueError, json.JSONDecodeError) as e:
        return json.dumps(encode_error(RequestDeserializationProblem(descr=str(e))))
    try:
        user = users.get_or_create_user(email)
        response = handler.handle(user, request)
        return json.dumps(encode_response(response))
    except StemmaError as e:
        logger.exception("Service error")
        return json.dumps(encode_error(e))
    except Exception as e:
        logger.exception("Unexpected error")
        return json.dumps(encode_error(UnknownError(cause=repr(e))))
