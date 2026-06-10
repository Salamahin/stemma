import time

import pytest

from stemma.domain.errors import InvalidInviteToken
from stemma.services.invite_tokens import (
    INVITE_TOKEN_TTL_SECONDS,
    InviteToken,
    decode_invite_token,
    encode_invite_token,
)


def _token() -> InviteToken:
    return InviteToken(
        invitees_email="invitee@example.com",
        stemma_id="42",
        target_person_id="7",
    )


def test_roundtrip_invite_token() -> None:
    encoded = encode_invite_token("secret_string", _token())
    decoded = decode_invite_token("secret_string", encoded)
    assert decoded == _token()


def test_decode_with_wrong_secret_raises() -> None:
    encoded = encode_invite_token("secret_string", _token())
    with pytest.raises(InvalidInviteToken):
        decode_invite_token("other_secret", encoded)


def test_decode_tampered_token_raises() -> None:
    encoded = encode_invite_token("secret", _token())
    tampered = encoded[:-4] + "XXXX"
    with pytest.raises(InvalidInviteToken):
        decode_invite_token("secret", tampered)


def test_decode_expired_token_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    encoded = encode_invite_token("secret", _token())
    monkeypatch.setattr(
        "cryptography.fernet.time",
        type("_T", (), {"time": staticmethod(lambda: time.time() + INVITE_TOKEN_TTL_SECONDS + 1)}),
    )
    with pytest.raises(InvalidInviteToken):
        decode_invite_token("secret", encoded)
