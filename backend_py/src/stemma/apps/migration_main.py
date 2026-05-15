import logging

from stemma.apps.bootstrap import engine_from_env, migrations_dir, write_root_cert
from stemma.storage.migrations import run_migrations

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def lambda_handler(event: dict, context: object) -> str:
    write_root_cert()
    engine = engine_from_env()
    run_migrations(engine, migrations_dir())
    return "Migration completed successfully"
