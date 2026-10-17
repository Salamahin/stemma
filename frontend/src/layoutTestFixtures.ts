/** Shared fixtures for the layout unit tests (not a test file itself). */
import { makeNodesAndRelations } from "./graphTools";
import type { Scheduler } from "./layoutCore";

export function syntheticGraph(target: number) {
    let s = 7;
    const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
    const people: any[] = [];
    const families: any[] = [];
    const queue: string[] = [];
    const mk = () => {
        const id = `p${people.length}`;
        people.push({ id, name: id });
        return id;
    };
    for (let i = 0; i < 3; i++) queue.push(mk());
    while (people.length < target && queue.length) {
        const p = queue.shift()!;
        const spouse = mk();
        const kids: string[] = [];
        const n = 1 + Math.floor(rnd() * 3);
        for (let k = 0; k < n && people.length < target; k++) {
            const c = mk();
            kids.push(c);
            queue.push(c);
        }
        families.push({ id: `f${families.length}`, parents: [p, spouse], children: kids });
    }
    const [nodes, links] = makeNodesAndRelations(people, families) as [any[], any[]];
    nodes.forEach((n, i) => {
        n.x = (i % 30) * 160;
        n.y = Math.floor(i / 30) * 200;
    });
    return { nodes, links };
}

/** Scheduler that only runs callbacks when the test says so. */
export function manualScheduler(clockStep = 0) {
    const queue: Array<() => void> = [];
    let t = 0;
    const scheduler: Scheduler = {
        soon: (fn) => queue.push(fn),
        frame: (fn) => queue.push(fn),
        now: () => (t += clockStep),
    };
    return {
        scheduler,
        pending: () => queue.length,
        runOne: () => queue.shift()?.(),
        runAll: (max = 10_000) => {
            let i = 0;
            while (queue.length && i++ < max) queue.shift()!();
        },
    };
}
