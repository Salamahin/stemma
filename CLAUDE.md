# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stemma is a collaborative family tree editor. Multiple users build shared genealogy trees with per-person edit permissions and invitation links. Authentication is via Google OAuth. Production runs on AWS (Lambda + API Gateway + S3 + CloudFront + DynamoDB on-demand).

## Workflow

1. Create a feature branch from `master` before making changes.
2. Write a test for the requested feature first, if applicable.
3. Implement the feature.
4. Run the relevant test suite (`uv run pytest`, `npm test`, `npm run check`) and ensure it passes before committing.

## Restrictions

- Never commit secrets (API keys, tokens, passwords, etc.).
- Never delete or skip failing tests. Fix the code to make them pass.

## Repository Layout

- `backend/` — Python 3.13 backend (FastAPI + boto3 + pydantic, managed with `uv`).
  - `src/stemma/domain/` — Domain dataclasses, tagged `Request`/`Response`/`StemmaError` unions, and the pydantic codec.
  - `src/stemma/services/` — Pure business logic (`UserService`, `invite_tokens`, `stemma_dfs`, `kinship`).
  - `src/stemma/storage/` — DynamoDB single-table schema (`schema.py`: key encoders) and `StorageService` (boto3 Table-resource-backed).
  - `src/stemma/apis/request_handler.py` — Central dispatcher: takes a `User` + parsed `Request`, returns a `Response`.
  - `src/stemma/apps/` — Transport adapters: `rest_main`/`rest_app` (local Uvicorn server on :8090), `lambda_main` (HTTP API handler), `mcp_main`/`mcp_app`/`mcp_lambda` (MCP server — local Uvicorn on :8091 or a Mangum Lambda on the same HTTP API — with its own Google-federated OAuth 2.1 authorization server), and `bootstrap` (Secrets Manager + DynamoDB Table construction).
- `frontend/` — Svelte 5 (runes mode) + TypeScript UI (Rollup bundler).
- `e2e/` — Playwright end-to-end tests with full local stack orchestration (`scripts/devstack.mjs`).
- `template.yaml` / `samconfig.toml` — AWS SAM infrastructure (Python 3.13 arm64 Lambda + shared layer + DynamoDB table).
- `Makefile` — `sam build` hooks that assemble the Lambda artifacts and shared layer from `backend/`.
- `.github/workflows/ci.yml` — CI: runs `uv run pytest`, frontend tests, and e2e tests.
- `.github/workflows/cd.yml` — CD: `uv export` → `sam build`/`deploy` → upload frontend → invalidate CloudFront.

## Architecture

The API is RPC-shaped: a single `POST /stemma` endpoint takes a tagged-union JSON body (`{"type": "<RequestType>", ...}`). `domain/codec.py` (pydantic `TypeAdapter`) decodes it into a `Request` dataclass; `RequestHandler.handle` is a `match` over the union that calls `StorageService` / `UserService` and returns a typed `Response`. Transport adapters (`apps/rest_app.py`, `apps/lambda_main.py`, sharing `apps/dispatch.py`) only do auth + envelope encode/decode. `StorageService` owns all DynamoDB access against one table (keys in `storage/schema.py`). Auth is cookie/session based: a Google id_token is exchanged for a `stemma_session` HttpOnly cookie, and every other request resolves `User` from it.

**To add an API**: add a dataclass to `domain/requests.py` + the `Request` union, a response in `domain/responses.py` + the `Response` union, a `case` in `RequestHandler.handle`, and wire the frontend client. Do not add new HTTP routes.

## Build & Test Commands

