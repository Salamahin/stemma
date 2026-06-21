type GsiCredentialResponse = { credential: string };

type Gsi = {
    accounts: {
        id: {
            initialize: (opts: {
                client_id: string;
                callback: (resp: GsiCredentialResponse) => void;
                auto_select?: boolean;
                use_fedcm_for_prompt?: boolean;
            }) => void;
            prompt: () => void;
            cancel: () => void;
        };
    };
};

type CredentialListener = (token: string) => void;

let initPromise: Promise<Gsi> | null = null;
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

export function initializeGoogleAuth(clientId: string): Promise<Gsi> {
    if (initPromise) return initPromise;
    initPromise = awaitGsi().then((g) => {
        g.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
                for (const l of Array.from(listeners)) l(resp.credential);
            },
            auto_select: true,
            use_fedcm_for_prompt: true,
        });
        return g;
    });
    return initPromise;
}

export function onCredential(listener: CredentialListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function cancelGoogleAuth(): void {
    gsi()?.accounts.id.cancel();
}
