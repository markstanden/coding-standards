// Tests for steps/tofu.mts: OpenTofu fmt, init, validate.
// Runner injected; no host binaries needed.
// Run: node --test steps/tofu.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { filterTofuFiles, runTofuStep } from "./tofu.mts";
import { baseCtx, fakeRunner } from "../test-helpers.mts";

test("filterTofuFiles finds .tf files", () => {
  assert.deepEqual(
    filterTofuFiles({ files: ["main.tf", "variables.tf", "a.sh", "b.yml"] }),
    ["main.tf", "variables.tf"],
  );
});

test("runTofuStep skips when no .tf files tracked", async () => {
  const { runner, calls } = fakeRunner({}, true);
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["a.sh", "b.yml"], runner });
  assert.equal(result.status, "skip");
  assert.equal(calls.length, 0);
});

test("check mode runs fmt -check, init, validate", async () => {
  const { runner, calls } = fakeRunner({}, true);
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
  const { runner, calls } = fakeRunner({}, true);
  const result = await runTofuStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "pass");
  const cmds = calls.map((c) => `${c[0]} ${c[1]}`);
  assert.deepEqual(cmds, ["tofu fmt", "tofu fmt", "tofu init", "tofu validate"]);
  assert.equal(calls[0]![2], "-write");
  assert.equal(calls[1]![2], "-check");
});

test("fmt failure in fix mode fails the step", async () => {
  const { runner } = fakeRunner({ "tofu fmt": { status: 1, stderr: "fmt error" } }, true);
  const result = await runTofuStep({ ctx: { ...baseCtx, mode: "fix" }, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: fmt"));
});

test("fmt check failure fails the step", async () => {
  const { runner } = fakeRunner({ "tofu fmt": { status: 1 } }, true);
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: fmt"));
});

test("init failure fails the step", async () => {
  const { runner } = fakeRunner({ "tofu init": { status: 1, stderr: "init error" } }, true);
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: init"));
});

test("validate failure fails the step", async () => {
  const { runner } = fakeRunner({ "tofu validate": { status: 1, stdout: "validation error" } }, true);
  const result = await runTofuStep({ ctx: baseCtx, trackedFiles: ["main.tf"], runner });
  assert.equal(result.status, "fail");
  assert.ok((result.notice ?? "").includes("tofu: validate"));
});