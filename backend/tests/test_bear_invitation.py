from stemma.apis.request_handler import RequestHandler
from stemma.domain.requests import BearInvitationRequest, CreateInvitationTokenRequest
from stemma.domain.responses import InviteToken, TokenAccepted
from stemma.services.user_service import UserService
from stemma.storage.storage_service import StorageService

from tests.factories import create_jane, create_john, family


def test_bearing_an_invite_names_the_shared_stemma(
    storage: StorageService, users: UserService
) -> None:
    owner = storage.get_or_create_user("owner@test.com")
    sid = storage.create_stemma(owner.user_id, "shared stemma")
    _, fam = storage.create_family(owner.user_id, sid, family(create_jane, create_john)())
    handler = RequestHandler(storage, users)
    invite = handler.handle(
        owner,
        CreateInvitationTokenRequest(
            stemma_id=sid, target_person_id=fam.parents[0], target_person_email="invitee@test.com"
        ),
    )
    assert isinstance(invite, InviteToken)

    # The invitee already has stemmas of their own, so the shared one is not
    # necessarily listed last; the response has to say which one it is.
    invitee = storage.get_or_create_user("invitee@test.com")
    storage.create_stemma(invitee.user_id, "zzz own stemma")
    accepted = handler.handle(invitee, BearInvitationRequest(encoded_token=invite.token))

    assert isinstance(accepted, TokenAccepted)
    assert accepted.stemma_id == sid
    assert sid in {s.id for s in accepted.stemmas}
    assert len(accepted.last_stemma.people) == 2
