"""The MCP tool catalog. Each `ToolSpec` carries a JSON Schema and a `to_payload` that
builds a tagged-union request envelope, fed through the same `domain.codec` as REST. Scope
is the text-only subset (stemma/person/family CRUD + linking); no photos or invite tokens.
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import cache

from stemma.services.person_search import DEFAULT_LIMIT, search_people

# Only consumed when a user is first provisioned (via the web app), ignored otherwise.
_SEED_DEFAULT_STEMMA_NAME = "My Stemma"
_SEED_KINGS_STEMMA_NAME = "European Kings"

_OPTIONAL_PERSON_FIELDS = ("birth_date", "death_date", "bio")


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict
    to_payload: Callable[[dict], dict]
    # Optional (args, encoded_response) -> reshaped response. Lets a tool answer from the
    # full stemma the handler returns while sending the client only the relevant slice.
    transform_response: Callable[[dict, dict], dict] | None = None


def _stemma_list_only(_args: dict, response: dict) -> dict:
    """The web app renders the first tree inline; over MCP that is a huge payload the
    client never needs (it fetches a specific tree with get_stemma), so drop it."""
    return {k: v for k, v in response.items() if k != "firstStemma"}


def _brief(person: dict) -> dict:
    return {k: person.get(k) for k in ("id", "name", "birthDate", "deathDate")}


def _dedup(ids: list[str]) -> list[str]:
    return list(dict.fromkeys(ids))


_MAX_SEARCH_LIMIT = 100


def _search_people(args: dict, response: dict) -> dict:
    query = args.get("query", "")
    requested = args.get("limit")
    limit = min(max(int(requested), 1), _MAX_SEARCH_LIMIT) if requested is not None else DEFAULT_LIMIT
    ranked = search_people(query, response.get("people", []), limit=None)
    matches = [_brief(p) for p in ranked[:limit]]
    # `count` is the number of matches, not of returned people: the client needs to know
    # when its limit truncated the answer.
    return {"type": "PeopleSearch", "query": query, "count": len(ranked), "people": matches}


def _get_person(args: dict, response: dict) -> dict:
    person_id = args["person_id"]
    by_id = {p["id"]: p for p in response.get("people", [])}
    person = by_id.get(person_id)
    if person is None:
        return {"type": "PersonNotFound", "person_id": person_id}
    parents: list[str] = []
    children: list[str] = []
    spouses: list[str] = []
    siblings: list[str] = []
    for family in response.get("families", []):
        family_parents = family.get("parents", [])
        family_children = family.get("children", [])
        if person_id in family_children:
            parents += family_parents
            siblings += [c for c in family_children if c != person_id]
        if person_id in family_parents:
            children += family_children
            spouses += [p for p in family_parents if p != person_id]

    def briefs(ids: list[str]) -> list[dict]:
        return [_brief(by_id[i]) for i in _dedup(ids) if i in by_id]

    return {
        "type": "Person",
        "person": person,
        "parents": briefs(parents),
        "spouses": briefs(spouses),
        "children": briefs(children),
        "siblings": briefs(siblings),
    }


def _get_relatives(args: dict, response: dict) -> dict:
    person_id = args["person_id"]
    kind = args.get("kind", "ancestors")
    depth = max(1, min(int(args.get("depth", 3)), 8))
    by_id = {p["id"]: p for p in response.get("people", [])}
    if person_id not in by_id:
        return {"type": "PersonNotFound", "person_id": person_id}
    # Ancestors walk child->parents, descendants walk parent->children.
    adjacency = _child_to_parents(response) if kind == "ancestors" else _parent_to_children(response)
    relatives: list[dict] = []
    seen = {person_id}
    frontier = [person_id]
    for generation in range(1, depth + 1):
        nxt: list[str] = []
        for pid in frontier:
            for related in adjacency.get(pid, []):
                if related in seen or related not in by_id:
                    continue
                seen.add(related)
                nxt.append(related)
                relatives.append({**_brief(by_id[related]), "generation": generation})
        frontier = nxt
        if not frontier:
            break
    return {"type": "Relatives", "kind": kind, "person_id": person_id, "count": len(relatives), "relatives": relatives}


def _child_to_parents(response: dict) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for family in response.get("families", []):
        for child in family.get("children", []):
            result.setdefault(child, []).extend(family.get("parents", []))
    return result


def _parent_to_children(response: dict) -> dict[str, list[str]]:
    result: dict[str, list[str]] = {}
    for family in response.get("families", []):
        for parent in family.get("parents", []):
            result.setdefault(parent, []).extend(family.get("children", []))
    return result


def _person_descr(args: dict) -> dict:
    descr: dict = {"type": "CreateNewPerson", "name": args["name"]}
    for field in _OPTIONAL_PERSON_FIELDS:
        if args.get(field) is not None:
            descr[field] = args[field]
    return descr


def _existing_people(ids: list[str]) -> list[dict]:
    return [{"type": "ExistingPerson", "id": person_id} for person_id in ids]


def _string_schema(properties: dict[str, str], required: list[str]) -> dict:
    return {
        "type": "object",
        "properties": {name: {"type": "string", "description": desc} for name, desc in properties.items()},
        "required": required,
        "additionalProperties": False,
    }


def _person_write_schema(extra_required: dict[str, dict]) -> dict:
    props = {
        **extra_required,
        "name": {"type": "string", "description": "Full name of the person"},
        "birth_date": {"type": "string", "description": "ISO date, e.g. 1901-05-06 (optional)"},
        "death_date": {"type": "string", "description": "ISO date (optional)"},
        "bio": {"type": "string", "description": "Free-text biography (optional)"},
    }
    return {
        "type": "object",
        "properties": props,
        "required": [*extra_required.keys(), "name"],
        "additionalProperties": False,
    }


@cache
def tool_specs() -> tuple[ToolSpec, ...]:
    return (
        ToolSpec(
            name="list_stemmas",
            description="List all family trees (stemmas) the current user owns or can access.",
            input_schema={"type": "object", "properties": {}, "additionalProperties": False},
            to_payload=lambda _args: {
                "type": "ListDescribeStemmasRequest",
                "default_stemma_name": _SEED_DEFAULT_STEMMA_NAME,
                "kings_of_europe_stemma_name": _SEED_KINGS_STEMMA_NAME,
            },
            transform_response=_stemma_list_only,
        ),
        ToolSpec(
            name="get_stemma",
            description="Get every person and family in one stemma. This is the whole tree and "
            "can be very large; prefer search_people / get_person / get_relatives to navigate.",
            input_schema=_string_schema({"stemma_id": "Id of the stemma to read"}, ["stemma_id"]),
            to_payload=lambda args: {"type": "GetStemmaRequest", "stemma_id": args["stemma_id"]},
        ),
        ToolSpec(
            name="search_people",
            description="Fuzzy-find people in a stemma by name (tolerant of typos, ё/й, word order, "
            "and Cyrillic/Latin spelling). Returns id, name and dates only — start here, not "
            "get_stemma. `count` is the total number of matches; raise `limit` if it exceeds "
            "the people returned.",
            input_schema={
                "type": "object",
                "properties": {
                    "stemma_id": {"type": "string", "description": "Id of the stemma"},
                    "query": {"type": "string", "description": "Name or part of a name to match"},
                    "limit": {
                        "type": "integer",
                        "description": f"Max people to return (1-{_MAX_SEARCH_LIMIT}, default {DEFAULT_LIMIT})",
                    },
                },
                "required": ["stemma_id", "query"],
                "additionalProperties": False,
            },
            to_payload=lambda args: {"type": "GetStemmaRequest", "stemma_id": args["stemma_id"]},
            transform_response=_search_people,
        ),
        ToolSpec(
            name="get_person",
            description="Get one person plus their immediate family (parents, spouses, children, "
            "siblings). The natural way to walk a tree step by step.",
            input_schema=_string_schema(
                {"stemma_id": "Id of the stemma", "person_id": "Id of the person"},
                ["stemma_id", "person_id"],
            ),
            to_payload=lambda args: {"type": "GetStemmaRequest", "stemma_id": args["stemma_id"]},
            transform_response=_get_person,
        ),
        ToolSpec(
            name="get_relatives",
            description="Walk ancestors or descendants of a person up to a given depth. "
            "Each relative comes back with its generation distance.",
            input_schema={
                "type": "object",
                "properties": {
                    "stemma_id": {"type": "string", "description": "Id of the stemma"},
                    "person_id": {"type": "string", "description": "Id of the person to start from"},
                    "kind": {"type": "string", "enum": ["ancestors", "descendants"]},
                    "depth": {"type": "integer", "description": "Generations to walk (1-8, default 3)"},
                },
                "required": ["stemma_id", "person_id", "kind"],
                "additionalProperties": False,
            },
            to_payload=lambda args: {"type": "GetStemmaRequest", "stemma_id": args["stemma_id"]},
            transform_response=_get_relatives,
        ),
        ToolSpec(
            name="create_stemma",
            description="Create a new, empty family tree.",
            input_schema=_string_schema({"name": "Name for the new stemma"}, ["name"]),
            to_payload=lambda args: {"type": "CreateNewStemmaRequest", "stemma_name": args["name"]},
        ),
        ToolSpec(
            name="rename_stemma",
            description="Rename an existing family tree.",
            input_schema=_string_schema(
                {"stemma_id": "Id of the stemma", "new_name": "New name"}, ["stemma_id", "new_name"]
            ),
            to_payload=lambda args: {
                "type": "RenameStemmaRequest",
                "stemma_id": args["stemma_id"],
                "new_name": args["new_name"],
            },
        ),
        ToolSpec(
            name="delete_stemma",
            description="Delete a family tree and everyone in it. Irreversible.",
            input_schema=_string_schema({"stemma_id": "Id of the stemma to delete"}, ["stemma_id"]),
            to_payload=lambda args: {"type": "DeleteStemmaRequest", "stemma_id": args["stemma_id"]},
        ),
        ToolSpec(
            name="clone_stemma",
            description="Copy an existing stemma into a brand-new one.",
            input_schema=_string_schema(
                {"stemma_id": "Id of the stemma to clone", "new_name": "Name for the copy"},
                ["stemma_id", "new_name"],
            ),
            to_payload=lambda args: {
                "type": "CloneStemmaRequest",
                "stemma_id": args["stemma_id"],
                "stemma_name": args["new_name"],
            },
        ),
        ToolSpec(
            name="create_person",
            description="Add a new unattached person to a stemma.",
            input_schema=_person_write_schema({"stemma_id": {"type": "string", "description": "Id of the stemma"}}),
            to_payload=lambda args: {
                "type": "CreateOrphanPersonRequest",
                "stemma_id": args["stemma_id"],
                "person_descr": _person_descr(args),
            },
        ),
        ToolSpec(
            name="update_person",
            description="Overwrite a person's name and optional birth/death/bio fields.",
            input_schema=_person_write_schema(
                {
                    "stemma_id": {"type": "string", "description": "Id of the stemma"},
                    "person_id": {"type": "string", "description": "Id of the person to update"},
                }
            ),
            to_payload=lambda args: {
                "type": "UpdatePersonRequest",
                "stemma_id": args["stemma_id"],
                "person_id": args["person_id"],
                "person_descr": _person_descr(args),
            },
        ),
        ToolSpec(
            name="delete_person",
            description="Remove a person from a stemma.",
            input_schema=_string_schema(
                {"stemma_id": "Id of the stemma", "person_id": "Id of the person to delete"},
                ["stemma_id", "person_id"],
            ),
            to_payload=lambda args: {
                "type": "DeletePersonRequest",
                "stemma_id": args["stemma_id"],
                "person_id": args["person_id"],
            },
        ),
        ToolSpec(
            name="link_persons",
            description="Link two existing people. role is one of: spouse, parent, child "
            "(the role of to_person relative to from_person).",
            input_schema={
                "type": "object",
                "properties": {
                    "stemma_id": {"type": "string", "description": "Id of the stemma"},
                    "from_person_id": {"type": "string", "description": "Id of the anchor person"},
                    "to_person_id": {"type": "string", "description": "Id of the person being linked"},
                    "role": {"type": "string", "enum": ["spouse", "parent", "child"]},
                },
                "required": ["stemma_id", "from_person_id", "to_person_id", "role"],
                "additionalProperties": False,
            },
            to_payload=lambda args: {
                "type": "LinkPersonsRequest",
                "stemma_id": args["stemma_id"],
                "from_person_id": args["from_person_id"],
                "to_person_id": args["to_person_id"],
                "role": args["role"],
            },
        ),
        ToolSpec(
            name="create_family",
            description="Create a family from existing people: up to two parents and any children.",
            input_schema={
                "type": "object",
                "properties": {
                    "stemma_id": {"type": "string", "description": "Id of the stemma"},
                    "parent_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "0-2 existing person ids that are the parents",
                    },
                    "child_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "existing person ids that are the children",
                    },
                },
                "required": ["stemma_id"],
                "additionalProperties": False,
            },
            to_payload=_create_family_payload,
        ),
        ToolSpec(
            name="delete_family",
            description="Delete a family (the parent/child grouping), leaving the people intact.",
            input_schema=_string_schema(
                {"stemma_id": "Id of the stemma", "family_id": "Id of the family to delete"},
                ["stemma_id", "family_id"],
            ),
            to_payload=lambda args: {
                "type": "DeleteFamilyRequest",
                "stemma_id": args["stemma_id"],
                "family_id": args["family_id"],
            },
        ),
    )


def _create_family_payload(args: dict) -> dict:
    parents = _existing_people(args.get("parent_ids") or [])
    return {
        "type": "CreateFamilyRequest",
        "stemma_id": args["stemma_id"],
        "family_descr": {
            "parent1": parents[0] if len(parents) > 0 else None,
            "parent2": parents[1] if len(parents) > 1 else None,
            "children": _existing_people(args.get("child_ids") or []),
        },
    }


@cache
def tools_by_name() -> dict[str, ToolSpec]:
    return {spec.name: spec for spec in tool_specs()}
