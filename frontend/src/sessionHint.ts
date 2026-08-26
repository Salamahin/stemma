// The `stemma_session` cookie is HttpOnly, so the client cannot tell whether it
// still holds a session. This flag mirrors it: on boot it decides whether we
// wait on a session probe behind a spinner (case: session cached) or paint the
// login screen straight away (case: no session). A stale flag costs one probe,
// never correctness — the cookie remains the only source of truth.
const KEY = "stemma_has_session";

export function hasSessionHint(): boolean {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        // Safari private mode and friends: no storage, no hint.
        return false;
    }
}

export function rememberSession(): void {
    try {
        localStorage.setItem(KEY, "1");
    } catch {
        // Best effort only.
    }
}

export function forgetSession(): void {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // Best effort only.
    }
}
