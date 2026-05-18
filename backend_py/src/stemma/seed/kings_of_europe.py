import json
from dataclasses import dataclass
from datetime import date
from functools import cache
from pathlib import Path


@dataclass(frozen=True)
class SeedPerson:
    id: str
    name: str
    birth_date: date | None
    death_date: date | None
    bio: str | None


@dataclass(frozen=True)
class SeedFamily:
    id: str
    parent_ids: tuple[str, ...]
    child_ids: tuple[str, ...]


@dataclass(frozen=True)
class SeedStemma:
    persons: tuple[SeedPerson, ...]
    families: tuple[SeedFamily, ...]


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


@cache
def load_kings_of_europe() -> SeedStemma:
    data_dir = Path(__file__).parent / "data" / "kings_of_europe"
    persons_raw = json.loads((data_dir / "persons.json").read_text(encoding="utf-8"))
    families_raw = json.loads((data_dir / "families.json").read_text(encoding="utf-8"))
    persons = tuple(
        SeedPerson(
            id=p["id"],
            name=p["name"],
            birth_date=_parse_date(p.get("birth_date")),
            death_date=_parse_date(p.get("death_date")),
            bio=p.get("bio"),
        )
        for p in persons_raw
    )
    families = tuple(
        SeedFamily(
            id=f["id"],
            parent_ids=tuple(f.get("parent_ids", [])),
            child_ids=tuple(f.get("child_ids", [])),
        )
        for f in families_raw
    )
    return SeedStemma(persons=persons, families=families)
