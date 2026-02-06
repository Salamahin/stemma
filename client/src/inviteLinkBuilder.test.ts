import { buildInviteLink } from "./inviteLinkBuilder";

describe("buildInviteLink", () => {
    test("encodes token in invite link", () => {
        const link = buildInviteLink("http://localhost:8090", "a/b");
        expect(link).toBe("http://localhost:8090/?inviteToken=a%2Fb");
    });
});
