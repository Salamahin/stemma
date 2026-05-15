from collections.abc import Callable
from datetime import date

from stemma.domain.requests import CreateFamily, CreateNewPerson, ExistingPerson, PersonDefinition
from stemma.domain.responses import Stemma

JOHNS_BIRTHDAY = date(1900, 1, 1)
JOHNS_DEATHDAY = date(2000, 1, 1)

create_john = CreateNewPerson(name="John", birth_date=JOHNS_BIRTHDAY, death_date=JOHNS_DEATHDAY)
create_jane = CreateNewPerson(name="Jane", birth_date=date(1850, 1, 1), death_date=date(1950, 1, 1))
create_james = CreateNewPerson(name="James")
create_jake = CreateNewPerson(name="Jake")
create_july = CreateNewPerson(name="July")
create_josh = CreateNewPerson(name="Josh")
create_jill = CreateNewPerson(name="Jill")
create_jeff = CreateNewPerson(name="Jeff")
create_jess = CreateNewPerson(name="Jess")
create_jabe = CreateNewPerson(name="Jabe")
create_jared = CreateNewPerson(name="Jared")


def existing(person_id: str) -> ExistingPerson:
    return ExistingPerson(id=person_id)


def family(*parents: PersonDefinition) -> Callable[..., CreateFamily]:
    if len(parents) > 2:
        raise ValueError("too many parents")
    parent1 = parents[0] if len(parents) >= 1 else None
    parent2 = parents[1] if len(parents) >= 2 else None

    def with_children(*children: PersonDefinition) -> CreateFamily:
        return CreateFamily(parent1=parent1, parent2=parent2, children=list(children))

    return with_children


def render_families(stemma: Stemma) -> list[str]:
    person_by_id = {p.id: p for p in stemma.people}
    out = []
    for f in stemma.families:
        parent_names = sorted(person_by_id[pid].name for pid in f.parents)
        child_names = sorted(person_by_id[cid].name for cid in f.children)
        out.append(f"({', '.join(parent_names)}) parentsOf ({', '.join(child_names)})")
    return out
