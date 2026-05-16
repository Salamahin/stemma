import uuid
from collections import defaultdict
from dataclasses import dataclass, replace
from datetime import date
from typing import Any

from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

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
from stemma.services.kinship import FamilyLink, kinsmen_families, members_of
from stemma.services.stemma_dfs import has_cycles
from stemma.storage.effects import ChownEffect
from stemma.storage.schema import (
    FAMILY_OWNER_PREFIX,
    FAMILY_PREFIX,
    GSI1_INDEX_NAME,
    PERSON_OWNER_PREFIX,
    PERSON_PREFIX,
    SK_META,
    SK_PROFILE,
    STEMMA_OWNER_PREFIX,
    STEMMA_PK_PREFIX,
    family_owner_sk,
    family_sk,
    parse_id_after_prefix,
    parse_owner_composite,
    person_owner_sk,
    person_sk,
    stemma_owner_sk,
    stemma_pk,
    user_email_pk,
    user_gsi_pk,
    user_gsi_sk,
)


@dataclass(frozen=True)
class _PersonRow:
    id: str
    name: str
    birth_date: date | None
    death_date: date | None
    bio: str | None


@dataclass(frozen=True)
class _FamilyRow:
    id: str
    parents: list[str]
    children: list[str]


@dataclass(frozen=True)
class _StemmaSnapshot:
    stemma_id: str
    people: dict[str, _PersonRow]
    families: dict[str, _FamilyRow]
    stemma_owners: set[str]
    person_owners: set[tuple[str, str]]
    family_owners: set[tuple[str, str]]


