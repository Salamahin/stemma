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
            renderButton: (parent: HTMLElement, opts: Record<string, unknown>) => void;
        };
    };
};

type CredentialListener = (token: string) => void;

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
            use_fedcm_for_prompt: true,
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
    if (fallbackTarget) g.accounts.id.renderButton(fallbackTarget, { theme: "outline", size: "large" });
    g.accounts.id.prompt();
}

export function cancelGoogleAuth(): void {
    gsi()?.accounts.id.cancel();
}

