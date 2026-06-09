from datetime import date

import pytest

from stemma.domain.errors import (
    AccessToFamilyDenied,
    AccessToPersonDenied,
    AccessToStemmaDenied,
    ChildAlreadyBelongsToFamily,
    DuplicatedIds,
    IncompleteFamily,
    NoSuchPersonId,
    StemmaHasCycles,
)
from stemma.storage.storage_service import StorageService, _parse_date

from tests.factories import (
    JOHNS_BIRTHDAY,
    JOHNS_DEATHDAY,
    create_jabe,
    create_james,
    create_jane,
    create_jared,
    create_jake,
    create_jeff,
    create_jess,
    create_jill,
    create_john,
    create_josh,
    create_july,
    existing,
    family,
    render_families,
)


def test_can_create_different_family_with_both_parents_and_several_children(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill, create_josh))
    storage.create_family(user.user_id, sid, family(create_john)(create_josh))
    storage.create_family(user.user_id, sid, family(create_jane, create_john)())
    storage.create_family(user.user_id, sid, family()(create_jane, create_john))

    stemma = storage.stemma(user.user_id, sid)
    assert sorted(render_families(stemma)) == sorted(
        [
            "(Jane, John) parentsOf (Jill, Josh)",
            "(John) parentsOf (Josh)",
            "(Jane, John) parentsOf ()",
            "() parentsOf (Jane, John)",
        ]
    )


def test_create_orphan_person_adds_lone_person(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    stemma = storage.create_orphan_person(user.user_id, sid, create_john)
    assert len(stemma.people) == 1
    assert stemma.people[0].name == "John"
    assert stemma.families == []


def test_create_orphan_person_requires_stemma_access(storage: StorageService) -> None:
    owner = storage.get_or_create_user("owner@test.com")
    stranger = storage.get_or_create_user("stranger@test.com")
    sid = storage.create_stemma(owner.user_id, "test stemma")
    with pytest.raises(AccessToStemmaDenied):
        storage.create_orphan_person(stranger.user_id, sid, create_john)


def test_create_orphan_then_use_as_parent_in_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    stemma = storage.create_orphan_person(user.user_id, sid, create_john)
    john_id = stemma.people[0].id
    storage.create_family(user.user_id, sid, family(existing(john_id))(create_jill))
    final = storage.stemma(user.user_id, sid)
    assert sorted(render_families(final)) == ["(John) parentsOf (Jill)"]


def test_cant_create_family_with_single_parent(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    with pytest.raises(IncompleteFamily):
        storage.create_family(user.user_id, sid, family(create_john)())


def test_cant_create_family_with_single_child(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    with pytest.raises(IncompleteFamily):
        storage.create_family(user.user_id, sid, family()(create_jill))


def test_append_children_to_full_existing_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, f1 = storage.create_family(user.user_id, sid, family(create_james)(create_jane))
    james_id = f1.parents[0]
    _, f2 = storage.create_family(user.user_id, sid, family(existing(james_id), create_jill)(create_john))
    jill_id = f2.parents[1]
    storage.create_family(user.user_id, sid, family(existing(james_id), existing(jill_id))(create_josh))

    stemma = storage.stemma(user.user_id, sid)
    assert sorted(render_families(stemma)) == sorted(
        ["(James, Jill) parentsOf (John, Josh)", "(James) parentsOf (Jane)"]
    )


def test_append_children_to_incomplete_existing_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, f1 = storage.create_family(user.user_id, sid, family(create_james)(create_jane))
    james_id = f1.parents[0]
    storage.create_family(user.user_id, sid, family(existing(james_id))(create_john))

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(James) parentsOf (Jane, John)"]


def test_duplicated_ids_forbidden(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_james)(create_jill))
    james_id, jill_id = fam.parents[0], fam.children[0]
    with pytest.raises(DuplicatedIds) as exc:
        storage.update_family(
            user.user_id, sid, fam.id, family(existing(james_id), existing(james_id))(existing(jill_id))
        )
    assert exc.value.duplicated_ids == james_id


def test_child_can_belong_to_single_family_only(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_james)(create_jill))
    jill_id = fam.children[0]
    with pytest.raises(ChildAlreadyBelongsToFamily) as exc:
        storage.create_family(user.user_id, sid, family(create_jane)(existing(jill_id)))
    assert exc.value.family_id == fam.id
    assert exc.value.person_id == jill_id


def test_remove_person_drops_relations(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill, create_james))
    jill_id = fam.children[0]
    storage.create_family(user.user_id, sid, family(existing(jill_id), create_josh)(create_jake))
    storage.remove_person(user.user_id, sid, jill_id)

    stemma = storage.stemma(user.user_id, sid)
    assert sorted(render_families(stemma)) == sorted(
        ["(Jane, John) parentsOf (James)", "(Josh) parentsOf (Jake)"]
    )


