// steps/node.mts — Node/JS projects: repo-wide formatting via prettier.
//
// Tools:    prettier
// Config:   quality/config/prettier.config.mjs + prettierignore, passed
//           explicitly (--config/--ignore-path) so they travel with the gate.
//           NOTE (2026-08-30): prettier resolves ignore patterns relative to
//           the ignore FILE, not CWD (getRelativePath(file, ignoreFile)) — a
//           travelling/temp ignore must live at the repo root for
//           repo-relative directory patterns to match. See PLAN.md "Confirmed:
//           prettier resolves ignore patterns…".
// Fix:      prettier --write rewrites, then the step re-checks before
//           reporting — a fix that leaves diffs can never read as success
//
// Detection is sync and data-driven: activation = at least one tracked
// package.json (any depth). ESLint/tsc/vitest deliberately wait for
// in-container dependency restore (decision #3): they need project-local
// plugins and types a global install cannot supply.
// The runner is injected so tests need no host binaries.

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { failed, passed, skipped, type StepResult } from "../lib/step-result.mts";
import { run } from "../lib/proc.mts";
import { gateConfigPath } from "../lib/paths.mts";
import { mergeIgnoreContents, writeMergedIgnore, removeMergedIgnore } from "../lib/ignore.mts";

export interface NodeRunContext {
  mode: "fix" | "no-fix";
  repoRoot: string;
}

type Runner = typeof run;

export function filterPackageJsons({ files }: { files: string[] }): string[] {
  return files.filter((file) => file.split("/").pop() === "package.json");
}

/**
 * Effective prettier ignore path: the gate's travelling ignore is the base;
 * the host repo's own `.prettierignore` (if present) is additive. Returns the
 * gate config path when no host file exists, else a merged temp file.
 */
export async function resolveIgnorePath({ repoRoot }: { repoRoot: string }): Promise<string> {
  const basePath = await gateConfigPath({ name: "prettierignore" });
  const base = await readFile(basePath, "utf8");
  let host = "";
  try {
    host = await readFile(join(repoRoot, ".prettierignore"), "utf8");
  } catch {
    host = "";
  }
  if (host.trim() === "") {
    return basePath;
  }
  return writeMergedIgnore({ content: mergeIgnoreContents({ base, host }) });
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
  const ignorePath = await resolveIgnorePath({ repoRoot: ctx.repoRoot });
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
