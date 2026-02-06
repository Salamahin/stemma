export function buildInviteLink(origin: string, token: string) {
    return `${origin}/?inviteToken=${encodeURIComponent(token)}`;
}
