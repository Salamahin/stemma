import secrets
import time
from dataclasses import dataclass
from typing import Any

from boto3.dynamodb.conditions import Key

from stemma.storage.schema import (
    ATTR_TTL,
    GSI1_INDEX_NAME,
    SESSION_PK_PREFIX,
    SK_META,
    session_pk,
    user_gsi_pk,
)

SESSION_TTL_SECONDS = 30 * 24 * 3600
TOUCH_GRACE_SECONDS = 5 * 60


@dataclass(frozen=True)
class Session:
    sid: str
    user_id: str
    email: str
    created_at: int
    last_seen: int
    expires_at: int


class SessionRepo:
    def __init__(self, table: Any, ttl_seconds: int = SESSION_TTL_SECONDS) -> None:
        self._table = table
        self._ttl = ttl_seconds

    def create(self, user_id: str, email: str, now: int | None = None) -> Session:
        now = int(now if now is not None else time.time())
        sid = secrets.token_urlsafe(32)
        expires_at = now + self._ttl
        self._table.put_item(
            Item={
                "pk": session_pk(sid),
                "sk": SK_META,
                "user_id": user_id,
                "email": email,
                "created_at": now,
                "last_seen": now,
                ATTR_TTL: expires_at,
                "gsi1pk": user_gsi_pk(user_id),
                "gsi1sk": session_pk(sid),
            }
        )
        return Session(
            sid=sid,
            user_id=user_id,
            email=email,
            created_at=now,
            last_seen=now,
            expires_at=expires_at,
        )

    def get(self, sid: str, now: int | None = None) -> Session | None:
        now = int(now if now is not None else time.time())
        item = self._table.get_item(Key={"pk": session_pk(sid), "sk": SK_META}).get("Item")
        if item is None:
            return None
        expires_at = int(item.get(ATTR_TTL, 0))
        if expires_at <= now:
            # DynamoDB TTL eviction can lag; treat as expired ourselves.
            return None
        return Session(
            sid=sid,
            user_id=item["user_id"],
            email=item["email"],
            created_at=int(item["created_at"]),
            last_seen=int(item["last_seen"]),
            expires_at=expires_at,
        )

    def touch(self, session: Session, now: int | None = None) -> Session:
        now = int(now if now is not None else time.time())
        if now - session.last_seen < TOUCH_GRACE_SECONDS:
            return session
        expires_at = now + self._ttl
        self._table.update_item(
            Key={"pk": session_pk(session.sid), "sk": SK_META},
            UpdateExpression="SET last_seen = :ls, #t = :t",
            ExpressionAttributeNames={"#t": ATTR_TTL},
            ExpressionAttributeValues={":ls": now, ":t": expires_at},
        )
        return Session(
            sid=session.sid,
            user_id=session.user_id,
            email=session.email,
            created_at=session.created_at,
            last_seen=now,
            expires_at=expires_at,
        )

    def delete(self, sid: str) -> None:
        self._table.delete_item(Key={"pk": session_pk(sid), "sk": SK_META})

    def delete_all_for_user(self, user_id: str) -> int:
        kwargs = {
            "IndexName": GSI1_INDEX_NAME,
            "KeyConditionExpression": Key("gsi1pk").eq(user_gsi_pk(user_id))
            & Key("gsi1sk").begins_with(SESSION_PK_PREFIX),
        }
        items: list[dict] = []
        response = self._table.query(**kwargs)
        items.extend(response.get("Items", []))
        while "LastEvaluatedKey" in response:
            response = self._table.query(ExclusiveStartKey=response["LastEvaluatedKey"], **kwargs)
            items.extend(response.get("Items", []))
        with self._table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"pk": item["pk"], "sk": item["sk"]})
        return len(items)
