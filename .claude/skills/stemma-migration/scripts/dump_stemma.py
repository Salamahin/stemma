"""Export every item belonging to one stemma to a JSON file.

Useful before any destructive change — apply_seed.py can restore the dump.

Usage:
    aws sso login --profile <profile>
    AWS_PROFILE=<profile> python dump_stemma.py \\
        --table stemma-app-StemmaTable-XXXXX \\
        --stemma <stemma_uuid_hex> \\
        --out backup.json

The output is a JSON array of items in the exact shape apply_seed.py expects.
``Decimal`` attributes (DynamoDB's default for numbers) are emitted as plain
int/float so the file is human-readable and round-trips through apply_seed.py.
"""
from __future__ import annotations

import argparse
import json
import sys
from decimal import Decimal
from pathlib import Path

import boto3
from boto3.dynamodb.conditions import Key


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p.add_argument("--table", required=True, help="DynamoDB table name")
    p.add_argument("--region", default="eu-central-1", help="AWS region")
    p.add_argument("--endpoint", help="DynamoDB endpoint URL (for DynamoDB Local)")
    p.add_argument("--stemma", required=True, help="Stemma id (just the uuid hex, no STEMMA# prefix)")
    p.add_argument("--out", type=Path, required=True, help="Output JSON path")
    args = p.parse_args(argv)

    kwargs: dict = {"region_name": args.region}
    if args.endpoint:
        kwargs["endpoint_url"] = args.endpoint
    table = boto3.resource("dynamodb", **kwargs).Table(args.table)

    print(f"Caller:  {_caller_identity(args.region)}", file=sys.stderr)
    print(f"Table:   {args.table}  ({args.region})", file=sys.stderr)
    print(f"Stemma:  {args.stemma}", file=sys.stderr)

    pk = f"STEMMA#{args.stemma}"
    items: list[dict] = []
    kw: dict = {"KeyConditionExpression": Key("pk").eq(pk)}
    while True:
        response = table.query(**kw)
        items.extend(response.get("Items", []))
        last = response.get("LastEvaluatedKey")
        if not last:
            break
        kw["ExclusiveStartKey"] = last

    args.out.write_text(json.dumps(items, ensure_ascii=False, default=_jsonable))
    print(f"Wrote {len(items):,} items to {args.out}", file=sys.stderr)
    return 0 if items else 4


def _jsonable(obj: object) -> object:
    if isinstance(obj, Decimal):
        return int(obj) if obj == obj.to_integral_value() else float(obj)
    raise TypeError(f"not json-serializable: {type(obj).__name__}")


def _caller_identity(region: str) -> str:
    try:
        ident = boto3.client("sts", region_name=region).get_caller_identity()
        return f"account={ident['Account']}  arn={ident['Arn']}"
    except Exception as exc:
        return f"(could not resolve: {exc})"


if __name__ == "__main__":
    raise SystemExit(main())
