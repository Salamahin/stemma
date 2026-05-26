type GsiNotification = {
    isNotDisplayed: () => boolean;
    isSkippedMoment: () => boolean;
    isDismissedMoment?: () => boolean;
    getNotDisplayedReason?: () => string;
    getSkippedReason?: () => string;
    getDismissedReason?: () => string;
};

type GsiCredentialResponse = { credential: string };

type Gsi = {
    accounts: {
        id: {
            initialize: (opts: {
                client_id: string;
                callback: (resp: GsiCredentialResponse) => void;
                auto_select?: boolean;
            }) => void;
            prompt: (handler?: (n: GsiNotification) => void) => void;
            renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
            disableAutoSelect: () => void;
        };
    };
};

type CredentialListener = (token: string) => void;

const REFRESH_TIMEOUT_MS = 8_000;

let initPromise: Promise<void> | null = null;
const listeners = new Set<CredentialListener>();

function gsi(): Gsi | null {
    const w = window as unknown as { google?: Gsi };
    return w.google ?? null;
}

async function awaitGsi(): Promise<Gsi> {
    const ready = (window as unknown as { __gsiReady?: Promise<void> }).__gsiReady;
    if (ready && typeof ready.then === "function") await ready;
    const g = gsi();
    if (!g) throw new Error("Google Identity Services not loaded");
    return g;
}

export function initializeGoogleAuth(clientId: string): Promise<void> {
    if (initPromise) return initPromise;
    initPromise = awaitGsi().then((g) => {
        g.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
                for (const l of Array.from(listeners)) l(resp.credential);
            },
            auto_select: true,
        });
    });
    return initPromise;
}

export function onCredential(listener: CredentialListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export async function promptInitialSignIn(fallbackTarget: HTMLElement | null): Promise<void> {
    const g = await awaitGsi();
    g.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            if (fallbackTarget) g.accounts.id.renderButton(fallbackTarget, { theme: "outline", size: "large" });
        }
    });
}

export async function refreshCredential(): Promise<string> {
    if (!initPromise) throw new Error("Google Identity Services not initialized");
    await initPromise;
    const g = gsi();
    if (!g) throw new Error("Google Identity Services not loaded");

    return new Promise<string>((resolve, reject) => {
        let settled = false;
        const finish = (ok: boolean, value: string | Error) => {
            if (settled) return;
            settled = true;
            unsubscribe();
            clearTimeout(timer);
            if (ok) resolve(value as string);
            else reject(value as Error);
        };
        const unsubscribe = onCredential((token) => finish(true, token));
        const timer = setTimeout(() => finish(false, new Error("Silent refresh timed out")), REFRESH_TIMEOUT_MS);

        try {
            g.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    finish(false, new Error("Silent refresh blocked by GIS"));
                }
            });
        } catch (err) {
            finish(false, err instanceof Error ? err : new Error(String(err)));
        }
    });
}

export function disableAutoSelect(): void {
    const g = gsi();
    if (g) g.accounts.id.disableAutoSelect();
}
