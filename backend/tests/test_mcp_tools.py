from stemma.services.mcp_tools import _search_people


def _response(count: int) -> dict:
    return {"people": [{"id": str(i), "name": f"Иван {i}", "bio": "x"} for i in range(count)]}


def test_search_reports_the_total_not_the_truncated_length() -> None:
    result = _search_people({"query": "Иван"}, _response(25))
    assert result["count"] == 25
    assert len(result["people"]) == 20  # default limit


def test_search_honours_a_client_limit() -> None:
    result = _search_people({"query": "Иван", "limit": 3}, _response(25))
    assert result["count"] == 25
    assert len(result["people"]) == 3


def test_search_clamps_a_nonsense_limit() -> None:
    assert len(_search_people({"query": "Иван", "limit": 0}, _response(5))["people"]) == 1
    assert len(_search_people({"query": "Иван", "limit": 999}, _response(5))["people"]) == 5


def test_person_name_schema_tells_the_assistant_how_to_write_unknown_people() -> None:
    from stemma.services.mcp_tools import _person_write_schema

    description = _person_write_schema({})["properties"]["name"]["description"]
    assert "???" in description
    assert "empty string" in description
