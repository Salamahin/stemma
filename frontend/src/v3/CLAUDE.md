# v3 — Explicit ghost-node affordances

v3 is a fork of v2 that adds **explicit "ghost" affordances** for adding spouses, parents, and children, while preserving v2's drag gestures unchanged. Goal: discoverability for new users without removing power-user gestures.

## Concept

When a person or family is **focused**, dashed "ghost" nodes appear around it:

| Focused entity | Ghost(s)                                                         |
| -------------- | ---------------------------------------------------------------- |
| Person         | spouse-ghost (`v3.addAnotherSpouse`) — always present            |
| Person         | parent-ghost (`v3.addParent`) — only if person has no parents    |
| Family         | child-ghost (`v3.addChild`) — always present                     |

Clicking a ghost opens the same create-person modal used by v2 pending-family promotion. On confirm, ghost materializes into a real person + family; focus stays on original node so user can add more.

## Focus model

- State: `focusedId: { kind: "person" | "family", id: string } | null`.
- **Desktop**: hovering bounding box sets focus (~150 ms debounce on leave to prevent flicker). Click on real node = edit modal.
- **Mobile**: short-tap (<500 ms) on real node = focus. Long-tap (≥500 ms) = edit modal. Tap elsewhere / pan = blur. ESC blurs on desktop.

## Physics

- All non-focused real nodes frozen via `fx, fy = current`.
- Focused real node also frozen (anchored at tap position — no jump).
- Ghosts: unfrozen. Initial seed: spouse to right of person, parent above, child below family. d3 collision force pushes ghosts into empty space against frozen neighbors. Sim stops on blur, ghosts despawn.

## Visual

- Dashed border + ~0.6 opacity — same language as v2 pending family (`ef1b738`).
- Dashed edge from focused node to ghost.
- Centered "+" icon + i18n label.
- Fade-in/out 200 ms on focus change.

## Coexist with v2 gestures

- Drag gestures from v2 untouched (link gesture `9c48496`, pending-family pin `ef1b738`).
- Ghosts = scaffolding for newcomers; gestures = power users.
- Both fire same backend mutations.

## i18n keys

New v3-only keys (add to both `en` and `ru` in `frontend/src/i18n.ts`):

- `v3.addAnotherSpouse` — "Add another spouse" / "Добавить ещё супруга"
- `v3.addParent` — "Add parent" / "Добавить родителя"
- `v3.addChild` — "Add child" / "Добавить потомка"

Existing `v2.*` keys (modal titles, drag tips) stay shared with v2 — same text.

## Ticket breakdown

Work runs one ticket at a time. Each ticket is independently shippable and behind the `/v3` route only.

1. **Bootstrap v3 route** — rename V2→V3 inside `frontend/src/v3/`, css `v2-`→`v3-`, route `/v3` in `main.ts`. No behavior change; v3 is byte-identical UX to v2 at this point.
2. **Focus state machine** — `focusedId` store + hover (desktop) / short-tap (mobile) detection. No UI; add a debug outline on focused node only.
3. **Ghost render** — derive ghost list from `focusedId`, render dashed spouse/parent/child placeholders at static seed positions. No physics yet, no click handler.
4. **Frozen-tree physics for ghosts** — freeze all non-ghost nodes, run d3 sim over ghost subset with collision force. Sim starts on focus, stops on blur.
5. **Ghost click → create modal** — wire ghost click to v3 create-person modal, reuse `promotePendingFamily` flow. On confirm: materialize person + family, keep focus on origin.
6. **Mobile long-press = edit modal** — disambiguate short-tap (focus) vs long-tap (edit) on touch. Desktop click on focused node already = edit.
7. **i18n strings** — add `v3.addAnotherSpouse`, `v3.addParent`, `v3.addChild` to both `en` and `ru`.
8. **Polish** — fade-in/out animation, blur on ESC / pan / empty-tap, focus survives zoom.

## Out of scope

- Removing v2 gestures.
- Reworking v2 pending-family flow.
- New backend endpoints — all mutations go through existing `RequestHandler` cases.
