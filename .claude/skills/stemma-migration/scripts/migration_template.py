"""Template for an ad-hoc Stemma DynamoDB migration.

Copy this file, rename after the fix (e.g. ``rename_my_stemma.py``), then fill
in ``plan(table)`` so it returns a list of ``(key, new_item_or_None)`` pairs:

- ``(key, dict)``  → ``put_item`` the dict (overwrites in place)
- ``(key, None)``  → ``delete_item`` the key

The harness prints caller identity, target table, the plan, and asks for
confirmation before writing. Use ``--dry-run`` to preview without writing.

Read the items you intend to change with ``GetItem`` or ``Query`` first; never
``Scan`` for a production fix.

Schema reference: ``backend/src/stemma/storage/schema.py``.
"""
from __future__ import annotations

import argparse

import boto3
from boto3.dynamodb.conditions import Key  # noqa: F401  (typically used in plan())

Change = tuple[dict, dict | None]


def plan(table) -> list[Change]:
    """Return the list of (key, new_item_or_None) pairs.

    Replace this body with the migration's read + transform logic.
    """
    # ----------------------------- examples -----------------------------
    #
    # Rename a stemma:
    #     sid = "0123456789abcdef0123456789abcdef"
    #     key = {"pk": f"STEMMA#{sid}", "sk": "META"}
    #     item = table.get_item(Key=key)["Item"]
    #     item["name"] = "New name"
    #     return [(key, item)]
    #
    # Delete a stray family + its owner rows:
    #     sid, fid = "...", "..."
    #     fkey = {"pk": f"STEMMA#{sid}", "sk": f"FAMILY#{fid}"}
    #     owners = table.query(
    #         KeyConditionExpression=Key("pk").eq(f"STEMMA#{sid}")
    #             & Key("sk").begins_with(f"OWNER#FAMILY#{fid}#"),
    #     )["Items"]
    #     return [(fkey, None)] + [({"pk": o["pk"], "sk": o["sk"]}, None) for o in owners]
    #
    # ---------------------------------------------------------------------
    raise NotImplementedError("fill in plan()")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--table", required=True, help="DynamoDB table name")
    p.add_argument("--region", default="eu-central-1", help="AWS region")
    p.add_argument("--endpoint", help="DynamoDB endpoint URL (for DynamoDB Local)")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--yes", action="store_true")
    args = p.parse_args(argv)

    session = boto3.session.Session(region_name=args.region)
    res_kwargs: dict = {}
    if args.endpoint:
        res_kwargs["endpoint_url"] = args.endpoint
    table = session.resource("dynamodb", **res_kwargs).Table(args.table)

    ident = session.client("sts").get_caller_identity()
    print(f"Caller: account={ident['Account']}  arn={ident['Arn']}")
    print(f"Table:  {args.table}  ({args.region})")

    changes = plan(table)
    print(f"\nPlan: {len(changes)} change(s)")
    for key, new in changes[:10]:
        marker = "DELETE" if new is None else "PUT   "
        print(f"  {marker}  {key}")
    if len(changes) > 10:
        print(f"  … and {len(changes) - 10} more")

    if args.dry_run:
        print("\n--dry-run: no items written.")
        return 0

    if not changes:
        print("Nothing to do.")
        return 0

    if not args.yes:
        reply = input(f"\nApply {len(changes)} change(s) to {args.table!r}? [y/N] ").strip().lower()
        if reply not in {"y", "yes"}:
            print("Aborted.")
            return 1

    with table.batch_writer() as batch:
        for key, new in changes:
            if new is None:
                batch.delete_item(Key=key)
            else:
                batch.put_item(Item=new)
    print(f"\nDone — {len(changes)} writes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
