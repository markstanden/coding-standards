// pipelines/tofu-plan.mts — OpenTofu plan with detailed exit-code handling.
//
// Extracted from opentofu--build--infrastructure.yml ("OpenTofu Plan" step).
// tofu plan -detailed-exitcode returns:
//   0 = success, no changes
//   1 = error
//   2 = success, changes detected
// The exit code is written to GITHUB_OUTPUT (downstream apply gates on == 2);
// only a genuine error (1) fails the step.
//
// Inputs (env): INFRA_DIR (working dir), OUTPUT_FILE (plan.txt). Uses process
// cwd when INFRA_DIR absent.

import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

import { run, type Runner } from "../lib/proc.mts";

export interface TofuPlanInput {
    infraDir?: string;
    outputFile?: string;
}

let planStdout = "";

/** Run `tofu plan -detailed-exitcode` and return the exit code (0/1/2). */
export function runTofuPlan({
    infraDir,
    outputFile = "plan.txt",
    runner = run,
}: TofuPlanInput & { runner?: Runner }): number {
    const cwd = infraDir ? resolve(infraDir) : process.cwd();
    const result = runner({
        cmd: "tofu",
        args: ["plan", "-detailed-exitcode", "-no-color", "-out=tfplan"],
        cwd,
    });

    // status is 0/1/2 (or 1 on crash). The shell version redirected stdout into
    // plan.txt regardless of exit code — keep the file populated for the debug
    // step. Persist happens in main() so the pure function stays testable.
    planStdout = result.stdout;
    return result.status;
}

async function main(): Promise<void> {
    const exitCode = runTofuPlan({
        infraDir: process.env.INFRA_DIR,
        outputFile: process.env.PLAN_OUTPUT_FILE,
    });

    const cwd = process.env.INFRA_DIR
        ? resolve(process.env.INFRA_DIR)
        : process.cwd();
    const outputFile = process.env.PLAN_OUTPUT_FILE ?? "plan.txt";
    await appendFile(resolve(cwd, outputFile), planStdout, "utf8");

    const file = process.env.GITHUB_OUTPUT;
    if (file) {
        await appendFile(file, `exitcode=${exitCode}\n`, "utf8");
    }

    if (exitCode === 1) {
        console.error("tofu plan failed (exit 1)");
        process.exit(1);
    }
}

if (import.meta.main) {
    await main();
}
