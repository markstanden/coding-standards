// Tests for lib/json.mts: safe JSON file reading.
// Run: node --test lib/json.test.mts

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { readJsonFile, tofuOutputValue } from "./json.mts";

async function makeTemp(): Promise<string> {
    return mkdtemp(join(tmpdir(), "quality-json-"));
}

test("readJsonFile parses a valid file", async () => {
    const dir = await makeTemp();
    try {
        const file = join(dir, "data.json");
        await writeFile(file, '{"a": 1}');
        assert.deepEqual(
            await readJsonFile<{ a: number }>({ filePath: file }),
            { a: 1 },
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("readJsonFile throws naming the missing file", async () => {
    const dir = await makeTemp();
    try {
        await assert.rejects(
            () => readJsonFile({ filePath: join(dir, "absent.json") }),
            /not found/u,
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("readJsonFile throws naming invalid JSON", async () => {
    const dir = await makeTemp();
    try {
        const file = join(dir, "bad.json");
        await writeFile(file, "{oops");
        await assert.rejects(
            () => readJsonFile({ filePath: file }),
            /invalid JSON/u,
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("tofuOutputValue extracts the .value field", () => {
    const outputs = { key: { value: "v", sensitive: true } };
    assert.equal(tofuOutputValue({ outputs, key: "key" }), "v");
});

test("tofuOutputValue returns undefined for an absent key", () => {
    const outputs = { other: { value: "x" } };
    assert.equal(tofuOutputValue({ outputs, key: "missing" }), undefined);
});
