// steps/naming.mts — semantic naming conventions (opt-in).
//
// Tools:    none (project-defined)
// Config:   .qualityrc.json at repo root, "naming" key — raises-only
// Fix:      not implemented; naming conventions are validated only
//
// Detection is explicit opt-in: step only runs when .qualityrc.json
// enables it. The prototype's naming.sh was repo-specific (system-config's
// functions/ + installers/ doctrine); the portable gate provides the
// framework, projects bring their own rules.
// The runner is injected so tests need no host binaries.

import { skipped, type StepResult } from "../lib/step-result.mts";

export interface NamingRunContext {
  mode: "fix" | "no-fix";
}

type Runner = typeof import("../../lib/proc.mts").run;

/**
 * Run naming conventions check. Returns skip when not enabled;
 * when enabled, currently a placeholder for project-specific rules.
 */
export async function runNamingStep({
  ctx,
  trackedFiles,
  runner,
  enabled = false,
}: {
  ctx: NamingRunContext;
  trackedFiles: string[];
  runner?: Runner;
  enabled?: boolean;
}): Promise<StepResult> {
  if (!enabled) {
    return skipped({ notice: "naming: not enabled (opt-in via .qualityrc.json)" });
  }

  // Placeholder for project-specific naming rules.
  // When .qualityrc.json enables naming, it should also provide
  // a config pointing at the project's naming rule module.
  // For now, skip with a notice so the gate stays green.
  return skipped({ notice: "naming: enabled but no rules configured (placeholder)" });
}