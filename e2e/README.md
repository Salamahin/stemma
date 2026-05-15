# E2E Tests

This directory contains Playwright end-to-end tests.

## What it starts

`playwright.config.ts` uses `scripts/devstack.mjs` to start:

1. DynamoDB Local in Docker (`stemma-e2e-dynamodb`)
2. REST backend (`backend_py/`, started via `uv run python -m stemma.apps.rest_main`) with `E2E_AUTH_BYPASS=1` and `STEMMA_AUTO_CREATE_TABLE=1`
3. Frontend build/server (`frontend/`) with `E2E_AUTO_LOGIN=1`

No real Google auth is required.

## Run locally

From repo root:

```bash
cd e2e
npm install
npx playwright install
npm test
```

## Notes

- Requires Docker, Python 3.13, `uv`, Node.js.
- Backend test auth bypass is enabled only when `E2E_AUTH_BYPASS=1`.
