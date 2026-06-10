"""Apply a JSON array of pre-shaped DynamoDB items to a Stemma table.

Items in the file must already match the single-table schema (pk, sk, attrs).
The script validates that `pk` and `sk` use known prefixes (see
`KNOWN_PK_PREFIXES` / `KNOWN_SK_PREFIXES`), but does not check non-key attrs.

If the file ends with a ``SYSTEM``/``MIGRATION_COMPLETE`` marker, the script
treats it as a one-shot seed: subsequent invocations short-circuit unless
``--force`` is passed. Without that marker the script always writes.

Usage:
    aws sso login --profile <profile>
    AWS_PROFILE=<profile> python apply_seed.py \\
        --table stemma-app-StemmaTable-XXXXX \\
        --region eu-central-1 \\
        --seed path/to/items.json \\
        --dry-run

    # then drop --dry-run to apply.
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import boto3

SEED_MARKER_KEY: dict[str, str] = {"pk": "SYSTEM", "sk": "MIGRATION_COMPLETE"}

KNOWN_PK_PREFIXES: tuple[str, ...] = ("STEMMA#", "USER#EMAIL#", "SESSION#")
KNOWN_PK_EXACT: frozenset[str] = frozenset({"SYSTEM"})
KNOWN_SK_PREFIXES: tuple[str, ...] = (
    "PERSON#",
    "FAMILY#",
    "OWNER#STEMMA#",
    "OWNER#PERSON#",
    "OWNER#FAMILY#",
)
KNOWN_SK_EXACT: frozenset[str] = frozenset({"META", "PROFILE", "MIGRATION_COMPLETE"})


def _validate_keys(items: list[dict]) -> list[tuple[int, str]]:
    bad: list[tuple[int, str]] = []
    for idx, item in enumerate(items):
        pk = item.get("pk")
        sk = item.get("sk")
        if not isinstance(pk, str) or not isinstance(sk, str):
            bad.append((idx, f"missing or non-string pk/sk: pk={pk!r} sk={sk!r}"))
            continue
        if pk not in KNOWN_PK_EXACT and not any(pk.startswith(p) for p in KNOWN_PK_PREFIXES):
            bad.append((idx, f"unknown pk prefix: {pk!r}"))
        if sk not in KNOWN_SK_EXACT and not any(sk.startswith(p) for p in KNOWN_SK_PREFIXES):
            bad.append((idx, f"unknown sk prefix: {sk!r}"))
    return bad


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    if not args.seed.exists():
        print(f"ERROR: seed file not found: {args.seed}", file=sys.stderr)
        return 2

    items: list[dict] = json.loads(args.seed.read_text())
    size_kb = args.seed.stat().st_size / 1024

    bad_keys = _validate_keys(items)
    if bad_keys:
        print(f"ERROR: {len(bad_keys)} items have unknown pk/sk prefixes:", file=sys.stderr)
        for idx, msg in bad_keys[:20]:
            print(f"  [{idx}] {msg}", file=sys.stderr)
        if len(bad_keys) > 20:
            print(f"  ... and {len(bad_keys) - 20} more", file=sys.stderr)
        print(
            "Known prefixes are defined in apply_seed.py; "
            "see backend/src/stemma/storage/schema.py for the authoritative encoders.",
            file=sys.stderr,
        )
        return 4

    print(f"Seed file:    {args.seed}")
    print(f"Items:        {len(items):,}  ({size_kb:.1f} KB)")
    print(f"Target table: {args.table}")
    print(f"Region:       {args.region}")
    if args.endpoint:
        print(f"Endpoint:     {args.endpoint}")
    print(f"Caller:       {_caller_identity(args.region)}")

    table = _table(args.region, args.endpoint, args.table)
    try:
        existing_marker = table.get_item(Key=SEED_MARKER_KEY).get("Item")
    except Exception as exc:
        print(f"ERROR: cannot reach table {args.table!r}: {exc}", file=sys.stderr)
        return 3

    if existing_marker:
        version = existing_marker.get("version")
        print(f"\nMarker present — table already seeded (version={version}).")
        if not args.force:
            print("Use --force to re-apply (overwrites items; does not delete extras).")
            return 0
        print("--force: re-applying anyway.")

    if args.dry_run:
        _show_breakdown(items)
        print("\n--dry-run: no items written.")
        return 0

    if not args.yes:
        reply = input(
            f"\nWrite {len(items):,} items to {args.table!r} in {args.region}? [y/N] "
        ).strip().lower()
        if reply not in {"y", "yes"}:
            print("Aborted.")
            return 1

    with table.batch_writer() as batch:
        for item in items:
            batch.put_item(Item=item)
    print(f"\nDone. Wrote {len(items):,} items.")
    return 0


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--table", required=True, help="DynamoDB table name")
    p.add_argument("--region", default="eu-central-1", help="AWS region (default: eu-central-1)")
    p.add_argument("--endpoint", help="DynamoDB endpoint URL (for DynamoDB Local)")
    p.add_argument("--seed", required=True, type=Path, help="Path to JSON array of items")
    p.add_argument("--dry-run", action="store_true", help="Print plan, do not write")
    p.add_argument("--yes", action="store_true", help="Skip interactive confirmation")
    p.add_argument("--force", action="store_true", help="Re-apply even if marker is present")
    return p.parse_args(argv)


def _table(region: str, endpoint: str | None, name: str):
    kwargs: dict = {"region_name": region}
    if endpoint:
        kwargs["endpoint_url"] = endpoint
    return boto3.resource("dynamodb", **kwargs).Table(name)


def _caller_identity(region: str) -> str:
    try:
        ident = boto3.client("sts", region_name=region).get_caller_identity()
        return f"account={ident['Account']}  arn={ident['Arn']}"
    except Exception as exc:
        return f"(could not resolve: {exc})"


def _show_breakdown(items: list[dict]) -> None:
    kinds: Counter[str] = Counter()
    for it in items:
        sk = it["sk"]
        if sk in {"PROFILE", "META", "MIGRATION_COMPLETE"}:
            kinds[sk] += 1
        else:
            kinds[sk.split("#")[0] + "#…"] += 1
    print("\nBreakdown:")
    for k, v in sorted(kinds.items()):
        print(f"  {k:24s} {v:>5}")


if __name__ == "__main__":
    raise SystemExit(main())
