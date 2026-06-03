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
- Backend: Python 3.13 (FastAPI, boto3, pydantic), managed with [`uv`](https://docs.astral.sh/uv/)
- Storage: DynamoDB (single table; DynamoDB Local for dev/e2e)

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
- Python 3.13 and [`uv`](https://docs.astral.sh/uv/)
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
uv run pytest
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

Frontend:
- `GOOGLE_CLIENT_ID`: same client ID as backend
- `STEMMA_BACKEND_URL`: backend base URL (for example `http://localhost:8090`)

## Notes
- For a clean local slate, stop and re-run the DynamoDB container — its in-memory data is wiped on restart.
