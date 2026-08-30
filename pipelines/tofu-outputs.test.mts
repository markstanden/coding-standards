// Tests for pipelines/tofu-outputs.mts: JSON fallback, artifact write, and
// verifyOutputsFile error modes. Runner injected; file assertions in temp dirs.
// Run: node --test pipelines/tofu-outputs.test.mts

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { collectTofuOutputs, verifyOutputsFile } from "./tofu-outputs.mts";
import { scriptedRunner } from "./test-helpers.mts";

test("collects keys and writes the raw outputs JSON to the artifact", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tofu-out-"));
    try {
        const raw =
            '{"url":{"value":"https://site.example.com"},"token":{"value":"s3cr3t-t0ken-value"}}';
        const { runner, calls } = scriptedRunner({
            "tofu output -json": { stdout: raw },
        });
        const { keys, artifactPath } = await collectTofuOutputs({
            infraDir: dir,
            runner,
        });
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
        const { runner } = scriptedRunner({
            "tofu output -json": { stdout: "not json" },
        });
        const { keys, artifactPath } = await collectTofuOutputs({
            infraDir: dir,
            runner,
        });
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
        await assert.doesNotReject(verifyOutputsFile({ artifactPath: path }));
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("verifyOutputsFile rejects an empty file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "tofu-verify-"));
    try {
        const path = join(dir, "out.json");
        await writeFile(path, "  ", "utf8");
        await assert.rejects(
            verifyOutputsFile({ artifactPath: path }),
            /outputs file is empty/u,
        );
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
