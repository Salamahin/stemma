---
name: frontend-style
description: TypeScript + Svelte coding style guide for this project — covers separating side effects from business logic, immutability, error handling, types, async, components, testing, naming, and complexity. Use whenever writing, editing, or reviewing code under `frontend/src/`.
---

# Generic coding style

## Separate side effects from business logic

Business logic should, as much as possible:
* avoid hidden mutable state
* be free of side effects
* be deterministic

In practice, business functions should not perform I/O such as `fetch`, `localStorage`, `document`/`window` access, or read `Date.now()` / `Math.random()`. Push those to the boundary — Svelte components, the `Model` HTTP client, and dedicated `*Storage` classes — and pass the resulting data into pure functions as arguments.

This is how the codebase is already organized: `selectStemmaId`, `computeInitialLayout`, `mapStemmaError`, `buildInviteLink`, `sanitizeRequestPayload`, `filterEditablePeople` are all pure transforms. New helpers should follow that shape and live in a `*.ts` module with a matching `*.test.ts`.

**Bad example**: mixing `localStorage` and business logic
```ts
function pickStemma(stemmas: StemmaDescription[]): string {
    const last = localStorage.getItem("stemma_last_stemma_id");
    const match = stemmas.find((s) => s.id === last);
    return match ? match.id : stemmas[0].id;
}
```

**Good example**: business logic operates only on data (this is the real `selectStemmaId`)
```ts
export function selectStemmaId(
    stemmas: StemmaDescription[],
    lastStemmaId?: string | null,
    defaultStemmaId?: string | null,
) {
    if (lastStemmaId) {
        const match = stemmas.find((s) => s.id === lastStemmaId);
        if (match) return match.id;
    }
    // ...
}
```

**Boundary example**: storage I/O happens in the controller; the pure helper is fed the value
```ts
const selectedId = selectStemmaId(
    result.stemmas,
    this.loadLastStemmaId(),
    result.defaultStemmaId,
);
```

**Bad example**: business logic depends on hidden entropy
```ts
export function isCredentialExpired(token: string): boolean {
    const decoded = jwtDecode<{ exp?: number }>(token);
    return !decoded.exp || decoded.exp * 1000 <= Date.now();
}
```

**Good example**: inject the clock; default it at the boundary (this is the real `loadCredential` shape)
```ts
export function loadCredential(now: number = Date.now()): StoredCredential | null {
    // ...
}
```

Svelte components and the `Model` class are the natural boundaries. Don't reach into `localStorage`, `fetch`, or `document` from a pure module.


## Prefer non-nullable inputs in business logic

Avoid passing nullable values into business functions when a natural empty value works. Nullable inputs add branching and inflate complexity at every call site.

When absence does not carry business meaning, prefer one of these instead:

* a natural empty value, such as `[]`, `""`, `new Map()`, `new Set()`
* a neutral null-object (e.g. `HighlightAll` vs `HiglightLineages` — the project already uses this pattern in `highlight.ts`)

Use `T | null` / `T | undefined` only when absence is itself part of the domain (e.g. "no stored credential", "user hasn't picked a default yet"). Normalize at boundaries — API payloads, `localStorage` reads, `JSON.parse` results — so business logic sees only non-null inputs.

**Bad example**: nullable input where an empty array already models the neutral case
```ts
function pinnedNames(ids: string[] | null, index: StemmaIndex): string[] {
    if (ids === null) return [];
    return ids.map((id) => index.person(id).name);
}
```

**Good example**: lean on the empty array
```ts
function pinnedNames(ids: string[], index: StemmaIndex): string[] {
    return ids.map((id) => index.person(id).name);
}
```

**Boundary normalization example**:
```ts
const ids = pinnedStorage?.allPinned() ?? [];
const names = pinnedNames(ids, index);
```

`null` vs `undefined`: in this codebase, **`null` means "explicitly absent"** (e.g. `currentStemmaId.set(null)`) and **`undefined` means "field was omitted"** (e.g. optional `birthDate?: string`). Pick one consciously — don't mix `?: T` with `: T | null` for the same field without reason.


## Prefer immutable data

Domain DTOs are plain `type` aliases — treat them as frozen value objects. Do not mutate data passed in as arguments; return a new value instead.

* For arrays: spread (`[...arr, item]`) or non-mutating methods (`map`, `filter`, `slice`).
* For objects: spread (`{ ...obj, key: value }`).
* Use `readonly` on properties and `ReadonlyArray<T>` / `readonly T[]` on inputs that should not be modified.
* Use `as const` for literal-typed tuples and constant configuration.

