// Tests for pipelines/tofu-plan.mts: exit-code passthrough and arg
// construction. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-plan.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Runner } from "../lib/proc.mts";

import { runTofuPlan } from "./tofu-plan.mts";

function scriptedRunner(status: number, stdout = ""): { runner: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args }: { cmd: string; args: string[] }) => {
    calls.push([cmd, ...args]);
    return { status, stdout, stderr: "" };
  }) as Runner;
  return { runner, calls };
}

test("returns 0 on no changes and 2 on changes detected", () => {
  assert.equal(runTofuPlan({ infraDir: "/repo/infra", runner: scriptedRunner(0).runner }), 0);
  assert.equal(runTofuPlan({ infraDir: "/repo/infra", runner: scriptedRunner(2).runner }), 2);
});

test("returns 1 (error) as-is for the caller to gate on", () => {
  assert.equal(runTofuPlan({ runner: scriptedRunner(1, "boom").runner }), 1);
});

test("passes detailed-exitcode, no-color and out=tfplan", () => {
  const { runner, calls } = scriptedRunner(0);
  runTofuPlan({ runner });
  assert.deepEqual(calls[0], ["tofu", "plan", "-detailed-exitcode", "-no-color", "-out=tfplan"]);
});