// Tests for steps/tofu.mts: OpenTofu fmt, init, validate.
// Runner injected; no host binaries needed.
// Run: node --test quality/steps/tofu.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { CommandResult } from "../lib/proc.mts";
import { filterTofuFiles, runTofuStep } from "./tofu.mts";

function fakeRunner(
  outcomes: Record<string, { status: number; stdout?: string; stderr?: string }>,
): { runner: typeof import("../lib/proc.mts").run; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args, cwd }: { cmd: string; args: string[]; cwd?: string }) => {
    calls.push([cmd, ...args, cwd ?? ""]);
    const key = `${cmd} ${args[0] ?? ""}`.trim();
    const o = outcomes[key] ?? outcomes[cmd] ?? { status: 0 };
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

test("filterTofuFiles finds .tf files", () => {
  assert.deepEqual(
    filterTofuFiles({ files: ["main.tf", "variables.tf", "a.sh", "b.yml"] }),
    ["main.tf", "variables.tf"],
  );
});

test("runTofuStep skips when no .tf files tracked", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["a.sh", "b.yml"], runner });
  assert.equal(result.status, "skip");
  assert.equal(calls.length, 0);
});

test("check mode runs fmt -check, init, validate", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runTofuStep({
    ctx: baseCtx,
    trackedFiles: ["main.tf"],
    runner,
  });
  assert.equal(result.status, "pass");
  const cmds = calls.map((c) => `${c[0]} ${c[1]}`);
  assert.deepEqual(cmds, ["tofu fmt", "tofu init", "tofu validate"]);
});

test("fix mode runs fmt -write then re-check, init, validate", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runTofuStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "pass");
  const cmds = calls.map((c) => `${c[0]} ${c[1]}`);
  assert.deepEqual(cmds, ["tofu fmt", "tofu fmt", "tofu init", "tofu validate"]);
  assert.equal(calls[0]![2], "-write");
  assert.equal(calls[1]![2], "-check");
});

test("fmt failure in fix mode fails the step", async () => {
  const { runner } = fakeRunner({ "tofu fmt": { status: 1, stderr: "fmt error" } });
  const result = await runTofuStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: fmt"));
});

test("fmt check failure fails the step", async () => {
  const { runner } = fakeRunner({ "tofu fmt": { status: 1 } });
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: fmt"));
});

test("init failure fails the step", async () => {
  const { runner } = fakeRunner({ "tofu init": { status: 1, stderr: "init error" } });
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: init"));
});

test("validate failure fails the step", async () => {
  const { runner } = fakeRunner({ "tofu validate": { status: 1, stdout: "validation error" } });
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: validate"));
});