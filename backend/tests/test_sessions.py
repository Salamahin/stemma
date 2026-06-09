from stemma.services.sessions import SESSION_TTL_SECONDS, TOUCH_GRACE_SECONDS, SessionRepo


def test_create_returns_session_with_ttl(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table)
    session = repo.create(user_id="u1", email="a@b.c", now=1000)
    assert session.user_id == "u1"
    assert session.email == "a@b.c"
    assert session.created_at == 1000
    assert session.last_seen == 1000
    assert session.expires_at == 1000 + SESSION_TTL_SECONDS
    assert len(session.sid) >= 32


def test_get_returns_session_when_valid(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table)
    session = repo.create(user_id="u1", email="a@b.c", now=1000)
    loaded = repo.get(session.sid, now=1500)
    assert loaded is not None
    assert loaded.sid == session.sid
    assert loaded.email == "a@b.c"


def test_get_returns_none_when_expired(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table, ttl_seconds=60)
    session = repo.create(user_id="u1", email="a@b.c", now=1000)
    assert repo.get(session.sid, now=session.expires_at + 1) is None


def test_get_returns_none_when_missing(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table)
    assert repo.get("nonexistent", now=1000) is None


def test_touch_skips_when_within_grace(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table)
    session = repo.create(user_id="u1", email="a@b.c", now=1000)
    touched = repo.touch(session, now=1000 + TOUCH_GRACE_SECONDS - 1)
    assert touched is session


def test_touch_extends_ttl_after_grace(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table, ttl_seconds=3600)
    session = repo.create(user_id="u1", email="a@b.c", now=1000)
    new_now = 1000 + TOUCH_GRACE_SECONDS + 1
    touched = repo.touch(session, now=new_now)
    assert touched.last_seen == new_now
    assert touched.expires_at == new_now + 3600
    reloaded = repo.get(session.sid, now=new_now)
    assert reloaded is not None
    assert reloaded.expires_at == touched.expires_at


def test_delete_removes_session(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table)
    session = repo.create(user_id="u1", email="a@b.c", now=1000)
    repo.delete(session.sid)
    assert repo.get(session.sid, now=1500) is None


def test_delete_all_for_user_removes_only_that_users_sessions(dynamo_table) -> None:
    repo = SessionRepo(dynamo_table)
    a1 = repo.create(user_id="u1", email="a@b.c", now=1000)
    a2 = repo.create(user_id="u1", email="a@b.c", now=1001)
    b1 = repo.create(user_id="u2", email="x@y.z", now=1002)
    removed = repo.delete_all_for_user("u1")
    assert removed == 2
    assert repo.get(a1.sid, now=1500) is None
    assert repo.get(a2.sid, now=1500) is None
    assert repo.get(b1.sid, now=1500) is not None
