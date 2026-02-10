# Stemma
[![Scala CI](https://github.com/Salamahin/stemma/actions/workflows/ci.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/ci.yml)
[![Deploy to AWS](https://github.com/Salamahin/stemma/actions/workflows/cd.yml/badge.svg)](https://github.com/Salamahin/stemma/actions/workflows/cd.yml)

Stemma is a collaborative family tree editor. It lets multiple people build and maintain a shared genealogy, with permissions and invitation links.

## Features
- Create and edit family trees with parent/child relationships
- Invite collaborators via shareable links
- Visual graph rendering of the tree
- Per-person edit permissions

## Tech stack
- Frontend: Svelte + Rollup
- Backend: Scala (ZIO, zhttp)
- Storage: PostgreSQL

## Repository layout
- `backend/`: Scala backend root
- `backend/build.sbt`, `backend/project/`: SBT root and build config
- `backend/src/api/`: domain model and core services
- `backend/src/api_impl_restful/`: REST API implementation (local server)
- `backend/src/api_impl_aws_lambda/`: AWS Lambda implementation
- `frontend/`: Svelte frontend
- `e2e/`: Playwright end-to-end tests and local dev stack launcher

## Quick start (local)

### Prerequisites
- Java 11+
- sbt
- Node.js + npm
- PostgreSQL (or Docker)

### 1) Start Postgres (Docker)
```bash
docker run --name stemma-postgres \
  -e POSTGRES_PASSWORD=mysecretpassword \
  -e POSTGRES_DB=stemma \
  --rm -p 5432:5432 postgres
```

### 2) Run the backend
```bash
export GOOGLE_CLIENT_ID=your_google_client_id
export INVITE_SECRET=your_invite_secret
export JDBC_URL=jdbc:postgresql://localhost:5432/stemma
export JDBC_USER=postgres
export JDBC_PASSWORD=mysecretpassword
cd backend
sbt "project api_impl_restful" run
```

The REST API listens on `http://localhost:8090`.

### 3) Run the frontend
```bash
cd frontend
npm install

GOOGLE_CLIENT_ID=your_google_client_id \
STEMMA_BACKEND_URL=http://localhost:8090 \
npm run dev
```

Open the dev server URL printed by Rollup.

## Tests
```bash
cd backend
sbt test
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
- `JDBC_URL`: PostgreSQL JDBC URL
- `JDBC_USER`: database user
- `JDBC_PASSWORD`: database password
- `E2E_AUTH_BYPASS` (optional): when set to `1` in `api_impl_restful`, any bearer token is accepted (for E2E only)

Frontend:
- `GOOGLE_CLIENT_ID`: same client ID as backend
- `STEMMA_BACKEND_URL`: backend base URL (for example `http://localhost:8090`)

## Notes
- If you change the schema or need a clean start, drop the database and re-run the backend to recreate the schema.
