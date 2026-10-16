import { CanvasChart, arrowKindFor, type ChartNode, type ChartLink } from "./canvasChart";
import { buildChartSvgElement } from "./svgExport";

// jsdom has no 2D canvas: give the renderer a recording no-op context.
function fakeContext() {
    const calls: Record<string, number> = {};
    const target: Record<string, unknown> = {
        measureText: (text: string) => ({ width: text.length * 8 }),
    };
    return {
        calls,
        ctx: new Proxy(target, {
            get(t, prop: string) {
                if (prop in t) return t[prop];
                return (..._args: unknown[]) => {
                    calls[prop] = (calls[prop] ?? 0) + 1;
                };
            },
            set(t, prop: string, value) {
                t[prop] = value;
                return true;
            },
        }),
    };
}

let fake: ReturnType<typeof fakeContext>;
let rafQueue: FrameRequestCallback[] = [];

beforeEach(() => {
    fake = fakeContext();
    (HTMLCanvasElement.prototype as any).getContext = () => fake.ctx;
    (HTMLCanvasElement.prototype as any).getBoundingClientRect = () =>
        ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600, x: 0, y: 0 }) as DOMRect;
    rafQueue = [];
    (globalThis as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
        rafQueue.push(cb);
        return rafQueue.length;
    };
    if (typeof (globalThis as any).DOMRect === "undefined") {
        (globalThis as any).DOMRect = class {
            constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
        };
    }
});

function flushFrames() {
    const q = rafQueue;
    rafQueue = [];
    for (const cb of q) cb(performance.now());
}

function makeChart() {
    const canvas = document.createElement("canvas");
    const chart = new CanvasChart(canvas);
    const nodes: ChartNode[] = [
        { id: "person_a", type: "person", name: "Alice", x: 100, y: 100, index: 0 },
        { id: "person_b", type: "person", name: "Bob", x: 400, y: 100, index: 1 },
        { id: "family_f", type: "family", x: 250, y: 200, index: 2 },
    ];
    const links: ChartLink[] = [
        { id: "a_f", source: nodes[0], target: nodes[2], type: "spouseToFamily" },
        { id: "f_b", source: nodes[2], target: nodes[1], type: "familyToChild" },
    ];
    chart.setData(nodes, links);
    return { chart, nodes, links };
}

describe("CanvasChart hit testing", () => {
    test("hits a node by its circle", () => {
        const { chart } = makeChart();
        expect(chart.hitNode(105, 95)?.id).toBe("person_a");
        expect(chart.hitNode(252, 201)?.id).toBe("family_f");
    });

    test("hits a person by its name label (the old <g> hit area)", () => {
        const { chart } = makeChart();
        // label: starts at x-15, baseline at y+40
        expect(chart.hitNode(100 - 15 + 10, 100 + 36)?.id).toBe("person_a");
    });

    test("misses empty space", () => {
        const { chart } = makeChart();
        expect(chart.hitNode(600, 500)).toBeNull();
    });

    test("respects zoom transform", () => {
        const { chart } = makeChart();
        chart.transform = chart.transform.translate(50, 20).scale(2);
        // world (100,100) -> screen (50 + 200, 20 + 200)
        expect(chart.hitNode(250, 220)?.id).toBe("person_a");
        expect(chart.hitNode(100, 100)).toBeNull();
    });

    test("skip predicate makes nodes transparent", () => {
        const { chart } = makeChart();
        expect(chart.hitNode(105, 95, { skip: (n) => n.id === "person_a" })).toBeNull();
    });

    test("hovered person has the enlarged hit radius", () => {
        const { chart } = makeChart();
        expect(chart.hitNode(100 + 20, 100)).toBeNull();
        chart.setHovered("person_a");
        expect(chart.hitNode(100 + 20, 100)?.id).toBe("person_a");
    });

    test("ghost persons are hit-testable, ghost families are not", () => {
        const { chart } = makeChart();
        const hide = chart.showGhosts({
            nodes: [
                { id: "ghost-person-spouse", type: "ghost-person", x: 600, y: 300, label: "Add spouse" },
                { id: "ghost-family-east", type: "ghost-family", x: 500, y: 300 },
            ],
            edges: [],
        });
        expect(chart.hitGhost(602, 301)?.id).toBe("ghost-person-spouse");
        expect(chart.hitGhost(500, 300)).toBeNull();
        hide();
        expect(chart.hitGhost(602, 301)).toBeNull();
    });
});

describe("CanvasChart rendering", () => {
    test("renders on demand: one frame per invalidation burst", () => {
        const { chart } = makeChart();
        flushFrames();
        expect(rafQueue.length).toBe(0);
        chart.positionsChanged();
        chart.positionsChanged();
        chart.requestRender();
        expect(rafQueue.length).toBe(1);
    });

    test("every drawn relationship line gets its arrowhead", () => {
        const { chart } = makeChart();
        flushFrames();
        const snap = chart.snapshot();
        expect(snap.stats.edges).toBe(2);
        expect(snap.stats.arrows).toBe(2);
        expect(snap.edges.map((e) => e.arrow).sort()).toEqual(["family", "person"]);
    });

    test("snapshot reports drawn nodes and client positions", () => {
        const { chart } = makeChart();
        flushFrames();
        const a = chart.snapshot().nodes.find((n) => n.id === "person_a")!;
        expect(a.drawn).toBe(true);
        expect(a.clientX).toBe(100);
        expect(a.clientY).toBe(100);
        expect(a.r).toBe(15);
    });

    test("off-screen nodes are culled", () => {
        const { chart, nodes } = makeChart();
        nodes[1].x = 50_000;
        chart.positionsChanged();
        flushFrames();
        const b = chart.snapshot().nodes.find((n) => n.id === "person_b")!;
        expect(b.drawn).toBe(false);
    });
});

describe("arrowKindFor", () => {
    test("maps relation direction to arrowhead", () => {
        expect(arrowKindFor("familyToChild")).toBe("person");
        expect(arrowKindFor("spouseToFamily")).toBe("family");
    });
});

describe("buildChartSvgElement", () => {
    test("rebuilds nodes, lines with arrow markers and labels", () => {
        const { chart } = makeChart();
        const { svg, bbox } = buildChartSvgElement(chart.exportModel() as any);
        expect(svg.querySelectorAll("g.main > g[id^='person_']").length).toBe(2);
        expect(svg.querySelectorAll("g.main > g[id^='family_']").length).toBe(1);
        const lines = [...svg.querySelectorAll("line")];
        expect(lines.length).toBe(2);
        for (const l of lines) {
            const ref = l.getAttribute("marker-end")!.match(/^url\(#(.+)\)$/)![1];
            expect(svg.querySelector(`marker#${ref}`)).not.toBeNull();
        }
        expect(svg.querySelector("#person_a text")?.textContent).toBe("Alice");
        expect(bbox.width).toBeGreaterThan(0);
    });
});
