import base64
import hashlib
import json
from dataclasses import dataclass

from cryptography.hazmat.primitives import padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes

from stemma.domain.errors import InvalidInviteToken

AES_BLOCK_SIZE_BITS = 128


@dataclass(frozen=True)
class InviteToken:
    invitees_email: str
    stemma_id: str
    target_person_id: str
    entropy: str


_WIRE_KEYS = {
    "invitees_email": "inviteesEmail",
    "stemma_id": "stemmaId",
    "target_person_id": "targetPersonId",
    "entropy": "entropy",
}
_PY_KEYS = {wire: py for py, wire in _WIRE_KEYS.items()}


def encode_invite_token(secret: str, token: InviteToken) -> str:
    payload = json.dumps({_WIRE_KEYS[k]: v for k, v in token.__dict__.items()}).encode("utf-8")
    return _encrypt(_derive_key(secret), payload)


def decode_invite_token(secret: str, encoded: str) -> InviteToken:
    try:
        decrypted = _decrypt(_derive_key(secret), encoded)
        data = json.loads(decrypted)
        return InviteToken(**{_PY_KEYS[k]: v for k, v in data.items()})
    except Exception as e:
        raise InvalidInviteToken() from e


def _derive_key(secret: str) -> bytes:
    return hashlib.sha1(secret.encode("utf-8")).digest()[:16]


def _encrypt(key: bytes, plaintext: bytes) -> str:
    padder = padding.PKCS7(AES_BLOCK_SIZE_BITS).padder()
    padded = padder.update(plaintext) + padder.finalize()
    encryptor = Cipher(algorithms.AES(key), modes.ECB()).encryptor()
    ciphertext = encryptor.update(padded) + encryptor.finalize()
    return base64.b64encode(ciphertext).decode("ascii")


def _decrypt(key: bytes, encoded: str) -> bytes:
    ciphertext = base64.b64decode(encoded)
    decryptor = Cipher(algorithms.AES(key), modes.ECB()).decryptor()
    padded = decryptor.update(ciphertext) + decryptor.finalize()
    unpadder = padding.PKCS7(AES_BLOCK_SIZE_BITS).unpadder()
    return unpadder.update(padded) + unpadder.finalize()
