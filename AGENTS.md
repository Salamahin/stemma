# AGENTS.md

## Project Map

```text
backend/          Scala + ZIO backend (SBT multi-module)
frontend/         Svelte + TypeScript UI (Rollup)
e2e/              Playwright end-to-end tests
.github/workflows CI pipeline
template.yaml     AWS SAM infra
samconfig.toml    SAM deploy config
```

## Global Rules

- Keep diffs minimal and in-scope.
- Do not modify unrelated files.
- Preserve external contracts unless migration is explicitly requested.
- Never commit secrets.

## Coding Standards

- Never mix business logic and side effects. Keep side effects at the boundaries.
- Prefer functional programming over object-oriented programming.
- Prefer object-oriented programming over imperative style when FP is not practical.
- Never use generic names like `utils`, `helpers`, or similar catch-all naming.
- Prefer short, focused, and specific methods over long and generic ones.
- Do not add comments unless they are strictly necessary.

## Task Routing

- Backend logic/data/API: work in `backend/`
- UI/client behavior/i18n: work in `frontend/`
- E2E flows: work in `e2e/`
- CI/deploy/infra: work in `.github/workflows/`, `template.yaml`, `samconfig.toml`

If a task crosses areas, touch only required files and call out cross-boundary changes explicitly.

## Backend Guide (`backend/`)

### Invariants

- Keep frontend-facing API contracts backward-compatible.
- Prefer ZIO layers/effects over ad-hoc futures/blocking.

### Validate (from `backend/`)

```sh
sbt test
sbt compile
```

Use targeted commands only when needed:

```sh
sbt "project api" test
sbt "project api_impl_restful" run
```

## Frontend Guide (`frontend/`, `e2e/`)

### Invariants

- Svelte is in legacy mode (`runes: false`).
- Use `mount()` from `svelte`; do not introduce runes unless doing an explicit migration.
- For i18n changes, update both `en` and `ru` in `frontend/src/i18n.ts`.

### Validate frontend (from `frontend/`)

```sh
npm run check
npm test
```

When build/config/env wiring changed:

```sh
npm run build
```

### Validate e2e (from `e2e/`)

```sh
npm test
```

### Build-time env vars (Rollup replace)

- `GOOGLE_CLIENT_ID`
- `STEMMA_BACKEND_URL`
- `E2E_AUTO_LOGIN`

## Infra Guide (`.github/workflows/`, `template.yaml`, `samconfig.toml`)

### Invariants

- Do not rename AWS logical IDs/resources without explicit migration planning.
- For risky infra edits, include rollback notes in the PR/summary.

### Validate

- For workflow changes: ensure job commands and paths still match repo layout.
- For SAM changes: verify template consistency and deployment command remains valid.

Deploy command:

```sh
sam build && sam deploy
```

## Branching

- Use a new branch per feature/task.
- Do not mix multiple unrelated features in one branch.

## Known Gotchas

*Add lessons learned here as you encounter them*
