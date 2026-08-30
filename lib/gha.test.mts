// Tests for lib/gha.mts: GitHub Actions output-file helpers.
// Run: node --test lib/gha.test.mts

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { appendToFile } from "./gha.mts";

test("appendToFile writes key=value lines when the env file exists", async () => {
    const dir = await mkdtemp(join(tmpdir(), "quality-gha-"));
    try {
        const file = join(dir, "GITHUB_OUTPUT");
        process.env.GITHUB_OUTPUT_TEST = file;
        await appendToFile({
            envName: "GITHUB_OUTPUT_TEST",
            lines: { a: "1", b: "two words" },
        });
        assert.equal(await readFile(file, "utf8"), "a=1\nb=two words\n");
    } finally {
        delete process.env.GITHUB_OUTPUT_TEST;
        await rm(dir, { recursive: true, force: true });
    }
});

test("appendToFile is a no-op when the env file is absent", async () => {
    delete process.env.GITHUB_OUTPUT_TEST2;
    await assert.doesNotReject(() =>
        appendToFile({ envName: "GITHUB_OUTPUT_TEST2", lines: { a: "1" } }),
    );
});
