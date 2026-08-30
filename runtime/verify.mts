#!/usr/bin/env node
// verify.mts — quality gate orchestrator.
//
// Runs steps in fixed order (naming → node → dotnet → shell → yaml →
// workflow → tofu), strictly sequentially. Scaffold state: every ecosystem
// step skips with a notice; the smoke step proves end-to-end container
// execution and will be removed once real steps land.
//
// Flags are parsed and context assembled by lib/ctx.mts.

import { spawnSync } from "node:child_process";

import { createRunContext, parseArgs, type RunContext } from "./lib/ctx.mts";
import { trackedFiles } from "../lib/git.mts";
import { runSetup } from "./setup.mts";
import { runDotNetStep } from "./steps/dotnet.mts";
import { runNamingStep } from "./steps/naming.mts";
import { runNodeStep } from "./steps/node.mts";
import { runShellStep } from "./steps/shell.mts";
import { runTofuStep } from "./steps/tofu.mts";
import { runWorkflowStep } from "./steps/workflow.mts";
import { runYamlStep } from "./steps/yaml.mts";
import { failed, passed, skipped, type StepResult } from "./lib/step-result.mts";

interface StepInput {
  ctx: RunContext;
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
async function runSmoke({ ctx }: { ctx: RunContext }): Promise<StepResult> {
  const probe = spawnSync("/usr/bin/git", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    return failed({ notice: "git not available in container" });
  }
  return passed({ notice: `container exec ok (${probe.stdout.trim()})` });
}

function skippedStep({ id }: { id: string }) {
  return async function run(_input: StepInput): Promise<StepResult> {
    return skipped({ notice: `${id}: not yet wired` });
  };
}

const STEPS: Step[] = [
  { id: "naming", run: ({ ctx, files }) => runNamingStep({ ctx, trackedFiles: files, enabled: false }) },
  {
    id: "node",
    run: ({ ctx, files }) => runNodeStep({ ctx, trackedFiles: files }),
  },
  {
    id: "dotnet",
    run: ({ ctx, files }) => runDotNetStep({ ctx, trackedFiles: files }),
  },
  { id: "shell", run: ({ ctx, files }) => runShellStep({ ctx, trackedFiles: files }) },
  { id: "smoke", run: runSmoke },
  {
    id: "yaml",
    run: ({ ctx, files }) => runYamlStep({ ctx, trackedFiles: files }),
  },
  { id: "workflow", run: ({ ctx, files }) => runWorkflowStep({ ctx, trackedFiles: files }) },
  { id: "tofu", run: ({ ctx, files }) => runTofuStep({ ctx, trackedFiles: files }) },
];

function printUsage(): void {
  console.log("usage: verify.sh [--fix] [--no-fix] [--silent] [-h]");
}

async function main(): Promise<void> {
  const positional = process.argv.slice(2);

  // Setup is the gate's bootstrap (decisions #13–14): install shared configs
  // and seed AGENTS.md. Delegate before flag parsing so verify flags never
  // apply to it.
  if (positional[0] === "setup") {
    await runSetup({ startDir: process.cwd() });
    return;
  }

  // Phase 1 — pure flag parsing; exits early on help or bad input.
  let args: ReturnType<typeof parseArgs>;
  try {
    args = parseArgs({ argv: positional });
  } catch (err) {
    console.error(String(err));
    process.exit(2);
  }
  if (args!.help) {
    printUsage();
    return;
  }

  // Phase 2 — async context assembly (repo-root derivation).
  const ctx = await createRunContext({
    argv: positional,
    startDir: process.cwd(),
  });

  // Phase 3 — sequential execution; every step starts marked fail so a
  // crash mid-run cannot be mistaken for success.
  const files = trackedFiles({ repoRoot: ctx.repoRoot });
  const results = new Map<string, StepResult>();
  for (const step of STEPS) {
    results.set(step.id, failed({ notice: "not started" }));
  }
  for (const step of STEPS) {
    const result = await step.run({ ctx, files });
    results.set(step.id, result);
  }

  // Summary: silent mode still prints passes (and the smoke line) so a
  // quiet green run is never fully mute.
  for (const [id, r] of results) {
    if (!ctx.silent || id === "smoke") {
      const notice = r.notice ? ` — ${r.notice}` : "";
      console.log(`${r.status.padEnd(4)} ${id}${notice}`);
    }
  }

  if ([...results.values()].some((r) => r.status === "fail")) {
    process.exit(1);
  }
}

await main();
