import type { RunSummary } from '../../api';
export declare function enqueue(summary: RunSummary): void;
export declare function initQueue(submit: (s: RunSummary) => Promise<unknown>): void;