class StorageService:
    def __init__(self, table: Any) -> None:
        self._table = table

    # ---------- users ----------

    def get_or_create_user(self, email: str) -> User:
        key = {"pk": user_email_pk(email), "sk": SK_PROFILE}
        item = self._table.get_item(Key=key).get("Item")
        if item:
            return User(user_id=item["user_id"], email=email)
        user_id = uuid.uuid4().hex
        try:
            self._table.put_item(
                Item={**key, "user_id": user_id, "email": email},
                ConditionExpression="attribute_not_exists(pk)",
            )
            return User(user_id=user_id, email=email)
        except ClientError as exc:
            if exc.response.get("Error", {}).get("Code") != "ConditionalCheckFailedException":
                raise
            existing = self._table.get_item(Key=key)["Item"]
            return User(user_id=existing["user_id"], email=email)

    # ---------- stemmas ----------

    def create_stemma(self, user_id: str, name: str) -> str:
        stemma_id = uuid.uuid4().hex
        self._table.put_item(Item={"pk": stemma_pk(stemma_id), "sk": SK_META, "name": name})
        self._put_stemma_owner(stemma_id, user_id)
        return stemma_id

    def list_owned_stemmas(self, user_id: str) -> list[StemmaDescription]:
        owner_rows = self._table.query(
            IndexName=GSI1_INDEX_NAME,
            KeyConditionExpression=Key("gsi1pk").eq(user_gsi_pk(user_id)),
        ).get("Items", [])
        stemma_ids = [parse_id_after_prefix(row["gsi1sk"], STEMMA_PK_PREFIX) for row in owner_rows]
        if not stemma_ids:
            return []
        descriptions: list[StemmaDescription] = []
        for sid in stemma_ids:
            meta = self._table.get_item(Key={"pk": stemma_pk(sid), "sk": SK_META}).get("Item")
            if meta is None:
                continue
            owners_count = self._count_stemma_owners(sid)
            descriptions.append(
                StemmaDescription(id=sid, name=meta["name"], removable=owners_count == 1)
            )
        return descriptions

    def remove_stemma(self, user_id: str, stemma_id: str) -> None:
        snapshot = self._load_snapshot(stemma_id)
        self._require_stemma_access(snapshot, user_id)
        if len(snapshot.stemma_owners) != 1:
            raise IsNotTheOnlyStemmaOwner(stemma_id=stemma_id)
        self._delete_entire_stemma(stemma_id)

    def stemma(self, user_id: str, stemma_id: str) -> Stemma:
        snapshot = self._load_snapshot(stemma_id)
        self._require_stemma_access(snapshot, user_id)
        return _describe_stemma(snapshot, user_id)

    def clone_stemma(self, user_id: str, stemma_id: str, new_stemma_name: str) -> Stemma:
        source = self._load_snapshot(stemma_id)
        self._require_stemma_access(source, user_id)

        new_stemma_id = uuid.uuid4().hex
        person_id_map = {old: uuid.uuid4().hex for old in source.people}
        family_id_map = {old: uuid.uuid4().hex for old in source.families}

        with self._table.batch_writer() as batch:
            batch.put_item(Item={"pk": stemma_pk(new_stemma_id), "sk": SK_META, "name": new_stemma_name})
            batch.put_item(
                Item={
                    "pk": stemma_pk(new_stemma_id),
                    "sk": stemma_owner_sk(user_id),
                    "gsi1pk": user_gsi_pk(user_id),
                    "gsi1sk": user_gsi_sk(new_stemma_id),
                }
            )
            for old_pid, new_pid in person_id_map.items():
                person = source.people[old_pid]
                batch.put_item(Item=_person_item(new_stemma_id, replace(person, id=new_pid)))
                batch.put_item(
                    Item={"pk": stemma_pk(new_stemma_id), "sk": person_owner_sk(new_pid, user_id)}
                )
            for old_fid, new_fid in family_id_map.items():
                fam = source.families[old_fid]
                new_fam = _FamilyRow(
                    id=new_fid,
                    parents=[person_id_map[p] for p in fam.parents],
                    children=[person_id_map[c] for c in fam.children],
                )
                batch.put_item(Item=_family_item(new_stemma_id, new_fam))
                batch.put_item(
                    Item={"pk": stemma_pk(new_stemma_id), "sk": family_owner_sk(new_fid, user_id)}
                )

        cloned_snapshot = _StemmaSnapshot(
            stemma_id=new_stemma_id,
            people={new_pid: replace(source.people[old], id=new_pid) for old, new_pid in person_id_map.items()},
            families={
                new_fid: _FamilyRow(
                    id=new_fid,
                    parents=[person_id_map[p] for p in source.families[old].parents],
                    children=[person_id_map[c] for c in source.families[old].children],
                )
                for old, new_fid in family_id_map.items()
            },
            stemma_owners={user_id},
            person_owners={(pid, user_id) for pid in person_id_map.values()},
            family_owners={(fid, user_id) for fid in family_id_map.values()},
        )
        return _describe_stemma(cloned_snapshot, user_id)

    # ---------- families ----------

    def create_family(
        self, user_id: str, stemma_id: str, family: CreateFamily
    ) -> tuple[Stemma, FamilyDescription]:
        snapshot = self._load_snapshot(stemma_id)
        self._require_stemma_access(snapshot, user_id)
        return self._apply_family_change(snapshot, user_id, target_family_id=None, family=family)

    def update_family(
        self, user_id: str, stemma_id: str, family_id: str, family: CreateFamily
    ) -> tuple[Stemma, FamilyDescription]:
        snapshot = self._load_snapshot(stemma_id)
        self._require_family_access(snapshot, user_id, family_id)
        return self._apply_family_change(snapshot, user_id, target_family_id=family_id, family=family)

    def remove_family(self, user_id: str, stemma_id: str, family_id: str) -> None:
        snapshot = self._load_snapshot(stemma_id)
        self._require_family_access(snapshot, user_id, family_id)
        self._delete_family(stemma_id, family_id, snapshot.family_owners)

    # ---------- people ----------

    def remove_person(self, user_id: str, stemma_id: str, person_id: str) -> None:
        snapshot = self._load_snapshot(stemma_id)
        self._require_person_access(snapshot, user_id, person_id)

        affected_families: list[_FamilyRow] = []
        for fam in snapshot.families.values():
            if person_id in fam.parents or person_id in fam.children:
                affected_families.append(
                    _FamilyRow(
                        id=fam.id,
                        parents=[p for p in fam.parents if p != person_id],
                        children=[c for c in fam.children if c != person_id],
                    )
                )

        with self._table.batch_writer() as batch:
            batch.delete_item(Key={"pk": stemma_pk(stemma_id), "sk": person_sk(person_id)})
            for owned_pid, owner_uid in snapshot.person_owners:
                if owned_pid == person_id:
                    batch.delete_item(
                        Key={
                            "pk": stemma_pk(stemma_id),
                            "sk": person_owner_sk(person_id, owner_uid),
                        }
                    )
            for fam in affected_families:
                if len(fam.parents) + len(fam.children) < 2:
                    batch.delete_item(
                        Key={"pk": stemma_pk(stemma_id), "sk": family_sk(fam.id)}
                    )
                    for owned_fid, owner_uid in snapshot.family_owners:
                        if owned_fid == fam.id:
                            batch.delete_item(
                                Key={
                                    "pk": stemma_pk(stemma_id),
                                    "sk": family_owner_sk(fam.id, owner_uid),
                                }
                            )
                else:
                    batch.put_item(Item=_family_item(stemma_id, fam))

    def update_person(
        self, user_id: str, stemma_id: str, person_id: str, description: CreateNewPerson
    ) -> None:
        if not self.owns_person(user_id, stemma_id, person_id):
            raise AccessToPersonDenied(person_id=person_id)
        existing = self._table.get_item(
            Key={"pk": stemma_pk(stemma_id), "sk": person_sk(person_id)}
        ).get("Item")
        if existing is None:
            raise NoSuchPersonId(id=person_id)
        updated = _make_person_row(person_id, description)
        self._table.put_item(Item=_person_item(stemma_id, updated))

    # ---------- ownership ----------

    def chown(self, user_id: str, stemma_id: str, target_person_id: str) -> ChownEffect:
        snapshot = self._load_snapshot(stemma_id)
        family_links = [
            FamilyLink(family_id=f.id, parents=frozenset(f.parents), children=frozenset(f.children))
            for f in snapshot.families.values()
        ]
        affected_families = kinsmen_families(target_person_id, family_links)
        affected_people = members_of(family_links, affected_families)

        with self._table.batch_writer() as batch:
            if user_id not in snapshot.stemma_owners:
                batch.put_item(
                    Item={
                        "pk": stemma_pk(stemma_id),
                        "sk": stemma_owner_sk(user_id),
                        "gsi1pk": user_gsi_pk(user_id),
                        "gsi1sk": user_gsi_sk(stemma_id),
                    }
                )
            for fid in affected_families:
                if (fid, user_id) not in snapshot.family_owners:
                    batch.put_item(
                        Item={"pk": stemma_pk(stemma_id), "sk": family_owner_sk(fid, user_id)}
                    )
            for pid in affected_people:
                if (pid, user_id) not in snapshot.person_owners:
                    batch.put_item(
                        Item={"pk": stemma_pk(stemma_id), "sk": person_owner_sk(pid, user_id)}
                    )

        return ChownEffect(
            affected_families=sorted(affected_families),
            affected_people=sorted(affected_people),
        )

    def owns_person(self, user_id: str, stemma_id: str, person_id: str) -> bool:
        item = self._table.get_item(
            Key={"pk": stemma_pk(stemma_id), "sk": person_owner_sk(person_id, user_id)}
        ).get("Item")
        return item is not None

    # ---------- internals ----------

    def _load_snapshot(self, stemma_id: str) -> _StemmaSnapshot:
        items = self._query_all(KeyConditionExpression=Key("pk").eq(stemma_pk(stemma_id)))

        people: dict[str, _PersonRow] = {}
        families: dict[str, _FamilyRow] = {}
        stemma_owners: set[str] = set()
        person_owners: set[tuple[str, str]] = set()
        family_owners: set[tuple[str, str]] = set()

        for item in items:
            sk = item["sk"]
            if sk == SK_META:
                continue
            if sk.startswith(PERSON_PREFIX) and not sk.startswith(PERSON_OWNER_PREFIX):
                pid = parse_id_after_prefix(sk, PERSON_PREFIX)
                people[pid] = _PersonRow(
                    id=pid,
                    name=item["name"],
                    birth_date=_parse_date(item.get("birth_date")),
                    death_date=_parse_date(item.get("death_date")),
                    bio=item.get("bio"),
                )
            elif sk.startswith(FAMILY_PREFIX) and not sk.startswith(FAMILY_OWNER_PREFIX):
                fid = parse_id_after_prefix(sk, FAMILY_PREFIX)
                families[fid] = _FamilyRow(
                    id=fid,
                    parents=list(item.get("parents", [])),
                    children=list(item.get("children", [])),
                )
            elif sk.startswith(STEMMA_OWNER_PREFIX):
                stemma_owners.add(parse_id_after_prefix(sk, STEMMA_OWNER_PREFIX))
            elif sk.startswith(PERSON_OWNER_PREFIX):
                person_owners.add(parse_owner_composite(sk, PERSON_OWNER_PREFIX))
            elif sk.startswith(FAMILY_OWNER_PREFIX):
                family_owners.add(parse_owner_composite(sk, FAMILY_OWNER_PREFIX))

        return _StemmaSnapshot(
            stemma_id=stemma_id,
            people=people,
            families=families,
            stemma_owners=stemma_owners,
            person_owners=person_owners,
            family_owners=family_owners,
        )

    def _query_all(self, **kwargs) -> list[dict]:
        response = self._table.query(**kwargs)
        items = list(response.get("Items", []))
        while "LastEvaluatedKey" in response:
            response = self._table.query(ExclusiveStartKey=response["LastEvaluatedKey"], **kwargs)
            items.extend(response.get("Items", []))
        return items

    def _put_stemma_owner(self, stemma_id: str, user_id: str) -> None:
        self._table.put_item(
            Item={
                "pk": stemma_pk(stemma_id),
                "sk": stemma_owner_sk(user_id),
                "gsi1pk": user_gsi_pk(user_id),
                "gsi1sk": user_gsi_sk(stemma_id),
            }
        )

    def _count_stemma_owners(self, stemma_id: str) -> int:
        response = self._table.query(
            KeyConditionExpression=Key("pk").eq(stemma_pk(stemma_id))
            & Key("sk").begins_with(STEMMA_OWNER_PREFIX),
            Select="COUNT",
        )
        return int(response.get("Count", 0))

    def _delete_entire_stemma(self, stemma_id: str) -> None:
        items = self._query_all(
            KeyConditionExpression=Key("pk").eq(stemma_pk(stemma_id)),
            ProjectionExpression="pk, sk",
        )
        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})

    def _delete_family(self, stemma_id: str, family_id: str, family_owners: set[tuple[str, str]]) -> None:
        with self._table.batch_writer() as batch:
            batch.delete_item(Key={"pk": stemma_pk(stemma_id), "sk": family_sk(family_id)})
            for fid, uid in family_owners:
                if fid == family_id:
                    batch.delete_item(
                        Key={"pk": stemma_pk(stemma_id), "sk": family_owner_sk(family_id, uid)}
                    )

    def _require_stemma_access(self, snapshot: _StemmaSnapshot, user_id: str) -> None:
        if user_id not in snapshot.stemma_owners:
            raise AccessToStemmaDenied(stemma_id=snapshot.stemma_id)

    def _require_person_access(self, snapshot: _StemmaSnapshot, user_id: str, person_id: str) -> None:
        if (person_id, user_id) not in snapshot.person_owners:
            raise AccessToPersonDenied(person_id=person_id)

    def _require_family_access(self, snapshot: _StemmaSnapshot, user_id: str, family_id: str) -> None:
        if (family_id, user_id) not in snapshot.family_owners:
            raise AccessToFamilyDenied(family_id=family_id)

    def _apply_family_change(
        self,
        snapshot: _StemmaSnapshot,
        user_id: str,
        target_family_id: str | None,
        family: CreateFamily,
    ) -> tuple[Stemma, FamilyDescription]:
        parents = [p for p in (family.parent1, family.parent2) if p is not None]
        kids = family.children
        if len(parents) + len(kids) < 2:
            raise IncompleteFamily()
        _ensure_no_duplicate_ids(parents + kids)
        _validate_existing_definitions(parents + kids, snapshot, user_id)

        family_id, reuse_match = _resolve_target_family(target_family_id, parents, snapshot, user_id)

        parent_ids, new_parent_rows = _materialize_definitions(parents)
        child_ids, new_child_rows = _materialize_definitions(kids)
        new_people = new_parent_rows + new_child_rows

        _check_no_child_conflicts(child_ids, family_id, snapshot)

        family_id, final_parents, final_children, owner_grant_needed = _compose_family_members(
            family_id, reuse_match, parent_ids, child_ids, snapshot
        )
        new_family = _FamilyRow(id=family_id, parents=final_parents, children=final_children)

        planned_snapshot = _plan_snapshot(snapshot, user_id, new_people, new_family)
        if has_cycles(_describe_stemma(planned_snapshot, user_id)):
            raise StemmaHasCycles()

        self._write_family_change(snapshot.stemma_id, user_id, new_people, new_family, owner_grant_needed)

        return (
            _describe_stemma(planned_snapshot, user_id),
            FamilyDescription(
                id=family_id, parents=final_parents, children=final_children, read_only=False
            ),
        )

    def _write_family_change(
        self,
        stemma_id: str,
        user_id: str,
        new_people: list[_PersonRow],
        new_family: _FamilyRow,
        owner_grant_needed: bool,
    ) -> None:
        with self._table.batch_writer() as batch:
            for row in new_people:
                batch.put_item(Item=_person_item(stemma_id, row))
                batch.put_item(
                    Item={"pk": stemma_pk(stemma_id), "sk": person_owner_sk(row.id, user_id)}
                )
            batch.put_item(Item=_family_item(stemma_id, new_family))
            if owner_grant_needed:
                batch.put_item(
                    Item={"pk": stemma_pk(stemma_id), "sk": family_owner_sk(new_family.id, user_id)}
                )


