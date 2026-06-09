"""DynamoDB key encoders and item shape constants.

Single-table layout. Every item is keyed by (pk, sk). GSI1 lets us list every
stemma (or session) a user owns by querying gsi1pk = USER#<user_id>.

    pk                      | sk                                | item
    ----------------------- | --------------------------------- | -----------------------
    USER#EMAIL#<email>      | PROFILE                           | user lookup by email
    STEMMA#<sid>            | META                              | stemma metadata
    STEMMA#<sid>            | PERSON#<pid>                      | person attributes
    STEMMA#<sid>            | FAMILY#<fid>                      | family + parents/children
    STEMMA#<sid>            | OWNER#STEMMA#<uid>                | stemma ownership (also on GSI1)
    STEMMA#<sid>            | OWNER#PERSON#<pid>#<uid>          | person ownership
    STEMMA#<sid>            | OWNER#FAMILY#<fid>#<uid>          | family ownership
    SESSION#<sid>           | META                              | session (TTL attr drives DynamoDB expiry)
"""

SK_PROFILE = "PROFILE"
SK_META = "META"

ATTR_DISPLAY_NAME = "display_name"
ATTR_DEFAULT_STEMMA_ID = "default_stemma_id"
ATTR_TTL = "ttl"

STEMMA_PK_PREFIX = "STEMMA#"
SESSION_PK_PREFIX = "SESSION#"
PERSON_PREFIX = "PERSON#"
FAMILY_PREFIX = "FAMILY#"
STEMMA_OWNER_PREFIX = "OWNER#STEMMA#"
PERSON_OWNER_PREFIX = "OWNER#PERSON#"
FAMILY_OWNER_PREFIX = "OWNER#FAMILY#"

GSI1_INDEX_NAME = "UserStemmasIndex"


TABLE_DEFINITION: dict = {
    "AttributeDefinitions": [
        {"AttributeName": "pk", "AttributeType": "S"},
        {"AttributeName": "sk", "AttributeType": "S"},
        {"AttributeName": "gsi1pk", "AttributeType": "S"},
        {"AttributeName": "gsi1sk", "AttributeType": "S"},
    ],
    "KeySchema": [
        {"AttributeName": "pk", "KeyType": "HASH"},
        {"AttributeName": "sk", "KeyType": "RANGE"},
    ],
    "GlobalSecondaryIndexes": [
        {
            "IndexName": GSI1_INDEX_NAME,
            "KeySchema": [
                {"AttributeName": "gsi1pk", "KeyType": "HASH"},
                {"AttributeName": "gsi1sk", "KeyType": "RANGE"},
            ],
            "Projection": {"ProjectionType": "ALL"},
        }
    ],
    "BillingMode": "PAY_PER_REQUEST",
}


def user_email_pk(email: str) -> str:
    return f"USER#EMAIL#{email}"


def stemma_pk(stemma_id: str) -> str:
    return f"{STEMMA_PK_PREFIX}{stemma_id}"


def person_sk(person_id: str) -> str:
    return f"{PERSON_PREFIX}{person_id}"


def family_sk(family_id: str) -> str:
    return f"{FAMILY_PREFIX}{family_id}"


def stemma_owner_sk(user_id: str) -> str:
    return f"{STEMMA_OWNER_PREFIX}{user_id}"


def person_owner_sk(person_id: str, user_id: str) -> str:
    return f"{PERSON_OWNER_PREFIX}{person_id}#{user_id}"


def family_owner_sk(family_id: str, user_id: str) -> str:
    return f"{FAMILY_OWNER_PREFIX}{family_id}#{user_id}"


def user_gsi_pk(user_id: str) -> str:
    return f"USER#{user_id}"


def user_gsi_sk(stemma_id: str) -> str:
    return f"{STEMMA_PK_PREFIX}{stemma_id}"


def session_pk(sid: str) -> str:
    return f"{SESSION_PK_PREFIX}{sid}"


def parse_id_after_prefix(sk: str, prefix: str) -> str:
    return sk[len(prefix) :]


def parse_owner_composite(sk: str, prefix: str) -> tuple[str, str]:
    """For OWNER#PERSON#<pid>#<uid> and OWNER#FAMILY#<fid>#<uid>."""
    remainder = sk[len(prefix) :]
    head, _, tail = remainder.partition("#")
    return head, tail
