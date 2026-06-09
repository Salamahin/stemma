from stemma.domain.responses import FamilyDescription, Stemma
from stemma.services.stemma_dfs import has_cycles


def _family(fid: str, parents: list[str], children: list[str]) -> FamilyDescription:
    return FamilyDescription(id=fid, parents=parents, children=children, read_only=False)


def test_minimal_stemma_has_no_cycles() -> None:
    stemma = Stemma(people=[], families=[_family("1", ["mother", "father"], ["child"])])
    assert has_cycles(stemma) is False


def test_marriage_between_shared_ancestor_descendants_is_not_a_cycle() -> None:
    stemma = Stemma(
        people=[],
        families=[
            _family("1", ["Ekaterina", "Ivan"], []),
            _family("2", ["Ivan", "Marina"], ["Petr"]),
            _family("3", ["Petr", "Ekaterina"], []),
        ],
    )
    assert has_cycles(stemma) is False


def test_more_complicated_stemma_with_no_cycles() -> None:
    stemma = Stemma(
        people=[],
        families=[
            _family("1", ["Marina", "Ivan"], ["Petr"]),
            _family("2", ["Petr"], ["Ekaterina"]),
            _family("3", ["Aleksei", "Ekaterina"], ["Eva"]),
        ],
    )
    assert has_cycles(stemma) is False


def test_self_descendant_directed_cycle_detected() -> None:
    stemma = Stemma(
        people=[],
        families=[
            _family("1", ["Jane"], ["Jill"]),
            _family("2", ["Jill"], ["Jane"]),
        ],
    )
    assert has_cycles(stemma) is True


def test_cousin_marriage_with_children_not_a_cycle() -> None:
    stemma = Stemma(
        people=[],
        families=[
            _family("1", ["Ancestor"], ["Aunt", "Uncle"]),
            _family("2", ["Aunt"], ["Cousin1"]),
            _family("3", ["Uncle"], ["Cousin2"]),
            _family("4", ["Cousin1", "Cousin2"], ["GreatGrandchild"]),
        ],
    )
    assert has_cycles(stemma) is False
