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
          /** true: replace unfixed positions with the structured seed (cold start). */
          seed: boolean;
          /** Clan index per node (-1: none): clan regions for the seed and for weak cross-clan links. */
          groups: Int32Array;
          /** Remembered anchors (NaN: none). */
          ax: Float64Array;
          ay: Float64Array;
      }
    | { type: "fixed"; gen: number; fx: Float64Array; fy: Float64Array }
    | { type: "pin"; gen: number; index: number; fx: number | null; fy: number | null }
    | { type: "move"; gen: number; index: number; x: number; y: number }
    | { type: "run"; gen: number; alpha: number | null; alphaTarget: number | null }
    | { type: "stop"; gen: number }
    | { type: "settle"; gen: number; ticks: number };

export type LayoutWorkerResponse =
    | {
          type: "positions";
          gen: number;
          ticks: number;
          alpha: number;
          x: Float64Array;
          y: Float64Array;
          vx: Float64Array;
          vy: Float64Array;
          /** Present right after a structured seed: the new anchors. */
          ax?: Float64Array;
          ay?: Float64Array;
      }
    | { type: "end"; gen: number }
    | { type: "error"; message: string };
