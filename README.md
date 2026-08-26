# Stemma
[![CI](https://github.com/Salamahin/stemma/actions/workflows/ci.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/ci.yml)
[![Deploy to AWS](https://github.com/Salamahin/stemma/actions/workflows/cd.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/cd.yml)

Stemma is a collaborative family tree editor. It lets multiple people build and maintain a shared genealogy, with permissions and invitation links.

## Features
- Create and edit family trees with parent/child relationships
- Invite collaborators via shareable links
- Visual graph rendering of the tree
- Per-person edit permissions
- AI access via a Model Context Protocol (MCP) server

## Tech stack
- Frontend: Svelte + Rollup
- Backend: Python 3.14 (FastAPI, boto3, pydantic), managed with [`uv`](https://docs.astral.sh/uv/)
- Storage: DynamoDB (single table; DynamoDB Local for dev/e2e)

The API is RPC-shaped, not REST: a single `POST /stemma` endpoint accepts a tagged-union JSON body (`{"type": "<RequestType>", ...}`) dispatched in `apis/request_handler.py`.

## AI access (MCP)

Stemma runs a [Model Context Protocol](https://modelcontextprotocol.io) server at `https://api.stemma.link/mcp`, with its own Google-federated OAuth 2.1 authorization server. Add it as a custom connector in an MCP client (e.g. Claude) to read and edit trees in natural language. Backend lives in `stemma.apps.mcp_app` (served locally by `mcp_main` on :8091, or a Mangum Lambda on the shared HTTP API).

## Repository layout
- `backend/`: Python backend
  - `src/stemma/domain/`: domain dataclasses, tagged `Request`/`Response`/`StemmaError` unions, pydantic codec
  - `src/stemma/services/`, `src/stemma/storage/`: business logic and persistence
  - `src/stemma/apis/request_handler.py`: central dispatcher
  - `src/stemma/apps/`: REST server and Lambda handler
- `frontend/`: Svelte frontend
- `e2e/`: Playwright end-to-end tests and local dev stack launcher
- `template.yaml`, `Makefile`: AWS SAM infrastructure

## Quick start (local)

### Prerequisites
- Python 3.14 and [`uv`](https://docs.astral.sh/uv/)
- Node.js + npm
- Docker (for DynamoDB Local)

### 1) Start DynamoDB Local (Docker)
```bash
docker run --name stemma-dynamodb \
  --rm -p 8000:8000 amazon/dynamodb-local
```

### 2) Run the backend
```bash
export GOOGLE_CLIENT_ID=your_google_client_id
export INVITE_SECRET=your_invite_secret
export STEMMA_TABLE_NAME=stemma-dev
export STEMMA_AUTO_CREATE_TABLE=1
export DYNAMODB_ENDPOINT_URL=http://127.0.0.1:8000
export AWS_REGION=eu-central-1
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
cd backend
uv sync
uv run python -m stemma.apps.rest_main
```

The REST API listens on `http://localhost:8090`. Use `uv sync --all-groups` for the dev tools (tests, linters), and `uv run python -m stemma.apps.mcp_main` to run the MCP server on `:8091`. Always invoke Python through `uv run` (don't call `.venv/bin/python` or set `PYTHONPATH` — `uv` handles both).

### 3) Run the frontend
```bash
cd frontend
npm install

GOOGLE_CLIENT_ID=your_google_client_id \
STEMMA_BACKEND_URL=http://localhost:8090 \
npm run dev
```

Open the dev server URL printed by Rollup.

## Tests & checks
```bash
cd backend
uv run pytest                                # all backend tests (in-process moto DynamoDB)
uv run pytest tests/test_storage_service.py  # a single file
uv run pytest -k <expr>                       # filter by test name
uv run ruff check                             # lint
uv run pyright                                # type check
```

```bash
cd frontend
npm test
```

```bash
cd e2e
npm test
```

## Environment variables
Backend:
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `INVITE_SECRET`: secret for invitation token signing
- `STEMMA_TABLE_NAME`: DynamoDB table name
- `DYNAMODB_ENDPOINT_URL` (optional): override the DynamoDB endpoint — set for DynamoDB Local
- `STEMMA_AUTO_CREATE_TABLE` (optional): when set to `1`, create the table on startup if missing (local/e2e only)
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`: standard AWS SDK config
- `E2E_AUTH_BYPASS` (optional): when set to `1`, the REST server accepts any bearer token (for E2E only)
- `STEMMA_ALLOWED_ORIGINS` (optional): CSV of allowed `Origin` values for the cookie-auth CSRF check + CORS; defaults to `*`
- `STEMMA_COOKIE_DOMAIN` (optional): `Domain` attribute on the session cookie (apex domain in prod, empty for local)
- `STEMMA_COOKIE_SECURE` (optional): when `1`, adds the `Secure` flag on the cookie (required in prod)

MCP server (backend, in addition to the above):
- `GOOGLE_OAUTH_CLIENT_SECRET`: Google OAuth client secret — needed for the MCP authorization-code exchange (the REST server only verifies id tokens and does not need it)
- `STEMMA_MCP_ISSUER` (optional): public base URL of the MCP server; defaults to the request's own base URL
- `STEMMA_MCP_AUTH_BYPASS` (optional): when `1`, the MCP login skips Google and uses `STEMMA_MCP_BYPASS_EMAIL` (local/e2e only)

Frontend (build-time, substituted by Rollup):
- `GOOGLE_CLIENT_ID`: same client ID as backend
- `STEMMA_BACKEND_URL`: backend base URL (for example `http://localhost:8090`)
- `E2E_AUTO_LOGIN` (optional): when `1`, auto-signs in without Google OAuth (e2e only)

## Notes
- For a clean local slate, stop and re-run the DynamoDB container — its in-memory data is wiped on restart.
