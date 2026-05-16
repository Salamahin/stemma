---
name: stemma-migration
description: Workflow + reference for one-off corrections to the production Stemma DynamoDB table. Use when the user asks to fix, rename, re-parent, batch-update, add, remove, or inspect items (users, stemmas, persons, families, ownership) in the live DB — anything that cannot be done through the UI. Also covers bulk imports from a JSON file.
---

# Stemma DynamoDB migrations

One-off corrections to the live single-table DynamoDB store. Migrations are run
from a local workstation through SSO-issued credentials — Lambda is never
involved.

## When to apply

- Field-level fixes: "rename stemma X to Y", "set birth_date on person N",
  "remove stale family", "transfer ownership of stemma S from A to B".
- Structural fixes: re-parenting, splitting/merging families, deduping persons.
- Bulk imports of a JSON file of pre-shaped items.
- Inspecting items the UI does not expose (owner rows, GSI projections,
  orphaned references).

For business-logic changes that should go through `RequestHandler.handle`, add a
new `Request` dataclass + handler branch instead — do not migrate around the API.

## AWS access

Production uses AWS Identity Center (SSO). One-time setup:

```sh
aws configure sso
# Prompts (values come from your Identity Center portal / admin):
#   SSO session name        — any label, e.g. "stemma"
#   SSO start URL           — your organisation's Identity Center start URL
#   SSO region              — region where the SSO directory lives (often us-east-1)
#   Account + role          — pick from the list shown
#   CLI default Region      — eu-central-1 for this project
#   Profile name            — auto-suggested, accept or customize
```

Refresh the SSO session whenever it expires (~8 h):

```sh
aws sso login --profile <profile>
AWS_PROFILE=<profile> aws sts get-caller-identity   # sanity check before any write
```

Discover the DynamoDB table name (CloudFormation generates it; never hardcode):

```sh
AWS_PROFILE=<profile> aws dynamodb list-tables --region eu-central-1
# look for stemma-app-StemmaTable-XXXXX
```

## Schema (single table)

Authoritative encoders: `backend_py/src/stemma/storage/schema.py`.

| Item            | `pk`                  | `sk`                              | Extra attrs                                          |
|-----------------|-----------------------|-----------------------------------|------------------------------------------------------|
| User PROFILE    | `USER#EMAIL#<email>`  | `PROFILE`                         | `user_id`, `email`                                   |
| Stemma META     | `STEMMA#<sid>`        | `META`                            | `name`                                               |
| Person          | `STEMMA#<sid>`        | `PERSON#<pid>`                    | `name`, optional `birth_date`, `death_date`, `bio`   |
| Family          | `STEMMA#<sid>`        | `FAMILY#<fid>`                    | `parents` (list of pids), `children` (list of pids)  |
| Stemma owner    | `STEMMA#<sid>`        | `OWNER#STEMMA#<uid>`              | `gsi1pk = USER#<uid>`, `gsi1sk = STEMMA#<sid>`       |
| Person owner    | `STEMMA#<sid>`        | `OWNER#PERSON#<pid>#<uid>`        | —                                                    |
| Family owner    | `STEMMA#<sid>`        | `OWNER#FAMILY#<fid>#<uid>`        | —                                                    |

GSI `UserStemmasIndex` is `(gsi1pk, gsi1sk)`. IDs are `uuid4().hex` (32 lowercase
hex chars). Dates are ISO strings (`YYYY-MM-DD`).

## Workflow

1. **Read first.** Query/GetItem the items you'll touch. Never `Scan` the whole
   table for a production fix — it's expensive and easy to misuse.
2. **Back up the affected stemma** with `scripts/dump_stemma.py` before any
   destructive change; restore with `scripts/apply_seed.py` if needed.
3. **Write the change as a script** by copying `scripts/migration_template.py`.
   Place new migration scripts outside git (the data they read often is PII).
4. **Two phases**: `--dry-run` prints the plan and exits; the default run
   prints the plan, asks confirmation, then writes.
5. **Print AWS caller identity** before any write (the template does this).
6. **Prefer `put_item` over `update_item`** for one-off fixes — read the whole
   item, modify in memory, put back. Simpler and overwrite-by-default is fine.

## Scripts in this skill

`.claude/skills/stemma-migration/scripts/`:

- **`apply_seed.py`** — apply a JSON array of pre-shaped items. Optional
  idempotency marker (`SYSTEM`/`MIGRATION_COMPLETE`) so re-runs are no-ops.
  Supports `--dry-run`, `--force`, `--yes`, prints caller identity + breakdown.
- **`dump_stemma.py`** — export every item belonging to one stemma to a JSON
  file. Use before any destructive change as a rollback artifact.
- **`migration_template.py`** — starter for ad-hoc fixes. Fill in `plan()`,
  which returns a list of `(key, new_item_or_None)` pairs; the harness handles
  identity print, dry-run, confirmation, and `batch_writer` writes.

Run pattern (no project venv needed — scripts only depend on `boto3`):

```sh
AWS_PROFILE=<profile> uvx --with boto3 python \
  .claude/skills/stemma-migration/scripts/<script>.py \
  --table stemma-app-StemmaTable-XXXXX --region eu-central-1 --dry-run
```

Or, if you're already in `backend_py/` with `uv sync` done:

```sh
AWS_PROFILE=<profile> uv run python \
  ../.claude/skills/stemma-migration/scripts/<script>.py …
```

## Common queries

```python
from boto3.dynamodb.conditions import Key

# All items in a stemma:
items = table.query(KeyConditionExpression=Key("pk").eq(f"STEMMA#{sid}"))["Items"]

# Just the family rows:
items = table.query(
    KeyConditionExpression=Key("pk").eq(f"STEMMA#{sid}") & Key("sk").begins_with("FAMILY#")
)["Items"]

# Stemmas a user owns (via GSI):
rows = table.query(
    IndexName="UserStemmasIndex",
    KeyConditionExpression=Key("gsi1pk").eq(f"USER#{uid}"),
)["Items"]

# Look up an existing user by email (do this before minting a new user_id):
profile = table.get_item(
    Key={"pk": f"USER#EMAIL#{email}", "sk": "PROFILE"}
).get("Item")
```

For larger reads (>1 MB), see the `_query_all` pagination loop in
`backend_py/src/stemma/storage/storage_service.py`.

## Gotchas

- **Never mint a new `user_id` for an email that already has a PROFILE.** A
  wrong `user_id` orphans every stemma that user owns. Always look up the
  existing PROFILE first and reuse its `user_id`.
- **GSI fields** (`gsi1pk`, `gsi1sk`) belong only on `OWNER#STEMMA#…` rows. Do
  not add them to `OWNER#PERSON#…` or `OWNER#FAMILY#…` rows.
- **`Family.parents` / `Family.children`** are stored as ordered lists.
  Preserve order when rewriting.
- **Removing a person** also requires rewriting every family that referenced
  them, and possibly deleting families that drop below two participants.
  `StorageService.remove_person` is the canonical recipe — mirror its logic.
- **Cycle check** lives in `stemma.services.stemma_dfs.has_cycles`. For any
  change that re-shapes the tree, simulate the planned snapshot and call
  `has_cycles` before writing — otherwise the DB ends up structurally invalid
  in a way the normal API would have refused.
- **Idempotency**: `batch_writer.put_item` overwrites by default, so re-running
  a put-only migration is naturally safe. Deletes are not — guard with a
  dry-run that prints what will go.
- **PII** lives in this table (real emails, biographies). Don't paste raw rows
  into long-lived chat transcripts. Keep migration scripts and any data files
  they read outside git.
