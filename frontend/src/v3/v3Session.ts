/**
 * Owns the v3 Google OAuth session lifecycle: cached credential, refresh
 * timer, in-flight refresh promise, and the e2e auto-login override.
 *
 * `signedIn` reactivity lives in `V3App.svelte` as `$state`; this class
 * mutates it through a setter ref so the component owns the reactivity edge.
 */

import { clearCredential, loadCredential, msUntilRefresh, saveCredential } from "../credentialStorage";
import { refreshCredential } from "../googleAuth";
import type { TokenProvider, User } from "../model";

import type { Ref } from "./v3MutationActions";

type Listeners = {
    onSignIn: (token: string) => void;
    onSignOut: () => void;
};

export class V3Session {
    readonly e2eAutoLoginEnabled: boolean;
    readonly initialCached: ReturnType<typeof loadCredential>;

    private currentToken: string | null = null;
    private refreshTimer: ReturnType<typeof setTimeout> | null = null;
    private inflightRefresh: Promise<string> | null = null;
    private e2eMode = false;

    constructor(
        private signedInRef: Ref<boolean>,
        private listeners: Listeners,
    ) {
        this.e2eAutoLoginEnabled = typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1";
        this.initialCached = this.e2eAutoLoginEnabled ? null : loadCredential();
        this.signedInRef.set(this.e2eAutoLoginEnabled || this.initialCached !== null);
    }

    readonly tokenProvider: TokenProvider = {
        getToken: () => this.currentToken,
        refresh: () => this.runRefresh(),
    };

    handleSignIn(user: User): void {
        this.adoptToken(user.id_token);
        this.listeners.onSignIn(user.id_token);
        this.signedInRef.set(true);
    }

    endSession(): void {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        this.refreshTimer = null;
        clearCredential();
        this.currentToken = null;
        this.signedInRef.set(false);
        this.listeners.onSignOut();
    }

    enableE2eMode(): void {
        this.e2eMode = true;
    }

    teardown(): void {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
    }

    private scheduleRefresh(expiresAt: number) {
        if (this.refreshTimer) clearTimeout(this.refreshTimer);
        if (this.e2eMode) return;
        this.refreshTimer = setTimeout(() => {
            void this.runRefresh();
        }, msUntilRefresh(expiresAt));
    }

    private adoptToken(token: string) {
        const saved = saveCredential(token);
        this.currentToken = token;
        if (saved) this.scheduleRefresh(saved.expiresAt);
    }

    private runRefresh(): Promise<string> {
        if (this.e2eMode) return Promise.resolve(this.currentToken!);
        if (this.inflightRefresh) return this.inflightRefresh;
        this.inflightRefresh = refreshCredential()
            .then((token) => {
                this.adoptToken(token);
                return token;
            })
            .catch((err) => {
                this.endSession();
                throw err;
            })
            .finally(() => {
                this.inflightRefresh = null;
            });
        return this.inflightRefresh;
    }
}
