from typing import Literal

from pydantic.dataclasses import dataclass

from stemma.domain._config import DOMAIN_CONFIG

AltNameKind = Literal["maiden", "married", "variant", "other"]


@dataclass(frozen=True, config=DOMAIN_CONFIG)
class AltName:
    """Another name a person is known under: maiden or married surname, a spelling
    variant from old records, a nickname. Search matches every one of them."""

    name: str
    kind: AltNameKind = "variant"