Note: `Array.sort` and `Array.reverse` mutate in place — make a copy first (`[...arr].sort(...)`). Same with `Map.set` / `Set.add` on shared instances.

**Bad example**: mutating an input array
```ts
function addPin(ids: string[], id: string): string[] {
    ids.push(id);
    return ids;
}
```

**Good example**: return a new value
```ts
function addPin(ids: string[], id: string): string[] {
    return [...ids, id];
}
```

Stateful encapsulators (`StemmaIndex`, `PinnedPeopleStorage`, `NodeLayoutCache`) legitimately hold mutable internal state — that is what they exist for. The rule is about *domain data flowing through pure functions*, not about banning all mutation.


## Error handling

Let exceptions propagate. Do not catch an exception just to return `null` or a default value — this silently turns a failure into a plausible-looking result and shifts an invisible burden onto every caller.

Only catch when you can genuinely handle it:
* retrying a transient failure,
* translating a low-level exception into a domain one (e.g. `LocalizedError`),
* recovering at a UI boundary by writing the error into a store for display.

Storage helpers in this codebase legitimately `catch` `localStorage`/`JSON.parse` failures and return `null`/empty — that is because **"no value" is a real domain outcome** for storage, not because they're hiding bugs. Outside that narrow pattern, let it throw.

When you do catch, be specific. Catching everything and ignoring it masks real bugs.

**Bad example**: swallowing the response error and returning `null`
```ts
async getStemma(stemmaId: string): Promise<Stemma | null> {
    try {
        return await this.send<Stemma>({ type: "GetStemmaRequest", stemmaId }, null);
    } catch {
        return null;
    }
}
```

**Good example**: propagate; the controller catches it once and shows it (this is the real flow)
```ts
// model.ts — translate transport failures to domain errors, then throw
if (response.status === 401) throw new LocalizedError("error.sessionExpired");
if (!response.ok) throw new LocalizedError("error.unexpectedResponse");

// appController.ts — single catch at the UI boundary
this.model.getStemma(stemmaId)
    .then((result) => this.stemma.set(result))
    .catch((err) => this.err.set(err));
```

**Bad example**: catching everything inside a pure transform
```ts
function buildLineage(p: PersonDescription, index: StemmaIndex): Generation {
    try {
        return index.lineage(p.id);
    } catch {
        return { generation: 0, relativies: new Set(), families: new Set() };
    }
}
```

**Good example**: let the caller decide; if "missing person" is a real case, model it explicitly in the data
```ts
function buildLineage(p: PersonDescription, index: StemmaIndex): Generation {
    return index.lineage(p.id);
}
```


## Logging

`console.log` / `console.error` are side effects — keep them at boundaries (controllers, top-level `.catch`, `$effect` blocks), not deep inside business logic or pure transforms.

Do not log and swallow an exception. Either propagate it (and let the boundary log once), or handle it and log the outcome. Logging at every layer just duplicates noise.

**Bad example**: logging and swallowing — the error disappears
```ts
async function fetchStemma(id: string): Promise<Stemma | null> {
    try {
        return await model.getStemma(id);
    } catch (err) {
        console.error("Failed to fetch stemma:", err);
        return null;
    }
}
```

**Good example**: propagate; log once at the boundary (this is the real `AppController` shape)
```ts
this.model.getStemma(stemmaId)
    .then((result) => this.stemma.set(result))
    .catch((err) => {
        this.err.set(err);
        console.error("Err when fetching stemma data:", err.stack);
    });
```

`alert`, `confirm`, and direct DOM manipulation are also side effects — they belong in components, not in `.ts` business modules.


## Documentation

JSDoc is for non-obvious public APIs only. Internal helpers do not need doc comments.

Comments are usually a code smell. If something needs a comment to be understood, rewrite it to be self-explanatory through better naming and structure. Never write comments that simply restate what the code does.

**Bad example**: comment restates the code
```ts
// Find the stemma matching the last id
const match = stemmas.find((s) => s.id === lastStemmaId);
```

**Good example**: the code speaks for itself; a named helper captures intent
```ts
const lastSelected = findById(stemmas, lastStemmaId);
```

**Bad example**: comment compensates for unclear logic
```ts
// retry only on transient errors
if (status === 429 || status === 503) retry();
```

