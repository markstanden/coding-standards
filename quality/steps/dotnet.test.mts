// Tests for steps/dotnet.mts: .NET format, build, test via dotnet CLI.
// Runner injected; no host binaries needed.
// Run: node --test quality/steps/dotnet.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { CommandResult } from "../lib/proc.mts";
import { filterDotNetFiles, discoverWorkspace, runDotNetStep } from "./dotnet.mts";

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

test("filterDotNetFiles finds csproj, sln, slnx files", () => {
  assert.deepEqual(
    filterDotNetFiles({ files: ["a.csproj", "sln.sln", "b.slnx", "c.sh", "d.yml"] }),
    ["a.csproj", "sln.sln", "b.slnx"],
  );
});

test("discoverWorkspace prefers explicit env, then single slnx/sln, else repo root", () => {
  // explicit env
  assert.equal(discoverWorkspace({ repoRoot: "/repo", workspaceEnv: "/repo/explicit.slnx" }), "/repo/explicit.slnx");
  // single slnx
  assert.equal(discoverWorkspace({ repoRoot: "/repo", slnxFiles: ["proj.slnx"], slnFiles: [] }), "/repo/proj.slnx");
  // single sln
  assert.equal(discoverWorkspace({ repoRoot: "/repo", slnxFiles: [], slnFiles: ["proj.sln"] }), "/repo/proj.sln");
  // none -> repo root
  assert.equal(discoverWorkspace({ repoRoot: "/repo", slnxFiles: [], slnFiles: [] }), "/repo");
});

test("discoverWorkspace throws on multiple solutions", () => {
  assert.throws(
    () => discoverWorkspace({ repoRoot: "/repo", slnxFiles: ["a.slnx"], slnFiles: ["b.sln"] }),
    /Multiple solution files/,
  );
});

test("runDotNetStep skips cleanly when no .NET files tracked", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runDotNetStep({ ctx: baseCtx, trackedFiles: ["a.sh", "b.yml"], runner });
  assert.equal(result.status, "skip");
  assert.equal(calls.length, 0);
});

test("check mode runs format --verify-no-changes, build, test", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runDotNetStep({
    ctx: baseCtx,
    trackedFiles: ["src/MyProj.csproj"],
    runner,
  });
  assert.equal(result.status, "pass");
  const cmds = calls.map((c) => c[0]);
  assert.deepEqual(cmds, ["dotnet", "dotnet", "dotnet"]);
  assert.equal(calls[0]![1], "format");
  assert.equal(calls[0]![2], "--verify-no-changes");
  assert.equal(calls[1]![1], "build");
  assert.equal(calls[2]![1], "test");
});

test("fix mode runs format then re-verify, build, test", async () => {
  const { runner, calls } = fakeRunner({});
  const result = await runDotNetStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["src/MyProj.csproj"], runner });
  assert.equal(result.status, "pass");
  const cmds = calls.map((c) => c[0]);
  assert.deepEqual(cmds, ["dotnet", "dotnet", "dotnet", "dotnet"]);
  assert.equal(calls[0]![1], "format");
  assert.equal(calls[1]![1], "format");
  assert.equal(calls[1]![2], "--verify-no-changes");
  assert.equal(calls[2]![1], "build");
  assert.equal(calls[3]![1], "test");
});

test("format failure in fix mode fails the step", async () => {
  const { runner, calls } = fakeRunner({ "dotnet format": { status: 1, stderr: "format error" } });
  const result = await runDotNetStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["src/MyProj.csproj"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("dotnet: format"));
});

test("build failure fails the step", async () => {
  const { runner } = fakeRunner({ "dotnet build": { status: 1, stderr: "build error" } });
  const result = await runDotNetStep({ ctx: baseCtx, trackedFiles: ["src/MyProj.csproj"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("dotnet: build"));
});

test("test failure fails the step", async () => {
  const { runner } = fakeRunner({ "dotnet test": { status: 1, stdout: "Failed: 1" } });
  const result = await runDotNetStep({ ctx: baseCtx, trackedFiles: ["src/MyProj.csproj"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("dotnet: test"));
});