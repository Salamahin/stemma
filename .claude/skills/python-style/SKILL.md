---
name: python-style
description: Python coding style guide for this project — covers separating side effects from business logic, immutability, error handling, logging, naming, testing, types, and complexity. Use whenever writing, editing, or reviewing Python code in this repo.
---

# Generic coding style

## Separate side effects from business logic

Business logic should, as much as possible:
* avoid hidden mutable state
* be free of side effects
* be deterministic

In practice, business functions should not perform I/O such as reading files, making network requests, querying databases, or reading system time. They should also not call entropy-based tools such as datetime.now() or random.

Instead, side effects should be executed at the boundary of the system, and their results should be passed into business functions as arguments. This keeps core logic easier to test, reason about, and reuse.

**Bad example**: mixing file I/O with business logic
```python
def calc_statistics(filename: str) -> float:
    with open(filename, "r") as file:
        data = json.load(file)
    return average(row["value"] for row in data)
```

**Good example**: business logic operates only on data
```python
def calc_statistics(data: list[dict]) -> float:
    return average(row["value"] for row in data)
```

**Boundary example**: I/O happens outside the business function
```python
def calc_statistics_from_file(filename: str) -> float:
    with open(filename, "r") as file:
        data = json.load(file)
    return calc_statistics(data)
```

**Bad example**: business logic depends on hidden entropy
```python
def pick_discount() -> int:
    current_second = datetime.now(UTC).second
    draw = Random().random()

    if current_second % 2 == 0 and draw > 0.5:
        return 20
    if draw > 0.2:
        return 10
    return 0
```

**Good example**: entropy is captured outside and injected explicitly
```python
@dataclass(frozen=True)
class DiscountEntropy:
    current_second: int
    draw: float

def pick_discount(entropy: DiscountEntropy) -> int:
    if entropy.current_second % 2 == 0 and entropy.draw > 0.5:
        return 20
    if entropy.draw > 0.2:
        return 10
    return 0
```

**Boundary example**: entropy is collected outside the business function
```python
def make_discount_entropy(rng: Random) -> DiscountEntropy:
    return DiscountEntropy(
        current_second=datetime.now(UTC).second,
        draw=rng.random(),
    )

def pick_discount_live(rng: Random) -> int:
    return pick_discount(entropy=make_discount_entropy(rng))
```


## Prefer non-nullable inputs in business logic

In general, avoid passing nullable values into business functions. Nullable inputs often add unnecessary branching and increase cyclomatic complexity.

When absence does not carry business meaning, prefer one of these instead:

* a natural empty value, such as an empty list, set, dict, or string
* a null-object that provides neutral behavior

Use nullable values only when absence is itself a real part of the domain.

At system boundaries, such as API payloads, databases, or third-party libraries, nullable or missing values may be unavoidable. Normalize them before they reach business logic.

**Bad example**: using a nullable input where an empty collection already models the neutral case
```python
def foo(args: list[str] | None):
    if args is None:
        return

    for item in args:
        yield item
```

**Good example**: using the collection’s natural empty-state behavior
```python
def foo(args: list[str]):
    for item in args:
        yield item
```

**Boundary normalization example**:
```python
def foo_from_payload(args: list[str] | None):
    return foo(args or [])
```


## Prefer immutable data

Prefer immutable data structures. Use `@dataclass(frozen=True)` for value objects. Do not mutate data passed in as arguments — return a new value instead. This makes data flow explicit and prevents action-at-a-distance bugs.

Python's mutable default argument is a common footgun: the default is evaluated once at definition time and shared across all calls.

**Bad example**: mutating a passed-in argument
```python
def add_tag(tags: list[str], tag: str) -> None:
    tags.append(tag)
```

**Good example**: return a new value
```python
def add_tag(tags: list[str], tag: str) -> list[str]:
    return [*tags, tag]
```

**Bad example**: mutable default argument accumulates state across calls
```python
def collect(item: str, result: list[str] = []) -> list[str]:
    result.append(item)
    return result
```

**Good example**: use an immutable default
```python
def collect(item: str, result: tuple[str, ...] = ()) -> tuple[str, ...]:
    return (*result, item)
```


## Error handling

Let exceptions propagate. Do not catch an exception just to return `None` or a sentinel value — this silently converts a failure into a plausible-looking result, hiding the error and shifting an invisible burden onto every caller.

Only catch an exception when you can genuinely handle it at that point: retrying a transient failure, translating a low-level exception into a domain-specific one, or recovering with a meaningful fallback. If none of these apply, let it propagate and allow the caller to decide.

When you do catch, be specific. Catching `Exception` broadly masks real bugs — unexpected errors should crash loudly, not disappear silently.

**Bad example**: swallowing the exception and returning `None`
```python
def load_config(path: str) -> Config | None:
    try:
        with open(path) as f:
            return Config(**json.load(f))
    except Exception:
        return None
```

