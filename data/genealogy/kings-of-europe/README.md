# Kings of Europe — stemma snapshot

Frozen export of the `Короли Европы` stemma from the production DynamoDB table.
Kept in the repo so the data is reviewable / diffable without re-querying AWS.

The canonical JSON (`persons.json` + `families.json`) used by backend seeding lives
under `backend/src/stemma/seed/data/kings_of_europe/` so it ships inside the
Lambda artifact. The markdown analyses below stay here for reference.

## Files

- `backend/src/stemma/seed/data/kings_of_europe/persons.json` — every person (id, name, dates, bio), sorted by birth date.
- `backend/src/stemma/seed/data/kings_of_europe/families.json` — every family with parent / child ids **and** resolved names, sorted by earliest parent's birth date.
- `persons.md` — same persons, as a markdown table.
- `families.md` — same families, as a readable list.
- `components.md` — connected-component analysis of the parent/child graph.
- `audit.md` — review of structural and historical issues, with proposed fixes.

## Source

- Stemma id: `1cd5147ad05b5b619cb5e0efb9ccfab8`
- DynamoDB table: `stemma-app-StemmaTable-17GSYHFZQU76H` (region `eu-central-1`)
- Snapshot date: 2026-05-18
- Persons: 328 — Families: 82
- Connected components: 1 (fully linked)

## How to regenerate

Need SSO access to the prod table. The dump scripts live in `.claude/skills/stemma-migration/scripts/`:

```sh
AWS_PROFILE=stemma uvx --with boto3 python \
  .claude/skills/stemma-migration/scripts/dump_stemma.py \
  --table stemma-app-StemmaTable-17GSYHFZQU76H --region eu-central-1 \
  --stemma 1cd5147ad05b5b619cb5e0efb9ccfab8 \
  --out /tmp/kings-europe-raw.json
```

The build script (markdown + JSON re-formatting + connectivity) is ad-hoc — see
the conversation that produced this dump.
