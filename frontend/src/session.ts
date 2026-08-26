import { Model } from "./model";
import type { Ref } from "./pendingState";
import { forgetSession, rememberSession } from "./sessionHint";

export function e2eAutoLoginEnabled(): boolean {
    return typeof E2E_AUTO_LOGIN !== "undefined" && E2E_AUTO_LOGIN === "1";
}

export class Session {
    readonly e2eAutoLoginEnabled: boolean;

    constructor(
        private model: Model,
        private signedInRef: Ref<boolean>,
        // Loads the signed-in user's data; returns false when the freshly
        // minted session turned out to be unusable.
        private onSignIn: () => Promise<boolean>,
    ) {
        this.e2eAutoLoginEnabled = e2eAutoLoginEnabled();
    }

    async signIn(idToken: string): Promise<void> {
        await this.model.login(idToken);
        await this.finishSignIn();
    }

    async signInAsE2eUser(): Promise<void> {
        const override = (window as unknown as { __STEMMA_E2E_USER__?: string }).__STEMMA_E2E_USER__;
        await this.model.login(override || "e2e-user@stemma.local");
        await this.finishSignIn();
    }

    async signOut(): Promise<void> {
        try {
            await this.model.logout();
        } catch {
            // Even if the logout request fails (network, expired cookie), drop client state.
        }
        this.markSignedOut();
    }

    markSignedOut(): void {
        forgetSession();
        this.signedInRef.set(false);
    }

    // The stemma is only revealed once its data is in hand, so the sign-in
    // indicator stays up for the whole login + load round trip.
    private async finishSignIn(): Promise<void> {
        rememberSession();
        if (await this.onSignIn()) this.signedInRef.set(true);
    }
}
