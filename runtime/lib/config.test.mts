// Tests for lib/config.mts: .defined.json reader and typed configuration.
// Run: node --test lib/config.test.mts

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import { afterEach, test } from "node:test";

import { loadConfig } from "./config.mts";
import { cleanupTempDirs, makeTempDir, TEST_SHA } from "../test-helpers.mts";

afterEach(cleanupTempDirs);

async function writeConfig(dir: string, content: string): Promise<void> {
    await writeFile(`${dir}/.defined.json`, content);
}

const SHA = TEST_SHA;

test("loadConfig returns empty config when file is absent", async () => {
    const dir = await makeTempDir("quality-config-");
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.version, "");
    assert.equal(config.coverage, undefined);
});

test("loadConfig parses version-only config", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, JSON.stringify({ version: SHA }));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.version, SHA);
    assert.equal(config.coverage, undefined);
});

test("loadConfig parses full config with coverage minimums", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: {
            node: {
                command: "npm run test:coverage",
                minimums: { line: 80, branch: 70, function: 90 },
            },
            dotnet: {
                command: "dotnet test --collect:XPlat",
                minimums: { line: 85 },
            },
        },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.version, SHA);
    assert.equal(config.coverage?.node?.command, "npm run test:coverage");
    assert.equal(config.coverage?.node?.minimums?.line, 80);
    assert.equal(config.coverage?.node?.minimums?.branch, 70);
    assert.equal(config.coverage?.node?.minimums?.function, 90);
    assert.equal(
        config.coverage?.dotnet?.command,
        "dotnet test --collect:XPlat",
    );
    assert.equal(config.coverage?.dotnet?.minimums?.line, 85);
    assert.equal(config.coverage?.dotnet?.minimums?.branch, undefined);
});

test("loadConfig parses coverage entry without minimums", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: {
            node: { command: "npm run test:coverage" },
        },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.coverage?.node?.command, "npm run test:coverage");
    assert.equal(config.coverage?.node?.minimums, undefined);
});

test("loadConfig rejects invalid JSON", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, "{ not valid json }");
    await assert.rejects(() => loadConfig({ repoRoot: dir }), /invalid JSON/u);
});

test("loadConfig rejects non-object root", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, JSON.stringify("just a string"));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a JSON object/u,
    );
});

test("loadConfig rejects array root", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, JSON.stringify([1, 2, 3]));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a JSON object/u,
    );
});

test("loadConfig rejects missing version", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, JSON.stringify({ coverage: {} }));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects short SHA", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, JSON.stringify({ version: "abc123" }));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects non-hex version", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(
        dir,
        JSON.stringify({ version: "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz" }),
    );
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects version with uppercase", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(
        dir,
        JSON.stringify({ version: "A1B2C3D4E5F6A1B2C3D4E5F6A1B2C3D4E5F6A1B2" }),
    );
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects non-string version", async () => {
    const dir = await makeTempDir("quality-config-");
    await writeConfig(dir, JSON.stringify({ version: 1234567 }));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects coverage with unknown ecosystem", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: { rust: { command: "cargo tarpaulin" } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /unknown coverage ecosystem "rust"/u,
    );
});

test("loadConfig rejects coverage entry with missing command", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = { version: SHA, coverage: { node: {} } };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"coverage.node.command" must be a non-empty string/u,
    );
});

test("loadConfig rejects coverage entry with empty command", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = { version: SHA, coverage: { node: { command: "  " } } };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"coverage.node.command" must be a non-empty string/u,
    );
});

test("loadConfig rejects minimum out of range", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", minimums: { line: 101 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a number 0–100/u,
    );
});

test("loadConfig rejects negative minimum", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", minimums: { line: -5 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a number 0–100/u,
    );
});

test("loadConfig rejects unknown minimum metric", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", minimums: { statements: 80 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /unknown minimum metric "statements"/u,
    );
});

test("loadConfig accepts minimum of exactly 0", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", minimums: { line: 0 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.coverage?.node?.minimums?.line, 0);
});

test("loadConfig accepts minimum of exactly 100", async () => {
    const dir = await makeTempDir("quality-config-");
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", minimums: { line: 100 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.coverage?.node?.minimums?.line, 100);
});
