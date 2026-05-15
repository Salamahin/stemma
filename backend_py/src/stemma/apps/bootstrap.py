import base64
import os
from pathlib import Path

from sqlalchemy import Engine, create_engine

_COCKROACH_CERT_PATH = Path("/tmp/cockroach-proud-gnoll.crt")


def write_root_cert() -> None:
    if _COCKROACH_CERT_PATH.exists():
        return
    cert_b64 = os.environ.get("JDBC_CERT")
    if not cert_b64:
        return
    _COCKROACH_CERT_PATH.write_text(base64.b64decode(cert_b64).decode("utf-8"))


def jdbc_to_sqlalchemy_url(jdbc_url: str, user: str, password: str) -> str:
    stripped = jdbc_url.removeprefix("jdbc:")
    for prefix in ("postgresql://", "postgres://"):
        if stripped.startswith(prefix):
            stripped = stripped.removeprefix(prefix)
            break
    return f"postgresql+psycopg://{user}:{password}@{stripped}"


def engine_from_env(*, pool_pre_ping: bool = False, pool_recycle: int = -1) -> Engine:
    return create_engine(
        jdbc_to_sqlalchemy_url(
            os.environ["JDBC_URL"], os.environ["JDBC_USER"], os.environ["JDBC_PASSWORD"]
        ),
        pool_size=1,
        max_overflow=0,
        pool_pre_ping=pool_pre_ping,
        pool_recycle=pool_recycle,
    )


def migrations_dir() -> Path:
    override = os.environ.get("STEMMA_MIGRATIONS_DIR")
    if override:
        return Path(override)
    return Path(__file__).resolve().parents[3] / "migrations"