def test_person_can_be_spouse_in_different_families(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_james, create_jane)(create_jill))
    james_id = fam.parents[0]
    storage.create_family(user.user_id, sid, family(existing(james_id))(create_july))

    stemma = storage.stemma(user.user_id, sid)
    assert sorted(render_families(stemma)) == sorted(
        ["(James, Jane) parentsOf (Jill)", "(James) parentsOf (July)"]
    )


def test_leaving_single_member_drops_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jill_id = fam.children[0]
    storage.create_family(user.user_id, sid, family(existing(jill_id))(create_july))
    storage.remove_person(user.user_id, sid, jill_id)

    stemma = storage.stemma(user.user_id, sid)
    assert stemma.families == []
    assert sorted(p.name for p in stemma.people) == ["Jane", "July"]


def test_can_update_existing_person(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jane_id = fam.parents[0]
    storage.update_person(user.user_id, sid, jane_id, create_john)

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(John) parentsOf (Jill)"]
    [john] = [p for p in stemma.people if p.id == jane_id]
    assert john.name == "John"
    assert john.birth_date == JOHNS_BIRTHDAY
    assert john.death_date == JOHNS_DEATHDAY


def test_can_update_existing_family(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "test stemma")
    _, fam = storage.create_family(
        user.user_id, sid, family(create_jane, create_john)(create_jill)
    )
    john_id = fam.parents[1]
    jill_id = fam.children[0]
    storage.update_family(
        user.user_id, sid, fam.id, family(create_july, existing(john_id))(existing(jill_id), create_james)
    )

    stemma = storage.stemma(user.user_id, sid)
    assert render_families(stemma) == ["(John, July) parentsOf (James, Jill)"]
    assert sorted(p.name for p in stemma.people) == sorted(["Jane", "John", "Jill", "July", "James"])


def test_users_have_separate_graphs(storage: StorageService) -> None:
    user = storage.get_or_create_user("user1@test.com")
    s1 = storage.create_stemma(user.user_id, "first stemma")
    storage.create_family(user.user_id, s1, family(create_jane, create_john)(create_josh, create_jill))
    s2 = storage.create_stemma(user.user_id, "second stemma")
    storage.create_family(user.user_id, s2, family(create_jake)(create_july, create_james))

    listed = storage.list_owned_stemmas(user.user_id)
    assert {(s.id, s.name, s.removable) for s in listed} == {
        (s1, "first stemma", True),
        (s2, "second stemma", True),
    }
    assert render_families(storage.stemma(user.user_id, s1)) == ["(Jane, John) parentsOf (Jill, Josh)"]
    assert render_families(storage.stemma(user.user_id, s2)) == ["(Jake) parentsOf (James, July)"]


def test_cant_update_person_if_not_owner(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    _, fam = storage.create_family(creator.user_id, sid, family(create_jane, create_john)(create_josh, create_jill))
    jane_id = fam.parents[0]
    with pytest.raises(AccessToPersonDenied):
        storage.remove_person(accessor.user_id, sid, jane_id)
    with pytest.raises(AccessToPersonDenied):
        storage.update_person(accessor.user_id, sid, jane_id, create_july)


def test_cant_update_family_if_not_owner(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    _, fam = storage.create_family(creator.user_id, sid, family(create_jane, create_john)(create_josh, create_jill))
    with pytest.raises(AccessToFamilyDenied):
        storage.remove_family(accessor.user_id, sid, fam.id)
    with pytest.raises(AccessToFamilyDenied):
        storage.update_family(accessor.user_id, sid, fam.id, family(create_james)(create_july))


def test_cant_request_stemma_if_not_owner(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    storage.create_family(creator.user_id, sid, family(create_jane, create_john)(create_josh, create_jill))
    with pytest.raises(AccessToStemmaDenied):
        storage.stemma(accessor.user_id, sid)


def test_when_updating_family_all_members_should_belong_to_graph(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    s1 = storage.create_stemma(user.user_id, "my first stemma")
    s2 = storage.create_stemma(user.user_id, "my second stemma")
    _, fam = storage.create_family(user.user_id, s1, family(create_jane, create_john)(create_josh, create_jill))
    jane_id, john_id = fam.parents
    josh_id, jill_id = fam.children
    with pytest.raises(NoSuchPersonId) as exc:
        storage.create_family(
            user.user_id,
            s2,
            family(existing(jane_id), existing(john_id))(existing(josh_id), existing(jill_id)),
        )
    assert exc.value.id == jane_id


def test_chown_affects_kinsmen_recursively(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    _, f1 = storage.create_family(creator.user_id, sid, family(create_jabe, create_jane)(create_jeff, create_july))
    jabe, jane = f1.parents
    jeff, july = f1.children
    _, f2 = storage.create_family(creator.user_id, sid, family(create_jared, existing(jeff))(create_jill))
    jared = f2.parents[0]
    jill = f2.children[0]
    _, f3 = storage.create_family(creator.user_id, sid, family(existing(july), create_josh)(create_jess))
    josh = f3.parents[1]
    jess = f3.children[0]
    storage.create_family(creator.user_id, sid, family(create_john)(existing(josh)))

    effect = storage.chown(accessor.user_id, sid, july)
    expected_families = {f1.id, f2.id, f3.id}
    expected_people = {jabe, jane, jeff, jared, jill, july, josh, jess}
    assert set(effect.affected_families) == expected_families
    assert set(effect.affected_people) == expected_people

    accessor_stemma = storage.stemma(accessor.user_id, sid)
    editable_people = {p.id for p in accessor_stemma.people if not p.read_only}
    editable_families = {f.id for f in accessor_stemma.families if not f.read_only}
    assert editable_people == expected_people
    assert editable_families == expected_families


def test_chown_grants_siblings(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    _, f1 = storage.create_family(creator.user_id, sid, family()(create_jill, create_josh))
    jill, josh = f1.children
    _, f2 = storage.create_family(creator.user_id, sid, family(existing(jill))(create_james))
    james = f2.children[0]
    _, f3 = storage.create_family(creator.user_id, sid, family(existing(josh), create_july)(create_jared))
    july = f3.parents[1]
    jared = f3.children[0]

    effect = storage.chown(accessor.user_id, sid, james)
    assert set(effect.affected_families) == {f1.id, f2.id, f3.id}
    assert set(effect.affected_people) == {jill, josh, july, james, jared}


def test_can_chown_multiple_times(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    _, fam = storage.create_family(creator.user_id, sid, family(create_jabe, create_jane)(create_jeff, create_july))
    july = fam.children[1]
    storage.chown(accessor.user_id, sid, july)
    storage.chown(accessor.user_id, sid, july)


def test_when_several_owners_stemma_not_removable(storage: StorageService) -> None:
    creator = storage.get_or_create_user("user1@test.com")
    accessor = storage.get_or_create_user("user2@test.com")
    sid = storage.create_stemma(creator.user_id, "my first stemma")
    _, fam = storage.create_family(creator.user_id, sid, family(create_jane)(create_jill))
    jill = fam.children[0]
    storage.chown(accessor.user_id, sid, jill)

    assert all(not s.removable for s in storage.list_owned_stemmas(creator.user_id))
    assert all(not s.removable for s in storage.list_owned_stemmas(accessor.user_id))


def test_can_remove_stemma_if_only_owner(storage: StorageService) -> None:
    user = storage.get_or_create_user("user1@test.com")
    sid = storage.create_stemma(user.user_id, "my first stemma")
    storage.remove_stemma(user.user_id, sid)
    assert storage.list_owned_stemmas(user.user_id) == []


def test_rename_stemma_only_affects_caller(storage: StorageService) -> None:
    creator = storage.get_or_create_user("creator@test.com")
    accessor = storage.get_or_create_user("accessor@test.com")
    sid = storage.create_stemma(creator.user_id, "shared name")
    _, fam = storage.create_family(creator.user_id, sid, family(create_jane)(create_jill))
    jill = fam.children[0]
    storage.chown(accessor.user_id, sid, jill)

    storage.rename_stemma(accessor.user_id, sid, "my private name")

    assert [s.name for s in storage.list_owned_stemmas(creator.user_id)] == ["shared name"]
    assert [s.name for s in storage.list_owned_stemmas(accessor.user_id)] == ["my private name"]


def test_rename_stemma_overwrites_previous_override(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "first")
    storage.rename_stemma(user.user_id, sid, "second")
    storage.rename_stemma(user.user_id, sid, "third")
    assert [s.name for s in storage.list_owned_stemmas(user.user_id)] == ["third"]


def test_rename_stemma_denied_if_not_owner(storage: StorageService) -> None:
    creator = storage.get_or_create_user("creator@test.com")
    other = storage.get_or_create_user("other@test.com")
    sid = storage.create_stemma(creator.user_id, "shared")
    with pytest.raises(AccessToStemmaDenied):
        storage.rename_stemma(other.user_id, sid, "hijack")


def test_can_clone_stemma(storage: StorageService) -> None:
    user = storage.get_or_create_user("user1@test.com")
    sid = storage.create_stemma(user.user_id, "original stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jill = fam.children[0]
    storage.create_family(user.user_id, sid, family(existing(jill))(create_july))

    cloned = storage.clone_stemma(user.user_id, sid, "cloned")
    original = storage.stemma(user.user_id, sid)
    assert set(render_families(original)) == set(render_families(cloned))


def test_can_add_parents_if_child_has_spouse_and_child(storage: StorageService) -> None:
    user = storage.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "stemma")
    _, f1 = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_jill))
    jane = f1.parents[0]
    storage.create_family(user.user_id, sid, family(create_james, create_july)(existing(jane)))

    stemma = storage.stemma(user.user_id, sid)
    assert sorted(render_families(stemma)) == sorted(
        ["(Jane, John) parentsOf (Jill)", "(James, July) parentsOf (Jane)"]
    )


def test_consanguineous_marriage_allowed(storage: StorageService) -> None:
    user = storage.get_or_create_user("user1@test.com")
    sid = storage.create_stemma(user.user_id, "my first stemma")
    _, f1 = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jane_id = f1.parents[0]
    jill_id = f1.children[0]
    _, f2 = storage.create_family(user.user_id, sid, family(existing(jane_id))(create_josh))
    josh_id = f2.children[0]
    _, f3 = storage.create_family(user.user_id, sid, family(existing(josh_id))(create_jabe))
    jabe_id = f3.children[0]
    storage.create_family(user.user_id, sid, family(existing(jabe_id), existing(jill_id))())

    stemma = storage.stemma(user.user_id, sid)
    parent_pairs = {tuple(sorted(f.parents)) for f in stemma.families}
    assert tuple(sorted([jabe_id, jill_id])) in parent_pairs


def test_self_descendant_cycle_prohibited(storage: StorageService) -> None:
    user = storage.get_or_create_user("user1@test.com")
    sid = storage.create_stemma(user.user_id, "my first stemma")
    _, f1 = storage.create_family(user.user_id, sid, family(create_jane)(create_jill))
    jane_id = f1.parents[0]
    jill_id = f1.children[0]
    with pytest.raises(StemmaHasCycles):
        storage.create_family(user.user_id, sid, family(existing(jill_id))(existing(jane_id)))


@pytest.mark.parametrize("value", [None, ""])
def test_parse_date_returns_none_for_falsy(value: str | None) -> None:
    assert _parse_date(value) is None


def test_parse_date_parses_iso_string() -> None:
    assert _parse_date("1900-01-15") == date(1900, 1, 15)
