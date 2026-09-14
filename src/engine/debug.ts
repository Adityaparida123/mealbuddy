let enabled = typeof window !== 'undefined';

export function setPipelineDebug(v: boolean): void {
  enabled = v;
}

export function isPipelineDebug(): boolean {
  return enabled;
}

export function logStage(...args: unknown[]): void {
  if (enabled) console.info('[pipeline]', ...args);
}

export interface StageCounters {
  total: number;
  removedAllergy: number;
  removedAvailability: number;
  removedDislike: number;
  removedDiet: number;
  removedBudget: number;
  removedTime: number;
  removedRequested: number;
  validCandidates: number;
  geminiSelectedCount: number;
  validatedCount: number;
}

export function summarizeStage(stage: string, before: number, after: number, label: string): void {
  logStage(`${stage} — ${label}: ${before} -> ${after} (removed ${before - after})`);
}