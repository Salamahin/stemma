# Frontend — editor UI

Single-version Svelte 5 (runes) UI. `main.ts` mounts `App.svelte` at every path. Edit mode toggles drag gestures + ghost affordances on the SVG canvas.

## Drag scenario matrix

Edit-mode pointer drag on the SVG canvas (`DragGestures.svelte`). The user presses mouse-down on a node (or empty canvas), drags, and releases on a node (or empty canvas). Source kind × target kind determines outcome.

Six valid gestures exist. Any other (FROM, TO) pair is a no-op.

### The six gestures

| #  | FROM    | TO      | Outcome                                                                                                    |
|----|---------|---------|------------------------------------------------------------------------------------------------------------|
| 1  | family  | empty   | Modal — create new Person as child of the dragged Family.                                                  |
| 2  | empty   | family  | Modal — create new Person as spouse (parent) of the target Family.                                         |
| 3  | person  | empty   | Silent — create pending Family with the dragged Person as the sole parent (front-end only, not yet sent). |
| 4  | empty   | person  | Silent — create pending Family with the target Person as the sole child (front-end only, not yet sent).   |
| 5  | person  | family  | Silent — attach dragged Person to target Family as spouse (parent). Promotes pending Family if target is pending. |
| 6  | family  | person  | Silent — attach target Person to dragged Family as child. Promotes pending Family if source is pending.   |

No-op gestures (explicitly): person→person, family→family, empty→empty.

### Pending families

- Gestures 3/4 create a front-end-only `PendingFamily` record (`pending-family-<uuid>`) merged into `displayedStemma`. No backend call.
- Pending families render as readOnly family nodes. They are valid drop targets/sources for gestures 1/2/5/6.
- When a second member is added (gestures 1/2 modal save, 5/6 attach), `promotePendingFamily` calls `controller.createFamily(parents, children)` with the combined member list and removes the pending entry on success. Backend rejects single-member families (`IncompleteFamily`), so promotion is required before backend sees the family.
- Pending families do not survive stemma switch / sign-out: state lives in `pendingFamilies` in `App.svelte`.

### Modal titles

| Gesture            | i18n key                  | English          | Russian             |
|--------------------|---------------------------|------------------|---------------------|
| 1 family → empty   | `createChildTitleOf`      | Add child of {names} | Добавить ребёнка {names} |
| 2 empty → family   | `createSpouseTitleOf`     | Add {name}'s spouse | Добавить супруга {name} |

### Drag tooltip text (hover hint while dragging)

| Source ↘ Hover     | Tip key                    |
|--------------------|----------------------------|
| person, family     | `tipIsSpouse`              |
| person, no target  | `tipIsParent` *(pending family creation)* |
| family, no target  | `tipIsChild` *(pending family creation)*  |
| family, person     | `tipIsChild`               |
| empty, family      | `tipIsSpouse` *(empty→family)* |
| empty, person      | `tipIsChild` *(empty→person)* |

### Notes

- "Silent" means no modal — the link or pending family appears immediately. Pending visuals come from `pendingAdds` / `pendingFamilies` in `App.svelte`.
- Disallowed links (cycle, duplicate spouse, too many parents, member already in pending family) are filtered via `StemmaIndex.canAddParent` / `canAddChild` and `findPendingFamily` membership checks. Hovering an invalid target shows the `drop-disallowed` class.

### Code locations

- Drag state machine: `components/DragGestures.svelte`.
- Outcome dispatch: `onMouseUp` inside that component.
- Tooltip text per gesture: `computeTipText`.
- Compatibility check: `targetCompatibility` + `classifyForDrop`.
- Silent attach: `attachPersonToFamily` (promotes pending family on second-member add).
- Modal create + extend existing family: `createPersonInFamily` (gestures 1, 2; also promotes pending family).
- Pending family creation: `createPendingFamilyForPerson` (gestures 3, 4).
- Pending family promotion: `promotePendingFamily` + `clearPendingFamily` (in `mutationActions.ts`).

## Ghost affordances

Explicit "ghost" placeholders for adding spouses, parents, and children. Discoverability layer on top of the drag gestures.

### Concept

When a person or family is **focused**, dashed "ghost" nodes appear around it:

| Focused entity | Ghost(s)                                                         |
| -------------- | ---------------------------------------------------------------- |
| Person         | spouse-ghost (`addSpouse`) — always present                      |
| Person         | parent-ghost (`addParent`) — only if person has no parents       |
| Family         | child-ghost (`addChild`) — always present                        |

Clicking a ghost opens the create-person modal. On confirm, ghost materializes into a real person + family; focus stays on original node so user can add more.

### Focus model

- State: `focusedId: { kind: "person" | "family", id: string } | null`.
- **Desktop**: hovering bounding box sets focus (~150 ms debounce on leave to prevent flicker). Click on real node = edit modal.
- **Mobile**: short-tap (<500 ms) on real node = focus. Long-tap (≥500 ms) = edit modal. Tap elsewhere / pan = blur. ESC blurs on desktop.

### Physics

- All non-focused real nodes frozen via `fx, fy = current`.
- Focused real node also frozen (anchored at tap position — no jump).
- Ghosts: unfrozen. Initial seed: spouse to right of person, parent above, child below family. d3 collision force pushes ghosts into empty space against frozen neighbors. Sim stops on blur, ghosts despawn.

### Visual

- Dashed border + ~0.6 opacity — same language as pending family.
- Dashed edge from focused node to ghost.
- Centered "+" icon + i18n label.
- Fade-in/out 200 ms on focus change.

## Known constraints

- `requestSanitizer.ts` drops fields with empty-string values. If a request type has a required field that may legitimately be empty (e.g. `name` for an "unknown" person), do not route it through the sanitizer or the backend rejects with `RequestDeserializationProblem`.