**Good example**: let the exception propagate — the caller knows what to do
```python
def load_config(path: str) -> Config:
    with open(path) as f:
        return Config(**json.load(f))
```

**Boundary example**: translate a low-level exception into a domain one at the edge of the system
```python
def load_config(path: str) -> Config:
    try:
        with open(path) as f:
            return Config(**json.load(f))
    except FileNotFoundError as e:
        raise ConfigNotFoundError(path) from e
```

**Bad example**: catching too broadly masks unexpected failures
```python
try:
    result = process(data)
except Exception:
    return default_result
```

**Good example**: catch only what you expect and can handle
```python
try:
    result = process(data)
except ValueError as e:
    raise InvalidDataError(data) from e
```


## Logging

Log at system boundaries, not deep inside business logic. Business functions are pure and have no reason to log — logging is a side effect. Keep it at the edges: HTTP handlers, queue consumers, scheduled job entry points.

Do not log and swallow an exception. Either propagate it (and let the boundary log it once), or handle it and log the outcome. Logging at every layer just duplicates noise and makes traces harder to read.

**Bad example**: logging and swallowing — the error disappears
```python
def get_user(user_id: str) -> User | None:
    try:
        return db.fetch_user(user_id)
    except UserNotFoundError as e:
        logger.error("Failed to fetch user: %s", e)
        return None
```

**Good example**: propagate the exception; log once at the boundary
```python
# business logic — no logging
def get_user(user_id: str) -> User:
    return db.fetch_user(user_id)

# boundary (e.g. HTTP handler)
try:
    user = get_user(user_id)
except UserNotFoundError:
    logger.warning("User not found: %s", user_id)
    return Response(status=404)
```

**Bad example**: logging mechanical steps adds noise without signal
```python
def process_order(order: Order) -> Receipt:
    logger.info("Processing order %s", order.id)
    receipt = compute_receipt(order)
    logger.info("Order %s processed", order.id)
    return receipt
```

**Good example**: log meaningful events, not implementation steps
```python
def process_order(order: Order) -> Receipt:
    return compute_receipt(order)

# At the boundary, log what matters to operations
logger.info("Order %s fulfilled, total=%.2f", order.id, receipt.total)
```


## Documentation

Docstrings are for public APIs only. Internal methods do not need docstrings.

Comments are usually a code smell. If something needs a comment to be understood, it should be rewritten to be self-explanatory through better naming and structure.

Never write comments that simply restate what the code does. Prefer expressive names for methods and variables instead.

**Bad example**: comment restates the code
```python
# Read the file
with open(path) as f:
    data = f.read()
```

**Good example**: the code speaks for itself
```python
raw_config = path.read_text()
```

**Bad example**: comment compensates for unclear logic
```python
# Retry only on transient errors
if error.code in (429, 503):
    retry()
```

**Good example**: extract a named predicate
```python
def is_transient(error: HttpError) -> bool:
    return error.code in (429, 503)

if is_transient(error):
    retry()
```


## Naming

Avoid generic, meaningless names for modules, packages, classes, or directories. Names like `utils`, `common`, `helpers`, `shared`, or `misc` give no information about what the code actually does.

Use names that describe the specific responsibility of the code.

**Bad examples**: `utils.py`, `common/`, `helpers.py`, `shared/`, `misc.py`

**Good examples**: `timestamps.py`, `formatters.py`, `request_handler.py`, `retry_policy.py`

If you feel the urge to create a `utils` module, it is a signal that the code needs to be reorganized into focused, well-named modules instead.


## Paradigm

Prefer functional style over object-oriented, and object-oriented over imperative. In practice this means:

* Prefer small, pure, generic functions over classes with methods
* Prefer transforming data through function composition over mutating state
* Prefer expressions over statements where they remain readable

That said, do not over-engineer for the sake of paradigm purity. The best code is the simplest code that clearly expresses intent. If a plain loop or a simple class is more readable than a pipeline of higher-order functions, use it.

Classes are the right tool when:
* **Injecting behavior into business logic** — a class with a clear interface is easier to work with than passing one or several functions as arguments
* **Keeping state over time** — accumulators, builders, or stateful processors are a natural fit for classes

**Bad example**: imperative accumulation
```python
def active_emails(users: list[User]) -> list[str]:
    result = []
    for user in users:
        if user.is_active:
            result.append(user.email)
    return result
```

**Good example**: functional, concise, self-explanatory
```python
def active_emails(users: list[User]) -> list[str]:
    return [u.email for u in users if u.is_active]
```

**Bad example**: passing multiple functions to inject behavior
```python
def process_order(order: Order, fetch: Callable, save: Callable, notify: Callable):
    data = fetch(order.id)
    result = compute(data)
    save(result)
    notify(result)
```

**Good example**: a class groups the injected behavior under a meaningful interface
```python
class OrderProcessor:
    def __init__(self, repo: OrderRepository, notifier: Notifier):
        self._repo = repo
        self._notifier = notifier

    def process(self, order: Order) -> None:
        data = self._repo.fetch(order.id)
        result = compute(data)
        self._repo.save(result)
        self._notifier.notify(result)
```

