import base64
import json
import logging
import os
from functools import cache

from stemma.apis.request_handler import RequestHandler
from stemma.apps.bootstrap import engine_from_env, populate_env_from_secrets, write_root_cert
from stemma.domain.codec import decode_request, encode_error, encode_response
from stemma.domain.errors import RequestDeserializationProblem, StemmaError, UnknownError
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


@cache
def _build() -> tuple[RequestHandler, UserService]:
    populate_env_from_secrets()
    write_root_cert()
    engine = engine_from_env(pool_pre_ping=True, pool_recycle=300)
    storage = StorageService(engine)
    users = UserService(storage, os.environ["INVITE_SECRET"])
    return RequestHandler(storage, users), users


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
