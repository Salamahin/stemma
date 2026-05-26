from collections.abc import Iterator

import boto3
import pytest
from moto import mock_aws

from stemma.services.photo_service import S3PhotoService
from stemma.services.user_service import UserService
from stemma.storage.schema import TABLE_DEFINITION
from stemma.storage.storage_service import StorageService

TABLE_NAME = "stemma-test"
PHOTO_BUCKET = "stemma-test-photos"


@pytest.fixture
def aws_mock() -> Iterator[None]:
    with mock_aws():
        yield


@pytest.fixture
def dynamo_table(aws_mock) -> Iterator:
    client = boto3.resource("dynamodb", region_name="eu-central-1")
    client.create_table(TableName=TABLE_NAME, **TABLE_DEFINITION)
    yield client.Table(TABLE_NAME)


@pytest.fixture
def s3_client(aws_mock):
    client = boto3.client("s3", region_name="eu-central-1")
    client.create_bucket(
        Bucket=PHOTO_BUCKET,
        CreateBucketConfiguration={"LocationConstraint": "eu-central-1"},
    )
    return client


@pytest.fixture
def photo_store(s3_client) -> S3PhotoService:
    return S3PhotoService(s3_client=s3_client, bucket=PHOTO_BUCKET)


@pytest.fixture
def storage(dynamo_table, photo_store) -> StorageService:
    return StorageService(dynamo_table, photo_store=photo_store)


@pytest.fixture
def users(storage: StorageService) -> UserService:
    return UserService(storage, invite_secret="secret_string")
