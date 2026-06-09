import asyncio
import logging

from fastapi import FastAPI, Request as FastApiRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response as FastApiResponse

from stemma.apis.request_handler import RequestHandler
from stemma.apps.dispatch import (
    CookieAction,
    CookieConfig,
    dispatch_payload,
)
from stemma.services.auth_service import AuthService

logger = logging.getLogger(__name__)

DEFAULT_REQUEST_DELAY_SECONDS = 2


def build_app(
    handler: RequestHandler,
    auth: AuthService,
    *,
    allowed_origins: set[str],
    cookie_config: CookieConfig,
    request_delay_seconds: float = DEFAULT_REQUEST_DELAY_SECONDS,
) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=sorted(allowed_origins) if "*" not in allowed_origins else ["*"],
        allow_methods=["POST", "OPTIONS"],
        allow_headers=["content-type"],
        allow_credentials="*" not in allowed_origins,
        max_age=600,
    )

    @app.post("/stemma")
    async def stemma_endpoint(request: FastApiRequest) -> FastApiResponse:
        body_bytes = await request.body()
        if request_delay_seconds:
            await asyncio.sleep(request_delay_seconds)
        result = await asyncio.to_thread(
            dispatch_payload,
            raw_body=body_bytes.decode("utf-8") if body_bytes else "",
            cookies=dict(request.cookies),
            origin=request.headers.get("origin"),
            allowed_origins=allowed_origins,
            auth=auth,
            handler=handler,
        )
        if result.body is None:
            response = FastApiResponse(status_code=result.status_code)
        else:
            response = JSONResponse(status_code=result.status_code, content=result.body)
        if result.cookie_action == CookieAction.SET:
            assert result.session_id is not None and result.session_max_age is not None
            response.set_cookie(
                key=cookie_config.name,
                value=result.session_id,
                max_age=result.session_max_age,
                path=cookie_config.path,
                domain=cookie_config.domain,
                secure=cookie_config.secure,
                httponly=True,
                samesite=cookie_config.same_site.lower(),  # type: ignore[arg-type]
            )
        elif result.cookie_action == CookieAction.CLEAR:
            response.delete_cookie(
                key=cookie_config.name,
                path=cookie_config.path,
                domain=cookie_config.domain,
                secure=cookie_config.secure,
                httponly=True,
                samesite=cookie_config.same_site.lower(),  # type: ignore[arg-type]
            )
        return response

    @app.get("/warmup")
    async def warmup() -> JSONResponse:
        return JSONResponse(content={"ok": True})

    return app
