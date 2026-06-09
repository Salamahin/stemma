"""Shared transport-layer dispatch: cookie auth + CSRF origin check + request routing.

REST (FastAPI) and Lambda (HTTP API) both call `dispatch_payload` and translate the
returned `DispatchResult` into their respective response shape (FastAPI JSONResponse
or API Gateway event dict).
"""

import json
import logging
import os
from dataclasses import dataclass
from enum import Enum
from http.cookies import Morsel, SimpleCookie
from typing import Any

from stemma.apis.request_handler import RequestHandler
from stemma.domain.codec import decode_request, encode_error, encode_response
from stemma.domain.errors import RequestDeserializationProblem, StemmaError, UnknownError
from stemma.domain.requests import AuthLoginRequest, AuthLogoutRequest
from stemma.domain.responses import AuthLoginResponse, AuthLogoutResponse
from stemma.services.auth_service import AuthService

logger = logging.getLogger(__name__)

COOKIE_NAME = "stemma_session"


class CookieAction(Enum):
    NONE = "none"
    SET = "set"
    CLEAR = "clear"


@dataclass(frozen=True)
class DispatchResult:
    status_code: int
    body: dict[str, Any] | None
    cookie_action: CookieAction = CookieAction.NONE
    session_id: str | None = None
    session_max_age: int | None = None


def dispatch_payload(
    *,
    raw_body: str,
    cookies: dict[str, str],
    origin: str | None,
    allowed_origins: set[str],
    auth: AuthService,
    handler: RequestHandler,
) -> DispatchResult:
    if not _origin_allowed(origin, allowed_origins):
        return DispatchResult(status_code=403, body=None)

    try:
        payload = json.loads(raw_body) if raw_body else {}
        request = decode_request(payload)
    except (ValueError, json.JSONDecodeError) as e:
        return DispatchResult(
            status_code=200,
            body=encode_error(RequestDeserializationProblem(descr=str(e))),
        )

    if isinstance(request, AuthLoginRequest):
        try:
            outcome = auth.login(request.id_token)
        except Exception as e:
            logger.warning("login failed: %s", e)
            return DispatchResult(status_code=401, body=None)
        return DispatchResult(
            status_code=200,
            body=encode_response(
                AuthLoginResponse(user_id=outcome.user.user_id, email=outcome.user.email)
            ),
            cookie_action=CookieAction.SET,
            session_id=outcome.session.sid,
            session_max_age=outcome.session.expires_at - outcome.session.created_at,
        )

    sid = cookies.get(COOKIE_NAME)

    if isinstance(request, AuthLogoutRequest):
        if sid is not None:
            auth.logout(sid)
        return DispatchResult(
            status_code=200,
            body=encode_response(AuthLogoutResponse()),
            cookie_action=CookieAction.CLEAR,
        )

    outcome = auth.resolve(sid) if sid else None
    if outcome is None:
        return DispatchResult(status_code=401, body=None)

    try:
        response = handler.handle(outcome.user, request)
        return DispatchResult(status_code=200, body=encode_response(response))
    except StemmaError as e:
        logger.exception("Service error")
        return DispatchResult(status_code=200, body=encode_error(e))
    except Exception as e:
        logger.exception("Unexpected error")
        return DispatchResult(status_code=200, body=encode_error(UnknownError(cause=repr(e))))


def _origin_allowed(origin: str | None, allowed: set[str]) -> bool:
    if "*" in allowed:
        return True
    if origin is None:
        # Non-browser callers (curl, Lambda warmup) have no Origin; browsers always
        # send it on cross-origin POST, which is the CSRF case this check exists for.
        return True
    return origin in allowed


def parse_cookie_header(header: str | None) -> dict[str, str]:
    if not header:
        return {}
    jar = SimpleCookie()
    jar.load(header)
    return {key: morsel.value for key, morsel in jar.items()}


@dataclass(frozen=True)
class CookieConfig:
    name: str = COOKIE_NAME
    domain: str | None = None
    secure: bool = False
    same_site: str = "Lax"
    path: str = "/"


def _build_morsel(config: CookieConfig, value: str, max_age: int) -> Morsel:
    morsel: Morsel = Morsel()
    morsel.set(config.name, value, value)
    morsel["path"] = config.path
    morsel["max-age"] = str(max_age)
    morsel["samesite"] = config.same_site
    morsel["httponly"] = True
    if config.secure:
        morsel["secure"] = True
    if config.domain:
        morsel["domain"] = config.domain
    return morsel


def build_set_cookie_header(sid: str, max_age: int, config: CookieConfig) -> str:
    return _build_morsel(config, sid, max_age).OutputString()


def build_clear_cookie_header(config: CookieConfig) -> str:
    return _build_morsel(config, "", 0).OutputString()


def allowed_origins_from_env() -> set[str]:
    raw = os.environ.get("STEMMA_ALLOWED_ORIGINS", "")
    return {o.strip() for o in raw.split(",") if o.strip()} or {"*"}


def cookie_config_from_env(*, secure_default: str = "0") -> CookieConfig:
    return CookieConfig(
        domain=os.environ.get("STEMMA_COOKIE_DOMAIN") or None,
        secure=os.environ.get("STEMMA_COOKIE_SECURE", secure_default) == "1",
    )
