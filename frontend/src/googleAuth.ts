type GsiCredentialResponse = { credential: string };

type GsiButtonOptions = {
    type?: "standard" | "icon";
    theme?: "outline" | "filled_blue" | "filled_black";
    size?: "large" | "medium" | "small";
    text?: "signin_with" | "signup_with" | "continue_with" | "signin";
    shape?: "rectangular" | "pill" | "circle" | "square";
    width?: number;
    locale?: string;
};

type Gsi = {
    accounts: {
        id: {
            initialize: (opts: {
                client_id: string;
                callback: (resp: GsiCredentialResponse) => void;
                auto_select?: boolean;
                use_fedcm_for_prompt?: boolean;
                itp_support?: boolean;
            }) => void;
            prompt: () => void;
            cancel: () => void;
            renderButton: (element: HTMLElement, options: GsiButtonOptions) => void;
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
    const supportsFedCm = "IdentityCredential" in window;
    initPromise = awaitGsi().then((g) => {
        g.accounts.id.initialize({
            client_id: clientId,
            callback: (resp) => {
                for (const l of Array.from(listeners)) l(resp.credential);
            },
            auto_select: true,
            use_fedcm_for_prompt: supportsFedCm,
            itp_support: true,
        });
        return g;
    });
    initPromise.catch(() => { initPromise = null; });
    return initPromise;
}

export function renderGoogleButton(element: HTMLElement, locale: string): Promise<void> {
    return initPromise
        ? initPromise.then((g) => g.accounts.id.renderButton(element, { type: "standard", theme: "outline", size: "large", locale }))
        : Promise.resolve();
}

export function onCredential(listener: CredentialListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function cancelGoogleAuth(): void {
    gsi()?.accounts.id.cancel();
}
