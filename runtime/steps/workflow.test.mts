// Tests for steps/workflow.mts: actionlint + zizmor + gitleaks.
// Runner injected; no host binaries needed.
// Run: node --test steps/workflow.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { filterWorkflowFiles, runWorkflowStep } from "./workflow.mts";
import { baseCtx, fakeRunner } from "../test-helpers.mts";

test("filterWorkflowFiles finds .github/workflows/*.yml and dependabot.yml", () => {
  assert.deepEqual(
    filterWorkflowFiles({
      files: [".github/workflows/ci.yml", ".github/dependabot.yml", ".github/workflows/cd.yaml", "a.sh"],
    }),
    [".github/workflows/ci.yml", ".github/dependabot.yml", ".github/workflows/cd.yaml"],
  );
});

test("filterWorkflowFiles ignores non-workflow yaml in .github/", () => {
  assert.deepEqual(
    filterWorkflowFiles({ files: [".github/other.yml", ".github/workflows/ci.yml"] }),
    [".github/workflows/ci.yml"],
  );
});

test("runWorkflowStep skips actionlint/zizmor when no workflow files", async () => {
  const { runner, calls } = fakeRunner({}, true);
  const result = await runWorkflowStep({ ctx: baseCtx, trackedFiles: ["a.sh", "b.yml"], runner });
  assert.equal(result.status, "pass");
  assert.ok((result.notice ?? "").includes("no workflow files"));
  // gitleaks still runs on whole tree
  assert.equal(calls.length, 1);
  assert.equal(calls[0]![0], "gitleaks");
});

test("actionlint runs on workflow files, then zizmor, then gitleaks", async () => {
  const { runner, calls } = fakeRunner({}, true);
  const result = await runWorkflowStep({
    ctx: baseCtx,
    trackedFiles: [".github/workflows/ci.yml"],
    runner,
  });
  assert.equal(result.status, "pass");
  const cmds = calls.map((c) => c[0]);
  assert.deepEqual(cmds, ["actionlint", "zizmor", "gitleaks"]);
  // actionlint gets the file as first arg
  assert.deepEqual(calls[0]!.slice(1, 2), [".github/workflows/ci.yml"]);
  // zizmor gets --no-progress as first arg
  assert.equal(calls[1]![1], "--no-progress");
  // gitleaks gets "dir" as first arg
  assert.equal(calls[2]![1], "dir");
});

test("actionlint failure fails the step", async () => {
  const { runner } = fakeRunner({ "actionlint": { status: 1, stderr: "actionlint error" } }, true);
  const result = await runWorkflowStep({
    ctx: baseCtx,
    trackedFiles: [".github/workflows/ci.yml"],
    runner,
  });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("actionlint"));
});

test("zizmor failure fails the step", async () => {
  const { runner } = fakeRunner({ "zizmor": { status: 1, stderr: "zizmor error" } }, true);
  const result = await runWorkflowStep({
    ctx: baseCtx,
    trackedFiles: [".github/workflows/ci.yml"],
    runner,
  });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("zizmor"));
});

test("gitleaks failure fails the step", async () => {
  const { runner } = fakeRunner({ "gitleaks": { status: 1, stdout: "leaks found" } }, true);
  const result = await runWorkflowStep({
    ctx: baseCtx,
    trackedFiles: [".github/workflows/ci.yml"],
    runner,
  });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("gitleaks"));
});

test("gitleaks scans repo root, not just workflow files", async () => {
  const { runner, calls } = fakeRunner({}, true);
  await runWorkflowStep({ ctx: baseCtx, trackedFiles: [".github/workflows/ci.yml"], runner });
  const gitleaksCall = calls.find((c) => c[0] === "gitleaks")!;
  assert.deepEqual(gitleaksCall.slice(1, 3), ["dir", "."]);
});