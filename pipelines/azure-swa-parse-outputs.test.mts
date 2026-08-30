// Tests for pipelines/azure-swa-parse-outputs.mts: outputs JSON parsing.
// Run: node --test pipelines/azure-swa-parse-outputs.test.mts

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { parseInfrastructureOutputs } from "./azure-swa-parse-outputs.mts";

async function makeTemp(): Promise<string> {
    return mkdtemp(join(tmpdir(), "quality-swa-parse-"));
}

test("extracts the token value from tofu outputs", async () => {
    const dir = await makeTemp();
    try {
        const file = join(dir, "outputs.json");
        await writeFile(
            file,
            JSON.stringify({
                azure_static_web_app_api_token: {
                    value: "secret-token",
                    sensitive: true,
                },
            }),
        );
        const result = await parseInfrastructureOutputs({
            outputFilename: file,
            tokenKey: "azure_static_web_app_api_token",
        });
        assert.equal(result.token, "secret-token");
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("extracts an optional URL alongside the token", async () => {
    const dir = await makeTemp();
    try {
        const file = join(dir, "outputs.json");
        await writeFile(
            file,
            JSON.stringify({
                azure_static_web_app_api_token: { value: "t" },
                static_web_app_url: { value: "https://site" },
            }),
        );
        const result = await parseInfrastructureOutputs({
            outputFilename: file,
            tokenKey: "azure_static_web_app_api_token",
            urlKey: "static_web_app_url",
        });
        assert.equal(result.url, "https://site");
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("throws naming the missing key and available keys", async () => {
    const dir = await makeTemp();
    try {
        const file = join(dir, "outputs.json");
        await writeFile(file, JSON.stringify({ other: { value: "x" } }));
        await assert.rejects(
            () =>
                parseInfrastructureOutputs({
                    outputFilename: file,
                    tokenKey: "missing_key",
                }),
            /missing_key\.value not found.*Available top-level keys: other/u,
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});

test("throws on invalid JSON", async () => {
    const dir = await makeTemp();
    try {
        const file = join(dir, "outputs.json");
        await writeFile(file, "{nope");
        await assert.rejects(
            () =>
                parseInfrastructureOutputs({
                    outputFilename: file,
                    tokenKey: "k",
                }),
            /invalid JSON/u,
        );
    } finally {
        await rm(dir, { recursive: true, force: true });
    }
});
