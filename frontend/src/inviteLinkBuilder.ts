const INVITE_PARAM = "inviteToken";
const PENDING_INVITE_KEY = "stemma_pending_invite";

type InviteStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function buildInviteLink(origin: string, token: string) {
    return `${origin}/?${INVITE_PARAM}=${encodeURIComponent(token)}`;
}

export function extractInviteToken(href: string): { token: string | null; cleanUrl: string } {
    const url = new URL(href);
    const token = url.searchParams.get(INVITE_PARAM);
    if (!token) return { token: null, cleanUrl: href };
    url.searchParams.delete(INVITE_PARAM);
    return { token, cleanUrl: url.toString() };
}

// The invitee usually lands signed out, so the token has to outlive the
// sign-in round trip; it is consumed once the session is up.
export function capturePendingInvite(href: string, replaceUrl: (url: string) => void, storage: InviteStorage): void {
    const { token, cleanUrl } = extractInviteToken(href);
    if (!token) return;
    try {
        storage.setItem(PENDING_INVITE_KEY, token);
    } catch {
        // Storage can be unavailable (private mode); the token is still in
        // the url, so leave it there rather than lose it.
        return;
    }
    replaceUrl(cleanUrl);
}

export function takePendingInvite(storage: InviteStorage): string | null {
    try {
        const token = storage.getItem(PENDING_INVITE_KEY);
        if (token) storage.removeItem(PENDING_INVITE_KEY);
        return token;
    } catch {
        return null;
    }
}
