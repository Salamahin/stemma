"""Per-request usage log: who called which action over which transport.

Lambdas log in JSON format, so the `extra` fields become top-level keys that the
CloudWatch usage dashboard queries directly (`message = "usage"`, `email`, ...).
Emails are personal data: the log groups these land in keep 30 days only.
"""

import logging

logger = logging.getLogger("stemma.usage")
logger.setLevel(logging.INFO)


def log_usage(*, transport: str, email: str, action: str) -> None:
    logger.info("usage", extra={"transport": transport, "email": email, "action": action})
