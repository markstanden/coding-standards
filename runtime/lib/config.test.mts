// Tests for lib/config.mts: .defined.json reader and typed configuration.
// Run: node --test lib/config.test.mts

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { loadConfig } from "./config.mts";

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map((dir) => rm(dir, { recursive: true, force: true })),
    );
});

async function tempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "quality-config-"));
    tempDirs.push(dir);
    return dir;
}

async function writeConfig(
    dir: string,
    content: string,
): Promise<void> {
    await writeFile(join(dir, ".defined.json"), content);
}

const SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

test("loadConfig returns empty config when file is absent", async () => {
    const dir = await tempDir();
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.version, "");
    assert.equal(config.coverage, undefined);
});

test("loadConfig parses version-only config", async () => {
    const dir = await tempDir();
    await writeConfig(dir, JSON.stringify({ version: SHA }));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.version, SHA);
    assert.equal(config.coverage, undefined);
});

test("loadConfig parses full config with coverage thresholds", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: {
            node: {
                command: "npm run test:coverage",
                thresholds: { line: 80, branch: 70, function: 90 },
            },
            dotnet: {
                command: "dotnet test --collect:XPlat",
                thresholds: { line: 85 },
            },
        },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.version, SHA);
    assert.equal(config.coverage?.node?.command, "npm run test:coverage");
    assert.equal(config.coverage?.node?.thresholds?.line, 80);
    assert.equal(config.coverage?.node?.thresholds?.branch, 70);
    assert.equal(config.coverage?.node?.thresholds?.function, 90);
    assert.equal(config.coverage?.dotnet?.command, "dotnet test --collect:XPlat");
    assert.equal(config.coverage?.dotnet?.thresholds?.line, 85);
    assert.equal(config.coverage?.dotnet?.thresholds?.branch, undefined);
});

test("loadConfig parses coverage entry without thresholds", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: {
            node: { command: "npm run test:coverage" },
        },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.coverage?.node?.command, "npm run test:coverage");
    assert.equal(config.coverage?.node?.thresholds, undefined);
});

test("loadConfig rejects invalid JSON", async () => {
    const dir = await tempDir();
    await writeConfig(dir, "{ not valid json }");
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /invalid JSON/u,
    );
});

test("loadConfig rejects non-object root", async () => {
    const dir = await tempDir();
    await writeConfig(dir, JSON.stringify("just a string"));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a JSON object/u,
    );
});

test("loadConfig rejects array root", async () => {
    const dir = await tempDir();
    await writeConfig(dir, JSON.stringify([1, 2, 3]));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a JSON object/u,
    );
});

test("loadConfig rejects missing version", async () => {
    const dir = await tempDir();
    await writeConfig(dir, JSON.stringify({ coverage: {} }));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects short SHA", async () => {
    const dir = await tempDir();
    await writeConfig(dir, JSON.stringify({ version: "abc123" }));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects non-hex version", async () => {
    const dir = await tempDir();
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
    const dir = await tempDir();
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
    const dir = await tempDir();
    await writeConfig(dir, JSON.stringify({ version: 1234567 }));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"version" must be a 7–40 character hex SHA/u,
    );
});

test("loadConfig rejects coverage with unknown ecosystem", async () => {
    const dir = await tempDir();
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
    const dir = await tempDir();
    const cfg = { version: SHA, coverage: { node: {} } };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"coverage.node.command" must be a non-empty string/u,
    );
});

test("loadConfig rejects coverage entry with empty command", async () => {
    const dir = await tempDir();
    const cfg = { version: SHA, coverage: { node: { command: "  " } } };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /"coverage.node.command" must be a non-empty string/u,
    );
});

test("loadConfig rejects threshold out of range", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", thresholds: { line: 101 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a number 0–100/u,
    );
});

test("loadConfig rejects negative threshold", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", thresholds: { line: -5 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /must be a number 0–100/u,
    );
});

test("loadConfig rejects unknown threshold metric", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", thresholds: { statements: 80 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    await assert.rejects(
        () => loadConfig({ repoRoot: dir }),
        /unknown threshold metric "statements"/u,
    );
});

test("loadConfig accepts threshold of exactly 0", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", thresholds: { line: 0 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.coverage?.node?.thresholds?.line, 0);
});

test("loadConfig accepts threshold of exactly 100", async () => {
    const dir = await tempDir();
    const cfg = {
        version: SHA,
        coverage: { node: { command: "npm t", thresholds: { line: 100 } } },
    };
    await writeConfig(dir, JSON.stringify(cfg));
    const config = await loadConfig({ repoRoot: dir });
    assert.equal(config.coverage?.node?.thresholds?.line, 100);
});
