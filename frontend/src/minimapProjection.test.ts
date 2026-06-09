import {
    computeBounds,
    computeLayout,
    projectNodes,
    projectViewport,
    minimapClickToTranslate,
    type NodeDot,
} from "./minimapProjection";
import { zoomIdentity } from "d3";

describe("computeBounds", () => {
    it("returns zeros for empty array", () => {
        expect(computeBounds([])).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0 });
    });

    it("handles a single node", () => {
        const nodes: NodeDot[] = [{ x: 10, y: 20, type: "person" }];
        expect(computeBounds(nodes)).toEqual({ minX: 10, minY: 20, maxX: 10, maxY: 20 });
    });

    it("computes correct min/max across multiple nodes", () => {
        const nodes: NodeDot[] = [
            { x: 50, y: 100, type: "person" },
            { x: -30, y: 200, type: "family" },
            { x: 80, y: 0, type: "person" },
        ];
        expect(computeBounds(nodes)).toEqual({ minX: -30, minY: 0, maxX: 80, maxY: 200 });
    });
});

describe("computeLayout", () => {
    it("fits content into canvas with uniform scale", () => {
        const bounds = { minX: 0, minY: 0, maxX: 200, maxY: 100 };
        const layout = computeLayout(bounds, 100, 100);
        // available area 84x84 (100 - 2*8), content 200x100
        // scaleX = 84/200 = 0.42, scaleY = 84/100 = 0.84 → scale = 0.42
        expect(layout.scale).toBeCloseTo(0.42, 2);
    });

    it("centers content that is narrower than canvas", () => {
        const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        const layout = computeLayout(bounds, 200, 200);
        // available 184x184, content 100x100 → scale = 1.84
        // scaledW = 184, offsetX = 8 + 0 - 0 = 8
        expect(layout.scale).toBeCloseTo(1.84, 2);
        expect(layout.offsetX).toBeCloseTo(8, 2);
        expect(layout.offsetY).toBeCloseTo(8, 2);
    });

    it("returns stable layout for zero-size content", () => {
        const bounds = { minX: 50, minY: 50, maxX: 50, maxY: 50 };
        const layout = computeLayout(bounds, 100, 100);
        expect(layout.offsetX).toBe(50);
        expect(layout.offsetY).toBe(50);
    });
});

describe("projectNodes", () => {
    it("applies scale and offset to each node", () => {
        const nodes: NodeDot[] = [{ x: 10, y: 20, type: "person" }];
        const layout = { scale: 2, offsetX: 5, offsetY: 3, contentWidth: 100, contentHeight: 100 };
        const projected = projectNodes(nodes, layout);
        expect(projected[0]).toEqual({ x: 25, y: 43, type: "person" });
    });

    it("preserves node type", () => {
        const nodes: NodeDot[] = [{ x: 0, y: 0, type: "family" }];
        const layout = { scale: 1, offsetX: 0, offsetY: 0, contentWidth: 0, contentHeight: 0 };
        expect(projectNodes(nodes, layout)[0].type).toBe("family");
    });

    it("does not mutate inputs", () => {
        const nodes: NodeDot[] = [{ x: 10, y: 20, type: "person" }];
        const layout = { scale: 2, offsetX: 5, offsetY: 3, contentWidth: 100, contentHeight: 100 };
        projectNodes(nodes, layout);
        expect(nodes[0].x).toBe(10);
    });
});

describe("projectViewport", () => {
    it("projects identity transform to full content area", () => {
        const layout = { scale: 1, offsetX: 0, offsetY: 0, contentWidth: 200, contentHeight: 200 };
        const rect = projectViewport(zoomIdentity, 100, 100, layout);
        // identity: k=1, tx=0, ty=0 → sim covers [0,100]x[0,100]
        expect(rect.x).toBe(0);
        expect(rect.y).toBe(0);
        expect(rect.width).toBe(100);
        expect(rect.height).toBe(100);
    });

    it("accounts for zoom scale", () => {
        const transform = zoomIdentity.translate(0, 0).scale(2);
        const layout = { scale: 1, offsetX: 0, offsetY: 0, contentWidth: 200, contentHeight: 200 };
        // k=2, tx=0, ty=0 → sim covers [0,50]x[0,50]
        const rect = projectViewport(transform, 100, 100, layout);
        expect(rect.width).toBeCloseTo(50, 5);
        expect(rect.height).toBeCloseTo(50, 5);
    });

    it("accounts for pan translation", () => {
        const transform = zoomIdentity.translate(-100, -50);
        const layout = { scale: 1, offsetX: 0, offsetY: 0, contentWidth: 200, contentHeight: 200 };
        // k=1, tx=-100, ty=-50 → simLeft=100, simTop=50
        const rect = projectViewport(transform, 200, 200, layout);
        expect(rect.x).toBeCloseTo(100, 5);
        expect(rect.y).toBeCloseTo(50, 5);
    });
});

describe("minimapClickToTranslate", () => {
    it("centres the view on the clicked sim point", () => {
        const layout = { scale: 0.5, offsetX: 10, offsetY: 10, contentWidth: 200, contentHeight: 200 };
        // click at minimap (60, 60) → simX = (60-10)/0.5 = 100, simY = 100
        // k=1, viewWidth=200, viewHeight=200 → tx = 100 - 100*1 = 0, ty = 0
        const [tx, ty] = minimapClickToTranslate(60, 60, layout, zoomIdentity, 200, 200);
        expect(tx).toBeCloseTo(0, 5);
        expect(ty).toBeCloseTo(0, 5);
    });

    it("preserves current zoom scale", () => {
        const layout = { scale: 1, offsetX: 0, offsetY: 0, contentWidth: 100, contentHeight: 100 };
        const transform = zoomIdentity.scale(2);
        // click at (50,50) → simX=50, simY=50
        // tx = viewW/2 - simX*k = 100 - 50*2 = 0
        const [tx] = minimapClickToTranslate(50, 50, layout, transform, 200, 200);
        expect(tx).toBeCloseTo(0, 5);
    });
});
