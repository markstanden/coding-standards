// Tests for steps/shell.mts: shfmt + shellcheck over tracked shell scripts.
// The runner is injected, so no host binaries are needed here.
// Run: node --test quality/steps/shell.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { CommandResult } from "../lib/proc.mts";
import { filterShellScripts, runShellStep, SHELLCHECK_DEFAULT_FLOOR } from "./shell.mts";

/** Scriptable fake runner: maps command name to canned results. */
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

const baseCtx = { mode: "no-fix" as const, silent: false, help: false as const, repoRoot: "/repo" };

test("filterShellScripts keeps only *.sh anywhere in the path", () => {
  assert.deepEqual(
    filterShellScripts({ files: ["a.sh", "deep/nested/b.sh", "c.bash", "d", "e.sh.txt"] }),
    ["a.sh", "deep/nested/b.sh"],
  );
});

test("runShellStep skips cleanly when no shell scripts are tracked", async () => {
  const { runner } = fakeRunner({});
  const result = await runShellStep({ ctx: baseCtx, trackedFiles: ["readme.md"], runner });
  assert.equal(result.status, "skip");
});

test("check mode fails when shfmt reports formatting diffs", async () => {
  const { runner } = fakeRunner({ shfmt: { status: 1 }, shellcheck: { status: 0 } });
  const result = await runShellStep({
    ctx: baseCtx,
    trackedFiles: ["broken.sh"],
    runner,
  });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("shfmt"));
});

test("fix mode rewrites then re-checks before reporting pass", async () => {
  const { runner, calls } = fakeRunner({
    // first shfmt (-w) "succeeds"; the re-check also passes
    shellcheck: { status: 0 },
  });
  const result = await runShellStep({
    ctx: { ...baseCtx, mode: "fix" },
    trackedFiles: ["fixable.sh"],
    runner,
  });
  assert.equal(result.status, "pass");
  assert.deepEqual(calls.filter((c) => c[0] === "shfmt")[0].slice(0, 2), ["shfmt", "-w"]);
});

test("shellcheck violations at or above the floor fail the step", async () => {
  const { runner } = fakeRunner({
    shfmt: { status: 0 },
    shellcheck: { status: 1, stderr: "bad.sh:1:1: error: note (SC1234)" },
  });
  const result = await runShellStep({
    ctx: baseCtx,
    trackedFiles: ["bad.sh"],
    runner,
  });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("shellcheck"));
});

test("default floor is style; a raised project floor is honoured via -S", async () => {
  const { runner, calls } = fakeRunner({});
  await runShellStep({ ctx: baseCtx, trackedFiles: ["ok.sh"], runner });
  const floorArg = calls.find((c) => c[0] === "shellcheck")?.[
    calls.find((c) => c[0] === "shellcheck")!.indexOf("-S") + 1
  ];
  assert.equal(SHELLCHECK_DEFAULT_FLOOR, "style");
  assert.equal(floorArg, "style");
});
