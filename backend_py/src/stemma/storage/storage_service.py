from collections import defaultdict
from dataclasses import replace

from sqlalchemy import Engine, and_, delete, exists, func, insert, select, text, update
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
        user_pk = int(user_id)
        with self._engine.begin() as conn:
            return self._make_new_stemma(conn, user_pk, name)

    def list_owned_stemmas(self, user_id: str) -> list[StemmaDescription]:
        user_pk = int(user_id)
        with self._engine.begin() as conn:
            owned = (
                select(stemma_owners.c.stemmaId).where(stemma_owners.c.ownerId == user_pk).subquery()
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
        user_pk, stemma_pk = int(user_id), int(stemma_id)
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, stemma_pk, user_pk)
            owners_count = conn.execute(
                select(func.count())
                .select_from(stemma_owners)
                .where(stemma_owners.c.stemmaId == stemma_pk)
            ).scalar_one()
            if owners_count != 1:
                raise IsNotTheOnlyStemmaOwner(stemma_id=stemma_id)
            conn.execute(delete(stemmas).where(stemmas.c.id == stemma_pk))

    def create_family(
        self, user_id: str, stemma_id: str, family: CreateFamily
    ) -> tuple[Stemma, FamilyDescription]:
        user_pk, stemma_pk = int(user_id), int(stemma_id)
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, stemma_pk, user_pk)
            parents = [p for p in (family.parent1, family.parent2) if p is not None]
            existing_match = self._try_find_matching_family(conn, parents, user_pk)
            if existing_match is not None:
                family_pk = existing_match
            else:
                family_pk = conn.execute(
                    insert(families).values(stemmaId=stemma_pk).returning(families.c.id)
                ).scalar_one()
                self._grant_family_owner(conn, user_pk, family_pk)

            descr = self._link_family_members(conn, user_pk, stemma_pk, family_pk, family)
            stemma = self._describe_stemma(conn, user_pk, stemma_pk)
            if has_cycles(stemma):
                raise StemmaHasCycles()
            return stemma, descr

    def update_family(
        self, user_id: str, family_id: str, family: CreateFamily
    ) -> tuple[Stemma, FamilyDescription]:
        user_pk, family_pk = int(user_id), int(family_id)
        with self._engine.begin() as conn:
            self._check_family_access(conn, family_pk, user_pk)
            self._unlink_family_members(conn, family_pk)
            stemma_pk = conn.execute(
                select(families.c.stemmaId).where(families.c.id == family_pk)
            ).scalar_one()
            descr = self._link_family_members(conn, user_pk, stemma_pk, family_pk, family)
            stemma = self._describe_stemma(conn, user_pk, stemma_pk)
            if has_cycles(stemma):
                raise StemmaHasCycles()
            return stemma, descr

    def remove_person(self, user_id: str, person_id: str) -> None:
        user_pk, person_pk = int(user_id), int(person_id)
        with self._engine.begin() as conn:
            self._check_person_access(conn, person_pk, user_pk)
            conn.execute(delete(people).where(people.c.id == person_pk))
            self._drop_empty_families(conn)

    def remove_family(self, user_id: str, family_id: str) -> None:
        user_pk, family_pk = int(user_id), int(family_id)
        with self._engine.begin() as conn:
            self._check_family_access(conn, family_pk, user_pk)
            self._unlink_family_members(conn, family_pk)
            conn.execute(delete(families).where(families.c.id == family_pk))

    def update_person(self, user_id: str, person_id: str, description: CreateNewPerson) -> None:
        user_pk, person_pk = int(user_id), int(person_id)
        with self._engine.begin() as conn:
            self._check_person_access(conn, person_pk, user_pk)
            conn.execute(
                update(people)
                .where(people.c.id == person_pk)
                .values(
                    name=description.name,
                    birthDate=description.birth_date,
                    deathDate=description.death_date,
                    bio=description.bio,
                )
            )

    def clone_stemma(self, user_id: str, stemma_id: str, new_stemma_name: str) -> Stemma:
        user_pk, stemma_pk = int(user_id), int(stemma_id)
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, stemma_pk, user_pk)
            new_stemma_id = int(self._make_new_stemma(conn, user_pk, new_stemma_name))
            source = self._describe_stemma(conn, user_pk, stemma_pk)
            person_id_map = self._clone_people(conn, user_pk, new_stemma_id, source.people)
            family_id_map = self._clone_families(conn, user_pk, new_stemma_id, source.families, person_id_map)
            return _rewrite_stemma_ids(source, person_id_map, family_id_map)

    def stemma(self, user_id: str, stemma_id: str) -> Stemma:
        user_pk, stemma_pk = int(user_id), int(stemma_id)
        with self._engine.begin() as conn:
            self._check_stemma_access(conn, stemma_pk, user_pk)
            return self._describe_stemma(conn, user_pk, stemma_pk)

    def chown(self, user_id: str, stemma_id: str, target_person_id: str) -> ChownEffect:
        user_pk, stemma_pk, target_pk = int(user_id), int(stemma_id), int(target_person_id)
        with self._engine.begin() as conn:
            kinsmen_families = [
                row[0]
                for row in conn.execute(_KINSMEN_FAMILIES_SQL, {"init_person_id": target_pk})
            ]
            affected_people = self._members_of_families(conn, kinsmen_families) if kinsmen_families else []

            for fid in kinsmen_families:
                self._grant_family_owner(conn, user_pk, fid)
            for pid in affected_people:
                self._grant_person_owner(conn, user_pk, pid)
            self._grant_stemma_owner(conn, user_pk, stemma_pk)

            return ChownEffect(
                affected_families=[str(f) for f in kinsmen_families],
                affected_people=[str(p) for p in affected_people],
            )

    def owns_person(self, user_id: str, person_id: str) -> bool:
        user_pk, person_pk = int(user_id), int(person_id)
        with self._engine.begin() as conn:
            return self._owns(
                conn, person_owners.c.ownerId, person_owners.c.personId, user_pk, person_pk
            )

    def _make_new_stemma(self, conn: Connection, user_id: int, name: str) -> str:
        new_id = conn.execute(insert(stemmas).values(name=name).returning(stemmas.c.id)).scalar_one()
        self._grant_stemma_owner(conn, user_id, new_id)
        return str(new_id)

    def _owns(self, conn: Connection, owner_col, target_col, user_id: int, target_id: int) -> bool:
        return conn.execute(
            select(exists().where(and_(owner_col == user_id, target_col == target_id)))
        ).scalar_one()

    def _check_stemma_access(self, conn: Connection, stemma_id: int, user_id: int) -> None:
        if not self._owns(conn, stemma_owners.c.ownerId, stemma_owners.c.stemmaId, user_id, stemma_id):
            raise AccessToStemmaDenied(stemma_id=str(stemma_id))

    def _check_person_access(self, conn: Connection, person_id: int, user_id: int) -> None:
        if not self._owns(conn, person_owners.c.ownerId, person_owners.c.personId, user_id, person_id):
            raise AccessToPersonDenied(person_id=str(person_id))

    def _check_family_access(self, conn: Connection, family_id: int, user_id: int) -> None:
        if not self._owns(conn, family_owners.c.ownerId, family_owners.c.familyId, user_id, family_id):
            raise AccessToFamilyDenied(family_id=str(family_id))

    def _grant_stemma_owner(self, conn: Connection, user_id: int, stemma_id: int) -> None:
        if not self._owns(conn, stemma_owners.c.ownerId, stemma_owners.c.stemmaId, user_id, stemma_id):
            conn.execute(insert(stemma_owners).values(ownerId=user_id, stemmaId=stemma_id))

    def _grant_person_owner(self, conn: Connection, user_id: int, person_id: int) -> None:
        if not self._owns(conn, person_owners.c.ownerId, person_owners.c.personId, user_id, person_id):
            conn.execute(insert(person_owners).values(ownerId=user_id, personId=person_id))

    def _grant_family_owner(self, conn: Connection, user_id: int, family_id: int) -> None:
        if not self._owns(conn, family_owners.c.ownerId, family_owners.c.familyId, user_id, family_id):
            conn.execute(insert(family_owners).values(ownerId=user_id, familyId=family_id))

    def _check_person_belongs_to_stemma(self, conn: Connection, person_id: int, stemma_id: int) -> None:
        present = conn.execute(
            select(exists().where(and_(people.c.id == person_id, people.c.stemmaId == stemma_id)))
        ).scalar_one()
        if not present:
            raise NoSuchPersonId(id=str(person_id))

    def _get_or_create_person(
        self, conn: Connection, stemma_id: int, user_id: int, pd: PersonDefinition
    ) -> int:
        match pd:
            case ExistingPerson(id=pid):
                self._check_person_access(conn, int(pid), user_id)
                self._check_person_belongs_to_stemma(conn, int(pid), stemma_id)
                return int(pid)
            case CreateNewPerson():
                new_id = conn.execute(
                    insert(people)
                    .values(
                        name=pd.name,
                        birthDate=pd.birth_date,
                        deathDate=pd.death_date,
                        bio=pd.bio,
                        stemmaId=stemma_id,
                    )
                    .returning(people.c.id)
                ).scalar_one()
                self._grant_person_owner(conn, user_id, new_id)
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
            read_only=True,
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
        people_descr = self._load_people(conn, user_id, stemma_id)
        families_descr = self._load_families(conn, user_id, stemma_id)
        return Stemma(people=people_descr, families=families_descr)

    def _load_people(self, conn: Connection, user_id: int, stemma_id: int) -> list[PersonDescription]:
        rows = conn.execute(
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
        return [
            PersonDescription(
                id=str(pid),
                name=name,
                birth_date=birth,
                death_date=death,
                bio=bio,
                read_only=not is_owner,
            )
            for (pid, name, birth, death, bio, is_owner) in rows
        ]

    def _load_families(self, conn: Connection, user_id: int, stemma_id: int) -> list[FamilyDescription]:
        fam_ids_for_stemma = (
            select(families.c.id).where(families.c.stemmaId == stemma_id).scalar_subquery()
        )
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

        read_only: dict[str, bool] = {}
        spouses_by_family: dict[str, set[str]] = defaultdict(set)
        children_by_family: dict[str, set[str]] = defaultdict(set)

        for fid, pid, is_owner in spouse_rows:
            spouses_by_family[str(fid)].add(str(pid))
            read_only[str(fid)] = not is_owner
        for fid, pid, is_owner in child_rows:
            children_by_family[str(fid)].add(str(pid))
            read_only[str(fid)] = not is_owner

        return [
            FamilyDescription(
                id=fid,
                parents=list(spouses_by_family[fid]),
                children=list(children_by_family[fid]),
                read_only=ro,
            )
            for fid, ro in read_only.items()
        ]

    def _members_of_families(self, conn: Connection, family_ids: list[int]) -> list[int]:
        rows = conn.execute(
            select(spouses.c.personId)
            .where(spouses.c.familyId.in_(family_ids))
            .union(select(children.c.personId).where(children.c.familyId.in_(family_ids)))
        ).all()
        return [row[0] for row in rows]

    def _clone_people(
        self, conn: Connection, user_id: int, new_stemma_id: int, source_people: list[PersonDescription]
    ) -> dict[str, int]:
        old_to_new: dict[str, int] = {}
        for person in source_people:
            new_id = conn.execute(
                insert(people)
                .values(
                    name=person.name,
                    birthDate=person.birth_date,
                    deathDate=person.death_date,
                    bio=person.bio,
                    stemmaId=new_stemma_id,
                )
                .returning(people.c.id)
            ).scalar_one()
            old_to_new[person.id] = new_id
            self._grant_person_owner(conn, user_id, new_id)
        return old_to_new

    def _clone_families(
        self,
        conn: Connection,
        user_id: int,
        new_stemma_id: int,
        source_families: list[FamilyDescription],
        person_id_map: dict[str, int],
    ) -> dict[str, int]:
        old_to_new: dict[str, int] = {}
        for fam in source_families:
            new_fid = conn.execute(
                insert(families).values(stemmaId=new_stemma_id).returning(families.c.id)
            ).scalar_one()
            old_to_new[fam.id] = new_fid
            self._grant_family_owner(conn, user_id, new_fid)
            for parent_old in fam.parents:
                conn.execute(insert(spouses).values(personId=person_id_map[parent_old], familyId=new_fid))
            for child_old in fam.children:
                conn.execute(insert(children).values(personId=person_id_map[child_old], familyId=new_fid))
        return old_to_new

    def _drop_empty_families(self, conn: Connection) -> None:
        combined = select(spouses.c.familyId).union_all(select(children.c.familyId)).subquery()
        empty_family_ids = (
            select(combined.c.familyId).group_by(combined.c.familyId).having(func.count() < 2)
        )
        fids = [row[0] for row in conn.execute(empty_family_ids)]
        if fids:
            conn.execute(delete(families).where(families.c.id.in_(fids)))

    def _create_spouse_relation_if_not_exist(self, conn: Connection, person_id: int, family_id: int) -> None:
        present = conn.execute(
            select(exists().where(and_(spouses.c.personId == person_id, spouses.c.familyId == family_id)))
        ).scalar_one()
        if not present:
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
        raise ChildAlreadyBelongsToFamily(family_id=str(other), person_id=str(person_id))


def _ensure_no_duplicate_ids(definitions: list[PersonDefinition]) -> None:
    seen: dict[str, int] = defaultdict(int)
    for pd in definitions:
        if isinstance(pd, ExistingPerson):
            seen[pd.id] += 1
    for pid, count in seen.items():
        if count > 1:
            raise DuplicatedIds(duplicated_ids=pid)


def _rewrite_stemma_ids(
    source: Stemma, person_id_map: dict[str, int], family_id_map: dict[str, int]
) -> Stemma:
    return Stemma(
        people=[replace(p, id=str(person_id_map[p.id]), read_only=False) for p in source.people],
        families=[
            FamilyDescription(
                id=str(family_id_map[f.id]),
                parents=[str(person_id_map[pid]) for pid in f.parents],
                children=[str(person_id_map[cid]) for cid in f.children],
                read_only=False,
            )
            for f in source.families
        ],
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