def _ensure_no_duplicate_ids(definitions: list[PersonDefinition]) -> None:
    seen: dict[str, int] = defaultdict(int)
    for pd in definitions:
        if isinstance(pd, ExistingPerson):
            seen[pd.id] += 1
    for pid, count in seen.items():
        if count > 1:
            raise DuplicatedIds(duplicated_ids=pid)


def _validate_existing_definitions(
    definitions: list[PersonDefinition], snapshot: _StemmaSnapshot, user_id: str
) -> None:
    for d in definitions:
        if not isinstance(d, ExistingPerson):
            continue
        if d.id not in snapshot.people:
            raise NoSuchPersonId(id=d.id)
        if (d.id, user_id) not in snapshot.person_owners:
            raise AccessToPersonDenied(person_id=d.id)


def _materialize_definitions(
    definitions: list[PersonDefinition],
) -> tuple[list[str], list[_PersonRow]]:
    ids: list[str] = []
    new_rows: list[_PersonRow] = []
    for d in definitions:
        if isinstance(d, ExistingPerson):
            ids.append(d.id)
        else:
            new_pid = uuid.uuid4().hex
            new_rows.append(_make_person_row(new_pid, d))
            ids.append(new_pid)
    return ids, new_rows


def _check_no_child_conflicts(
    child_ids: list[str], current_family_id: str | None, snapshot: _StemmaSnapshot
) -> None:
    for cid in child_ids:
        for fam in snapshot.families.values():
            if cid in fam.children and fam.id != current_family_id:
                raise ChildAlreadyBelongsToFamily(family_id=fam.id, person_id=cid)


