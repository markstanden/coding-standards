// Tests for pipelines/dotnet-check-npm.mts: package.json detection.
// Run: node --test pipelines/dotnet-check-npm.test.mts

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { hasPackageJson } from "./dotnet-check-npm.mts";

test("hasPackageJson detects package.json presence", async () => {
    const dir = await mkdtemp(join(tmpdir(), "quality-check-npm-"));
    try {
        assert.equal(hasPackageJson({ webProjectPath: dir }), false);
        await writeFile(join(dir, "package.json"), "{}");
        assert.equal(hasPackageJson({ webProjectPath: dir }), true);
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
