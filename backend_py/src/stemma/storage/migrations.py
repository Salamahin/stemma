import logging
import re
from pathlib import Path

from sqlalchemy import Engine, text

logger = logging.getLogger(__name__)

_FILENAME_RE = re.compile(r"V(\d+)__(.+)\.sql$")


def run_migrations(engine: Engine, migrations_dir: Path) -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS applied_migrations (
                    version INTEGER PRIMARY KEY,
                    description VARCHAR NOT NULL,
                    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        applied = {row[0] for row in conn.execute(text("SELECT version FROM applied_migrations"))}

    pending = sorted(_discover_migrations(migrations_dir), key=lambda m: m[0])
    for version, description, sql_path in pending:
        if version in applied:
            continue
        sql = sql_path.read_text(encoding="utf-8")
        with engine.begin() as conn:
            conn.exec_driver_sql(sql)
            conn.execute(
                text("INSERT INTO applied_migrations (version, description) VALUES (:v, :d)"),
                {"v": version, "d": description},
            )
        logger.info("Applied migration V%s__%s", version, description)


def _discover_migrations(migrations_dir: Path) -> list[tuple[int, str, Path]]:
    result: list[tuple[int, str, Path]] = []
    for path in migrations_dir.iterdir():
        match = _FILENAME_RE.match(path.name)
        if match:
            result.append((int(match.group(1)), match.group(2), path))
    return result
