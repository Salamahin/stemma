import asyncio
import json
import logging

from fastapi import FastAPI, HTTPException, Request as FastApiRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from stemma.apis.request_handler import RequestHandler
from stemma.apps.auth import TokenVerifier
from stemma.domain.codec import decode_request, encode_error, encode_response
from stemma.domain.errors import RequestDeserializationProblem, StemmaError, UnknownError
from stemma.domain.user import User
from stemma.services.user_service import UserService

logger = logging.getLogger(__name__)

DEFAULT_REQUEST_DELAY_SECONDS = 2


def build_app(
    handler: RequestHandler,
    verifier: TokenVerifier,
    users: UserService,
    *,
    request_delay_seconds: float = DEFAULT_REQUEST_DELAY_SECONDS,
) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
        max_age=600,
    )

    @app.post("/stemma")
    async def stemma_endpoint(request: FastApiRequest) -> JSONResponse:
        user = await asyncio.to_thread(_resolve_user, request, verifier, users)
        body_bytes = await request.body()
        if request_delay_seconds:
            await asyncio.sleep(request_delay_seconds)
        try:
            payload = json.loads(body_bytes)
            domain_request = decode_request(payload)
        except (ValueError, json.JSONDecodeError) as e:
            return JSONResponse(content=encode_error(RequestDeserializationProblem(descr=str(e))))
        try:
            response = await asyncio.to_thread(handler.handle, user, domain_request)
            return JSONResponse(content=encode_response(response))
        except StemmaError as e:
            logger.exception("Service error")
            return JSONResponse(content=encode_error(e))
        except Exception as e:
            logger.exception("Unexpected error")
            return JSONResponse(content=encode_error(UnknownError(cause=repr(e))))

    return app


def _resolve_user(request: FastApiRequest, verifier: TokenVerifier, users: UserService) -> User:
    auth_header = request.headers.get("authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="missing authorization header")
    token = auth_header.removeprefix("Bearer ").strip()
    try:
        email = verifier.email_from(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="invalid token") from e
    return users.get_or_create_user(email)
