import json
import os

from botocore.exceptions import ClientError

from stemma.storage.schema import TABLE_DEFINITION


def populate_env_from_secrets() -> None:
    secret_names = [
        name for name in (os.environ.get("STEMMA_INVITE_SECRET_NAME"),) if name
    ]
    if not secret_names:
        return
    import boto3  # pyright: ignore[reportMissingImports]  # provided by Lambda runtime

    client = boto3.client("secretsmanager")
    for name in secret_names:
        payload = json.loads(client.get_secret_value(SecretId=name)["SecretString"])
        for key, value in payload.items():
            os.environ.setdefault(key, value)


def dynamo_table_from_env():
    import boto3

    table_name = os.environ["STEMMA_TABLE_NAME"]
    endpoint_url = os.environ.get("DYNAMODB_ENDPOINT_URL")
    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "eu-central-1"
    kwargs: dict = {"region_name": region}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    resource = boto3.resource("dynamodb", **kwargs)
    if os.environ.get("STEMMA_AUTO_CREATE_TABLE") == "1":
        _ensure_table(resource, table_name)
    return resource.Table(table_name)


def photo_store_from_env():
    from stemma.services.photo_service import S3PhotoService

    bucket = os.environ.get("STEMMA_PHOTO_BUCKET")
    if not bucket:
        return None
    import boto3

    region = os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "eu-central-1"
    endpoint_url = os.environ.get("S3_ENDPOINT_URL")
    kwargs: dict = {"region_name": region, "config": _s3_signature_config()}
    if endpoint_url:
        kwargs["endpoint_url"] = endpoint_url
    client = boto3.client("s3", **kwargs)
    return S3PhotoService(s3_client=client, bucket=bucket)


def _s3_signature_config():
    from botocore.config import Config

    return Config(signature_version="s3v4")


def _ensure_table(resource, table_name: str) -> None:
    try:
        resource.meta.client.describe_table(TableName=table_name)
        return
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "ResourceNotFoundException":
            raise
    table = resource.create_table(TableName=table_name, **TABLE_DEFINITION)
    table.wait_until_exists()
