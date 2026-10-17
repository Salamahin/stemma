import pytest
from pydantic import ValidationError

from stemma.domain.codec import decode_request
from stemma.domain.dates import format_partial_date, parse_partial_date
from stemma.domain.requests import CreateNewPerson, CreateOrphanPersonRequest
from stemma.storage.storage_service import StorageService


@pytest.mark.parametrize(
    "value",
    ["1899", "1899-03", "1899-03-16", "~1899", "~1899-03", "~1899-03-16", "0988"],
)
def test_partial_dates_are_accepted_as_written(value: str) -> None:
    assert CreateNewPerson(name="x", birth_date=value).birth_date == value


@pytest.mark.parametrize("value", ["1899-13", "1899-02-30", "18990", "abc", "1899-3", "~", "1899-03-16T00:00"])
def test_invalid_partial_dates_are_rejected(value: str) -> None:
    with pytest.raises(ValidationError):
        CreateNewPerson(name="x", birth_date=value)


def test_codec_rejects_a_bad_partial_date() -> None:
    # dispatch.py turns this into RequestDeserializationProblem for the client.
    with pytest.raises(ValidationError):
        decode_request(
            {
                "type": "CreateOrphanPersonRequest",
                "stemmaId": "1",
                "personDescr": {"type": "CreateNewPerson", "name": "x", "birthDate": "1899-13"},
            }
        )


def test_codec_keeps_the_precision() -> None:
    request = decode_request(
        {
            "type": "CreateOrphanPersonRequest",
            "stemmaId": "1",
            "personDescr": {"type": "CreateNewPerson", "name": "x", "birthDate": "~1820", "deathDate": "1899-03"},
        }
    )
    assert isinstance(request, CreateOrphanPersonRequest)
    assert request.person_descr == CreateNewPerson(name="x", birth_date="~1820", death_date="1899-03")


def test_storage_round_trips_partial_dates(storage: StorageService) -> None:
    user = storage.get_or_create_user("u@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    storage.create_orphan_person(user.user_id, sid, CreateNewPerson(name="Ivan", birth_date="~1819", death_date="1890-05"))
    [person] = storage.stemma(user.user_id, sid).people
    assert person.birth_date == "~1819"
    assert person.death_date == "1890-05"


def test_parse_and_format() -> None:
    assert parse_partial_date("~1899-03") == (True, 1899, 3, None)
    assert parse_partial_date("1899-03-16") == (False, 1899, 3, 16)
    assert format_partial_date(True, 1899, None, None) == "~1899"
