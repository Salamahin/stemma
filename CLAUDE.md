# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stemma is a collaborative family tree editor. Multiple users build shared genealogy trees with per-person edit permissions and invitation links. Authentication is via Google OAuth. Production runs on AWS (Lambda + API Gateway + S3 + CloudFront + CockroachDB serverless over the Postgres wire protocol).

## Workflow

1. Create a feature branch from `master` before making changes.
2. Write a test for the requested feature first, if applicable.
3. Implement the feature.
4. Run the relevant test suite (`uv run pytest`, `npm test`, `npm run check`) and ensure it passes before committing.

## Restrictions

- Never commit secrets (API keys, tokens, passwords, etc.).
- Never delete or skip failing tests. Fix the code to make them pass.

## Repository Layout

- `backend_py/` — Python 3.13 backend (FastAPI + SQLAlchemy + pydantic, managed with `uv`).
  - `src/stemma/domain/` — Domain dataclasses, tagged `Request`/`Response`/`StemmaError` unions, and the pydantic codec.
  - `src/stemma/services/` — Pure business logic (`UserService`, `invite_tokens`, `stemma_dfs`).
  - `src/stemma/storage/` — SQLAlchemy schema, `StorageService`, and the migration runner.
  - `src/stemma/apis/request_handler.py` — Central dispatcher: takes a `User` + parsed `Request`, returns a `Response`.
  - `src/stemma/apps/` — Transport adapters: `rest_main`/`rest_app` (local Uvicorn server on :8090), `lambda_main` (HTTP API handler), `migration_main` (migration Lambda), and `bootstrap` (Secrets Manager + engine construction).
  - `migrations/` — Plain SQL migration files applied by `storage/migrations.py`.
- `frontend/` — Svelte 5 (legacy mode, `runes: false`) + TypeScript UI (Rollup bundler).
- `e2e/` — Playwright end-to-end tests with full local stack orchestration (`scripts/devstack.mjs`).
- `template.yaml` / `samconfig.toml` — AWS SAM infrastructure (Python 3.13 arm64 Lambda + shared layer).
- `Makefile` — `sam build` hooks that assemble the Lambda artifacts and shared layer from `backend_py/`.
- `.github/workflows/ci.yml` — CI: runs `uv run pytest`, frontend tests, and e2e tests.
- `.github/workflows/cd.yml` — CD: `uv export` → `sam build`/`deploy` → invoke `MigrationFunction` → upload frontend → invalidate CloudFront.

## Architecture

- `request_handler.RequestHandler.handle` is the single dispatch point: a `match` on the `Request` union calling the appropriate `StorageService` / `UserService` action and returning a typed `Response`.
- Both transport adapters (`apps/rest_app.py` and `apps/lambda_main.py`) only handle auth + JSON envelope encode/decode, then hand off to `RequestHandler`. Cross-cutting changes belong in `apis/`/`services/`/`storage/` so REST and Lambda surfaces stay in sync.
- Frontend talks to a single `POST /stemma` endpoint with a tagged-union JSON body of the form `{"<RequestType>": {...fields}}`. `domain/codec.py` (built on `pydantic.TypeAdapter`) decodes the envelope into the right `Request` dataclass and symmetrically encodes responses / errors. **To add an API**: add a dataclass to `domain/requests.py`, add it to the `Request` union, add a response dataclass (and to the `Response` union) in `domain/responses.py`, add a `case` branch in `RequestHandler.handle`, and wire matching types into the frontend client. Do not add new HTTP routes.
- `StorageService` owns all SQL. Every `Engine.begin()` block lives in there; services and the handler never touch the engine directly.
- In Lambda, `_build()` is `@cache`d so warm invocations reuse the engine. `bootstrap.populate_env_from_secrets()` pulls JDBC + invite secrets from Secrets Manager at cold start (driven by `STEMMA_DB_SECRET_NAME` / `STEMMA_INVITE_SECRET_NAME`). `bootstrap.write_root_cert()` materializes the CockroachDB root cert from the base64 `JDBC_CERT` env var to `/tmp` before the engine connects. The runtime SQLAlchemy URL uses the `cockroachdb+psycopg` dialect.

## Build & Test Commands