Prerequisites: Python 3.13, [`uv`](https://docs.astral.sh/uv/), Node.js, Docker (or `podman`) for DynamoDB Local (e2e only — unit tests use `moto`).

### Backend (run from `backend/`)

```sh
uv sync --all-groups                          # Install runtime + dev deps
uv run pytest                                  # Run all backend tests (in-process moto DynamoDB)
uv run pytest tests/test_storage_service.py    # Single test file
uv run pytest -k <expr>                        # Filter by test name
uv run ruff check                              # Lint
uv run pyright                                 # Type check
uv run python -m stemma.apps.rest_main         # Start local REST server on :8090
uv run python -m stemma.apps.mcp_main          # Start local MCP server on :8091
```

Always invoke Python through `uv run` — do not call `.venv/bin/python` directly or set `PYTHONPATH` manually; `uv` handles both.

### Frontend (run from `frontend/`)

```sh
npm install           # Install dependencies
npm test              # Run Jest unit tests
npm run check         # Run svelte-check (type checking)
npm run build         # Production build (output: public/build/bundle.js)
npm run dev           # Dev server with watch mode (sirv + livereload)
```

### E2E (run from `e2e/`)

```sh
npm install                                    # Install deps
npx playwright install --with-deps chromium   # Install browser
npm test                                       # Run Playwright tests (auto-starts full stack via devstack.mjs)
```

The e2e `scripts/devstack.mjs` orchestrates: DynamoDB Local (Docker, port 8000) → backend (`uv run python -m stemma.apps.rest_main` with `E2E_AUTH_BYPASS=1`, `STEMMA_AUTO_CREATE_TABLE=1`, `DYNAMODB_ENDPOINT_URL=http://127.0.0.1:8000`) → frontend build (with `E2E_AUTO_LOGIN=1`) → sirv static server on port 4173. The Playwright config has `reuseExistingServer` off in CI, on locally.

### Build-time environment variables (Rollup `@rollup/plugin-replace`)

- `GOOGLE_CLIENT_ID` — Google OAuth client ID (string-substituted into bundle).
- `STEMMA_BACKEND_URL` — Backend base URL.
- `E2E_AUTO_LOGIN` — When `"1"`, auto-signs in without Google OAuth.

Access `E2E_AUTO_LOGIN` in code with a `typeof` guard: `typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1"`.

### Backend environment variables

Always required:
- `GOOGLE_CLIENT_ID`, `INVITE_SECRET`, `STEMMA_TABLE_NAME`.

Optional / context-dependent:
- `DYNAMODB_ENDPOINT_URL` — Override the DynamoDB endpoint (set to `http://127.0.0.1:8000` for DynamoDB Local). Omit in Lambda to use the real service.
- `STEMMA_AUTO_CREATE_TABLE` — When `"1"`, `bootstrap.dynamo_table_from_env()` creates the table on startup if missing (local/e2e only — Lambda relies on the SAM stack).
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` — Standard boto3 config. For Lambda, the runtime injects these; for local use any non-empty values when pointed at DynamoDB Local.
- `E2E_AUTH_BYPASS` — When `"1"`, the REST server accepts any id_token (e2e use only) and creates a real session row for it.
- `GOOGLE_OAUTH_CLIENT_SECRET` — Google OAuth client secret; MCP-server only, needed for the authorization-code exchange (the REST server only verifies id tokens and does not need it).
- `STEMMA_MCP_ISSUER` — Public base URL of the MCP server; its OAuth discovery documents advertise endpoints under it. Defaults to the request's own base URL.
- `STEMMA_MCP_AUTH_BYPASS` — When `"1"`, the MCP OAuth flow skips Google and logs in as `STEMMA_MCP_BYPASS_EMAIL` (local/e2e only).
- `STEMMA_ALLOWED_ORIGINS` — CSV of allowed `Origin` values for the cookie-auth CSRF check + CORS. Required when the frontend lives on a different origin than the API (e.g. `http://localhost:5000` for `npm run dev`). Defaults to `*` (no CSRF check, no credentialled CORS).
- `STEMMA_COOKIE_DOMAIN` — `Domain` attribute on the session cookie. Set to the apex domain in prod (`stemma.link`); leave empty for host-only cookies in local dev.
- `STEMMA_COOKIE_SECURE` — `"1"` adds the `Secure` flag; required in prod, must be `"0"` for plain-HTTP local dev.

One-off corrections to the production DynamoDB table go through the `stemma-migration` skill (see `.claude/skills/stemma-migration/`).

### AWS access (production)

Production access uses AWS Identity Center (SSO). The local profile is named `stemma`:

```sh
aws sso login --profile stemma
AWS_PROFILE=stemma aws sts get-caller-identity   # sanity check
AWS_PROFILE=stemma sam deploy                    # local SAM deploys (CI uses access keys, not profile)
```

Lambda-only (set in `template.yaml` Globals or by `bootstrap`):
- `STEMMA_INVITE_SECRET_NAME` — Secrets Manager ID fetched at cold start; its JSON contents populate `INVITE_SECRET` via `os.environ.setdefault`.

## Coding Standards

- Prefer functional programming; side effects at boundaries only. Domain dataclasses are `frozen=True`.
- Never use generic names (`utils`, `helpers`).
- Keep diffs minimal and in-scope.
- For i18n changes, update **both** `en` and `ru` dictionaries in `frontend/src/i18n.ts`.
- Python: 4-space indent, 120-char lines (`tool.ruff` config), Python 3.13 typing syntax (`X | None`, PEP 695 generics). Module names are snake_case, classes PascalCase.

## Known Gotchas

- The local REST server has a **2-second artificial delay** on every request (`DEFAULT_REQUEST_DELAY_SECONDS` in `apps/rest_app.py`); it is **not** applied in Lambda.
- E2E tests run serially (`workers: 1`, `fullyParallel: false`) because they share a single table.
- The Playwright config auto-launches the full stack via `webServer.command` — no manual setup needed for `npm test` in `e2e/`.
- Svelte runs in **runes mode** (`runes: true`). Use `$state`, `$derived`, `$effect`, `$props`, and callback props. Do not use `export let`, `$:`, or `createEventDispatcher`.
- Storage methods that target a specific person/family take `stemma_id` alongside the entity id — items are keyed by `STEMMA#<sid>`, so the stemma id is part of every DynamoDB key.
- `bootstrap.populate_env_from_secrets()` uses `os.environ.setdefault`, so secrets do not overwrite values that were already exported — useful for local override but be aware in debugging.
- DynamoDB has no schema for non-key attributes; field rename/split migrations are scan-and-rewrite scripts rather than SQL migrations.
- **Access model rests entirely on invite tokens.** `StorageService.chown` is the privileged primitive that grants ownership of a stemma + the kinsmen subtree; it now requires an explicit `authorized=True` argument and intentionally performs no permission checks of its own. Never call `storage.chown` from a new handler without first validating an invite token (`RequestHandler._bear_invitation` is the only legitimate caller) or an equivalent server-side authorization. Bypassing it opens the door to silent ownership grants.
