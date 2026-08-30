// Tests for pipelines/tofu-diagnose.mts: best-effort probing never throws,
// and output-key listing parses tofu's JSON. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-diagnose.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Runner } from "../lib/proc.mts";

import { diagnoseTofu } from "./tofu-diagnose.mts";

function scriptedRunner(outcomes: Record<string, { status?: number; stdout?: string; stderr?: string }>): { runner: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args }: { cmd: string; args: string[] }) => {
    calls.push([cmd, ...args]);
    const key = `${cmd} ${args.join(" ")}`.trim();
    const o = outcomes[key] ?? { status: 0 };
    return { status: o.status ?? 0, stdout: o.stdout ?? "", stderr: o.stderr ?? "" };
  }) as Runner;
  return { runner, calls };
}

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
  const logged: string[] = [];
  const orig = console.log;
  console.log = (...parts: string[]) => { logged.push(parts.join(" ")); };
  try {
    diagnoseTofu({ showOutputKeys: true, runner });
  } finally {
    console.log = orig;
  }
  assert.ok(logged.some((l) => l.includes("url")));
  assert.ok(logged.some((l) => l.includes("token")));
});

test("prints (no outputs) when output JSON is unparseable", () => {
  const { runner } = scriptedRunner({ "tofu output -json": { status: 0, stdout: "not json" } });
  const logged: string[] = [];
  const orig = console.log;
  console.log = (...parts: string[]) => { logged.push(parts.join(" ")); };
  try {
    diagnoseTofu({ showOutputKeys: true, runner });
  } finally {
    console.log = orig;
  }
  assert.ok(logged.includes("(no outputs)"));
});