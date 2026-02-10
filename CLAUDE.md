# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Stemma is a collaborative family tree editor. Multiple users build shared genealogy trees with per-person edit permissions and invitation links. Authentication is via Google OAuth. Production runs on AWS (Lambda + S3 + CloudFront + PostgreSQL).

## Repository Layout

- `backend/` — Scala 2.13 + ZIO backend (SBT multi-module build, `build.sbt` is inside `backend/`)
  - `src/api/` — Domain model, core services, storage (shared by all API implementations)
  - `src/api_impl_restful/` — Local REST server (zhttp on port 8090)
  - `src/api_impl_aws_lambda/` — AWS Lambda handler for production
- `frontend/` — Svelte 5 (legacy mode, `runes: false`) + TypeScript UI (Rollup bundler)
- `e2e/` — Playwright end-to-end tests with full local stack orchestration
- `template.yaml` / `samconfig.toml` — AWS SAM infrastructure
- `.github/workflows/ci.yml` — CI: runs backend tests, frontend tests, and e2e tests
- `.github/workflows/cd.yml` — CD: deploys to AWS

## Build & Test Commands

### Backend (run from `backend/`)
```sh
sbt test              # Run all backend tests
sbt compile           # Compile all modules
sbt "project api" test                    # Test only the core API module
sbt "project api_impl_restful" run        # Start local REST server on :8090
```

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
npm install           # Install deps
npx playwright install --with-deps chromium   # Install browser
npm test              # Run Playwright tests (auto-starts full stack via devstack.mjs)
```

The e2e `devstack.mjs` script orchestrates: Postgres (Docker) → backend (sbt with `E2E_AUTH_BYPASS=1`) → frontend build (with `E2E_AUTO_LOGIN=1`) → sirv static server on port 4173.

## Architecture

### Single-endpoint API pattern
Both frontend and backend use a **single POST endpoint** (`/stemma`). All requests are discriminated union types:
- Backend: `sealed trait Request` in `domain/Request.scala`, dispatched by `HandleApiRequestService`
- Frontend: `CompositeRequest` / `CompositeResponse` union types in `model.ts`

The frontend `Model` class serializes a tagged request object, sends it to the backend, and the backend pattern-matches on the request type. Responses follow the same discriminated union pattern.

### Backend layering (ZIO)
Services are composed via ZIO layers:
- `StorageService` — PostgreSQL via Slick (schema auto-created on startup)
- `UserService` — User management + invitation token encode/decode
- `ApiService` — Business logic orchestration (depends on StorageService + UserService)
- `HandleApiRequestService` — Request dispatch (depends on ApiService)
- `OAuthService` — Google OAuth or E2E bypass mode

### Frontend state management
`AppController` (`appController.ts`) is the central orchestrator. It owns Svelte writable stores for all app state (stemma, ownedStemmas, currentStemmaId, etc.) and `App.svelte` subscribes to them. The controller delegates API calls to `Model` and updates stores on responses.

### Build-time environment variables (Rollup `@rollup/plugin-replace`)
- `GOOGLE_CLIENT_ID` — Google OAuth client ID (string-substituted into bundle)
- `STEMMA_BACKEND_URL` — Backend base URL
- `E2E_AUTO_LOGIN` — When `"1"`, auto-signs in without Google OAuth

Access `E2E_AUTO_LOGIN` in code with a `typeof` guard: `typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1"`.

### Backend environment variables
- `GOOGLE_CLIENT_ID`, `INVITE_SECRET`, `JDBC_URL`, `JDBC_USER`, `JDBC_PASSWORD`
- `E2E_AUTH_BYPASS` — When `"1"`, accepts any bearer token (restful server only)

## Coding Standards

- Prefer functional programming; side effects at boundaries only.
- Never use generic names (`utils`, `helpers`).
- Keep diffs minimal and in-scope.
- Svelte is in **legacy mode** (`runes: false`). Use `mount()` from `svelte`; do not introduce runes.
- For i18n changes, update **both** `en` and `ru` dictionaries in `frontend/src/i18n.ts`.
- Keep frontend-facing API contracts backward-compatible.
- Prefer ZIO layers/effects over ad-hoc futures/blocking in the backend.
- Backend tests use an in-memory H2 database (see `src/api/src/test/`).

## Workflow

1. Create a feature branch from `master` before making changes.
2. Write a test for the requested feature first, if applicable.
3. Implement the feature.
4. Run the relevant test suite (`sbt test`, `npm test`, `npm run check`) and ensure all tests pass before committing.

## Restrictions

- Never commit secrets (API keys, tokens, passwords, etc.).
- Never delete or skip failing tests. Fix the code to make them pass.

## Known Gotchas

- The backend REST server has a **2-second artificial delay** on every request (`delay(Duration.fromSeconds(2))` in `Main.scala`).
- E2E tests run serially (`workers: 1`, `fullyParallel: false`) because they share a single database.
- The Playwright config auto-launches the full stack via `webServer.command` — no manual setup needed for `npm test` in `e2e/`.
