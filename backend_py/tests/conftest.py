import os
from collections.abc import Iterator
from pathlib import Path

import pytest
from sqlalchemy import Engine, create_engine, text

from stemma.services.user_service import UserService
from stemma.storage.migrations import run_migrations
from stemma.storage.storage_service import StorageService

MIGRATIONS_DIR = Path(__file__).resolve().parents[1] / "migrations"


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    external = os.environ.get("STEMMA_TEST_DATABASE_URL")
    if external:
        yield external
        return

    from testcontainers.postgres import PostgresContainer

    with PostgresContainer("postgres:16-alpine", driver="psycopg") as pg:
        yield pg.get_connection_url()


@pytest.fixture(scope="session")
def session_engine(database_url: str) -> Iterator[Engine]:
    engine = create_engine(database_url, pool_size=2, max_overflow=0)
    run_migrations(engine, MIGRATIONS_DIR)
    yield engine
    engine.dispose()


@pytest.fixture
def engine(session_engine: Engine) -> Iterator[Engine]:
    with session_engine.begin() as conn:
        conn.execute(
            text(
                'TRUNCATE TABLE "Spouse", "Child", "FamilyOwner", "PersonOwner", "StemmaOwner", '
                '"Family", "Person", "Stemma", "StemmaUsers" RESTART IDENTITY CASCADE'
            )
        )
    yield session_engine


@pytest.fixture
def storage(engine: Engine) -> StorageService:
    return StorageService(engine)


@pytest.fixture
def users(storage: StorageService) -> UserService:
    return UserService(storage, invite_secret="secret_string")
