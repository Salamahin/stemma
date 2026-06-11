import { Model } from "./model";
import type { Ref } from "./pendingState";

export class Session {
    readonly e2eAutoLoginEnabled: boolean;

    constructor(
        private model: Model,
        private signedInRef: Ref<boolean>,
        private onSignIn: () => void,
    ) {
        this.e2eAutoLoginEnabled = typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1";
    }

    async restore(): Promise<boolean> {
        // We don't need an explicit "is this cookie valid" endpoint; the first
        // listDescribeStemmas call will 401 if the cookie is missing/stale, and
        // the caller can route that back to the login screen.
        return this.signedInRef.get();
    }

    async signIn(idToken: string): Promise<void> {
        await this.model.login(idToken);
        this.signedInRef.set(true);
        this.onSignIn();
    }

    async signInAsE2eUser(): Promise<void> {
        const override = (window as unknown as { __STEMMA_E2E_USER__?: string }).__STEMMA_E2E_USER__;
        await this.model.login(override || "e2e-user@stemma.local");
        this.signedInRef.set(true);
        this.onSignIn();
    }

    async signOut(): Promise<void> {
        try {
            await this.model.logout();
        } catch {
            // Even if the logout request fails (network, expired cookie), drop client state.
        }
        this.signedInRef.set(false);
    }

    markSignedOut(): void {
        this.signedInRef.set(false);
    }
}
