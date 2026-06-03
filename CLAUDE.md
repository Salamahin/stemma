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
  - `src/stemma/apps/` — Transport adapters: `rest_main`/`rest_app` (local Uvicorn server on :8090), `lambda_main` (HTTP API handler), and `bootstrap` (Secrets Manager + DynamoDB Table construction).
- `frontend/` — Svelte 5 (runes mode) + TypeScript UI (Rollup bundler).
- `e2e/` — Playwright end-to-end tests with full local stack orchestration (`scripts/devstack.mjs`).
- `template.yaml` / `samconfig.toml` — AWS SAM infrastructure (Python 3.13 arm64 Lambda + shared layer + DynamoDB table).
- `Makefile` — `sam build` hooks that assemble the Lambda artifacts and shared layer from `backend/`.
- `.github/workflows/ci.yml` — CI: runs `uv run pytest`, frontend tests, and e2e tests.
- `.github/workflows/cd.yml` — CD: `uv export` → `sam build`/`deploy` → upload frontend → invalidate CloudFront.

## Architecture

- `request_handler.RequestHandler.handle` is the single dispatch point: a `match` on the `Request` union calling the appropriate `StorageService` / `UserService` action and returning a typed `Response`.
- Both transport adapters (`apps/rest_app.py` and `apps/lambda_main.py`) only handle auth + JSON envelope encode/decode, then hand off to `RequestHandler`. Cross-cutting changes belong in `apis/`/`services/`/`storage/` so REST and Lambda surfaces stay in sync.
- Frontend talks to a single `POST /stemma` endpoint with a tagged-union JSON body of the form `{"type": "<RequestType>", ...fields}`. `domain/codec.py` (built on `pydantic.TypeAdapter`) decodes the envelope into the right `Request` dataclass and symmetrically encodes responses / errors. **To add an API**: add a dataclass to `domain/requests.py`, add it to the `Request` union, add a response dataclass (and to the `Response` union) in `domain/responses.py`, add a `case` branch in `RequestHandler.handle`, and wire matching types into the frontend client. Do not add new HTTP routes.
- `StorageService` owns all DynamoDB calls. It works against a `boto3.resource("dynamodb").Table(...)` handle; services and the handler never touch the client directly.
- Storage layout is single-table. Keys are encoded in `storage/schema.py`: `pk = STEMMA#<sid>` with `sk` prefixes `META`, `PERSON#<pid>`, `FAMILY#<fid>`, `OWNER#STEMMA#<uid>`, `OWNER#PERSON#<pid>#<uid>`, `OWNER#FAMILY#<fid>#<uid>`. User-by-email lookup uses `pk = USER#EMAIL#<email>` / `sk = PROFILE`. GSI `UserStemmasIndex` (`gsi1pk = USER#<uid>`, `gsi1sk = STEMMA#<sid>`) backs `list_owned_stemmas`. IDs are `uuid4().hex`.
- Most mutating operations follow a load-snapshot → plan-in-memory → batch-write pattern (`_load_snapshot` in `storage_service.py`). Cycle detection runs on the planned snapshot before any write so there's no rollback. The recursive CTE that used to compute kinsmen families for `chown` is now `services/kinship.py` — pure Python over the loaded family graph.
- In Lambda, `_build()` is `@cache`d so warm invocations reuse the boto3 Table handle. `bootstrap.populate_env_from_secrets()` pulls the invite secret from Secrets Manager at cold start (driven by `STEMMA_INVITE_SECRET_NAME`). The Lambda has DynamoDB CRUD permissions on the table referenced by `STEMMA_TABLE_NAME`.

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
- `E2E_AUTH_BYPASS` — When `"1"`, the REST server accepts any bearer token (e2e use only).

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
