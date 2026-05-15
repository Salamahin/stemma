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
        "CreateFamilyRequest": {
            "stemmaId": "7",
            "familyDescr": {
                "parent1": {"ExistingPerson": {"id": "1"}},
                "parent2": {"CreateNewPerson": {"name": "Jane", "birthDate": "1900-01-01"}},
                "children": [{"CreateNewPerson": {"name": "Josh"}}],
            },
        }
    }
    request = decode_request(payload)
    assert isinstance(request, CreateFamilyRequest)
    assert request.stemmaId == "7"
    assert request.familyDescr.parent1 == ExistingPerson(id="1")
    assert request.familyDescr.parent2 == CreateNewPerson(name="Jane", birthDate=date(1900, 1, 1))
    assert request.familyDescr.children == [CreateNewPerson(name="Josh")]


def test_decode_update_person_request_omits_missing_optional_fields() -> None:
    payload = {"UpdatePersonRequest": {"stemmaId": "1", "personId": "2", "personDescr": {"name": "Solo"}}}
    request = decode_request(payload)
    assert isinstance(request, UpdatePersonRequest)
    assert request.personDescr == CreateNewPerson(name="Solo")


def test_encode_owned_stemmas_response_wraps_with_class_name() -> None:
    response = OwnedStemmas(
        stemmas=[StemmaDescription(id="3", name="Tree", removable=True)],
        firstStemma=Stemma(
            people=[
                PersonDescription(
                    id="9",
                    name="John",
                    birthDate=date(1900, 1, 1),
                    deathDate=None,
                    bio=None,
                    readOnly=False,
                )
            ],
            families=[FamilyDescription(id="1", parents=["9"], children=[], readOnly=False)],
        ),
    )
    encoded = encode_response(response)
    assert encoded == {
        "OwnedStemmas": {
            "stemmas": [{"id": "3", "name": "Tree", "removable": True}],
            "firstStemma": {
                "people": [
                    {
                        "id": "9",
                        "name": "John",
                        "birthDate": "1900-01-01",
                        "deathDate": None,
                        "bio": None,
                        "readOnly": False,
                    }
                ],
                "families": [{"id": "1", "parents": ["9"], "children": [], "readOnly": False}],
            },
        }
    }


def test_encode_error_with_fields() -> None:
    assert encode_error(AccessToFamilyDenied(familyId="42")) == {"AccessToFamilyDenied": {"familyId": "42"}}


def test_encode_error_without_fields() -> None:
    assert encode_error(IncompleteFamily()) == {"IncompleteFamily": {}}
    assert encode_error(InvalidInviteToken()) == {"InvalidInviteToken": {}}
