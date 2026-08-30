// steps/workflow.mts — GitHub Actions workflows: actionlint + zizmor + gitleaks.
//
// Tools:    actionlint, zizmor, gitleaks (all required — missing = loud fail)
// Config:   .gitleaksignore at repo root (optional); per-project ignores via
//           .qualityrc.json when needed
// Fix:      none — these are check-only tools
//
// Detection: actionlint/zizmor run only when tracked workflow files exist
// (.github/workflows/*.yml, .github/workflows/*.yaml, .github/dependabot.yml).
// gitleaks always runs (scans entire tracked working tree for secrets).
// The runner is injected so tests need no host binaries.

import { failed, passed, type StepResult } from "../lib/step-result.mts";
import { run } from "../../lib/proc.mts";

export interface WorkflowRunContext {
    mode: "fix" | "no-fix";
    repoRoot: string;
}

type Runner = typeof run;

export const WORKFLOW_GLOBS = [
    ".github/workflows/*.yml",
    ".github/workflows/*.yaml",
    ".github/dependabot.yml",
] as const;

export function filterWorkflowFiles({ files }: { files: string[] }): string[] {
    return files.filter((file) => {
        return (
            (file.startsWith(".github/workflows/") &&
                (file.endsWith(".yml") || file.endsWith(".yaml"))) ||
            file === ".github/dependabot.yml"
        );
    });
}

/**
 * Run actionlint, zizmor on workflow files, and gitleaks on the whole repo.
 * Returns pass when all clean; fail naming the offending tool.
 * If no workflow files tracked, skips actionlint/zizmor but still runs gitleaks.
 */
export async function runWorkflowStep({
    ctx,
    trackedFiles,
    runner = run,
}: {
    ctx: WorkflowRunContext;
    trackedFiles: string[];
    runner?: Runner;
}): Promise<StepResult> {
    const workflowFiles = filterWorkflowFiles({ files: trackedFiles });

    if (workflowFiles.length > 0) {
        const actionlint = runner({
            cmd: "actionlint",
            args: workflowFiles,
            cwd: ctx.repoRoot,
        });
        if (actionlint.status !== 0) {
            return failed({
                notice: `workflow: actionlint failed: ${actionlint.stderr.trim() || actionlint.stdout.trim()}`,
            });
        }

        const zizmor = runner({
            cmd: "zizmor",
            args: ["--no-progress", "--min-severity", "high", ...workflowFiles],
            cwd: ctx.repoRoot,
        });
        if (zizmor.status !== 0) {
            return failed({
                notice: `workflow: zizmor failed: ${zizmor.stderr.trim() || zizmor.stdout.trim()}`,
            });
        }
    }

    // gitleaks always scans the working tree (dir . from repo root)
    const gitleaks = runner({
        cmd: "gitleaks",
        args: ["dir", "."],
        cwd: ctx.repoRoot,
    });
    if (gitleaks.status !== 0) {
        return failed({
            notice: `workflow: gitleaks found secrets: ${gitleaks.stdout.trim() || gitleaks.stderr.trim()}`,
        });
    }

    if (workflowFiles.length > 0) {
        return passed({
            notice: `workflow: actionlint/zizmor/gitleaks clean (${workflowFiles.length} workflow file(s))`,
        });
    }
    return passed({ notice: "workflow: no workflow files; gitleaks clean" });
}
