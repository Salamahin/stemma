from collections import defaultdict
from dataclasses import dataclass, replace
from typing import Any

from sqlalchemy import Engine, Table, and_, delete, exists, func, insert, select, text, update
from sqlalchemy.engine import Connection

from stemma.domain.errors import (
    AccessToFamilyDenied,
    AccessToPersonDenied,
    AccessToStemmaDenied,
    ChildAlreadyBelongsToFamily,
    DuplicatedIds,
    IncompleteFamily,
    IsNotTheOnlyStemmaOwner,
    NoSuchPersonId,
    StemmaHasCycles,
)
from stemma.domain.requests import CreateFamily, CreateNewPerson, ExistingPerson, PersonDefinition
from stemma.domain.responses import FamilyDescription, PersonDescription, Stemma, StemmaDescription
from stemma.domain.user import User
from stemma.services.stemma_dfs import has_cycles
from stemma.storage.effects import ChownEffect
from stemma.storage.schema import (
    children,
    families,
    family_owners,
    people,
    person_owners,
    spouses,
    stemma_owners,
    stemma_users,
    stemmas,
)


class StorageService:
    def __init__(self, engine: Engine) -> None:
        self._engine = engine

    def get_or_create_user(self, email: str) -> User:
        with self._engine.begin() as conn:
            row = conn.execute(select(stemma_users.c.id).where(stemma_users.c.email == email)).first()
            if row is not None:
                return User(user_id=str(row.id), email=email)
            user_id = conn.execute(
                insert(stemma_users).values(email=email).returning(stemma_users.c.id)
            ).scalar_one()
            return User(user_id=str(user_id), email=email)

    def create_stemma(self, user_id: str, name: str) -> str:
        with self._engine.begin() as conn:
            return self._make_new_stemma(conn, int(user_id), name)

    def list_owned_stemmas(self, user_id: str) -> list[StemmaDescription]:
        with self._engine.begin() as conn:
            owned = (
                select(stemma_owners.c.stemmaId)
                .where(stemma_owners.c.ownerId == int(user_id))
                .subquery()
            )
            owners_counted = (
                select(owned.c.stemmaId.label("sid"), func.count(stemma_owners.c.ownerId).label("n"))
                .join_from(owned, stemma_owners, owned.c.stemmaId == stemma_owners.c.stemmaId)
                .group_by(owned.c.stemmaId)
                .subquery()
            )
            stmt = select(stemmas.c.id, stemmas.c.name, owners_counted.c.n).join_from(
                stemmas, owners_counted, stemmas.c.id == owners_counted.c.sid
            )
            return [
                StemmaDescription(id=str(sid), name=sname, removable=n == 1)
                for (sid, sname, n) in conn.execute(stmt)
            ]

    def remove_stemma(self, user_id: str, stemma_id: str) -> None:
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, int(stemma_id), int(user_id))
            owners_count = conn.execute(
                select(func.count())
                .select_from(stemma_owners)
                .where(stemma_owners.c.stemmaId == int(stemma_id))
            ).scalar_one()
            if owners_count != 1:
                raise IsNotTheOnlyStemmaOwner(stemmaId=stemma_id)
            conn.execute(delete(stemmas).where(stemmas.c.id == int(stemma_id)))

    def create_family(self, user_id: str, stemma_id: str, family: CreateFamily) -> tuple[Stemma, FamilyDescription]:
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, int(stemma_id), int(user_id))
            parents = [p for p in (family.parent1, family.parent2) if p is not None]
            existing_match = self._try_find_matching_family(conn, parents, int(user_id))
            if existing_match is not None:
                family_id = existing_match
            else:
                family_id = conn.execute(
                    insert(families).values(stemmaId=int(stemma_id)).returning(families.c.id)
                ).scalar_one()
                conn.execute(insert(family_owners).values(ownerId=int(user_id), familyId=family_id))

            descr = self._link_family_members(conn, int(user_id), int(stemma_id), family_id, family)
            stemma = self._describe_stemma(conn, int(user_id), int(stemma_id))
            if has_cycles(stemma):
                raise StemmaHasCycles()
            return stemma, descr

    def update_family(self, user_id: str, family_id: str, family: CreateFamily) -> tuple[Stemma, FamilyDescription]:
        with self._engine.begin() as conn:
            self._check_family_access(conn, int(family_id), int(user_id))
            self._unlink_family_members(conn, int(family_id))
            stemma_id = conn.execute(
                select(families.c.stemmaId).where(families.c.id == int(family_id))
            ).scalar_one()
            descr = self._link_family_members(conn, int(user_id), stemma_id, int(family_id), family)
            stemma = self._describe_stemma(conn, int(user_id), stemma_id)
            if has_cycles(stemma):
                raise StemmaHasCycles()
            return stemma, descr

    def remove_person(self, user_id: str, person_id: str) -> None:
        with self._engine.begin() as conn:
            self._check_person_access(conn, int(person_id), int(user_id))
            conn.execute(delete(people).where(people.c.id == int(person_id)))
            self._drop_empty_families(conn)

    def remove_family(self, user_id: str, family_id: str) -> None:
        with self._engine.begin() as conn:
            self._check_family_access(conn, int(family_id), int(user_id))
            self._unlink_family_members(conn, int(family_id))
            conn.execute(delete(families).where(families.c.id == int(family_id)))

    def update_person(self, user_id: str, person_id: str, description: CreateNewPerson) -> None:
        with self._engine.begin() as conn:
            self._check_person_access(conn, int(person_id), int(user_id))
            conn.execute(
                update(people)
                .where(people.c.id == int(person_id))
                .values(
                    name=description.name,
                    birthDate=description.birthDate,
                    deathDate=description.deathDate,
                    bio=description.bio,
                )
            )

    def clone_stemma(self, user_id: str, stemma_id: str, new_stemma_name: str) -> Stemma:
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, int(stemma_id), int(user_id))
            new_stemma_id = self._make_new_stemma(conn, int(user_id), new_stemma_name)
            source = self._describe_stemma(conn, int(user_id), int(stemma_id))

            old_to_new_person: dict[str, int] = {}
            for person in source.people:
                new_id = conn.execute(
                    insert(people)
                    .values(
                        name=person.name,
                        birthDate=person.birthDate,
                        deathDate=person.deathDate,
                        bio=person.bio,
                        stemmaId=new_stemma_id,
                    )
                    .returning(people.c.id)
                ).scalar_one()
                old_to_new_person[person.id] = new_id
                conn.execute(insert(person_owners).values(ownerId=int(user_id), personId=new_id))

            old_to_new_family: dict[str, int] = {}
            for fam in source.families:
                new_fid = conn.execute(
                    insert(families).values(stemmaId=new_stemma_id).returning(families.c.id)
                ).scalar_one()
                old_to_new_family[fam.id] = new_fid
                conn.execute(insert(family_owners).values(ownerId=int(user_id), familyId=new_fid))
                for parent_old in fam.parents:
                    conn.execute(
                        insert(spouses).values(personId=old_to_new_person[parent_old], familyId=new_fid)
                    )
                for child_old in fam.children:
                    conn.execute(
                        insert(children).values(personId=old_to_new_person[child_old], familyId=new_fid)
                    )

            return Stemma(
                people=[replace(p, id=str(old_to_new_person[p.id]), readOnly=False) for p in source.people],
                families=[
                    FamilyDescription(
                        id=str(old_to_new_family[f.id]),
                        parents=[str(old_to_new_person[pid]) for pid in f.parents],
                        children=[str(old_to_new_person[cid]) for cid in f.children],
                        readOnly=False,
                    )
                    for f in source.families
                ],
            )

    def stemma(self, user_id: str, stemma_id: str) -> Stemma:
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, int(stemma_id), int(user_id))
            return self._describe_stemma(conn, int(user_id), int(stemma_id))

    def chown(self, user_id: str, stemma_id: str, target_person_id: str) -> ChownEffect:
        with self._engine.begin() as conn:
            kinsmen_families = [
                row[0]
                for row in conn.execute(_KINSMEN_FAMILIES_SQL, {"init_person_id": int(target_person_id)})
            ]
            if kinsmen_families:
                affected_people_rows = conn.execute(
                    select(spouses.c.personId)
                    .where(spouses.c.familyId.in_(kinsmen_families))
                    .union(select(children.c.personId).where(children.c.familyId.in_(kinsmen_families)))
                ).all()
                affected_people = [row[0] for row in affected_people_rows]
            else:
                affected_people = []

            for fid in kinsmen_families:
                self._add_owner_if_needed(conn, _FAMILY_OWNERSHIP, int(user_id), fid)
            for pid in affected_people:
                self._add_owner_if_needed(conn, _PERSON_OWNERSHIP, int(user_id), pid)
            self._add_owner_if_needed(conn, _STEMMA_OWNERSHIP, int(user_id), int(stemma_id))

            return ChownEffect(
                affected_families=[str(f) for f in kinsmen_families],
                affected_people=[str(p) for p in affected_people],
            )

    def owns_person(self, user_id: str, person_id: str) -> bool:
        with self._engine.begin() as conn:
            return conn.execute(
                select(
                    exists().where(
                        and_(
                            person_owners.c.ownerId == int(user_id),
                            person_owners.c.personId == int(person_id),
                        )
                    )
                )
            ).scalar_one()

    def _make_new_stemma(self, conn: Connection, user_id: int, name: str) -> str:
        new_id = conn.execute(insert(stemmas).values(name=name).returning(stemmas.c.id)).scalar_one()
        conn.execute(insert(stemma_owners).values(ownerId=user_id, stemmaId=new_id))
        return str(new_id)

    def _check_ownership(
        self, conn: Connection, ownership: "_Ownership", target_id: int, user_id: int
    ) -> None:
        is_owner = conn.execute(
            select(
                exists().where(
                    and_(
                        ownership.owner_col == user_id,
                        ownership.target_col == target_id,
                    )
                )
            )
        ).scalar_one()
        if not is_owner:
            raise ownership.denied_exc(**{ownership.denied_field: str(target_id)})

    def _check_stemma_access(self, conn: Connection, stemma_id: int, user_id: int) -> None:
        self._check_ownership(conn, _STEMMA_OWNERSHIP, stemma_id, user_id)

    def _check_person_access(self, conn: Connection, person_id: int, user_id: int) -> None:
        self._check_ownership(conn, _PERSON_OWNERSHIP, person_id, user_id)

    def _check_family_access(self, conn: Connection, family_id: int, user_id: int) -> None:
        self._check_ownership(conn, _FAMILY_OWNERSHIP, family_id, user_id)

    def _check_person_belongs_to_stemma(self, conn: Connection, person_id: int, stemma_id: int) -> None:
        present = conn.execute(
            select(exists().where(and_(people.c.id == person_id, people.c.stemmaId == stemma_id)))
        ).scalar_one()
        if not present:
            raise NoSuchPersonId(id=str(person_id))

    def _get_or_create_person(
        self, conn: Connection, stemma_id: int, user_id: int, pd: PersonDefinition
    ) -> int:
        if isinstance(pd, ExistingPerson):
            self._check_person_access(conn, int(pd.id), user_id)
            self._check_person_belongs_to_stemma(conn, int(pd.id), stemma_id)
            return int(pd.id)
        new_id = conn.execute(
            insert(people)
            .values(
                name=pd.name,
                birthDate=pd.birthDate,
                deathDate=pd.deathDate,
                bio=pd.bio,
                stemmaId=stemma_id,
            )
            .returning(people.c.id)
        ).scalar_one()
        conn.execute(insert(person_owners).values(ownerId=user_id, personId=new_id))
        return new_id

    def _link_family_members(
        self, conn: Connection, user_id: int, stemma_id: int, family_id: int, family: CreateFamily
    ) -> FamilyDescription:
        parents = [p for p in (family.parent1, family.parent2) if p is not None]
        kids = family.children
        if len(parents) + len(kids) < 2:
            raise IncompleteFamily()
        _ensure_no_duplicate_ids(parents + kids)

        parent_ids = [self._get_or_create_person(conn, stemma_id, user_id, p) for p in parents]
        child_ids = [self._get_or_create_person(conn, stemma_id, user_id, c) for c in kids]

        for pid in parent_ids:
            self._create_spouse_relation_if_not_exist(conn, pid, family_id)
        for cid in child_ids:
            self._create_child_relation_or_fail(conn, cid, family_id)

        return FamilyDescription(
            id=str(family_id),
            parents=[str(p) for p in parent_ids],
            children=[str(c) for c in child_ids],
            readOnly=True,
        )

    def _unlink_family_members(self, conn: Connection, family_id: int) -> None:
        conn.execute(delete(spouses).where(spouses.c.familyId == family_id))
        conn.execute(delete(children).where(children.c.familyId == family_id))

    def _try_find_matching_family(
        self, conn: Connection, parents: list[PersonDefinition], user_id: int
    ) -> int | None:
        existing_parent_ids = [int(p.id) for p in parents if isinstance(p, ExistingPerson)]
        if not parents or len(parents) != len(existing_parent_ids):
            return None

        head_pid = existing_parent_ids[0]
        target_set = set(existing_parent_ids)

        rows = conn.execute(
            select(spouses.c.familyId, spouses.c.personId).where(
                spouses.c.familyId.in_(select(spouses.c.familyId).where(spouses.c.personId == head_pid))
            )
        ).all()

        by_family: dict[int, set[int]] = defaultdict(set)
        for fid, pid in rows:
            by_family[fid].add(pid)

        for fid, members in by_family.items():
            if members == target_set:
                self._check_family_access(conn, fid, user_id)
                return fid
        return None

    def _describe_stemma(self, conn: Connection, user_id: int, stemma_id: int) -> Stemma:
        person_rows = conn.execute(
            select(
                people.c.id,
                people.c.name,
                people.c.birthDate,
                people.c.deathDate,
                people.c.bio,
                exists()
                .where(
                    and_(
                        person_owners.c.ownerId == user_id,
                        person_owners.c.personId == people.c.id,
                    )
                )
                .label("is_owner"),
            ).where(people.c.stemmaId == stemma_id)
        ).all()

        people_descr = [
            PersonDescription(
                id=str(pid),
                name=name,
                birthDate=birth,
                deathDate=death,
                bio=bio,
                readOnly=not is_owner,
            )
            for (pid, name, birth, death, bio, is_owner) in person_rows
        ]

        fam_ids_for_stemma = select(families.c.id).where(families.c.stemmaId == stemma_id).scalar_subquery()
        spouse_rows = conn.execute(
            select(
                spouses.c.familyId,
                spouses.c.personId,
                exists()
                .where(
                    and_(
                        family_owners.c.ownerId == user_id,
                        family_owners.c.familyId == spouses.c.familyId,
                    )
                )
                .label("is_owner"),
            ).where(spouses.c.familyId.in_(fam_ids_for_stemma))
        ).all()
        child_rows = conn.execute(
            select(
                children.c.familyId,
                children.c.personId,
                exists()
                .where(
                    and_(
                        family_owners.c.ownerId == user_id,
                        family_owners.c.familyId == children.c.familyId,
                    )
                )
                .label("is_owner"),
            ).where(children.c.familyId.in_(fam_ids_for_stemma))
        ).all()

        family_read_only: dict[str, bool] = {}
        family_spouses: dict[str, set[str]] = defaultdict(set)
        family_children: dict[str, set[str]] = defaultdict(set)

        for fid, pid, is_owner in spouse_rows:
            family_spouses[str(fid)].add(str(pid))
            family_read_only[str(fid)] = not is_owner
        for fid, pid, is_owner in child_rows:
            family_children[str(fid)].add(str(pid))
            family_read_only[str(fid)] = not is_owner

        families_descr = [
            FamilyDescription(
                id=fid,
                parents=list(family_spouses[fid]),
                children=list(family_children[fid]),
                readOnly=read_only,
            )
            for fid, read_only in family_read_only.items()
        ]

        return Stemma(people=people_descr, families=families_descr)

    def _drop_empty_families(self, conn: Connection) -> None:
        combined = select(spouses.c.familyId).union_all(select(children.c.familyId)).subquery()
        empty_family_ids = (
            select(combined.c.familyId)
            .group_by(combined.c.familyId)
            .having(func.count() < 2)
        )
        fids = [row[0] for row in conn.execute(empty_family_ids)]
        if fids:
            conn.execute(delete(families).where(families.c.id.in_(fids)))

    def _create_spouse_relation_if_not_exist(self, conn: Connection, person_id: int, family_id: int) -> None:
        exists_row = conn.execute(
            select(
                exists().where(and_(spouses.c.personId == person_id, spouses.c.familyId == family_id))
            )
        ).scalar_one()
        if not exists_row:
            conn.execute(insert(spouses).values(personId=person_id, familyId=family_id))

    def _create_child_relation_or_fail(self, conn: Connection, person_id: int, family_id: int) -> None:
        existing = [
            row[0]
            for row in conn.execute(select(children.c.familyId).where(children.c.personId == person_id))
        ]
        if not existing:
            conn.execute(insert(children).values(personId=person_id, familyId=family_id))
            return
        if len(existing) == 1 and existing[0] == family_id:
            return
        other = next(f for f in existing if f != family_id)
        raise ChildAlreadyBelongsToFamily(familyId=str(other), personId=str(person_id))

    def _add_owner_if_needed(
        self, conn: Connection, ownership: "_Ownership", user_id: int, target_id: int
    ) -> None:
        present = conn.execute(
            select(
                exists().where(
                    and_(
                        ownership.owner_col == user_id,
                        ownership.target_col == target_id,
                    )
                )
            )
        ).scalar_one()
        if not present:
            conn.execute(
                insert(ownership.table).values(ownerId=user_id, **{ownership.target_key: target_id})
            )


