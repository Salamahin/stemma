import base64
import json
import os
from pathlib import Path

from sqlalchemy import Engine, create_engine

_DEFAULT_CERT_PATH = Path("/tmp/cockroach-proud-gnoll.crt")


def _cert_path() -> Path:
    override = os.environ.get("STEMMA_JDBC_CERT_PATH")
    return Path(override) if override else _DEFAULT_CERT_PATH


def populate_env_from_secrets() -> None:
    secret_names = [
        name
        for name in (
            os.environ.get("STEMMA_DB_SECRET_NAME"),
            os.environ.get("STEMMA_INVITE_SECRET_NAME"),
        )
        if name
    ]
    if not secret_names:
        return
    import boto3  # pyright: ignore[reportMissingImports]  # provided by Lambda runtime

    client = boto3.client("secretsmanager")
    for name in secret_names:
        payload = json.loads(client.get_secret_value(SecretId=name)["SecretString"])
        for key, value in payload.items():
            os.environ.setdefault(key, value)


def write_root_cert() -> None:
    path = _cert_path()
    if path.exists():
        return
    cert_b64 = os.environ.get("JDBC_CERT")
    if not cert_b64:
        return
    path.write_text(base64.b64decode(cert_b64).decode("utf-8"))


def jdbc_to_sqlalchemy_url(jdbc_url: str, user: str, password: str) -> str:
    stripped = jdbc_url.removeprefix("jdbc:")
    for prefix in ("postgresql://", "postgres://"):
        if stripped.startswith(prefix):
            stripped = stripped.removeprefix(prefix)
            break
    return f"cockroachdb+psycopg://{user}:{password}@{stripped}"


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
