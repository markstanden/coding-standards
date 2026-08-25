#!/usr/bin/env node
// verify.mts — quality gate orchestrator.
//
// Runs steps in fixed order (naming → node → dotnet → shell → yaml →
// workflow → tofu), strictly sequentially. Scaffold state: every ecosystem
// step skips with a notice; the smoke step proves end-to-end container
// execution and will be removed once real steps land.
//
// Flags: --fix | --no-fix | --silent | -h/--help

import { spawnSync } from "node:child_process";

type StepMode = "fix" | "no-fix";
type StepStatus = "pass" | "fail" | "skip";

interface RunContext {
  mode: StepMode;
  silent: boolean;
  repoRoot: string;
}

interface StepResult {
  status: StepStatus;
  notice?: string;
}

interface Step {
  id: string;
  run: { (ctx: RunContext): Promise<StepResult> };
}

function parseArgs({ argv }: { argv: string[] }): { ctx: RunContext; help: boolean } {
  let mode: StepMode = "no-fix";
  let silent = false;
  for (const arg of argv) {
    if (arg === "--fix") mode = "fix";
    else if (arg === "--no-fix") mode = "no-fix";
    else if (arg === "--silent") silent = true;
    else if (arg === "-h" || arg === "--help") return { ctx: { mode, silent, repoRoot: process.cwd() }, help: true };
    else throw new Error(`unknown flag: ${arg}`);
  }
  return { ctx: { mode, silent, repoRoot: process.cwd() }, help: false };
}

async function runSmoke({ ctx }: { ctx: RunContext }): Promise<StepResult> {
  const probe = spawnSync("git", ["--version"], { encoding: "utf8" });
  if (probe.status !== 0) {
    return { status: "fail", notice: "git not available in container" };
  }
  return { status: "pass", notice: `container exec ok (${probe.stdout.trim()})` };
}

function skippedStep({ id }: { id: string }) {
  return async function run(_ctx: RunContext): Promise<StepResult> {
    return { status: "skip", notice: `${id}: not yet wired` };
  };
}

const STEPS: Step[] = [
  { id: "naming", run: skippedStep({ id: "naming" }) },
  { id: "node", run: skippedStep({ id: "node" }) },
  { id: "dotnet", run: skippedStep({ id: "dotnet" }) },
  { id: "shell", run: skippedStep({ id: "shell" }) },
  { id: "smoke", run: runSmoke },
  { id: "yaml", run: skippedStep({ id: "yaml" }) },
  { id: "workflow", run: skippedStep({ id: "workflow" }) },
  { id: "tofu", run: skippedStep({ id: "tofu" }) },
];

function main(): void {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({ argv: process.argv.slice(2) });
  } catch (err) {
    console.error(String(err));
    process.exit(2);
  }
  if (parsed.help) {
    console.log("usage: verify.sh [--fix] [--no-fix] [--silent] [-h]");
    return;
  }

  const results = new Map<string, StepResult>();
  for (const step of STEPS) {
    results.set(step.id, { status: "fail", notice: "not started" });
  }

  (async () => {
    for (const step of STEPS) {
      const result = await step.run({ ctx: parsed.ctx });
      results.set(step.id, result);
    }

    const failed = [...results.entries()].filter(([, r]) => r.status === "fail");
    for (const [id, r] of results) {
      if (!parsed.silent || r.status !== "skip" || id === "smoke") {
        console.log(`${r.status.padEnd(4)} ${id}${r.notice ? ` — ${r.notice}` : ""}`);
      }
    }
    if (failed.length > 0) {
      process.exit(1);
    }
  })();
}

main();