def _ensure_no_duplicate_ids(definitions: list[PersonDefinition]) -> None:
    seen: dict[str, int] = defaultdict(int)
    for pd in definitions:
        if isinstance(pd, ExistingPerson):
            seen[pd.id] += 1
    for pid, count in seen.items():
        if count > 1:
            raise DuplicatedIds(duplicatedIds=pid)


@dataclass(frozen=True)
class _Ownership:
    table: Table
    owner_col: Any
    target_col: Any
    target_key: str
    denied_exc: type[Exception]
    denied_field: str


_STEMMA_OWNERSHIP = _Ownership(
    table=stemma_owners,
    owner_col=stemma_owners.c.ownerId,
    target_col=stemma_owners.c.stemmaId,
    target_key="stemmaId",
    denied_exc=AccessToStemmaDenied,
    denied_field="stemmaId",
)
_PERSON_OWNERSHIP = _Ownership(
    table=person_owners,
    owner_col=person_owners.c.ownerId,
    target_col=person_owners.c.personId,
    target_key="personId",
    denied_exc=AccessToPersonDenied,
    denied_field="personId",
)
_FAMILY_OWNERSHIP = _Ownership(
    table=family_owners,
    owner_col=family_owners.c.ownerId,
    target_col=family_owners.c.familyId,
    target_key="familyId",
    denied_exc=AccessToFamilyDenied,
    denied_field="familyId",
)


