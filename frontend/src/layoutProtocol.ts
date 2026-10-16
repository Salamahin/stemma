/** Messages between the main thread (layoutEngine.ts) and layout.worker.ts. */

/** Every message carries the graph generation; stale replies are dropped. */
export type LayoutWorkerRequest =
    | {
          type: "graph";
          gen: number;
          ids: string[];
          x: Float64Array;
          y: Float64Array;
          vx: Float64Array;
          vy: Float64Array;
          /** NaN = not fixed. */
          fx: Float64Array;
          fy: Float64Array;
          /** Flattened [source, target] node-index pairs. */
          links: Int32Array;
          width: number;
          height: number;
          alpha: number;
          /** false: load only (edit mode follows up with "settle"). */
          start: boolean;
      }
    | { type: "fixed"; gen: number; fx: Float64Array; fy: Float64Array }
    | { type: "pin"; gen: number; index: number; fx: number | null; fy: number | null }
    | { type: "run"; gen: number; alpha: number | null; alphaTarget: number | null }
    | { type: "stop"; gen: number }
    | { type: "settle"; gen: number; ticks: number };

export type LayoutWorkerResponse =
    | { type: "positions"; gen: number; ticks: number; alpha: number; x: Float64Array; y: Float64Array; vx: Float64Array; vy: Float64Array }
    | { type: "end"; gen: number }
    | { type: "error"; message: string };
