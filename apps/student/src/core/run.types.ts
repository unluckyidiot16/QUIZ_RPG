// apps/student/src/core/run.types.ts
export type RunSummary = {
  cleared: boolean;
  turns: number;
  durationSec: number;
  correct: number;
  wrong: number;
  time: string;        // ISO
};
