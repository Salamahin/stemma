from stemma.services.person_search import normalize_ru, search_people, to_latin_variants


def _people(*names: str) -> list[dict]:
    return [{"id": str(i), "name": n} for i, n in enumerate(names)]


def _names(results: list[dict]) -> list[str]:
    return [r["name"] for r in results]


def test_normalize_folds_yo_and_short_i() -> None:
    assert normalize_ru("Семён") == "семен"
    assert normalize_ru("Андрей") == "андреи"


def test_substring_match_case_insensitive() -> None:
    results = search_people("ivan", _people("Ivan Petrov", "Maria Petrova"))
    assert _names(results) == ["Ivan Petrov"]


def test_matches_across_yo_spelling() -> None:
    results = search_people("Семен", _people("Пётр Семёнов", "Иван Кузнецов"))
    assert _names(results) == ["Пётр Семёнов"]


def test_cyrillic_query_matches_latin_name() -> None:
    # transliteration bridges alphabets both ways
    assert to_latin_variants("Иванов") <= {"ivanov"} | to_latin_variants("Иванов")
    results = search_people("Иванов", _people("Sergey Ivanov", "Anna Smirnova"))
    assert _names(results) == ["Sergey Ivanov"]


def test_tolerates_a_typo() -> None:
    results = search_people("Кузнецов", _people("Кузнецов Иван", "Петров Пётр"))
    assert "Кузнецов Иван" in _names(results)
    typo = search_people("Кузнецев", _people("Кузнецов Иван"))
    assert _names(typo) == ["Кузнецов Иван"]


def test_skips_blank_names_and_short_queries() -> None:
    assert search_people("Иван", _people("", "   ")) == []
    assert search_people("и", _people("Иван")) == []


def test_ranks_stronger_matches_first_and_limits() -> None:
    people = _people("Иван", "Иван Петров", "Иванова Мария", "Совсем другой")
    results = search_people("Иван", people, limit=2)
    assert len(results) == 2
    assert "Совсем другой" not in _names(results)
