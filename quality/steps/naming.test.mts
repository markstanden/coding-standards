// Tests for steps/naming.mts: opt-in naming conventions step.
// Runner injected; no host binaries needed.
// Run: node --test quality/steps/naming.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { CommandResult } from "../lib/proc.mts";
import { runNamingStep } from "./naming.mts";

function fakeRunner(
  outcomes: Record<string, { status: number; stdout?: string; stderr?: string }>,
): { runner: typeof import("../lib/proc.mts").run; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args }: { cmd: string; args: string[] }) => {
    calls.push([cmd, ...args]);
    const o = outcomes[cmd] ?? { status: 0 };
    return {
      status: o.status,
      stdout: o.stdout ?? "",
      stderr: o.stderr ?? "",
    } satisfies CommandResult;
  }) as typeof import("../lib/proc.mts").run;
  return { runner, calls };
}

const baseCtx = {
  mode: "no-fix" as const,
  silent: false,
  help: false as const,
  repoRoot: "/repo",
};

test("runNamingStep skips cleanly when not enabled", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runNamingStep({ ctx: baseCtx, trackedFiles: ["a.sh"], runner, enabled: false });
  assert.equal(result.status, "skip");
  assert.ok((result.notice ?? "").includes("not enabled"));
  assert.equal(calls.length, 0);
});

test("runNamingStep runs when enabled (placeholder implementation)", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runNamingStep({ ctx: baseCtx, trackedFiles: ["a.sh"], runner, enabled: true });
  assert.equal(result.status, "skip");
  assert.ok((result.notice ?? "").includes("placeholder"));
  assert.equal(calls.length, 0);
});