from dataclasses import dataclass


@dataclass(frozen=True)
class User:
    user_id: str
    email: str
    default_stemma_id: str | None = None
