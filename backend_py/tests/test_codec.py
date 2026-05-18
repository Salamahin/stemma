from datetime import date

from stemma.domain.codec import decode_request, encode_error, encode_response
from stemma.domain.errors import AccessToFamilyDenied, IncompleteFamily, InvalidInviteToken
from stemma.domain.requests import (
    CreateFamilyRequest,
    CreateNewPerson,
    ExistingPerson,
    UpdatePersonRequest,
)
from stemma.domain.responses import FamilyDescription, OwnedStemmas, PersonDescription, Stemma, StemmaDescription


def test_decode_create_family_request_with_mixed_person_definitions() -> None:
    payload = {
        "type": "CreateFamilyRequest",
        "stemmaId": "7",
        "familyDescr": {
            "parent1": {"type": "ExistingPerson", "id": "1"},
            "parent2": {"type": "CreateNewPerson", "name": "Jane", "birthDate": "1900-01-01"},
            "children": [{"type": "CreateNewPerson", "name": "Josh"}],
        },
    }
    request = decode_request(payload)
    assert isinstance(request, CreateFamilyRequest)
    assert request.stemma_id == "7"
    assert request.family_descr.parent1 == ExistingPerson(id="1")
    assert request.family_descr.parent2 == CreateNewPerson(name="Jane", birth_date=date(1900, 1, 1))
    assert request.family_descr.children == [CreateNewPerson(name="Josh")]


def test_decode_update_person_request_omits_missing_optional_fields() -> None:
    payload = {
        "type": "UpdatePersonRequest",
        "stemmaId": "1",
        "personId": "2",
        "personDescr": {"type": "CreateNewPerson", "name": "Solo"},
    }
    request = decode_request(payload)
    assert isinstance(request, UpdatePersonRequest)
    assert request.person_descr == CreateNewPerson(name="Solo")


def test_encode_owned_stemmas_response_tags_with_type_field() -> None:
    response = OwnedStemmas(
        stemmas=[StemmaDescription(id="3", name="Tree", removable=True)],
        first_stemma=Stemma(
            people=[
                PersonDescription(
                    id="9",
                    name="John",
                    birth_date=date(1900, 1, 1),
                    death_date=None,
                    bio=None,
                    read_only=False,
                )
            ],
            families=[FamilyDescription(id="1", parents=["9"], children=[], read_only=False)],
        ),
    )
    encoded = encode_response(response)
    assert encoded == {
        "type": "OwnedStemmas",
        "stemmas": [{"type": "StemmaDescription", "id": "3", "name": "Tree", "removable": True}],
        "defaultStemmaId": None,
        "firstStemma": {
            "type": "Stemma",
            "people": [
                {
                    "type": "PersonDescription",
                    "id": "9",
                    "name": "John",
                    "birthDate": "1900-01-01",
                    "deathDate": None,
                    "bio": None,
                    "readOnly": False,
                }
            ],
            "families": [
                {"type": "FamilyDescription", "id": "1", "parents": ["9"], "children": [], "readOnly": False}
            ],
        },
    }


def test_encode_error_with_fields() -> None:
    assert encode_error(AccessToFamilyDenied(family_id="42")) == {
        "type": "AccessToFamilyDenied",
        "familyId": "42",
    }


def test_encode_error_without_fields() -> None:
    assert encode_error(IncompleteFamily()) == {"type": "IncompleteFamily"}
    assert encode_error(InvalidInviteToken()) == {"type": "InvalidInviteToken"}
