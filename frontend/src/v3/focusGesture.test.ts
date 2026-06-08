import { isShortTap, isLongPress, focusedIdFromG, closestNodeG, cursorNearGhost, TAP_MAX_MS, TAP_MAX_MOVE_PX, FOCUS_RADIUS_SVG } from "./focusGesture";

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

describe("cursorNearGhost", () => {
    it("returns false when positions list is empty", () => {
        expect(cursorNearGhost([], 0, 0, FOCUS_RADIUS_SVG)).toBe(false);
    });

    it("returns true when cursor is exactly on a ghost center", () => {
        expect(cursorNearGhost([{ x: 100, y: 200 }], 100, 200, FOCUS_RADIUS_SVG)).toBe(true);
    });

    it("returns true when cursor is within hitRadius of a ghost center", () => {
        // ghost at (160, 0), cursor at (12, 0) — distance = 148, within FOCUS_RADIUS_SVG=150
        expect(cursorNearGhost([{ x: 160, y: 0 }], 12, 0, FOCUS_RADIUS_SVG)).toBe(true);
    });

    it("returns false when cursor is just outside hitRadius of all ghosts", () => {
        // ghost at (160, 0), cursor at (9, 0) — distance = 151, outside FOCUS_RADIUS_SVG=150
        expect(cursorNearGhost([{ x: 160, y: 0 }], 9, 0, FOCUS_RADIUS_SVG)).toBe(false);
    });

    it("returns true when cursor is within the rendered node radius of a ghost center (personR extension)", () => {
        // Ghost person center at (160, 0). Cursor at (152, 0): distance to ghost = 8px.
        // Without personR extension, this is well within range. This test verifies
        // that at the edge of the gap (cursor between real-node radius and ghost),
        // focus is preserved once ghost positions are known.
        const ghostPersonR = 15;
        // cursor is exactly personR pixels past the real-node focus radius, and
        // personR pixels before the ghost center — should still keep focus
        const cursorX = FOCUS_RADIUS_SVG + 1; // just outside real-node radius
        const ghostX = FOCUS_RADIUS_SVG + 1 + ghostPersonR - 1; // ghost center is personR-1 away
        expect(cursorNearGhost([{ x: ghostX, y: 0 }], cursorX, 0, ghostPersonR)).toBe(true);
    });

    it("returns true for any ghost when multiple positions provided", () => {
        const positions = [
            { x: 500, y: 500 },
            { x: 160, y: 0 },
        ];
        // cursor near second ghost
        expect(cursorNearGhost(positions, 15, 0, FOCUS_RADIUS_SVG)).toBe(true);
    });

    it("covers the traversal gap between real-node radius and ghost seed position", () => {
        // Simulates cursor moving from real node (0,0) toward a ghost person at (160,0).
        // Ghost person rendered radius is personR=15.
        // Real node focus radius is FOCUS_RADIUS_SVG=150.
        // At cursor position (155,0): distance to real node = 155 > 150, so real node doesn't help.
        // Distance to ghost center = 5 < personR=15, so ghost hit radius keeps focus.
        const ghostPersonR = 15;
        expect(cursorNearGhost([{ x: 160, y: 0 }], 155, 0, ghostPersonR)).toBe(true);
    });

    it("does NOT keep focus when cursor is in the true gap (beyond real radius, beyond ghost radius)", () => {
        // ghost at (160,0), personR=15. Cursor at (145,0): distance to ghost=15 which equals personR.
        // At ghost hit radius boundary: distance=personR should be included (<=), so this is true.
        const ghostPersonR = 15;
        expect(cursorNearGhost([{ x: 160, y: 0 }], 145, 0, ghostPersonR)).toBe(true);
        // cursor at (144,0): distance to ghost=16 > personR=15, so NOT near ghost
        expect(cursorNearGhost([{ x: 160, y: 0 }], 144, 0, ghostPersonR)).toBe(false);
    });
});
