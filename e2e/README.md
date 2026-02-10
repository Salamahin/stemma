# E2E Tests

This directory contains Playwright end-to-end tests.

## What it starts

`playwright.config.ts` uses `scripts/devstack.mjs` to start:

1. PostgreSQL in Docker (`stemma-e2e-postgres`)
2. REST backend (`backend/src/api_impl_restful`) with `E2E_AUTH_BYPASS=1`
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

- Requires Docker, Java, sbt, Node.js.
- Backend test auth bypass is enabled only when `E2E_AUTH_BYPASS=1`.
