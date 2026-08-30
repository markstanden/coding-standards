// steps/tofu.mts — OpenTofu: fmt, tflint, init, validate.
//
// Tools:    tofu (OpenTofu), tflint
// Config:   none (tflint picks up the project's .tflint.hcl when present)
// Fix:      tofu fmt -write and tflint --fix rewrite, then step re-verifies —
//           a fix that leaves diffs can never read as success
//
// Detection is sync and data-driven: activation = at least one tracked *.tf file.
// The runner is injected so tests need no host binaries.

import {
    failed,
    passed,
    skipped,
    type StepResult,
} from "../lib/step-result.mts";
import { run } from "../../lib/proc.mts";

export interface TofuRunContext {
    mode: "fix" | "no-fix";
    repoRoot: string;
}

type Runner = typeof run;

export function filterTofuFiles({ files }: { files: string[] }): string[] {
    return files.filter((file) => file.endsWith(".tf"));
}

async function runTofuCommand(
    runner: Runner,
    args: string[],
    cwd: string,
): Promise<{ status: number; stdout: string; stderr: string }> {
    return runner({ cmd: "tofu", args, cwd });
}

async function runTflintCommand(
    runner: Runner,
    args: string[],
    cwd: string,
): Promise<{ status: number; stdout: string; stderr: string }> {
    return runner({ cmd: "tflint", args, cwd });
}

/**
 * Run tofu fmt, tflint, init, validate over the repo root.
 * Returns skip when no .tf files tracked; fail naming the failing phase.
 */
export async function runTofuStep({
    ctx,
    trackedFiles,
    runner = run,
}: {
    ctx: TofuRunContext;
    trackedFiles: string[];
    runner?: Runner;
}): Promise<StepResult> {
    const tfFiles = filterTofuFiles({ files: trackedFiles });
    if (tfFiles.length === 0) {
        return skipped({ notice: "tofu: no tracked *.tf files" });
    }

    // Fix mode: fmt -write then verify; check mode: fmt -check.
    if (ctx.mode === "fix") {
        const fmtWrite = await runTofuCommand(
            runner,
            ["fmt", "-write"],
            ctx.repoRoot,
        );
        if (fmtWrite.status !== 0) {
            return failed({
                notice: `tofu: fmt -write failed: ${fmtWrite.stderr.trim()}`,
            });
        }
    }

    // Always verify formatting is clean.
    const fmtCheck = await runTofuCommand(
        runner,
        ["fmt", "-check"],
        ctx.repoRoot,
    );
    if (fmtCheck.status !== 0) {
        return failed({ notice: "tofu: fmt found diffs (run with --fix)" });
    }

    // tflint: static lint over the tracked *.tf files (no init needed for the
    // built-in rules). --init first so a project .tflint.hcl's plugins land in
    // the plugin cache; then lint. Exit 0 clean / 1 error / 2 issues found.
    const tflintInit = await runTflintCommand(runner, ["--init"], ctx.repoRoot);
    if (tflintInit.status !== 0) {
        return failed({
            notice: `tofu: tflint --init failed: ${tflintInit.stderr.trim()}`,
        });
    }

    if (ctx.mode === "fix") {
        const tflintFix = await runTflintCommand(
            runner,
            ["--fix"],
            ctx.repoRoot,
        );
        if (tflintFix.status === 1) {
            return failed({
                notice: `tofu: tflint --fix failed: ${tflintFix.stderr.trim()}`,
            });
        }
    }

    const tflint = await runTflintCommand(runner, [], ctx.repoRoot);
    if (tflint.status !== 0) {
        return failed({
            notice: `tofu: tflint found issues:\n${tflint.stdout.trim()}`,
        });
    }

    // Init with -backend=false to skip backend init (still downloads providers but skips backend config).
    const init = await runTofuCommand(
        runner,
        ["init", "-backend=false"],
        ctx.repoRoot,
    );
    if (init.status !== 0) {
        return failed({ notice: `tofu: init failed: ${init.stderr.trim()}` });
    }

    const validate = await runTofuCommand(runner, ["validate"], ctx.repoRoot);
    if (validate.status !== 0) {
        return failed({
            notice: `tofu: validate failed: ${validate.stdout.trim() || validate.stderr.trim()}`,
        });
    }

    return passed({
        notice: `tofu: fmt/tflint/init/validate clean (${tfFiles.length} file(s))`,
    });
}
