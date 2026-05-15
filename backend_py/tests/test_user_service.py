from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

from tests.factories import create_jane, create_jill, create_john, create_josh, family


def test_can_create_or_find_user(users: UserService) -> None:
    created = users.get_or_create_user("user@test.com")
    found = users.get_or_create_user("user@test.com")
    assert created == found


def test_can_create_and_decode_invite_token(users: UserService, storage: StorageService) -> None:
    user = users.get_or_create_user("user@test.com")
    sid = storage.create_stemma(user.user_id, "my first stemma")
    _, fam = storage.create_family(user.user_id, sid, family(create_jane, create_john)(create_josh, create_jill))
    josh_id = fam.children[0]

    token = users.create_invite_token("invitee@test.com", sid, josh_id)
    decoded = users.decode_invite_token(token)
    assert decoded.inviteesEmail == "invitee@test.com"
    assert decoded.targetPersonId == josh_id