**Good example**: extract a named predicate
```ts
function isTransient(status: number): boolean {
    return status === 429 || status === 503;
}

if (isTransient(status)) retry();
```


## Naming

Avoid generic, meaningless names for modules, classes, or directories. Names like `utils`, `common`, `helpers`, `shared`, `misc` give no information about what the code does.

Use names that describe the specific responsibility. The codebase obeys this — every file is focused: `stemmaErrorMapping.ts`, `requestSanitizer.ts`, `inviteLinkBuilder.ts`, `nodeLayoutCache.ts`, `personSelectionRules.ts`. Keep adding files that way.

**Bad examples**: `utils.ts`, `helpers.ts`, `common/`, `shared/`, `misc.ts`

**Good examples**: `stemmaErrorMapping.ts`, `credentialStorage.ts`, `initialLayout.ts`, `appController.ts`

If you feel the urge to create a `utils.ts`, that's a signal the code should be split into focused, well-named modules instead.

Naming conventions in use:
* Files: `camelCase.ts` (modules), `PascalCase.svelte` (components).
* Types and classes: `PascalCase`.
* Variables, functions, properties: `camelCase`.
* Constants: `SCREAMING_SNAKE_CASE` for module-level true constants, `camelCase` otherwise — be consistent with the surrounding module.
* Discriminated-union tags: `"PascalCase"` string literal (e.g. `type: "CreateNewPerson"`).


## Paradigm

Prefer functional style over class-based, and class-based over imperative. In practice:

* Prefer small, pure functions over classes with methods.
* Prefer transforming data through `map`/`filter`/`reduce` and spread over loops that build up state.
* Prefer expressions over statements where they remain readable.

That said, don't over-engineer for paradigm purity. The best code is the simplest code that expresses intent. Reach for a class when:
* **Encapsulating state over time** — `StemmaIndex` (precomputed lookups), `PinnedPeopleStorage` and `NodeLayoutCache` (persisted state) are natural fits.
* **Implementing an interface** — `HighlightAll` / `HiglightLineages` both implement `Highlight` so callers can swap behavior.
* **Injecting collaborators into a stateful coordinator** — `AppController` holds the `Model` and the writable stores together.

Otherwise, a plain function is sufficient.

**Bad example**: imperative accumulation
```ts
function editableNames(people: PersonDescription[]): string[] {
    const result: string[] = [];
    for (const p of people) {
        if (!p.readOnly) result.push(p.name);
    }
    return result;
}
```

**Good example**: functional, concise (this is the codebase style)
```ts
function editableNames(people: PersonDescription[]): string[] {
    return people.filter((p) => !p.readOnly).map((p) => p.name);
}
```

**Bad example**: class wrapping stateless logic that needs no encapsulation
```ts
class InviteLinkBuilder {
    constructor(private origin: string) {}
    build(token: string): string {
        return `${this.origin}/?invite=${token}`;
    }
}
```

**Good example**: a plain function (this is the real `buildInviteLink`)
```ts
export function buildInviteLink(origin: string, token: string): string {
    return `${origin}/?invite=${token}`;
}
```

Also: avoid `var`. Default to `const`; reach for `let` only when reassignment is actually needed.


## Testing

