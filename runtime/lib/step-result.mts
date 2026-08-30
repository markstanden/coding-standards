// lib/step-result.mts — shared step contract types and constructors.
//
// Types only (no runtime behaviour to test): every step returns a
// StepResult; constructors keep notice phrasing uniform across steps.

export type StepStatus = "pass" | "fail" | "skip";

export interface StepResult {
  status: StepStatus;
  notice?: string;
}

export function passed({ notice }: { notice?: string }): StepResult {
  return { status: "pass", notice };
}

export function failed({ notice }: { notice?: string }): StepResult {
  return { status: "fail", notice };
}

/** Skips are clean exits: the ecosystem is absent, nothing was wrong. */
export function skipped({ notice }: { notice: string }): StepResult {
  return { status: "skip", notice };
}
