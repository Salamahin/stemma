"""FastAPI app exposing Stemma over the Model Context Protocol.

One app, two surfaces: an OAuth 2.1 authorization server (DCR + authorization-code + PKCE,
login federated to Google) and the MCP JSON-RPC endpoint (`POST /mcp`). The access token it
issues is the Stemma session id, so `AuthService.resolve` stays the only token→user step,
and tool calls go through the same `domain.codec` + `RequestHandler` as the REST surface.
"""

import asyncio
import json
import logging
import time
from urllib.parse import parse_qs, urlencode

from fastapi import FastAPI, Request as FastApiRequest
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse, Response as FastApiResponse

from stemma.apis.request_handler import RequestHandler
from stemma.apps.mcp_identity import IdentityProvider
from stemma.apps.usage import log_usage
from stemma.domain.codec import decode_request, encode_error, encode_response
from stemma.domain.errors import StemmaError
from stemma.domain.user import User
from stemma.services.auth_service import AuthService
from stemma.services.mcp_tools import ToolSpec, tools_by_name
from stemma.services.oauth_repo import OAuthRepo
from stemma.services.oauth_service import (
    OAUTH_SCOPE,
    OAuthError,
    authorization_server_metadata,
    protected_resource_metadata,
    validate_authorization_request,
    validate_redirect_uris,
    validate_token_request,
)

logger = logging.getLogger(__name__)

SERVER_NAME = "stemma-mcp"
SUPPORTED_PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
DEFAULT_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]

# JSON-RPC 2.0 error codes.
_PARSE_ERROR = -32700
_METHOD_NOT_FOUND = -32601
_INVALID_PARAMS = -32602