def _resolve_target_family(
    target_family_id: str | None,
    parents: list[PersonDefinition],
    snapshot: _StemmaSnapshot,
    user_id: str,
) -> tuple[str | None, str | None]:
    if target_family_id is not None:
        return target_family_id, None
    reuse_match = _find_family_with_existing_parents(parents, snapshot)
    if reuse_match is None:
        return None, None
    if (reuse_match, user_id) not in snapshot.family_owners:
        raise AccessToFamilyDenied(family_id=reuse_match)
    return reuse_match, reuse_match


def _compose_family_members(
    family_id: str | None,
    reuse_match: str | None,
    parent_ids: list[str],
    child_ids: list[str],
    snapshot: _StemmaSnapshot,
) -> tuple[str, list[str], list[str], bool]:
    if family_id is None:
        return uuid.uuid4().hex, parent_ids, child_ids, True
    if reuse_match is not None:
        existing = snapshot.families[family_id]
        merged_children = list(existing.children) + [c for c in child_ids if c not in existing.children]
        return family_id, list(existing.parents), merged_children, False
    return family_id, parent_ids, child_ids, False


def _plan_snapshot(
    snapshot: _StemmaSnapshot,
    user_id: str,
    new_people: list[_PersonRow],
    new_family: _FamilyRow,
) -> _StemmaSnapshot:
    planned_families = dict(snapshot.families)
    planned_families[new_family.id] = new_family
    planned_people = dict(snapshot.people)
    for row in new_people:
        planned_people[row.id] = row
    return replace(
        snapshot,
        people=planned_people,
        families=planned_families,
        person_owners=snapshot.person_owners | {(row.id, user_id) for row in new_people},
        family_owners=snapshot.family_owners | {(new_family.id, user_id)},
    )


