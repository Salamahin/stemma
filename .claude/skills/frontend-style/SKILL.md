---
name: frontend-style
description: TypeScript + Svelte coding style guide for this project — covers separating side effects from business logic, immutability, error handling, types, async, components, testing, naming, and complexity. Use whenever writing, editing, or reviewing code under `frontend/src/`.
---

CLAUDE.md pins the Svelte 5 runes-mode rule and i18n dual-dictionary rule. This file layers the project-specific patterns.

## Side effects at boundaries

Boundaries are Svelte components, the `Model` HTTP client (`model.ts`), and the `*Storage` classes (`settingsStorage.ts`, `pinnedPeopleStorage.ts`, `credentialStorage.ts`). Everything else — `selectStemmaId`, `computeInitialLayout`, `mapStemmaError`, `buildInviteLink`, `sanitizeRequestPayload`, `filterEditablePeople` — is a pure transform with a matching `*.test.ts`.

Pure modules must not call `fetch`, touch `localStorage`/`document`/`window`, or read `Date.now()`/`Math.random()`. Inject the clock/RNG as an argument; default it at the boundary.

```ts
// good — pure, takes the data it needs
export function selectStemmaId(stemmas: StemmaDescription[], lastStemmaId?: string | null, defaultStemmaId?: string | null) { ... }

// boundary glue
const id = selectStemmaId(result.stemmas, this.loadLastStemmaId(), result.defaultStemmaId);
```

## Non-nullable inputs

In this codebase `null` means "explicitly absent" (e.g. `currentStemmaId.set(null)`); `undefined` means "field was omitted" (e.g. optional `birthDate?: string`). Don't mix `?: T` with `: T | null` on the same field. Normalize at the boundary so business helpers see only non-null inputs:

```ts
const ids = pinnedStorage?.allPinned() ?? [];
```

Prefer null-objects for behavioral neutrality — see `HighlightAll` vs `HighlightLineages` in `highlight.ts`.

## Immutable data

Domain DTOs in `model.ts` are plain `type` aliases — treat as frozen. Spread (`[...arr]`, `{...obj}`), `map`/`filter`/`slice`. Beware `Array.sort` and `Array.reverse` mutate in place — copy first (`[...arr].sort(...)`).

Stateful encapsulators (`StemmaIndex`, `PinnedPeopleStorage`, `NodeLayoutCache`) legitimately hold internal mutable state — the rule is about *domain data flowing through pure functions*, not banning all mutation.

## Error handling

Transport errors become `LocalizedError(key)` inside `Model.send` (e.g. `error.sessionExpired`, `error.unexpectedResponse`). The single catch lives in `AppController` (`.catch((err) => this.err.set(err))`). Don't catch in middle layers to return `null`.

Storage helpers (`*Storage` classes) DO catch `JSON.parse` / `localStorage` failures and return `null`/empty — "no value" is a real outcome for storage, not a hidden bug. Outside that narrow pattern, let it throw.

## Logging

`console.*` is a side effect — keep it at boundaries (`AppController`, top-level `.catch`, `$effect`). Pattern: `console.error("Err when X:", err.stack)` at the controller's catch, after `this.err.set(err)`.

`alert`, `confirm`, direct DOM manipulation belong in components, not `.ts` modules.

## Naming

Files: `camelCase.ts` modules, `PascalCase.svelte` components. Types/classes PascalCase, vars/funcs camelCase. Tagged-union tags are `"PascalCase"` literals (`type: "CreateNewPerson"`).

Every file should be focused: `stemmaErrorMapping.ts`, `requestSanitizer.ts`, `inviteLinkBuilder.ts`, `nodeLayoutCache.ts`, `personSelectionRules.ts`. Never `utils.ts` / `helpers.ts` / `common/`.

## Paradigm

Functional default. Classes when:
- **State over time** — `StemmaIndex` (precomputed lookups), `PinnedPeopleStorage` / `NodeLayoutCache` (persisted state).
- **Swappable interface** — `HighlightAll` / `HighlightLineages` both implement `Highlight`.
- **Injected coordinator** — `AppController` bundles the `Model` and writable stores.

Otherwise a plain function suffices (`buildInviteLink`, `selectStemmaId`). Default to `const`; reach for `let` only when reassignment is needed; never `var`.

## Testing

`npm test` from `frontend/`. Tests live as `*.test.ts` alongside the module (Jest + `jest-environment-jsdom` for DOM-touching code). Pure modules need no mocks — pass inputs, assert outputs.

For `AppController` tests, inject a fake `Model` through the `modelFactory` constructor argument — that's why it exists. Don't `jest.mock` the module.

