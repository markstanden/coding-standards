// steps/node.mts — Node/JS projects: repo-wide formatting via prettier.
//
// Tools:    prettier
// Config:   quality/config/prettier.config.mjs + prettierignore, passed
//           explicitly (--config/--ignore-path) so they travel with the
//           gate regardless of CWD — prettier resolves ignore files
//           relative to CWD, not the target tree (prototype lesson)
// Fix:      prettier --write rewrites, then the step re-checks before
//           reporting — a fix that leaves diffs can never read as success
//
// Detection is sync and data-driven: activation = at least one tracked
// package.json (any depth). ESLint/tsc/vitest deliberately wait for
// in-container dependency restore (decision #3): they need project-local
// plugins and types a global install cannot supply.
// The runner is injected so tests need no host binaries.

import { failed, passed, skipped, type StepResult } from "../lib/step-result.mts";
import { run } from "../lib/proc.mts";
import { gateConfigPath } from "../lib/paths.mts";

export interface NodeRunContext {
  mode: "fix" | "no-fix";
  repoRoot: string;
}

type Runner = typeof run;

export function filterPackageJsons({ files }: { files: string[] }): string[] {
  return files.filter((file) => file.split("/").pop() === "package.json");
}

/**
 * Run prettier over the whole tracked tree when the project is a Node
 * project. Returns skip with a notice when no package.json exists; fail
 * naming the unformatted-file count otherwise.
 */
export async function runNodeStep({
  ctx,
  trackedFiles,
  runner = run,
}: {
  ctx: NodeRunContext;
  trackedFiles: string[];
  runner?: Runner;
}): Promise<StepResult> {
  const manifests = filterPackageJsons({ files: trackedFiles });
  if (manifests.length === 0) {
    return skipped({ notice: "node: no tracked package.json" });
  }

  const config = await gateConfigPath({ name: "prettier.config.mjs" });
  const ignorePath = await gateConfigPath({ name: "prettierignore" });
  const sharedArgs = ["--config", config, "--ignore-path", ignorePath];

  if (ctx.mode === "fix") {
    const write = runner({ cmd: "prettier", args: ["--write", ...sharedArgs, "."], cwd: ctx.repoRoot });
    if (write.status !== 0) {
      return failed({ notice: `node: prettier --write failed: ${write.stderr.trim()}` });
    }
  }

  // Always verify clean — in fix mode this proves the rewrite left nothing.
  const check = runner({ cmd: "prettier", args: ["--check", ...sharedArgs, "."], cwd: ctx.repoRoot });
  if (check.status !== 0) {
    const unformatted = check.stdout.split("\n").filter((line) => line.trim() !== "").length;
    return failed({ notice: `node: prettier found ${unformatted} unformatted file(s)` });
  }

  return passed({ notice: `node: tree formatted (${manifests.length} package(s))` });
}
