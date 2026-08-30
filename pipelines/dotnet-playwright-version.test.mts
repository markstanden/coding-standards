// Tests for pipelines/dotnet-playwright-version.mts: Playwright version detection.
// Run: node --test pipelines/dotnet-playwright-version.test.mts

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { detectPlaywrightVersion } from "./dotnet-playwright-version.mts";

async function makeTemp(): Promise<string> {
    return mkdtemp(join(tmpdir(), "quality-pwver-"));
}

test("reads the version from packages.lock.json", async () => {
    const dir = await makeTemp();
    try {
        await writeFile(
            join(dir, "packages.lock.json"),
            JSON.stringify({
                dependencies: {
                    "Microsoft.Playwright": {
                        resolved: "1.44.0",
                        requested: "[1.44.0, )",
                    },
                },
            }),
        );
        assert.equal(
            await detectPlaywrightVersion({ projectDir: dir }),
            "1.44.0",
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("falls back to project.assets.json when no lock file version", async () => {
    const dir = await makeTemp();
    try {
        await mkdir(join(dir, "obj"), { recursive: true });
        await writeFile(
            join(dir, "obj", "project.assets.json"),
            JSON.stringify({
                libraries: {
                    "Microsoft.Playwright/1.45.1": { type: "package" },
                },
            }),
        );
        assert.equal(
            await detectPlaywrightVersion({ projectDir: dir }),
            "1.45.1",
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("returns empty when nothing yields a version", async () => {
    const dir = await makeTemp();
    try {
        assert.equal(await detectPlaywrightVersion({ projectDir: dir }), "");
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
