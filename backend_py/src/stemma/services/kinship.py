"""Compute the set of families that should transfer when a person is chowned.

The kinship rule:

    1. Start at the target person.
    2. Walk ancestors: any family where they were a child carries their parents,
       repeat upward.
    3. Add siblings: anyone who is a child of a family in the ancestor set.
    4. Add dependees: spouses descend from the ancestor/sibling set via families
       where the spouse appears as a parent and the partner descends from an
       ancestor family.
    5. Return every family touched along the way.
"""

from collections import defaultdict
from dataclasses import dataclass


@dataclass(frozen=True)
class FamilyLink:
    family_id: str
    parents: frozenset[str]
    children: frozenset[str]


def kinsmen_families(target_person_id: str, families: list[FamilyLink]) -> set[str]:
    spouse_of: dict[str, set[str]] = defaultdict(set)
    child_of: dict[str, set[str]] = defaultdict(set)
    parents_of_family: dict[str, frozenset[str]] = {}
    children_of_family: dict[str, frozenset[str]] = {}

    for fam in families:
        for pid in fam.parents:
            spouse_of[pid].add(fam.family_id)
        for cid in fam.children:
            child_of[cid].add(fam.family_id)
        parents_of_family[fam.family_id] = fam.parents
        children_of_family[fam.family_id] = fam.children

    ancestor_families: set[str] = set()
    frontier: set[str] = {target_person_id}
    while frontier:
        next_frontier: set[str] = set()
        for pid in frontier:
            for fid in child_of.get(pid, ()):
                if fid in ancestor_families:
                    continue
                ancestor_families.add(fid)
                next_frontier.update(parents_of_family[fid])
        frontier = next_frontier

    blood_people: set[str] = {target_person_id}
    for fid in ancestor_families:
        blood_people.update(parents_of_family[fid])
        blood_people.update(children_of_family[fid])

    dependee_families: set[str] = set(ancestor_families)
    frontier = set(blood_people)
    seen_spouse_descent: set[str] = set()
    while frontier:
        next_frontier: set[str] = set()
        for pid in frontier:
            if pid in seen_spouse_descent:
                continue
            seen_spouse_descent.add(pid)
            for fid in spouse_of.get(pid, ()):
                if fid in dependee_families:
                    continue
                dependee_families.add(fid)
                next_frontier.update(children_of_family[fid])
        frontier = next_frontier

    return dependee_families


def members_of(families: list[FamilyLink], family_ids: set[str]) -> set[str]:
    out: set[str] = set()
    for fam in families:
        if fam.family_id in family_ids:
            out.update(fam.parents)
            out.update(fam.children)
    return out
