// Tests for pipelines/tofu-outputs.mts: JSON fallback, artifact write, and
// verifyOutputsFile error modes. Runner injected; file assertions in temp dirs.
// Run: node --test pipelines/tofu-outputs.test.mts

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import type { Runner } from "../lib/proc.mts";

import { collectTofuOutputs, verifyOutputsFile } from "./tofu-outputs.mts";

function scriptedRunner(stdout: string): { runner: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args }: { cmd: string; args: string[] }) => {
    calls.push([cmd, ...args]);
    return { status: 0, stdout, stderr: "" };
  }) as Runner;
  return { runner, calls };
}

test("collects keys and writes the raw outputs JSON to the artifact", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tofu-out-"));
  try {
    const raw = '{"url":{"value":"https://x"},"token":{"value":"t"}}';
    const { runner, calls } = scriptedRunner(raw);
    const { keys, artifactPath } = await collectTofuOutputs({ infraDir: dir, runner });
    assert.deepEqual(keys, ["url", "token"]);
    assert.ok(artifactPath.endsWith("tofu_outputs.json"));
    assert.equal(await readFile(artifactPath, "utf8"), raw);
    assert.deepEqual(calls[0], ["tofu", "output", "-json"]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("falls back to empty keys when output JSON is unparseable", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tofu-out-"));
  try {
    const { runner } = scriptedRunner("not json");
    const { keys, artifactPath } = await collectTofuOutputs({ infraDir: dir, runner });
    assert.deepEqual(keys, []);
    assert.equal(await readFile(artifactPath, "utf8"), "not json");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifyOutputsFile resolves on a non-empty file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tofu-verify-"));
  try {
    const path = join(dir, "out.json");
    await writeFile(path, "{}", "utf8");
    await verifyOutputsFile({ artifactPath: path });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifyOutputsFile rejects an empty file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tofu-verify-"));
  try {
    const path = join(dir, "out.json");
    await writeFile(path, "  ", "utf8");
    await assert.rejects(verifyOutputsFile({ artifactPath: path }), /outputs file is empty/u);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("verifyOutputsFile rejects a missing file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "tofu-verify-"));
  try {
    await assert.rejects(
      verifyOutputsFile({ artifactPath: join(dir, "nope.json") }),
      /outputs file does not exist/u,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});