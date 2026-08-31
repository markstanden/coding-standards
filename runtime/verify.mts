#!/usr/bin/env node
// verify.mts — quality gate orchestrator (two-verb contract, decision #23).
//
// Public surface:
//   defined comply   bootstrap → repair (fix) pass → fresh verify (no-fix)
//                    pass → exit 0 only when the final pass is green.
//   defined verify   managed-artifact check (never writes) → complete no-fix
//                    pass → non-zero for any drift, finding or failure.
//
// Steps run in fixed order (naming → node → dotnet → shell → yaml → workflow
// → tofu), strictly sequentially. Output follows the report contract (decision
// #24): green runs print exactly one `compliant` line; anything else prints a
// stable, agent-actionable breakdown.

import { spawnSync } from "node:child_process";

import { createRunContext, parseCommand, type StepMode } from "./lib/ctx.mts";
import { trackedFiles } from "../lib/git.mts";
import { checkSetup, runSetup } from "./setup.mts";
import { formatReport } from "./lib/report.mts";
import { runDotNetStep } from "./steps/dotnet.mts";
import { runNamingStep } from "./steps/naming.mts";
import { runNodeStep } from "./steps/node.mts";
import { runShellStep } from "./steps/shell.mts";
import { runTofuStep } from "./steps/tofu.mts";
import { runWorkflowStep } from "./steps/workflow.mts";
import { runYamlStep } from "./steps/yaml.mts";
import { failed, passed, type StepResult } from "./lib/step-result.mts";

interface StepInput {
    mode: StepMode;
    repoRoot: string;
    /** Git-tracked files relative to repoRoot (lib/git.mts). */
    files: string[];
}

interface Step {
    id: string;
    run: (input: StepInput) => Promise<StepResult>;
}

/**
 * Prove end-to-end container execution by probing git's version. Uses a
 * fixed absolute path (/usr/bin/git — the image installs git via apt on
 * Debian slim), so no PATH lookup is involved and the probe is deterministic.
 */
async function runSmoke(_input: StepInput): Promise<StepResult> {
    const probe = spawnSync("/usr/bin/git", ["--version"], {
        encoding: "utf8",
    });
    if (probe.status !== 0) {
        return failed({ notice: "git not available in container" });
    }
    return passed({ notice: `container exec ok (${probe.stdout.trim()})` });
}

const STEPS: Step[] = [
    {
        id: "naming",
        run: ({ mode, repoRoot, files }) =>
            runNamingStep({
                ctx: { mode, repoRoot },
                trackedFiles: files,
                enabled: false,
            }),
    },
    {
        id: "node",
        run: ({ mode, repoRoot, files }) =>
            runNodeStep({ ctx: { mode, repoRoot }, trackedFiles: files }),
    },
    {
        id: "dotnet",
        run: ({ mode, repoRoot, files }) =>
            runDotNetStep({ ctx: { mode, repoRoot }, trackedFiles: files }),
    },
    {
        id: "shell",
        run: ({ mode, repoRoot, files }) =>
            runShellStep({ ctx: { mode, repoRoot }, trackedFiles: files }),
    },
    { id: "smoke", run: runSmoke },
    {
        id: "yaml",
        run: ({ mode, repoRoot, files }) =>
            runYamlStep({ ctx: { mode, repoRoot }, trackedFiles: files }),
    },
    {
        id: "workflow",
        run: ({ mode, repoRoot, files }) =>
            runWorkflowStep({ ctx: { mode, repoRoot }, trackedFiles: files }),
    },
    {
        id: "tofu",
        run: ({ mode, repoRoot, files }) =>
            runTofuStep({ ctx: { mode, repoRoot }, trackedFiles: files }),
    },
];

/** Run every step in order in the given mode; nothing may crash silently. */
async function runPass({
    mode,
    repoRoot,
    files,
}: {
    mode: StepMode;
    repoRoot: string;
    files: string[];
}): Promise<Map<string, StepResult>> {
    const results = new Map<string, StepResult>();
    for (const step of STEPS) {
        results.set(step.id, failed({ notice: "not started" }));
    }
    for (const step of STEPS) {
        const result = await step.run({ mode, repoRoot, files });
        results.set(step.id, result);
    }
    return results;
}

function printUsage(): void {
    console.log("usage: defined comply | defined verify");
}

async function main(): Promise<void> {
    const positional = process.argv.slice(2);

    let parsed;
    try {
        parsed = parseCommand({ argv: positional });
    } catch (err) {
        console.error(String(err));
        printUsage();
        process.exit(2);
    }
    if (parsed!.help) {
        printUsage();
        return;
    }

    const ctx = await createRunContext({
        verb: parsed!.verb,
        startDir: process.cwd(),
    });
    const files = trackedFiles({ repoRoot: ctx.repoRoot });

    // `comply`: bootstrap (write, raises-only) → fix pass → fresh verify pass.
    // The second pass is mandatory: repairs must be re-checked, and any
    // surviving failure sets the exit code.
    if (ctx.verb === "comply") {
        await runSetup({ startDir: process.cwd() });
        await runPass({ mode: "fix", repoRoot: ctx.repoRoot, files });
        const verify = await runPass({
            mode: "no-fix",
            repoRoot: ctx.repoRoot,
            files,
        });
        const lines = formatReport({
            verb: "comply",
            steps: [...verify].map(([id, result]) => ({ id, result })),
        });
        for (const line of lines) {
            console.log(line);
        }
        if (lines[0] !== "compliant") {
            process.exit(1);
        }
        return;
    }

    // `verify`: read-only bootstrap check → complete no-fix pass.
    const setup = await checkSetup({ startDir: process.cwd() });
    const results = await runPass({
        mode: "no-fix",
        repoRoot: ctx.repoRoot,
        files,
    });
    const lines = formatReport({
        verb: "verify",
        setup,
        steps: [...results].map(([id, result]) => ({ id, result })),
    });
    for (const line of lines) {
        console.log(line);
    }
    if (lines[0] !== "compliant") {
        process.exit(1);
    }
}

await main();
