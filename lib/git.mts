// lib/git.mts — git inventory for the quality gate.
//
// Scanning scope is git-tracked files only (decision #10): untracked local
// scratch never fails a gate, and per-tool ignores handle committed-but-
// generated exceptions via config travelling in runtime/config/.

import { existsSync } from "node:fs";
import { join } from "node:path";

import { run } from "./proc.mts";

/**
 * List files git considers part of the tree: tracked plus untracked but
 * not ignored, relative to the repo root. Tracked files deleted from the
 * working tree are excluded; symlinks appear as themselves.
 */
export function trackedFiles({ repoRoot }: { repoRoot: string }): string[] {
    const result = run({
        cmd: "git",
        args: ["ls-files", "-co", "--exclude-standard", "--deduplicate"],
        cwd: repoRoot,
    });
    return result.stdout
        .split("\n")
        .filter((line) => line !== "" && existsSync(join(repoRoot, line)));
}