_KINSMEN_FAMILIES_SQL = text(
    """
    with recursive
      "PersonFamilies" as (
        select coalesce(s."personId", c."personId") as "personId",
               s."familyId" as "spouseOf",
               c."familyId" as "childOf"
        from "Spouse" s full join "Child" c on s."personId" = c."personId"
      ),
      "Ancestors" as (
        select "personId", "spouseOf", "childOf" from "PersonFamilies" where "personId" = :init_person_id
        union
        select pf."personId", pf."spouseOf", pf."childOf"
        from "Ancestors" anc inner join "PersonFamilies" pf on anc."childOf" = pf."spouseOf"
      ),
      "Siblings" as (
        select pf."personId", pf."spouseOf", pf."childOf"
        from "Ancestors" a
        inner join "PersonFamilies" pf on pf."childOf" = a."childOf"
      ),
      "BloodRelatives" as (
        select * from "Ancestors" union select * from "Siblings"
      ),
      "Dependees" as (
        select * from "BloodRelatives"
        union
        select pf."personId", pf."spouseOf", pf."childOf"
        from "Dependees" dep inner join "PersonFamilies" pf on dep."spouseOf" = pf."childOf"
      ),
      "KinsmenFamilies" as (
        select "spouseOf" as "familyId" from "Dependees"
        union
        select "childOf" as "familyId" from "Dependees"
      )
    select "familyId" from "KinsmenFamilies" where "familyId" is not null
    """
)
