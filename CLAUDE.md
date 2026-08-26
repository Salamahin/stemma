# CLAUDE.md

Guidance for Claude Code (claude.ai/code) in this repository. For the project overview, repository layout, local setup, run/test commands, and environment variables, see `README.md` — this file covers only agent-facing specifics: workflow, architecture, production access, and conventions.

## Workflow

1. Create a feature branch from `master` before making changes.
2. Write a test for the requested feature first, if applicable.
3. Implement the feature.
4. Run the relevant test suite (`uv run pytest`, `npm test`, `npm run check`) and ensure it passes before committing.

## Restrictions

- Never commit secrets (API keys, tokens, passwords, etc.).
- Never delete or skip failing tests. Fix the code to make them pass.

## Architecture

The API is RPC-shaped: a single `POST /stemma` endpoint takes a tagged-union JSON body (`{"type": "<RequestType>", ...}`). `domain/codec.py` (pydantic `TypeAdapter`) decodes it into a `Request` dataclass; `RequestHandler.handle` is a `match` over the union that calls `StorageService` / `UserService` and returns a typed `Response`. Transport adapters (`apps/rest_app.py`, `apps/lambda_main.py`, sharing `apps/dispatch.py`) only do auth + envelope encode/decode. `StorageService` owns all DynamoDB access against one table (keys in `storage/schema.py`). Auth is cookie/session based: a Google id_token is exchanged for a `stemma_session` HttpOnly cookie, and every other request resolves `User` from it. A second transport, the MCP server (`apps/mcp_app.py` / `mcp_lambda.py`), reuses the same `RequestHandler` behind its own Google-federated OAuth 2.1 authorization server.

**To add an API**: add a dataclass to `domain/requests.py` + the `Request` union, a response in `domain/responses.py` + the `Response` union, a `case` in `RequestHandler.handle`, and wire the frontend client. Do not add new HTTP routes.

## Production (AWS)

Production runs on AWS (Lambda + API Gateway + S3 + CloudFront + DynamoDB on-demand). Access uses AWS Identity Center (SSO); the local profile is named `stemma`:

```sh
aws sso login --profile stemma
AWS_PROFILE=stemma aws sts get-caller-identity   # sanity check
AWS_PROFILE=stemma sam deploy                    # local SAM deploys (CI uses access keys, not profile)
```

Deploys otherwise happen automatically: a merge to `master` runs CI, and on success the `Deploy to AWS` workflow runs `uv export` → `sam build`/`deploy` → uploads the frontend → invalidates CloudFront.


## Known Gotchas

- The local REST server has a **2-second artificial delay** on every request (`DEFAULT_REQUEST_DELAY_SECONDS` in `apps/rest_app.py`); it is **not** applied in Lambda.
- E2E tests run serially (`workers: 1`, `fullyParallel: false`) because they share a single table.
- The Playwright config auto-launches the full stack via `webServer.command` — no manual setup needed for `npm test` in `e2e/`.
- Svelte runs in **runes mode** (`runes: true`). Use `$state`, `$derived`, `$effect`, `$props`, and callback props. Do not use `export let`, `$:`, or `createEventDispatcher`.
- Storage methods that target a specific person/family take `stemma_id` alongside the entity id — items are keyed by `STEMMA#<sid>`, so the stemma id is part of every DynamoDB key.
- `bootstrap.populate_env_from_secrets()` uses `os.environ.setdefault`, so secrets do not overwrite values that were already exported — useful for local override but be aware in debugging.
- DynamoDB has no schema for non-key attributes; field rename/split migrations are scan-and-rewrite scripts rather than SQL migrations.
- **Access model rests entirely on invite tokens.** `StorageService.chown` is the privileged primitive that grants ownership of a stemma + the kinsmen subtree; it now requires an explicit `authorized=True` argument and intentionally performs no permission checks of its own. Never call `storage.chown` from a new handler without first validating an invite token (`RequestHandler._bear_invitation` is the only legitimate caller) or an equivalent server-side authorization. Bypassing it opens the door to silent ownership grants.
