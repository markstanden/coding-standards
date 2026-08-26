// Tests for steps/node.mts: repo-wide formatting via prettier.
// Runner injected, so no host binaries are needed here.
// Run: node --test quality/steps/node.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { CommandResult } from "../lib/proc.mts";
import { filterPackageJsons, runNodeStep } from "./node.mts";

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

test("filterPackageJsons finds package.json files at any depth", () => {
  assert.deepEqual(
    filterPackageJsons({ files: ["package.json", "lib/package.json", "a.sh", "packages/x/package.json"] }),
    ["package.json", "lib/package.json", "packages/x/package.json"],
  );
});

test("runNodeStep skips cleanly when no package.json is tracked", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runNodeStep({ ctx: baseCtx, trackedFiles: ["a.sh", "b.yml"], runner });
  assert.equal(result.status, "skip");
  assert.equal(calls.length, 0);
});

test("check mode runs prettier --check with travelling config and ignore", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runNodeStep({
    ctx: baseCtx,
    trackedFiles: ["package.json"],
    runner,
  });
  assert.equal(result.status, "pass");
  assert.equal(calls.length, 1);
  const [cmd, ...args] = calls[0]!;
  assert.equal(cmd, "prettier");
  assert.equal(args[0], "--check");
  assert.equal(args[1], "--config");
  assert.match(args[2]!, /quality\/config\/prettier\.config\.mjs$/u);
  assert.equal(args[3], "--ignore-path");
  assert.match(args[4]!, /quality\/config\/prettierignore$/u);
  assert.deepEqual(args.slice(5), ["."]);
});

test("fix mode writes then re-checks before reporting success", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runNodeStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["package.json"], runner });
  assert.equal(result.status, "pass");
  assert.deepEqual(calls.map((c) => c[0] !== "prettier" ? c[0] : c[1]), ["--write", "--check"]);
});

test("a fix that leaves diffs can never read as success", async () => {
  let calls = 0;
  const runner = (({ cmd, args }: { cmd: string; args: string[] }) => {
    calls += 1;
    const status = calls === 1 ? 0 : 1;
    return { status, stdout: "", stderr: "" } satisfies CommandResult;
  }) as typeof import("../lib/proc.mts").run;
  const result = await runNodeStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["package.json"], runner });
  assert.equal(result.status, "fail");
});

test("check mode failure names prettier and the file count", async () => {
  const { runner } = fakeRunner({ prettier: { status: 1, stdout: "a.md\nb.md\nc.md\n" } });
  const result = await runNodeStep({ ctx: baseCtx, trackedFiles: ["package.json"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("prettier"));
});
