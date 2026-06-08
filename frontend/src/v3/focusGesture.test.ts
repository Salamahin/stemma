import { isShortTap, isLongPress, focusedIdFromG, closestNodeG, TAP_MAX_MS, TAP_MAX_MOVE_PX } from "./focusGesture";

describe("isShortTap", () => {
    it("returns true when elapsed < TAP_MAX_MS and moved <= TAP_MAX_MOVE_PX", () => {
        expect(isShortTap(TAP_MAX_MS - 1, 0)).toBe(true);
        expect(isShortTap(100, TAP_MAX_MOVE_PX)).toBe(true);
    });

    it("returns false when elapsed >= TAP_MAX_MS", () => {
        expect(isShortTap(TAP_MAX_MS, 0)).toBe(false);
        expect(isShortTap(TAP_MAX_MS + 1, 0)).toBe(false);
    });

    it("returns false when moved > TAP_MAX_MOVE_PX", () => {
        expect(isShortTap(100, TAP_MAX_MOVE_PX + 1)).toBe(false);
    });

    it("returns false when both thresholds exceeded", () => {
        expect(isShortTap(TAP_MAX_MS + 100, TAP_MAX_MOVE_PX + 5)).toBe(false);
    });
});

describe("isLongPress", () => {
    it("returns true when elapsed >= TAP_MAX_MS and moved <= TAP_MAX_MOVE_PX", () => {
        expect(isLongPress(TAP_MAX_MS, 0)).toBe(true);
        expect(isLongPress(TAP_MAX_MS + 1, 0)).toBe(true);
        expect(isLongPress(TAP_MAX_MS, TAP_MAX_MOVE_PX)).toBe(true);
    });

    it("returns false when elapsed < TAP_MAX_MS", () => {
        expect(isLongPress(TAP_MAX_MS - 1, 0)).toBe(false);
        expect(isLongPress(0, 0)).toBe(false);
    });

    it("returns false when moved > TAP_MAX_MOVE_PX", () => {
        expect(isLongPress(TAP_MAX_MS, TAP_MAX_MOVE_PX + 1)).toBe(false);
    });

    it("returns false when both thresholds violated", () => {
        expect(isLongPress(TAP_MAX_MS - 1, TAP_MAX_MOVE_PX + 1)).toBe(false);
    });
});

describe("focusedIdFromG", () => {
    const noPending = (_id: string) => false;
    const allPending = (_id: string) => true;

    function makeG(domId: string): SVGGElement {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", domId);
        return g;
    }

    it("extracts person kind and id from person_ prefix", () => {
        const g = makeG("person_abc123");
        expect(focusedIdFromG(g, noPending)).toEqual({ kind: "person", id: "abc123" });
    });

    it("extracts family kind and id from family_ prefix", () => {
        const g = makeG("family_xyz789");
        expect(focusedIdFromG(g, noPending)).toEqual({ kind: "family", id: "xyz789" });
    });

    it("returns null for pending ids", () => {
        const g = makeG("person_pending-abc");
        expect(focusedIdFromG(g, allPending)).toBeNull();
    });
});

describe("closestNodeG", () => {
    it("returns null for null target", () => {
        expect(closestNodeG(null)).toBeNull();
    });

    it("returns the element itself when it matches", () => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", "person_abc");
        expect(closestNodeG(g)).toBe(g);
    });

    it("walks up to find a matching ancestor", () => {
        const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
        g.setAttribute("id", "family_def");
        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        g.appendChild(circle);
        expect(closestNodeG(circle)).toBe(g);
    });

    it("returns null when no ancestor matches", () => {
        const div = document.createElement("div");
        expect(closestNodeG(div)).toBeNull();
    });
});
