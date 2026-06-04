import pytest

from stemma.domain.errors import (
    AccessToPersonDenied,
    AmbiguousLinkTarget,
    NoSuchPersonId,
    SpouseLinkAlreadyExists,
    StemmaHasCycles,
    TooManyParents,
)
from stemma.storage.storage_service import StorageService

from tests.factories import (
    create_james,
    create_jane,
    create_jill,
    create_john,
    create_july,
    create_josh,
    existing,
    family,
    render_families,
)


def _orphan_ids(storage: StorageService, user_id: str, sid: str, *definitions) -> list[str]:
    ids: list[str] = []
    for definition in definitions:
        before = {p.id for p in storage.stemma(user_id, sid).people}
        stemma = storage.create_orphan_person(user_id, sid, definition)
        new_ids = [p.id for p in stemma.people if p.id not in before]
        assert len(new_ids) == 1
        ids.append(new_ids[0])
    return ids


def test_link_spouse_creates_new_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    [jane_id, john_id] = _orphan_ids(storage, user.user_id, sid, create_jane, create_john)

    storage.link_persons(user.user_id, sid, jane_id, john_id, "spouse")

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(Jane, John) parentsOf ()"]


def test_link_spouse_rejects_existing_pair(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill))
    jane_id, john_id = fam.parents
    with pytest.raises(SpouseLinkAlreadyExists) as exc:
        storage.link_persons(user.user_id, sid, jane_id, john_id, "spouse")
    assert exc.value.family_id == fam.id


def test_link_child_to_couple_appends_to_existing_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill))
    jane_id = fam.parents[0]
    [josh_id] = _orphan_ids(storage, user.user_id, sid, create_josh)

    storage.link_persons(user.user_id, sid, jane_id, josh_id, "child")

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(Jane, John) parentsOf (Jill, Josh)"]


def test_link_child_creates_new_family_for_orphan_parent(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    [jane_id, jill_id] = _orphan_ids(storage, user.user_id, sid, create_jane, create_jill)

    storage.link_persons(user.user_id, sid, jane_id, jill_id, "child")

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(Jane) parentsOf (Jill)"]


def test_link_child_ambiguous_when_parent_in_multiple_families(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    _, f1 = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill))
    jane_id = f1.parents[0]
    storage.create_family(user.user_id, sid, family(existing(jane_id), create_james)(create_july))
    [josh_id] = _orphan_ids(storage, user.user_id, sid, create_josh)

    with pytest.raises(AmbiguousLinkTarget) as exc:
        storage.link_persons(user.user_id, sid, jane_id, josh_id, "child")
    assert exc.value.person_id == jane_id


def test_link_parent_to_orphan_child_creates_new_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    [jill_id, jane_id] = _orphan_ids(storage, user.user_id, sid, create_jill, create_jane)

    storage.link_persons(user.user_id, sid, jill_id, jane_id, "parent")

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(Jane) parentsOf (Jill)"]


def test_link_parent_adds_second_parent_to_single_parent_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jill_id = fam.children[0]
    [john_id] = _orphan_ids(storage, user.user_id, sid, create_john)

    storage.link_persons(user.user_id, sid, jill_id, john_id, "parent")

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(Jane, John) parentsOf (Jill)"]


def test_link_parent_rejects_when_family_already_has_two_parents(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill))
    jill_id = fam.children[0]
    [james_id] = _orphan_ids(storage, user.user_id, sid, create_james)

    with pytest.raises(TooManyParents) as exc:
        storage.link_persons(user.user_id, sid, jill_id, james_id, "parent")
    assert exc.value.family_id == fam.id


def test_link_persons_rejects_cycle(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    _, f1 = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jane_id = f1.parents[0]
    jill_id = f1.children[0]

    with pytest.raises(StemmaHasCycles):
        storage.link_persons(user.user_id, sid, jane_id, jill_id, "parent")


def test_link_persons_requires_known_person(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "s")
    [jane_id] = _orphan_ids(storage, user.user_id, sid, create_jane)
    with pytest.raises(NoSuchPersonId):
        storage.link_persons(user.user_id, sid, jane_id, "missing-id", "spouse")


def test_link_persons_requires_person_ownership(storage: StorageService) -> None:
    owner = storage.get_or_create_user("owner@test.com")
    stranger = storage.get_or_create_user("stranger@test.com")
    sid = storage.create_stemma(owner.user_id, "s")
    [jane_id, john_id] = _orphan_ids(storage, owner.user_id, sid, create_jane, create_john)
    storage.chown(stranger.user_id, sid, jane_id)
    with pytest.raises(AccessToPersonDenied):
        storage.link_persons(stranger.user_id, sid, jane_id, john_id, "spouse")
