/// <reference types="svelte" />

declare const E2E_AUTO_LOGIN: string;

/** Source of the layout Web Worker bundle (rollup `inlineLayoutWorker` plugin). */
declare module "virtual:layout-worker" {
    const source: string;
    export default source;
}
