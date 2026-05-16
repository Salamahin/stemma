from collections.abc import Iterator

import boto3
import pytest
from moto import mock_aws

from stemma.services.user_service import UserService
from stemma.storage.schema import TABLE_DEFINITION
from stemma.storage.storage_service import StorageService

TABLE_NAME = "stemma-test"


@pytest.fixture
def dynamo_table() -> Iterator:
    with mock_aws():
        client = boto3.resource("dynamodb", region_name="eu-central-1")
        client.create_table(TableName=TABLE_NAME, **TABLE_DEFINITION)
        yield client.Table(TABLE_NAME)


@pytest.fixture
def storage(dynamo_table) -> StorageService:
    return StorageService(dynamo_table)


@pytest.fixture
def users(storage: StorageService) -> UserService:
    return UserService(storage, invite_secret="secret_string")
