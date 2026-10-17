/**
 * Layout Web Worker entry. Bundled separately by rollup (see the
 * `inlineLayoutWorker` plugin) and embedded into the main bundle as a string,
 * started from a Blob URL by layoutEngine.ts.
 */
import { LayoutWorkerHost } from "./layoutWorkerHost";
import type { Scheduler } from "./layoutCore";
import type { LayoutWorkerRequest } from "./layoutProtocol";

const ctx = self as unknown as {
    postMessage(msg: unknown, transfer: Transferable[]): void;
    onmessage: ((e: MessageEvent<LayoutWorkerRequest>) => void) | null;
};

// MessageChannel continuation: unlike nested setTimeout(0) it is not clamped to 4 ms.
const channel = new MessageChannel();
const queue: Array<() => void> = [];
channel.port1.onmessage = () => queue.shift()?.();

const scheduler: Scheduler = {
    soon: (fn) => {
        queue.push(fn);
        channel.port2.postMessage(0);
    },
    frame: (fn) => setTimeout(fn, 16),
    now: () => performance.now(),
};

const host = new LayoutWorkerHost((msg, transfer) => ctx.postMessage(msg, transfer), scheduler);
ctx.onmessage = (e) => host.handle(e.data);
