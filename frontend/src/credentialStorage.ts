import { jwtDecode } from "jwt-decode";

const STORAGE_KEY = "stemma_credential";
const EXPIRY_BUFFER_MS = 60_000;

export type StoredCredential = {
    token: string;
    expiresAt: number;
};

function decodeExpiry(token: string): number | null {
    const decoded = jwtDecode<{ exp?: number }>(token);
    if (!decoded || typeof decoded.exp !== "number") return null;
    return decoded.exp * 1000;
}

export function loadCredential(now: number = Date.now()): StoredCredential | null {
    let token: string | null;
    try {
        token = localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
    if (!token) return null;

    try {
        const expiresAt = decodeExpiry(token);
        if (expiresAt === null || expiresAt - EXPIRY_BUFFER_MS <= now) {
            clearCredential();
            return null;
        }
        return { token, expiresAt };
    } catch {
        clearCredential();
        return null;
    }
}

export function saveCredential(token: string): StoredCredential | null {
    try {
        const expiresAt = decodeExpiry(token);
        if (expiresAt === null) return null;
        localStorage.setItem(STORAGE_KEY, token);
        return { token, expiresAt };
    } catch {
        return null;
    }
}

export function clearCredential(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch {
        // ignore storage errors
    }
}
