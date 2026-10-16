import { buildInviteLink, capturePendingInvite, extractInviteToken, takePendingInvite } from "./inviteLinkBuilder";

class MemoryStorage {
    private items = new Map<string, string>();
    getItem(key: string) { return this.items.has(key) ? this.items.get(key)! : null; }
    setItem(key: string, value: string) { this.items.set(key, value); }
    removeItem(key: string) { this.items.delete(key); }
}

describe("buildInviteLink", () => {
    test("encodes token in invite link", () => {
        const link = buildInviteLink("http://localhost:8090", "a/b");
        expect(link).toBe("http://localhost:8090/?inviteToken=a%2Fb");
    });

    test("round-trips the token through extractInviteToken", () => {
        const token = "gAAAAABq0dW2xl+Jr/SZ==";
        const { token: extracted } = extractInviteToken(buildInviteLink("https://stemma.link", token));
        expect(extracted).toBe(token);
    });
});

describe("extractInviteToken", () => {
    test("returns null and the same url when there is no token", () => {
        expect(extractInviteToken("https://stemma.link/?foo=1#x")).toEqual({
            token: null,
            cleanUrl: "https://stemma.link/?foo=1#x",
        });
    });

    test("strips the token but keeps other params and the hash", () => {
        expect(extractInviteToken("https://stemma.link/?foo=1&inviteToken=abc#x")).toEqual({
            token: "abc",
            cleanUrl: "https://stemma.link/?foo=1#x",
        });
    });

    test("ignores an empty token", () => {
        expect(extractInviteToken("https://stemma.link/?inviteToken=").token).toBeNull();
    });
});

describe("pending invite", () => {
    test("captures the token from the url, cleans the url and keeps it until taken", () => {
        const storage = new MemoryStorage();
        const replaced: string[] = [];
        capturePendingInvite("https://stemma.link/?inviteToken=abc", (url) => replaced.push(url), storage);

        expect(replaced).toEqual(["https://stemma.link/"]);
        expect(takePendingInvite(storage)).toBe("abc");
        expect(takePendingInvite(storage)).toBeNull();
    });

    test("does not touch the url or storage when there is no token", () => {
        const storage = new MemoryStorage();
        storage.setItem("stemma_pending_invite", "earlier");
        const replaced: string[] = [];
        capturePendingInvite("https://stemma.link/", (url) => replaced.push(url), storage);

        expect(replaced).toEqual([]);
        expect(takePendingInvite(storage)).toBe("earlier");
    });
});
