// Tests for pipelines/tofu-init.mts: init arg construction, workspace
// select-or-create, and status handling. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-init.test.mts

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { runTofuInit } from "./tofu-init.mts";
import { scriptedRunner } from "./test-helpers.mts";

const baseInput = {
  pluginCacheDir: ".tofu-plugin-cache",
  backendRg: "rg",
  backendSa: "sa",
  backendContainer: "container",
  backendKey: "key",
};

test("runs tofu init with the Azure backend config", () => {
  const { runner, calls } = scriptedRunner({});
  runTofuInit({ ...baseInput, runner });
  const init = calls.find((c) => c[1] === "init");
  assert.ok(init);
  assert.ok(init.includes("-reconfigure"));
  assert.ok(init.includes("-input=false"));
  assert.ok(init.includes("-backend-config=resource_group_name=rg"));
  assert.ok(init.includes("-backend-config=storage_account_name=sa"));
  assert.ok(init.includes("-backend-config=container_name=container"));
  assert.ok(init.includes("-backend-config=key=key"));
});

test("throws when tofu init fails", () => {
  const { runner } = scriptedRunner({ "tofu init -reconfigure -input=false -backend-config=resource_group_name=rg -backend-config=storage_account_name=sa -backend-config=container_name=container -backend-config=key=key": { status: 1, stderr: "boom" } });
  assert.throws(() => runTofuInit({ ...baseInput, runner }), /tofu init failed:\nboom/u);
});

test("selects an existing non-default workspace without creating it", () => {
  const { runner, calls } = scriptedRunner({});
  runTofuInit({ ...baseInput, buildEnv: "dev", runner });
  const selects = calls.filter((c) => c[1] === "workspace");
  assert.deepEqual(selects, [["tofu", "workspace", "select", "dev"]]);
});

test("creates the workspace when select fails", () => {
  const { runner, calls } = scriptedRunner({
    "tofu workspace select dev": { status: 1, stderr: "no workspace" },
  });
  runTofuInit({ ...baseInput, buildEnv: "dev", runner });
  assert.deepEqual(calls.filter((c) => c[1] === "workspace"), [
    ["tofu", "workspace", "select", "dev"],
    ["tofu", "workspace", "new", "dev"],
  ]);
});

test("throws when both select and new fail", () => {
  const { runner } = scriptedRunner({
    "tofu workspace select dev": { status: 1, stderr: "no workspace" },
    "tofu workspace new dev": { status: 1, stderr: "no create" },
  });
  assert.throws(() => runTofuInit({ ...baseInput, buildEnv: "dev", runner }), /tofu workspace select\|new failed:\nno create/u);
});

test("skips workspace handling for the default environment", () => {
  const { runner, calls } = scriptedRunner({});
  runTofuInit({ ...baseInput, buildEnv: "default", runner });
  assert.ok(!calls.some((c) => c[1] === "workspace"));
});

test("clears a stale .terraform/environment marker before init", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tofu-init-"));
  try {
    await mkdir(join(dir, ".terraform"), { recursive: true });
    await writeFile(join(dir, ".terraform", "environment"), "stale");
    const { runner, calls } = scriptedRunner({});
    runTofuInit({ ...baseInput, infraDir: dir, runner });
    assert.deepEqual(calls[0], ["rm", "-f", join(dir, ".terraform", "environment")]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});