from stemma.services.invite_tokens import InviteToken, decode_invite_token, encode_invite_token


def test_roundtrip_invite_token() -> None:
    token = InviteToken(
        inviteesEmail="invitee@example.com",
        stemmaId="42",
        targetPersonId="7",
        entropy="abcd",
    )
    encoded = encode_invite_token("secret_string", token)
    decoded = decode_invite_token("secret_string", encoded)
    assert decoded == token


def test_decode_with_wrong_secret_raises() -> None:
    import pytest

    from stemma.domain.errors import InvalidInviteToken

    token = InviteToken(inviteesEmail="x@y", stemmaId="1", targetPersonId="2", entropy="e")
    encoded = encode_invite_token("secret_string", token)
    with pytest.raises(InvalidInviteToken):
        decode_invite_token("other_secret", encoded)
