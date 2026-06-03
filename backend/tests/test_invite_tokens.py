import pytest

from stemma.domain.errors import InvalidInviteToken
from stemma.services.invite_tokens import InviteToken, decode_invite_token, encode_invite_token


def test_roundtrip_invite_token() -> None:
    token = InviteToken(
        invitees_email="invitee@example.com",
        stemma_id="42",
        target_person_id="7",
        entropy="abcd",
    )
    encoded = encode_invite_token("secret_string", token)
    decoded = decode_invite_token("secret_string", encoded)
    assert decoded == token


def test_decode_with_wrong_secret_raises() -> None:
    token = InviteToken(invitees_email="x@y", stemma_id="1", target_person_id="2", entropy="e")
    encoded = encode_invite_token("secret_string", token)
    with pytest.raises(InvalidInviteToken):
        decode_invite_token("other_secret", encoded)
