import base64
import hashlib
import json
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken

from stemma.domain.errors import InvalidInviteToken

INVITE_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30  # 30 days


@dataclass(frozen=True)
class InviteToken:
    invitees_email: str
    stemma_id: str
    target_person_id: str


_WIRE_KEYS = {
    "invitees_email": "inviteesEmail",
    "stemma_id": "stemmaId",
    "target_person_id": "targetPersonId",
}
_PY_KEYS = {wire: py for py, wire in _WIRE_KEYS.items()}


def encode_invite_token(secret: str, token: InviteToken) -> str:
    payload = json.dumps({_WIRE_KEYS[k]: v for k, v in token.__dict__.items()}).encode("utf-8")
    return Fernet(_derive_fernet_key(secret)).encrypt(payload).decode("ascii")


def decode_invite_token(secret: str, encoded: str) -> InviteToken:
    try:
        raw = Fernet(_derive_fernet_key(secret)).decrypt(
            encoded.encode("ascii"), ttl=INVITE_TOKEN_TTL_SECONDS
        )
        data = json.loads(raw)
        return InviteToken(**{_PY_KEYS[k]: v for k, v in data.items()})
    except (InvalidToken, ValueError, KeyError, TypeError) as e:
        raise InvalidInviteToken() from e


def _derive_fernet_key(secret: str) -> bytes:
    digest = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)