def build_mcp_app(
    handler: RequestHandler,
    auth: AuthService,
    oauth: OAuthRepo,
    identity: IdentityProvider,
    *,
    issuer_override: str | None = None,
    server_version: str = "0.1.0",
) -> FastAPI:
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["content-type", "authorization", "mcp-protocol-version"],
        max_age=600,
    )

    def issuer(request: FastApiRequest) -> str:
        return issuer_override or str(request.base_url).rstrip("/")

    def resource(request: FastApiRequest) -> str:
        return f"{issuer(request)}/mcp"

    def callback_url(request: FastApiRequest) -> str:
        return f"{issuer(request)}/oauth/callback"

    @app.get("/.well-known/oauth-authorization-server")
    async def authorization_server_discovery(request: FastApiRequest) -> JSONResponse:
        return JSONResponse(authorization_server_metadata(issuer(request)))

    # Bare + resource-scoped paths: different MCP clients probe one or the other.
    @app.get("/.well-known/oauth-protected-resource")
    @app.get("/.well-known/oauth-protected-resource/mcp")
    async def protected_resource_discovery(request: FastApiRequest) -> JSONResponse:
        return JSONResponse(protected_resource_metadata(resource(request), issuer(request)))

    @app.post("/register")
    async def register(request: FastApiRequest) -> JSONResponse:
        try:
            body = await request.json()
        except ValueError:
            return _oauth_error(OAuthError("invalid_client_metadata", "body must be JSON"))
        try:
            redirect_uris = validate_redirect_uris(body.get("redirect_uris") or [])
        except OAuthError as e:
            return _oauth_error(e)
        client = oauth.register_client(redirect_uris, body.get("client_name"))
        return JSONResponse(
            status_code=201,
            content={
                "client_id": client.client_id,
                "redirect_uris": list(client.redirect_uris),
                "client_name": client.client_name,
                "token_endpoint_auth_method": "none",
                "grant_types": ["authorization_code"],
                "response_types": ["code"],
            },
        )

    @app.get("/authorize")
    async def authorize(request: FastApiRequest) -> FastApiResponse:
        params = request.query_params
        client_id = params.get("client_id", "")
        redirect_uri = params.get("redirect_uri", "")
        try:
            client = validate_authorization_request(
                oauth.get_client(client_id),
                client_id=client_id,
                redirect_uri=redirect_uri,
                response_type=params.get("response_type", ""),
                code_challenge=params.get("code_challenge", ""),
                code_challenge_method=params.get("code_challenge_method", "S256"),
            )
        except OAuthError as e:
            return _oauth_error(e)
        flow = oauth.create_flow(
            client_id=client.client_id,
            redirect_uri=redirect_uri,
            code_challenge=params.get("code_challenge", ""),
            client_state=params.get("state"),
        )
        target = identity.authorization_url(state=flow.flow_id, redirect_uri=callback_url(request))
        return RedirectResponse(target, status_code=302)

    @app.get("/oauth/callback")
    async def oauth_callback(request: FastApiRequest) -> FastApiResponse:
        params = dict(request.query_params)
        flow = oauth.take_flow(params.get("state", ""))
        if flow is None:
            return _oauth_error(OAuthError("invalid_request", "unknown or expired login flow"))
        try:
            email = await asyncio.to_thread(
                identity.fetch_email, params=params, redirect_uri=callback_url(request)
            )
        except OAuthError as e:
            return _redirect_error(flow.redirect_uri, e, flow.client_state)
        outcome = await asyncio.to_thread(auth.begin_session, email)
        code = oauth.create_code(
            client_id=flow.client_id,
            redirect_uri=flow.redirect_uri,
            code_challenge=flow.code_challenge,
            session_id=outcome.session.sid,
        )
        return RedirectResponse(
            _with_query(flow.redirect_uri, code=code.code, state=flow.client_state), status_code=302
        )

    @app.post("/token")
    async def token(request: FastApiRequest) -> JSONResponse:
        form = _parse_form((await request.body()).decode("utf-8"))
        if form.get("grant_type") != "authorization_code":
            return _oauth_error(OAuthError("unsupported_grant_type", "only authorization_code"))
        try:
            code = validate_token_request(
                oauth.take_code(form.get("code", "")),
                client_id=form.get("client_id", ""),
                redirect_uri=form.get("redirect_uri", ""),
                code_verifier=form.get("code_verifier", ""),
            )
        except OAuthError as e:
            return _oauth_error(e)
        resolved = await asyncio.to_thread(auth.resolve, code.session_id)
        if resolved is None:
            return _oauth_error(OAuthError("invalid_grant", "session is no longer valid"))
        return JSONResponse(
            content={
                "access_token": code.session_id,
                "token_type": "Bearer",
                "scope": OAUTH_SCOPE,
                "expires_in": max(0, resolved.session.expires_at - int(time.time())),
            },
            headers={"Cache-Control": "no-store"},
        )

    @app.post("/mcp")
    async def mcp_endpoint(request: FastApiRequest) -> FastApiResponse:
        token_value = _bearer_token(request.headers.get("authorization"))
        outcome = await asyncio.to_thread(auth.resolve, token_value) if token_value else None
        if outcome is None:
            return _unauthorized(issuer(request))
        try:
            message = await request.json()
        except ValueError:
            return JSONResponse(_rpc_error(None, _PARSE_ERROR, "invalid JSON"))
        log_usage(transport="mcp", email=outcome.user.email, action=_rpc_action(message))
        reply = await asyncio.to_thread(
            _dispatch_rpc, message, outcome.user, handler, server_version
        )
        if reply is None:
            return FastApiResponse(status_code=202)
        return JSONResponse(reply)

    @app.get("/warmup")
    async def warmup() -> JSONResponse:
        return JSONResponse({"ok": True})

    return app


def _dispatch_rpc(message: dict, user: User, handler: RequestHandler, server_version: str) -> dict | None:
    method = message.get("method")
    msg_id = message.get("id")
    if method == "initialize":
        return _rpc_result(msg_id, _initialize_result(message.get("params") or {}, server_version))
    if method == "notifications/initialized":
        return None
    if method == "ping":
        return _rpc_result(msg_id, {})
    if method == "tools/list":
        return _rpc_result(msg_id, {"tools": [_tool_manifest(spec) for spec in tools_by_name().values()]})
    if method == "tools/call":
        return _tools_call(msg_id, message.get("params") or {}, user, handler)
    return _rpc_error(msg_id, _METHOD_NOT_FOUND, f"unknown method: {method}")


