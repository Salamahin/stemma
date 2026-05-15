from dataclasses import dataclass


@dataclass(frozen=True)
class ChownEffect:
    affected_families: list[str]
    affected_people: list[str]