For DOM-touching storage classes, exercise the real `localStorage` under jsdom — existing storage tests do this. Don't mock `localStorage`.

Transport-level tests (real HTTP) belong in `e2e/` (Playwright), not in `frontend/`. Don't mock `fetch` to test wire-format details.

## Complexity

Keep functions under ~30 lines. Trust the types — no defensive `null` guards on typed-non-null parameters. Validate only at boundaries (response JSON, `localStorage` reads, third-party callbacks).

## Types

Always type signatures. Avoid `any`; use `unknown` at boundaries and narrow via a type guard or the union tag. `import type { ... }` for type-only imports (`verbatimModuleSyntax` is on).

Tagged unions are the project's core type pattern — every Request/Response/Error in `model.ts` has a `type` field. **Narrow via the tag, never via `as` or `instanceof`.** Make `switch` exhaustive with a `default: { const _: never = x; return _; }` arm so adding a new variant is a compile error until handled (see `mapStemmaError`).

Don't return bare positional tuples for more than two elements — name the type. `readonly` on params/props that shouldn't be mutated, `as const` on literal-typed constants.

Avoid `// @ts-ignore`, `// @ts-expect-error`, and `as Foo` casts. If you reach for them, the type model is wrong — fix it.

## Async

Prefer `async`/`await` in new code; don't mix with `.then()` in the same flow. Don't leave floating promises — `await`, `return`, or attach `.catch` at the boundary. Don't wrap a promise in `new Promise((resolve) => ...)` — that's a missing `async`. `async` functions that never `await` shouldn't be `async`.

# Svelte 5 runes

Project-wide `runes: true`. Legacy patterns (`export let`, `$:`, `createEventDispatcher`, `on:event`) are banned in project files; third-party legacy Svelte packages compile via a separate Rollup plugin instance and keep `runes: false` — don't add `<svelte:options runes={...} />` to project files.

- **State**: `$state(...)` for mutable component data — plain `let x = ...` won't trigger reactivity.
- **Derivations**: `$derived(expr)` for single expressions, `$derived.by(() => { ...; return v })` for multi-step. Keep them pure.
- **Effects**: `$effect(() => { setup; return teardown })` — replaces `onMount`/`onDestroy`. Runs after mount; for init-time logic, call directly or `$derived`.
- **Props**: declare a `Props` type, destructure: `let { foo, bar = default }: Props = $props();`.
- **Two-way binding**: `$bindable()` only when the parent legitimately writes back (see `FamilyGeneration.selectedPeople`). Otherwise callback props.
- **Events**: callback props (`onpinned: (p: T) => void`), called as `onpinned?.(payload)`. No dispatcher, no event ceremony.
- **DOM handlers**: `onclick={...}`, not `on:click=...`. For `preventDefault`, wrap inline: `onclick={(e) => { e.preventDefault(); fn() }}`.
- **Custom DOM events** (e.g. `@imask/svelte` `accept`/`complete`): register in `$effect` with `addEventListener` and return the teardown.
- **Legacy third-party components** (e.g. `svelte-select`): `on:select` / `on:clear` directives are still valid for receiving events from legacy-mode components, and `<svelte:fragment slot="...">` still fills their slots.
- **Imperative API** exposed via `bind:this`: plain `export function`.
- **Module scope**: `<script module lang="ts">` (replaces deprecated `context="module"`).
- **Stores**: `writable`/`readable` still work and `$store` auto-sub is unchanged. For new single-component state prefer `$state`; for cross-component state pick stores or `$state` and stay consistent per concern.
- **Boundaries**: components own DOM access, `bootstrap.Modal`, store subscriptions. Push logic to a sibling `.ts` module so it's unit-testable (see `appController.ts`, `personSelectionRules.ts`).

```svelte
<script lang="ts">
    type Props = { stemma: Stemma; onpinned: (p: { id: string }) => void };
    let { stemma, onpinned }: Props = $props();

    let pinned = $state(false);
    const peopleCount = $derived(stemma.people.length);

    $effect(() => { /* setup */; return () => { /* cleanup */ }; });

    function pin() { pinned = true; onpinned({ id: stemma.id }); }
</script>
<button onclick={pin}>Pin</button>
```

# i18n

Every user-visible string comes from `frontend/src/i18n.ts`. **Update both `en` and `ru` dictionaries** when adding a key — hard project rule. Use the `{paramName}` substitution pattern of `t(key, params)`; never concatenate localized strings. Errors raised from business logic throw `LocalizedError(key, params)` rather than human strings (see `mapStemmaError` for the pattern).
