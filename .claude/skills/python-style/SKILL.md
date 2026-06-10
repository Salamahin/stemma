---
name: python-style
description: Python coding style guide for this project — covers separating side effects from business logic, immutability, error handling, logging, naming, testing, types, and complexity. Use whenever writing, editing, or reviewing Python code in this repo.
---

CLAUDE.md § Coding Standards already pins line length (120), indent (4), Python 3.13 typing (`X | None`, PEP 695), frozen dataclasses, and the "no generic names" rule. This file covers the project-specific patterns layered on top.

## Side effects at boundaries

Business functions in `services/` and `domain/` do not perform I/O, read the clock, or read entropy. Boundaries are `apps/` (transport), `storage/storage_service.py` (DynamoDB), and `apis/request_handler.py` (dispatch).

If a service needs the current time or randomness, pass it in as an argument (`now: datetime`, `rng: Random`) — wrap the boundary call at the dispatcher.

**Bad** — mixing I/O with logic:
```python
def calc_statistics(filename: str) -> float:
    with open(filename) as f:
        return average(row["value"] for row in json.load(f))
```

**Good** — pure transform on already-loaded data; the caller does the file read:
```python
def calc_statistics(data: list[dict]) -> float:
    return average(row["value"] for row in data)
```

## Prefer non-nullable inputs

Don't pass `None` into a business function when an empty collection or null-object models the neutral case. Normalize at the boundary so internal code never branches on `None`.

```python
# bad
def foo(args: list[str] | None):
    if args is None: return
    for item in args: yield item

# good
def foo(args: list[str]):
    yield from args
```

Reserve `T | None` for cases where absence carries domain meaning (e.g. "no session yet").

## Immutable data

Domain dataclasses are `frozen=True` (see `domain/requests.py`, `domain/responses.py`). Never mutate a passed-in list or dict — return a new value. Beware Python's mutable-default footgun (`def f(xs: list = [])` shares state across calls — use `()` or `None` instead).

`StorageService` uses a load-snapshot → plan → batch-write pattern (`_load_snapshot` in `storage_service.py`). Plans are built in-memory against the snapshot; cycle detection runs on the planned state before any write. Don't introduce read-modify-write loops that mutate DynamoDB in place.

## Error handling

Let exceptions propagate. Domain errors raised in `services/` / `storage/` are translated into typed `StemmaError` responses in `apis/request_handler.py` and the codec — that's the single translation point. Don't catch in middle layers just to return `None` or a sentinel.

When you do catch, be specific. Catching `Exception` is reserved for the outermost handler in `apps/dispatch.py` (where it logs and returns `UnknownError(cause="error-xxxxxxxx")` — opaque id, full repr server-side only).

```python
# bad — swallows and returns a fake-success None
def load_config(path: str) -> Config | None:
    try:
        return Config(**json.load(open(path)))
    except Exception:
        return None

# good — propagate; translate only when crossing a layer with a domain meaning
def load_config(path: str) -> Config:
    try:
        return Config(**json.load(open(path)))
    except FileNotFoundError as e:
        raise ConfigNotFoundError(path) from e
```

## Logging

Log at boundaries (`apps/`, top-level handlers), not inside `services/` or `storage/` (with one exception: `StorageService.chown` logs each grant — that is a security-audit signal, not a debug trace). Never log-and-swallow.

## Naming

Use the project's domain vocabulary: `stemma_id` not `tree_id`, `person_id` not `node_id`, `family_id` not `marriage_id`, `kinsmen` for the recursive family graph. Module names are snake_case; classes PascalCase. Never `utils.py` / `helpers.py` / `common.py`.

## Paradigm

Functional first. `RequestHandler.handle` is a `match` over `Request` — each case is one focused method, side effects flow through the injected `StorageService` / `UserService`. Add behavior as new dataclass + case branch, not new module-level state.

Classes are right when you're either injecting collaborators (`AppController`-style pattern on the frontend, `RequestHandler` here) or holding state over time. Don't wrap a stateless function in a class.

## Testing

`uv run pytest` from `backend/`. Unit tests live next to the suite (`backend/tests/`). Storage tests use in-process `moto` DynamoDB — never real AWS. E2E tests in `e2e/` run against DynamoDB Local in Docker via `scripts/devstack.mjs`.

Pure business functions are testable by calling them directly. Reach for `MagicMock`/`patch` only at a real boundary (rare). For transport tests, use FastAPI's `TestClient` against `apps/rest_app.py` — not raw `requests`.

```python
# good — business logic is pure, just pass inputs
def test_discount():
    entropy = DiscountEntropy(current_second=4, draw=0.9)
    assert pick_discount(entropy) == 20
```

When testing `RequestHandler` flows, wire a `StorageService` against the in-memory moto table — don't mock `StorageService` itself.

## Cyclomatic complexity

Keep functions short and straight. ~20 lines is a signal to extract a helper. Don't add defensive checks for cases the caller cannot produce — validate at boundaries (codec, transport), trust inside.

```python
# bad — defensive guards the type system already rules out
def apply_discount(price: float, rate: float) -> float:
    if price is None: raise ValueError(...)
    if rate < 0 or rate > 1: raise ValueError(...)
    return price * (1 - rate)

# good
def apply_discount(price: float, rate: float) -> float:
    return price * (1 - rate)
```

## Types

Always type signatures. Avoid `hasattr` / `getattr` / `isinstance` — they signal the type model is wrong. Domain unions (`Request`, `Response`, `StemmaError`) are tagged via pydantic `Literal` discriminators in `domain/codec.py` — the codec narrows for you; don't reinvent narrowing with `isinstance`.

Don't return bare tuples for multi-value results — introduce a `@dataclass(frozen=True)`. Union types in service signatures are a code smell (one function doing two things); split or use the tagged-union dispatcher.

## Concurrency / Lambda

`apps/lambda_main._build()` is `@cache`d so warm invocations reuse the boto3 Table handle. Anything stateful at module scope must be safe to re-enter across requests — no mutation of cached values. `bootstrap.populate_env_from_secrets()` uses `os.environ.setdefault`, so env exports win over Secrets Manager — useful for local override.