Business logic must be covered with unit tests in `*.test.ts` alongside the module (this repo's convention — see `selectStemmaId`, `mapStemmaError`, `nodeLayoutCache`, etc.). Because business logic is pure (see above), tests just call functions with inputs and assert on outputs — no mocks required.

Minimize the use of `jest.mock`, `jest.spyOn`, and `as any`. Heavy mocking is a signal that side effects have leaked into business logic. Prefer black-box testing: assert on observable outputs and store values, not on internal calls.

For `AppController` tests, inject a fake `Model` through the `modelFactory` constructor argument (this is exactly why it exists) — don't `jest.mock` the module.

For DOM-touching helpers (storage classes), use `jsdom` (`jest-environment-jsdom`) and exercise the real `localStorage` — that's what the existing storage tests do.

**Bad example**: mocking modules to test pure logic
```ts
jest.mock("./stemmaIndex");
test("highlight covers ancestors", () => {
    (StemmaIndex as any).mockImplementation(() => ({ lineage: () => ({ ... }) }));
    const h = new HiglightLineages(new (StemmaIndex as any)(), ["1"]);
    expect(h.personIsHighlighted("2")).toBe(true);
});
```

**Good example**: build a real input fixture and assert on the output
```ts
test("highlight covers ancestors", () => {
    const stemma: Stemma = { type: "Stemma", people: [...], families: [...] };
    const h = new HiglightLineages(new StemmaIndex(stemma), ["1"]);
    expect(h.personIsHighlighted("2")).toBe(true);
});
```

**Bad example**: testing a request by mocking `fetch` deeply with brittle expectations
```ts
test("createFamily", async () => {
    (global.fetch as any) = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    await new Model("x", { id_token: "t" }).createFamily(/* ... */);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("/stemma"), expect.objectContaining({ ... }));
});
```

**Good example**: test the pure logic the request depends on (validation, sanitization, mapping) directly. Reserve transport-level tests for the e2e suite (`e2e/`), which exercises the real backend.


## Cyclomatic complexity and method length

Keep functions short and straight. A function longer than ~30 lines is a signal to extract smaller, named helpers.

Do not add defensive checks for cases that cannot happen given the calling context. If no caller passes `null` and the type doesn't permit `null`, do not guard against `null`. Unnecessary branches inflate complexity and imply to the reader that these cases are real concerns.

Only validate at boundaries — user input, the response JSON envelope, `localStorage` reads, third-party callbacks. Inside the system, trust the contracts established by your own types.

**Bad example**: defensive checks the type system already rules out
```ts
function applyDiscount(price: number, rate: number): number {
    if (price == null) throw new Error("price required");
    if (rate == null) throw new Error("rate required");
    if (rate < 0 || rate > 1) throw new Error("rate must be 0..1");
    return price * (1 - rate);
}
```

**Good example**: trust the types, just do the work
```ts
function applyDiscount(price: number, rate: number): number {
    return price * (1 - rate);
}
```


## Types

Always type function signatures (parameters and return type). Avoid `any`. Use `unknown` for boundary data and narrow with type guards or the discriminated-union tag.

Do not overuse anonymous tuples for related values — introduce a named `type` instead. Positional tuples are fine for genuine pairs (e.g. `[x, y]` in `initialLayout.ts`) but lose meaning quickly past two elements.

Tagged (discriminated) unions are the project's core type pattern — every request, response, and error in `model.ts` has a `type: "..."` field. **Use the tag to narrow**, not `as` or `instanceof`. Make `switch` statements exhaustive so adding a new variant is a compile error until handled (see `mapStemmaError`).

* `import type { ... }` for type-only imports (the project enables `verbatimModuleSyntax`).
* `readonly` / `ReadonlyArray<T>` for params and properties that should not be mutated.
* `as const` for literal-typed constants.
* Avoid `// @ts-ignore` / `// @ts-expect-error` and type assertions (`as Foo`). If you reach for them, the type model is wrong — fix it instead. The only acceptable place is at a true boundary (`JSON.parse` result, untyped third-party callback) and even then prefer a type guard.

**Bad example**: anonymous tuple hides meaning
```ts
function dimensions(): [number, number, number] {
    return [1920, 1080, 60];
}
```

**Good example**: a named type makes intent explicit
```ts
type Dimensions = { width: number; height: number; fps: number };

function dimensions(): Dimensions {
    return { width: 1920, height: 1080, fps: 60 };
}
```

**Bad example**: narrowing with `as`
```ts
function describePerson(r: StemmaResponse): string {
    if (r.type === "NoSuchPersonId") return (r as NoSuchPersonId).id;
    // ...
}
```

**Good example**: tag-based narrowing — no cast needed
```ts
function describePerson(r: StemmaResponse): string {
    if (r.type === "NoSuchPersonId") return r.id;
    // ...
}
```

**Bad example**: non-exhaustive switch silently misses new variants
```ts
function severity(r: StemmaErrorResponse): "info" | "warn" {
    switch (r.type) {
        case "InvalidInviteToken": return "info";
        case "AccessToStemmaDenied": return "warn";
    }
    return "warn";
}
```

**Good example**: exhaustive — adding a new error breaks the build
```ts
function severity(r: StemmaErrorResponse): "info" | "warn" {
    switch (r.type) {
        case "InvalidInviteToken": return "info";
        case "AccessToStemmaDenied": return "warn";
        // ... all other cases
        default: {
            const exhaustive: never = r;
            return exhaustive;
        }
    }
}
```


## Async

* Prefer `async`/`await` over `.then()` chains in new code. Chains nested more than two levels deep get hard to read; `await` flattens them.
* Don't mix `await` with `.then()` in the same flow — pick one.
* Don't leave floating promises. Either `await` them, `return` them, or attach a `.catch` at the boundary.
* Don't wrap a promise in `new Promise((resolve) => ...)` — that's a sign you're missing the `async` keyword.
* `async` functions that don't use `await` shouldn't be `async`.

**Bad example**: nested `.then` makes control flow opaque
```ts
this.model.listDescribeStemmas().then((result) => {
    return getStemma(id).then((stemma) => {
        this.stemma.set(stemma);
        return this.model.listOthers().then((others) => {
            this.others.set(others);
        });
    });
});
```

**Good example**: `await` reads top-to-bottom
```ts
const result = await this.model.listDescribeStemmas();
const stemma = await getStemma(id);
this.stemma.set(stemma);
const others = await this.model.listOthers();
this.others.set(others);
```


# Svelte-specific (Svelte 5, runes)

> Note: parts of `frontend/` are still written in legacy mode (`runes: false`, `$:` reactivity, `export let`, `createEventDispatcher`). When **writing new components or refactoring existing ones**, use the runes-mode patterns below. Match the surrounding file's style when making small in-place edits to legacy components — do not partially migrate.

* **State is `$state`.** Component-local mutable data goes through `$state(...)`. Don't use plain `let foo = ...` for things you mutate; the reactivity won't fire.
* **Derived data is `$derived`.** Replaces `$:` reactive declarations. Keep derivations pure — no side effects.
* **Side effects are `$effect`.** Replaces `onMount` / `$:` blocks that perform side effects (DOM init, store subscriptions, third-party setup). Return a teardown function from `$effect` instead of `onDestroy`.
* **Props are `$props`.** Replaces `export let`. Destructure with defaults: `let { stemma, onSelect = () => {} }: Props = $props();`. Declare the `Props` type as a `type` alias at the top of the script.
* **Two-way binding is `$bindable`.** Mark a prop `$bindable()` only when the parent legitimately needs to write back; otherwise prefer callback props.
* **Events are callback props, not `createEventDispatcher`.** Pass `onSomething: (payload: T) => void` props instead of dispatching events. They're typed, traceable through "go to definition", and don't need `bubbles`/`cancelable` ceremony.
* **Children are snippets.** Replaces slots — declare `children?: Snippet` (or named snippets) in props and render with `{@render children?.()}`. Use snippet parameters to pass data into a render slot.
* **Components are still boundaries.** They own DOM access, `bootstrap.Modal` calls, snippet rendering, and store subscriptions. Keep business logic out of `<script>` blocks; put it in a sibling `.ts` module so it can be unit-tested. If a component's `<script>` has logic worth testing, that's a signal to extract it (this is exactly why `appController.ts`, `personSelectionRules.ts`, `stemmaErrorMapping.ts`, etc. are separate modules).
* **Module-scoped helpers** still go in `<script context="module">` — that mechanism is unchanged.
* **Stores** still work (`writable`, `readable`) and `$store` auto-subscription is unchanged, but for new state that lives inside a single component prefer `$state`. Cross-component state can use either — pick one consistently per concern.

**Bad example**: legacy patterns in new code
```svelte
<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    export let stemma: Stemma;
    let pinned = false;
    $: peopleCount = stemma.people.length;
    const dispatch = createEventDispatcher();
    onMount(() => { /* ... */ });
    function pin() { pinned = true; dispatch("pinned", { id: stemma.id }); }
</script>
```

**Good example**: runes + callback props
```svelte
<script lang="ts">
    type Props = {
        stemma: Stemma;
        onPinned: (payload: { id: string }) => void;
    };
    let { stemma, onPinned }: Props = $props();

    let pinned = $state(false);
    const peopleCount = $derived(stemma.people.length);

    $effect(() => {
        // setup; return teardown
        return () => { /* cleanup */ };
    });

    function pin() {
        pinned = true;
        onPinned({ id: stemma.id });
    }
</script>
```


# i18n

Every user-visible string must come from `frontend/src/i18n.ts`. When you add a key, **update both `en` and `ru`** dictionaries — this is a hard project rule.

Do not use string concatenation to build localized strings; use the `{paramName}` substitution pattern that `t(key, params)` already supports. Errors raised from business logic should throw `LocalizedError(key, params)` rather than human strings (see `mapStemmaError` for the pattern).
