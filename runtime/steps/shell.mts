// steps/shell.mts — shell script quality: shfmt + shellcheck.
//
// Tools:    shfmt (format), shellcheck (analysis)
// Config:   severity floor via raiseFloor; per-project ignores travel in
//           runtime/config/ when needed
// Fix:      shfmt -w rewrites, then the step re-checks before reporting —
//           a fix that leaves breakage can never read as success
//
// Detection is sync and data-driven: the orchestrator supplies the tracked
// file list (lib/git.mts); this module only filters it. The runner is
// injected so tests need no host binaries.

import { failed, passed, skipped, type StepResult } from "../lib/step-result.mts";
import { run } from "../../lib/proc.mts";
import type { Severity } from "../lib/severities.mts";

// Floor 'style' = every shellcheck finding gates (error < warning < info
// < style). Raised from the original 'error' default per decision #18;
// floors only ever move up.
export const SHELLCHECK_DEFAULT_FLOOR: Severity = "style";

export interface ShellRunContext {
  mode: "fix" | "no-fix";
}

type Runner = typeof run;

export function filterShellScripts({ files }: { files: string[] }): string[] {
  return files.filter((file) => file.endsWith(".sh"));
}

/**
 * Run shfmt + shellcheck over the tracked shell scripts. Returns skip with
 * a notice when none are present; fail naming the offending tool otherwise.
 */
export async function runShellStep({
  ctx,
  trackedFiles,
  runner = run,
  floor = SHELLCHECK_DEFAULT_FLOOR,
}: {
  ctx: ShellRunContext;
  trackedFiles: string[];
  runner?: Runner;
  floor?: Severity;
}): Promise<StepResult> {
  const scripts = filterShellScripts({ files: trackedFiles });
  if (scripts.length === 0) {
    return skipped({ notice: "shell: no tracked *.sh files" });
  }

  // Format first: in fix mode rewrite, then always verify clean.
  const formatArgs = ctx.mode === "fix" ? ["-w", ...scripts] : ["-d", ...scripts];
  const fmt = runner({ cmd: "shfmt", args: formatArgs });
  if (ctx.mode === "fix" && fmt.status !== 0) {
    return failed({ notice: `shell: shfmt -w failed: ${fmt.stderr.trim()}` });
  }
  const check = ctx.mode === "fix" ? runner({ cmd: "shfmt", args: ["-d", ...scripts] }) : fmt;
  if (check.status !== 0) {
    return failed({ notice: `shell: shfmt found formatting diffs (${scripts.length} files)` });
  }

  const lint = runner({ cmd: "shellcheck", args: ["-x", "-S", floor, ...scripts] });
  if (lint.status !== 0) {
    return failed({
      notice: `shell: shellcheck violations at or above '${floor}'`,
    });
  }

  return passed({ notice: `shell: ${scripts.length} file(s) clean` });
}