Prerequisites: Python 3.13, [`uv`](https://docs.astral.sh/uv/), Node.js, Docker (or `podman`) for Postgres/testcontainers.

### Backend (run from `backend_py/`)

```sh
uv sync --all-groups                          # Install runtime + dev deps
uv run pytest                                  # Run all backend tests (spins up a Postgres testcontainer)
uv run pytest tests/test_storage_service.py    # Single test file
uv run pytest -k <expr>                        # Filter by test name
uv run ruff check                              # Lint
uv run pyright                                 # Type check
uv run python -m stemma.apps.rest_main         # Start local REST server on :8090
```

Always invoke Python through `uv run` — do not call `.venv/bin/python` directly or set `PYTHONPATH` manually; `uv` handles both.

To run tests against a pre-existing Postgres instead of testcontainers, set `STEMMA_TEST_DATABASE_URL` (see `tests/conftest.py`).

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

The e2e `scripts/devstack.mjs` orchestrates: Postgres (Docker) → backend (`uv run python -m stemma.apps.rest_main` with `E2E_AUTH_BYPASS=1`) → frontend build (with `E2E_AUTO_LOGIN=1`) → sirv static server on port 4173. The Playwright config has `reuseExistingServer` off in CI, on locally.

### Build-time environment variables (Rollup `@rollup/plugin-replace`)

- `GOOGLE_CLIENT_ID` — Google OAuth client ID (string-substituted into bundle).
- `STEMMA_BACKEND_URL` — Backend base URL.
- `E2E_AUTO_LOGIN` — When `"1"`, auto-signs in without Google OAuth.

Access `E2E_AUTO_LOGIN` in code with a `typeof` guard: `typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1"`.

### Backend environment variables

Always required:
- `GOOGLE_CLIENT_ID`, `INVITE_SECRET`, `JDBC_URL`, `JDBC_USER`, `JDBC_PASSWORD`.

REST-only:
- `E2E_AUTH_BYPASS` — When `"1"`, the REST server accepts any bearer token (e2e use only).

Lambda-only (set in `template.yaml` Globals or by `bootstrap`):
- `STEMMA_DB_SECRET_NAME` / `STEMMA_INVITE_SECRET_NAME` — Secrets Manager IDs fetched at cold start. The secret JSONs populate the JDBC/INVITE env vars via `os.environ.setdefault`.
- `STEMMA_MIGRATIONS_DIR` — Path to migration SQL files inside the Lambda package (set to `/var/task/migrations` for `MigrationFunction`).
- `STEMMA_JDBC_CERT_PATH` — Override path where `JDBC_CERT` is written; defaults to `/tmp/cockroach-proud-gnoll.crt`.
- `JDBC_CERT` — base64-encoded CockroachDB root cert, materialized to disk at cold start.

## Coding Standards

- Prefer functional programming; side effects at boundaries only. Domain dataclasses are `frozen=True`.
- Never use generic names (`utils`, `helpers`).
- Keep diffs minimal and in-scope.
- For i18n changes, update **both** `en` and `ru` dictionaries in `frontend/src/i18n.ts`.
- Python: 4-space indent, 120-char lines (`tool.ruff` config), Python 3.13 typing syntax (`X | None`, PEP 695 generics). Module names are snake_case, classes PascalCase.

## Known Gotchas

- The local REST server has a **2-second artificial delay** on every request (`DEFAULT_REQUEST_DELAY_SECONDS` in `apps/rest_app.py`); it is **not** applied in Lambda.
- E2E tests run serially (`workers: 1`, `fullyParallel: false`) because they share a single database.
- The Playwright config auto-launches the full stack via `webServer.command` — no manual setup needed for `npm test` in `e2e/`.
- Svelte is in **legacy mode** (`runes: false`). Use `mount()` from `svelte`; do not introduce runes.
- The CockroachDB SQLAlchemy dialect (`cockroachdb+psycopg`) is used at runtime so the driver issues Cockroach-compatible SQL. Tests run against vanilla Postgres via testcontainers (the dialect is still compatible with the wire protocol).
- `bootstrap.populate_env_from_secrets()` uses `os.environ.setdefault`, so secrets do not overwrite values that were already exported — useful for local override but be aware in debugging.
