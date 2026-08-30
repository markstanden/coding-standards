// Tests for pipelines/tofu-destroy.mts: workspace select gating and destroy
// failure handling. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-destroy.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import type { Runner } from "../lib/proc.mts";

import { runTofuDestroy } from "./tofu-destroy.mts";

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

test("returns false without destroying when a non-default workspace is absent", () => {
  const { runner, calls } = scriptedRunner({ "tofu workspace select dev": { status: 1 } });
  assert.equal(runTofuDestroy({ infraDir: "/repo/infra", buildEnv: "dev", runner }), false);
  assert.ok(!calls.some((c) => c[1] === "destroy"));
});

test("destroys the default workspace in place", () => {
  const { runner, calls } = scriptedRunner({});
  assert.equal(runTofuDestroy({ infraDir: "/repo/infra", buildEnv: "default", runner }), true);
  assert.ok(calls.some((c) => c[1] === "destroy"));
});

test("throws on destroy failure, including the state listing for diagnostics", () => {
  const { runner } = scriptedRunner({ "tofu destroy -auto-approve -input=false": { status: 1, stderr: "boom" } });
  assert.throws(() => runTofuDestroy({ infraDir: "/repo/infra", buildEnv: "default", runner }), /tofu destroy failed \(1\):\nboom/u);
});