**Bad example**: class wrapping stateless logic that needs no encapsulation
```python
class DiscountCalculator:
    def __init__(self, rate: float):
        self.rate = rate

    def apply(self, price: float) -> float:
        return price * (1 - self.rate)
```

**Good example**: a plain function is sufficient
```python
def apply_discount(price: float, rate: float) -> float:
    return price * (1 - rate)
```


## Testing

Business logic must be covered with unit tests. Because business logic is pure and side-effect-free (see above), it should be directly testable by calling functions with inputs and asserting outputs — no mocks required.

Minimize the use of `MagicMock`, `patch`, and similar tools. Heavy mocking is a signal that side effects have leaked into business logic. Prefer black-box testing: assert on observable outputs and return values, not on internal calls or implementation details.

For I/O and integration testing, prefer the native testing utilities of the framework over manually wiring HTTP clients or mocking invocations. Native test clients exercise the real stack with less boilerplate and fewer false positives.

**Bad example**: mocking internals to test business logic
```python
def test_discount():
    with patch("myapp.discount.datetime") as mock_dt:
        mock_dt.now.return_value.second = 4
        with patch("myapp.discount.Random") as mock_rng:
            mock_rng.return_value.random.return_value = 0.9
            assert pick_discount() == 20
```

**Good example**: business logic is pure — just pass the inputs
```python
def test_discount():
    entropy = DiscountEntropy(current_second=4, draw=0.9)
    assert pick_discount(entropy) == 20
```

**Bad example**: testing an HTTP endpoint by calling `requests` or mocking the handler
```python
def test_create_order():
    with patch("myapp.routes.save_order") as mock_save:
        mock_save.return_value = None
        response = requests.post("http://localhost:8000/orders", json={...})
        assert response.status_code == 201
        mock_save.assert_called_once()
```

**Good example**: use the framework's native test client
```python
def test_create_order(client: TestClient):
    response = client.post("/orders", json={...})
    assert response.status_code == 201
```


## Cyclomatic complexity and method length

Keep functions short and straight. A function longer than ~20 lines is a signal to extract smaller, named helpers.

Do not add defensive checks for cases that cannot happen given the calling context. If no caller passes `None`, do not guard against `None`. If no caller passes an empty list, do not handle it. Unnecessary branches inflate complexity and imply to the reader that these cases are real concerns.

Only validate at system boundaries — user input, external APIs, deserialization. Inside the system, trust the contracts established by your own code.

**Bad example**: defensive checks that cannot be triggered by any real caller
```python
def apply_discount(price: float, rate: float) -> float:
    if price is None:
        raise ValueError("price must not be None")
    if rate is None:
        raise ValueError("rate must not be None")
    if rate < 0 or rate > 1:
        raise ValueError("rate must be between 0 and 1")
    return price * (1 - rate)
```

**Good example**: trust the caller, just do the work
```python
def apply_discount(price: float, rate: float) -> float:
    return price * (1 - rate)
```

**Bad example**: one large function doing too much
```python
def process_order(order: Order) -> Receipt:
    # validate
    if not order.items:
        raise ValueError("empty order")
    # apply discounts
    total = sum(item.price for item in order.items)
    if order.coupon:
        total *= (1 - order.coupon.rate)
    # compute tax
    tax = total * 0.2
    total_with_tax = total + tax
    # build receipt
    lines = [f"{item.name}: {item.price}" for item in order.items]
    return Receipt(lines=lines, total=total_with_tax)
```

**Good example**: extract focused helpers
```python
def process_order(order: Order) -> Receipt:
    total = apply_coupon(subtotal(order.items), order.coupon)
    return build_receipt(order.items, with_tax(total))
```


## Types

Always use type hints. Avoid `hasattr`, `getattr`, `isinstance` checks, and other runtime type introspection — these are signs that the type system is not being used properly.

Do not overuse generic container types like bare tuples. When a function returns or accepts multiple related values, introduce a named type. This makes the code self-documenting and prevents positional confusion at call sites.

Union types (`X | Y`) are a code smell. A function that accepts or returns multiple unrelated types is doing too much. Prefer specific, focused functions over a single generic one. Use unions only when unavoidable — for example, at API or framework boundaries where the type is imposed externally.

**Bad example**: anonymous tuple hides meaning
```python
def get_coordinates() -> tuple[float, float]:
    return 51.5, 0.1
```

**Good example**: a named type makes intent explicit
```python
@dataclass(frozen=True)
class Point:
    x: float
    y: float

def get_coordinates() -> Point:
    return Point(x=51.5, y=0.1)
```

**Bad example**: one function handling multiple unrelated types
```python
def render(value: dict | list | str) -> str:
    ...
```

**Good example**: separate, focused functions with precise types
```python
def render_dict(value: dict) -> str: ...
def render_list(value: list) -> str: ...
def render_str(value: str) -> str: ...
```
