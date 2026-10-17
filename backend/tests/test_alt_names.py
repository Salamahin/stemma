import pytest
from pydantic import ValidationError

from stemma.domain.codec import decode_request
from stemma.domain.requests import AltName, CreateNewPerson, CreateOrphanPersonRequest
from stemma.services.mcp_tools import _person_descr, _person_write_schema
from stemma.services.person_search import search_people
from stemma.storage.storage_service import StorageService

IRINA = CreateNewPerson(
    name="Саломахина Ирина Ивановна",
    alt_names=[AltName(name="Соломахина Ирина Иоаннова", kind="variant"), AltName(name="Белова", kind="maiden")],
)


def test_codec_decodes_alt_names() -> None:
    request = decode_request(
        {
            "type": "CreateOrphanPersonRequest",
            "stemmaId": "1",
            "personDescr": {
                "type": "CreateNewPerson",
                "name": "Иванова Мария",
                "altNames": [{"name": "Петрова", "kind": "maiden"}],
            },
        }
    )
    assert isinstance(request, CreateOrphanPersonRequest)
    assert request.person_descr.alt_names == [AltName(name="Петрова", kind="maiden")]


def test_alt_names_default_to_empty_and_reject_unknown_kinds() -> None:
    assert CreateNewPerson(name="x").alt_names == []
    with pytest.raises(ValidationError):
        AltName(name="x", kind="nickname-ish")  # type: ignore[arg-type]


def test_storage_round_trips_and_overwrites_alt_names(storage: StorageService) -> None:
    user = storage.get_or_create_user("u@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    storage.create_orphan_person(user.user_id, sid, IRINA)
    [person] = storage.stemma(user.user_id, sid).people
    assert person.alt_names == IRINA.alt_names

    storage.update_person(user.user_id, sid, person.id, CreateNewPerson(name=IRINA.name))
    [person] = storage.stemma(user.user_id, sid).people
    assert person.alt_names == []


def test_clone_keeps_alt_names(storage: StorageService) -> None:
    user = storage.get_or_create_user("u@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    storage.create_orphan_person(user.user_id, sid, IRINA)
    clone = storage.clone_stemma(user.user_id, sid, "copy")
    assert clone.people[0].alt_names == IRINA.alt_names


def test_search_matches_any_name_of_a_person() -> None:
    people = [
        {"id": "1", "name": "Иванова Мария", "altNames": [{"name": "Петрова", "kind": "maiden"}]},
        {"id": "2", "name": "Петров Иван", "altNames": []},
    ]
    assert [p["id"] for p in search_people("Мария Петрова", people)] == ["1"]
    assert {p["id"] for p in search_people("Петров", people)} == {"1", "2"}


def test_mcp_tools_accept_alt_names() -> None:
    schema = _person_write_schema({})
    assert "alt_names" in schema["properties"]
    descr = _person_descr({"name": "Иванова", "alt_names": [{"name": "Петрова", "kind": "maiden"}]})
    assert descr["alt_names"] == [{"name": "Петрова", "kind": "maiden"}]
