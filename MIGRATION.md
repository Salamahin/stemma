# Migration: anchor-on-person editing under `/v2`

Tracking issue for legacy code removal: [#132](https://github.com/Salamahin/stemma/issues/132).

## Goal

Pilot a redesigned UI under `/v2` that swaps the bulk "Add family" modal for anchored, fine-grained operations on individual persons and families. Optimized for mobile / lightweight modals. The legacy `/` flow keeps working unchanged during the pilot.

## UX model

Two-level action set:

- **Person card** (in edit mode):
  - `+ family` — anchor person becomes a parent of a new (initially empty) family node.
  - `+ ancestor` — anchor person becomes a child of a new (initially empty) family node.
- **Family card** (in edit mode):
  - `+ child` — adds a child to this family.
  - `+ spouse` — fills the empty second-parent slot (disabled when both slots occupied).

Multi-marriage = multiple families anchored on the same person. Each marriage is a separate family node, descendants from different marriages stay correctly grouped.

**Bootstrap** (empty stemma): navbar `+ person` creates an orphan person — the first anchor.

**Edit-mode toggle**: session-only `$state` in the v2 shell. No `localStorage`. Off by default — viewers see clean canvas.

## Stub families (client-only)

Creating an empty family (`+ family` / `+ ancestor` on a person) does **not** hit the backend. The stub family is held in v2 client state with a temporary id and rendered with a dashed outline.

The stub becomes a real (backend-persisted) family the first time the user adds content to it:

- Descendant stub + `+ child` → `CreateFamilyRequest { parent1: anchor, children: [new] }`
- Descendant stub + `+ spouse` → `CreateFamilyRequest { parent1: anchor, parent2: new }`
- Ancestor stub + `+ spouse` → `CreateFamilyRequest { parent1: new, children: [anchor] }`
- Ancestor stub + `+ child` → `CreateFamilyRequest { children: [anchor, new] }` (sibling group, no parents)

All four transitions send ≥2 members, satisfying the existing `IncompleteFamily` (`< 2`) constraint.

Reload or `/` ↔ `/v2` navigation drops in-memory stubs — nothing is persisted yet so nothing is lost.

## Backend changes

Minimal. Only orphan-person bootstrap is new; family ops reuse existing endpoints.

- ✅ `CreateOrphanPersonRequest { stemma_id, person_descr: CreateNewPerson }` — new request type, registered in `Request` discriminated union.
- ✅ `StorageService.create_orphan_person(user_id, stemma_id, description) -> Stemma` — single-person write + owner grant, no family logic.
- ✅ `RequestHandler._create_orphan_person` dispatch branch.
- ✅ Tests: `test_storage_service.py` (happy path, access denial, then-use-as-parent), `test_codec.py` (decode envelope).
- ↪ `CreateFamilyRequest` / `UpdateFamilyRequest` unchanged. v2 sends full composition exactly like `/`.

## Frontend changes (planned)

- **Routing**: `frontend/src/main.ts` switches on `window.location.pathname`. `/v2*` mounts `V2App`, anything else mounts the existing `App`.
- **SPA fallback**:
  - Dev: `sirv public --no-clear --single` in `frontend/package.json`.
  - Prod (CloudFront): verify `CustomErrorResponses` rewrite missing paths to `/index.html` — fix `template.yaml` if needed.
- **Directory**: new code lives in `frontend/src/v2/`. Reuses `AppController`, `model.ts`, `stemmaIndex.ts`, `personSearch.ts` from the existing shell.
- **Components** (sketch):
  - `V2App.svelte` — shell with auth, controller wiring, edit-mode `$state`, stub-family `$state Map<tempId, {anchorPersonId, anchorRole: "parent" | "child"}>`.
  - `v2/components/Navbar.svelte` — minimal mobile-first nav with edit-mode toggle + `+ person` bootstrap.
  - `v2/components/PersonModal.svelte` — lightweight detail view; in edit mode shows `+ family` / `+ ancestor` actions.
  - `v2/components/FamilyModal.svelte` — minimal family panel; in edit mode shows `+ child` / `+ spouse`.
  - Person picker for "add existing relative" reuses `components/misc/PersonSelector.svelte` (already handles namesakes).
- **Canvas**: render stub families with dashed outline so users see what's in-progress. On first content add, replace temp id with the real id returned by `CreateFamilyRequest`.
- **No new HTTP routes**: everything still goes through `POST /stemma` with the tagged-union envelope.

## E2E

- One Playwright happy path under `/v2`: bootstrap orphan → `+ family` on orphan → `+ child` on stub → assert real family appears with both members.

## Deprecation markers

When v2 PR lands, annotate the legacy add-family pieces with:

```
# FIXME REMOVE ISSUE#132
```

Targets:

- `frontend/src/components/family_modal/FamilyDetailsModal.svelte`
- `frontend/src/components/family_modal/CreateSelectPerson.svelte`
- `Add family` entry in `frontend/src/components/Navbar.svelte` + `oncreateNewFamily` wiring in `App.svelte`

Backend stays — v2 keeps using `CreateFamily` / `UpdateFamily`.

## Promotion criteria

When `/v2` graduates to default:

1. Either redirect `/` → `/v2` or delete `App.svelte` and rename `V2App` → `App`.
2. Remove every site annotated with `FIXME REMOVE ISSUE#132`.
3. Close issue #132.