def _rpc_action(message: object) -> str:
    if not isinstance(message, dict):
        return "invalid"
    method = message.get("method")
    params = message.get("params")
    if method == "tools/call" and isinstance(params, dict) and isinstance(params.get("name"), str):
        return params["name"]
    return method if isinstance(method, str) else "invalid"


def _initialize_result(params: dict, server_version: str) -> dict:
    requested = params.get("protocolVersion")
    version = requested if requested in SUPPORTED_PROTOCOL_VERSIONS else DEFAULT_PROTOCOL_VERSION
    return {
        "protocolVersion": version,
        "capabilities": {"tools": {"listChanged": False}},
        "serverInfo": {"name": SERVER_NAME, "version": server_version},
    }


def _tool_manifest(spec: ToolSpec) -> dict:
    return {"name": spec.name, "description": spec.description, "inputSchema": spec.input_schema}


def _tools_call(msg_id: object, params: dict, user: User, handler: RequestHandler) -> dict:
    name = params.get("name")
    spec = tools_by_name().get(name) if isinstance(name, str) else None
    if spec is None:
        return _rpc_error(msg_id, _INVALID_PARAMS, f"unknown tool: {name}")
    arguments = params.get("arguments") or {}
    try:
        request = decode_request(spec.to_payload(arguments))
    except (KeyError, ValueError) as e:
        return _rpc_result(msg_id, _tool_result(f"invalid arguments: {e}", is_error=True))
    try:
        response = handler.handle(user, request)
    except StemmaError as e:
        return _rpc_result(msg_id, _tool_result(_json_text(encode_error(e)), is_error=True))
    payload = encode_response(response)
    if spec.transform_response is not None:
        payload = spec.transform_response(arguments, payload)
    return _rpc_result(msg_id, _tool_result(_json_text(payload), is_error=False))


def _tool_result(text: str, *, is_error: bool) -> dict:
    return {"content": [{"type": "text", "text": text}], "isError": is_error}


def _json_text(payload: dict) -> str:
    return json.dumps(payload, ensure_ascii=False)


def _rpc_result(msg_id: object, result: dict) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "result": result}


def _rpc_error(msg_id: object, code: int, message: str) -> dict:
    return {"jsonrpc": "2.0", "id": msg_id, "error": {"code": code, "message": message}}


def _bearer_token(header: str | None) -> str | None:
    if not header or not header.lower().startswith("bearer "):
        return None
    return header[len("bearer ") :].strip() or None


def _unauthorized(issuer: str) -> FastApiResponse:
    metadata_url = f"{issuer}/.well-known/oauth-protected-resource"
    return JSONResponse(
        status_code=401,
        content={"error": "invalid_token", "error_description": "missing or invalid bearer token"},
        headers={"WWW-Authenticate": f'Bearer resource_metadata="{metadata_url}"'},
    )


def _oauth_error(error: OAuthError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status,
        content={"error": error.error, "error_description": error.description},
        headers={"Cache-Control": "no-store"},
    )


def _redirect_error(redirect_uri: str, error: OAuthError, state: str | None) -> RedirectResponse:
    return RedirectResponse(
        _with_query(redirect_uri, error=error.error, error_description=error.description, state=state),
        status_code=302,
    )


def _with_query(url: str, **params: str | None) -> str:
    query = urlencode({k: v for k, v in params.items() if v is not None})
    separator = "&" if "?" in url else "?"
    return f"{url}{separator}{query}" if query else url


def _parse_form(body: str) -> dict[str, str]:
    return {key: values[0] for key, values in parse_qs(body).items() if values}
