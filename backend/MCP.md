# Stemma MCP server

Exposes the Stemma family-tree API over the [Model Context Protocol](https://modelcontextprotocol.io)
so an LLM client (Claude Desktop, MCP Inspector, …) can read and edit trees in natural
language. It runs as a second app alongside the REST server, reusing the same
`RequestHandler`, `StorageService`, and session store — no business logic is duplicated.

## Surfaces

One FastAPI app (`stemma.apps.mcp_app`) serves two things:

1. **OAuth 2.1 authorization server** — dynamic client registration (RFC 7591),
   authorization-code grant with PKCE (S256), and discovery documents. The user is
   authenticated by federating the login to Google. Google itself cannot be the MCP
   authorization server directly because MCP clients require dynamic registration, which
   Google does not support — so Stemma acts as the authorization server and delegates the
   actual sign-in to Google.
2. **MCP endpoint** (`POST /mcp`) — JSON-RPC 2.0 over the Streamable-HTTP transport
   (single-JSON-response mode), answering `initialize`, `tools/list`, and `tools/call`.

The access token handed to the client **is the Stemma session id**, so `AuthService.resolve`
stays the single token→`User` step shared with the cookie-based REST surface.

### OAuth flow

```
client  --POST /register-------------------------->  { client_id }
client  --GET  /authorize (PKCE challenge)-------->  302 to Google
Google  --GET  /oauth/callback (code)------------->  session created, 302 back with code
client  --POST /token (PKCE verifier)------------->  { access_token = session id }
client  --POST /mcp (Authorization: Bearer …)----->  tools
```

### Tools (v1)

`list_stemmas`, `get_stemma`, `create_stemma`, `rename_stemma`, `delete_stemma`,
`clone_stemma`, `create_person`, `update_person`, `delete_person`, `link_persons`,
`create_family`, `delete_family`.

Each tool maps to a `Request` envelope validated by the same `domain.codec` the REST API
uses. Photo upload (binary) and invitation tokens (privileged) are intentionally out of v1.

## Running locally

```sh
# DynamoDB Local must be running (see the repo README).
export STEMMA_TABLE_NAME=stemma-dev
export STEMMA_AUTO_CREATE_TABLE=1
export DYNAMODB_ENDPOINT_URL=http://127.0.0.1:8000
export AWS_REGION=eu-central-1 AWS_ACCESS_KEY_ID=local AWS_SECRET_ACCESS_KEY=local
export INVITE_SECRET=dev-secret

# Skip Google during local dev — logs in as STEMMA_MCP_BYPASS_EMAIL:
export STEMMA_MCP_AUTH_BYPASS=1
export STEMMA_MCP_BYPASS_EMAIL=me@example.com

uv run python -m stemma.apps.mcp_main    # serves on :8091
```

Point MCP Inspector at `http://127.0.0.1:8091/mcp` and complete the (bypassed) OAuth flow.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth client id (audience for id-token verification). |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Google OAuth client secret — required for the authorization-code exchange (**not** needed for the REST server, which only verifies id tokens). |
| `STEMMA_MCP_ISSUER` | Public base URL of the MCP server (e.g. `https://mcp.stemma.link`). The OAuth discovery documents advertise endpoints under it. Defaults to the request's own base URL. |
| `STEMMA_MCP_AUTH_BYPASS` | `1` skips Google and logs in as `STEMMA_MCP_BYPASS_EMAIL`. Local/e2e only — never enable in production. |
| `STEMMA_MCP_BYPASS_EMAIL` | Email used when bypass is on (default `mcp-dev@stemma.local`). |

Plus the standard backend variables (`STEMMA_TABLE_NAME`, `INVITE_SECRET`, DynamoDB/AWS
config) — see the root `CLAUDE.md`.

## Deployment (follow-up)

This change ships the app + local/self-hosted entrypoint (`mcp_main`, Uvicorn on :8091).
Put it behind a TLS-terminating reverse proxy and set `STEMMA_MCP_ISSUER` to the public URL.
Wiring it as an additional SAM Lambda (via an ASGI adapter such as Mangum) and registering
a public Google OAuth redirect URI (`<issuer>/oauth/callback`) is left as a deploy step for
the maintainer to review separately.
