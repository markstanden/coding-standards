// Tests for pipelines/tofu-diagnose.mts: best-effort probing never throws,
// and output-key listing parses tofu's JSON. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-diagnose.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { diagnoseTofu } from "./tofu-diagnose.mts";
import { captureLogs, scriptedRunner } from "./test-helpers.mts";

test("never throws when every probe fails", () => {
  const { runner } = scriptedRunner({
    "tofu workspace show": { status: 1, stderr: "no state" },
    "tofu workspace list": { status: 1, stderr: "boom" },
    "tofu state list": { status: 1, stderr: "boom" },
    "tofu output -json": { status: 1, stderr: "boom" },
  });
  assert.doesNotThrow(() => diagnoseTofu({ showOutputKeys: true, runner }));
});

test("lists output keys from tofu output -json", () => {
  const { runner } = scriptedRunner({ "tofu output -json": { status: 0, stdout: '{"url":{"value":"https://x"},"token":{"value":"t"}}' } });
  const logged = captureLogs(() => diagnoseTofu({ showOutputKeys: true, runner }));
  assert.ok(logged.some((l) => l.includes("url")));
  assert.ok(logged.some((l) => l.includes("token")));
});

test("prints (no outputs) when output JSON is unparseable", () => {
  const { runner } = scriptedRunner({ "tofu output -json": { status: 0, stdout: "not json" } });
  const logged = captureLogs(() => diagnoseTofu({ showOutputKeys: true, runner }));
  assert.ok(logged.includes("(no outputs)"));
});