# Frontend — v2 canvas drag scenario matrix

Edit-mode pointer drag on the v2 SVG canvas. The user presses mouse-down on a node (or empty canvas), drags, and releases on a node (or empty canvas). Source kind × target kind determines outcome.

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
- Pending families do not survive stemma switch / sign-out: state lives in `pendingFamilies` in `V2App.svelte`.

### Modal titles

| Gesture            | i18n key                  | English          | Russian             |
|--------------------|---------------------------|------------------|---------------------|
| 1 family → empty   | `v2.createChildTitle`     | Add child        | Добавить потомка    |
| 2 empty → family   | `v2.createSpouseTitle`    | Add spouse       | Добавить супруга    |

### Drag tooltip text (hover hint while dragging)

| Source ↘ Hover     | Tip key                    |
|--------------------|----------------------------|
| person, family     | `v2.tipAttachSpouse`       |
| person, no target  | `v2.tipCreateFamily`       |
| family, no target  | `v2.tipCreateChild`        |
| family, person     | `v2.tipAttachChild`        |
| empty, family      | `v2.tipCreateSpouse`       |
| empty, person      | `v2.tipCreateFamily`       |

### Notes

- "Silent" means no modal — the link or pending family appears immediately. Pending visuals come from `pendingAdds` / `pendingFamilies` in `V2App.svelte`.
- Disallowed links (cycle, duplicate spouse, too many parents, member already in pending family) are filtered via `StemmaIndex.canAddParent` / `canAddChild` and `findPendingFamily` membership checks. Hovering an invalid target shows the `v2-drop-disallowed` class.

### Code locations

- Drag state machine: `V2App.svelte` — `$effect` near `// Canvas pointer gesture` (mousedown/mousemove/mouseup).
- Outcome dispatch: `onMouseUp` inside that effect.
- Tooltip text per gesture: `computeTipText`.
- Compatibility check: `targetCompatibility` + `classifyForDrop`.
- Silent attach: `attachPersonToFamily` (promotes pending family on second-member add).
- Modal create + extend existing family: `createPersonInFamily` (gestures 1, 2; also promotes pending family).
- Pending family creation: `createPendingFamilyForPerson` (gestures 3, 4).
- Pending family promotion: `promotePendingFamily` + `clearPendingFamily`.

### Known constraints

- `requestSanitizer.ts` drops fields with empty-string values. If a request type has a required field that may legitimately be empty (e.g. `name` for an "unknown" person), do not route it through the sanitizer or the backend rejects with `RequestDeserializationProblem`.

### Related

- v3 (in development) layers explicit ghost-node affordances on top of v2's drag gestures. See `src/v3/CLAUDE.md`.
