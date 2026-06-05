export const PERSON_PRESERVE_KEYS = ["name"] as const;

export function sanitizeRequestPayload(obj: Record<string, unknown>, preserveKeys: readonly string[] = []) {
    const preserve = new Set(preserveKeys);
    return Object.fromEntries(
        Object.entries(obj).filter(([k, v]) => preserve.has(k) || (v !== null && v !== undefined && v !== "")),
    );
}