def _find_family_with_existing_parents(
    parents: list[PersonDefinition], snapshot: _StemmaSnapshot
) -> str | None:
    if not parents or not all(isinstance(p, ExistingPerson) for p in parents):
        return None
    target = {p.id for p in parents if isinstance(p, ExistingPerson)}
    for fam in snapshot.families.values():
        if set(fam.parents) == target:
            return fam.id
    return None


def _make_person_row(pid: str, definition: CreateNewPerson) -> _PersonRow:
    return _PersonRow(
        id=pid,
        name=definition.name,
        birth_date=definition.birth_date,
        death_date=definition.death_date,
        bio=definition.bio,
    )


def _person_item(stemma_id: str, person: _PersonRow) -> dict:
    item: dict = {
        "pk": stemma_pk(stemma_id),
        "sk": person_sk(person.id),
        "name": person.name,
    }
    if person.birth_date is not None:
        item["birth_date"] = person.birth_date.isoformat()
    if person.death_date is not None:
        item["death_date"] = person.death_date.isoformat()
    if person.bio is not None:
        item["bio"] = person.bio
    return item


def _family_item(stemma_id: str, family: _FamilyRow) -> dict:
    return {
        "pk": stemma_pk(stemma_id),
        "sk": family_sk(family.id),
        "parents": family.parents,
        "children": family.children,
    }


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    return date.fromisoformat(value)


def _describe_stemma(snapshot: _StemmaSnapshot, user_id: str) -> Stemma:
    return Stemma(
        people=[
            PersonDescription(
                id=p.id,
                name=p.name,
                birth_date=p.birth_date,
                death_date=p.death_date,
                bio=p.bio,
                read_only=(p.id, user_id) not in snapshot.person_owners,
            )
            for p in snapshot.people.values()
        ],
        families=[
            FamilyDescription(
                id=f.id,
                parents=list(f.parents),
                children=list(f.children),
                read_only=(f.id, user_id) not in snapshot.family_owners,
            )
            for f in snapshot.families.values()
        ],
    )
