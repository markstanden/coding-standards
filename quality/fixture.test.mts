// Integration test: the gate finds broken code and auto-fixes it.
//
// Builds a deliberately-broken git repo (lib/fixture.mts), runs the real gate
// against it in-container via quality/verify.sh, and asserts:
//   1. check mode FAILS on every broken ecosystem (picked up),
//   2. --fix repairs the auto-fixable ones (node/shell/yaml/tofu pass,
//      workflow stays red — actionlint is check-only),
//   3. a file behind the host .prettierignore is never touched.
//
// Requires a container engine + the gate image (verify.sh builds it on first
// run). Skips cleanly when podman/docker are absent so `node --test` stays
// runnable on a bare machine.
// Run: node --test quality/fixture.test.mts

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

import { createBrokenFixture, brokenFixtureFiles } from "./lib/fixture.mts";
import { run } from "./lib/proc.mts";

function hasEngine(): boolean {
  return existsSync("/usr/bin/podman") || existsSync("/usr/bin/docker");
}

function gateShim(): string {
  // quality/fixture.test.mts → quality/verify.sh (two levels up via lib/).
  return resolve(import.meta.dirname, "verify.sh");
}

async function makeTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "quality-fixture-"));
}

test("gate picks up every broken ecosystem and --fix repairs auto-fixable ones", { skip: !hasEngine() }, async () => {
  const root = await makeTemp();
  try {
    await createBrokenFixture({ root });

    // Check mode: every broken ecosystem fails (picked up).
    const check = run({ cmd: gateShim(), args: [], cwd: root });
    assert.equal(check.status, 1, `check should fail, got:\n${check.stdout}`);
    for (const step of ["node", "shell", "yaml", "workflow", "tofu"]) {
      assert.match(check.stdout, new RegExp(`^fail ${step} `, "m"), `${step} should be picked up in check mode`);
    }

    // Fix mode: auto-fixable ecosystems pass; workflow (check-only) stays red.
    const fix = run({ cmd: gateShim(), args: ["--fix"], cwd: root });
    assert.equal(fix.status, 1, "fix run still fails (workflow is check-only)");
    for (const step of ["node", "shell", "yaml", "tofu"]) {
      assert.match(fix.stdout, new RegExp(`^pass ${step} `, "m"), `${step} should pass after --fix`);
    }
    assert.match(fix.stdout, /^fail workflow /m, "workflow stays red after --fix (actionlint is check-only)");

    // Ignored file untouched: host .prettierignore covers dotfiles/nvim/.
    const ignored = await readFile(join(root, "dotfiles/nvim/lazy-lock.json"), "utf8");
    assert.equal(ignored, brokenFixtureFiles()["dotfiles/nvim/lazy-lock.json"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});