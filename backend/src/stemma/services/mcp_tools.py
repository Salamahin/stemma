"""The MCP tool catalog. Each `ToolSpec` carries a JSON Schema and a `to_payload` that
builds a tagged-union request envelope, fed through the same `domain.codec` as REST. Scope
is the text-only subset (stemma/person/family CRUD + linking); no photos or invite tokens.
"""

from collections.abc import Callable
from dataclasses import dataclass
from functools import cache

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
        ),
        ToolSpec(
            name="get_stemma",
            description="Get every person and family in one stemma.",
            input_schema=_string_schema({"stemma_id": "Id of the stemma to read"}, ["stemma_id"]),
            to_payload=lambda args: {"type": "GetStemmaRequest", "stemma_id": args["stemma_id"]},
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
