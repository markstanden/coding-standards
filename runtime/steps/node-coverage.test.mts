// Tests for steps/node-coverage.mts: lcov parser + threshold gate.
// Runner injected, so no host binaries are needed here.
// Run: node --test steps/node-coverage.test.mts

import assert from "node:assert/strict";
import { mkdir, readFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import {
    checkThresholds,
    parseLcov,
    runNodeCoverageStep,
} from "./node-coverage.mts";
import { baseCtx, fakeRunner } from "../test-helpers.mts";

const SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

const tempDirs: string[] = [];

async function tempDir(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "quality-nc-"));
    tempDirs.push(dir);
    return dir;
}

async function writeLcov(dir: string, content: string): Promise<void> {
    await mkdir(join(dir, "coverage"), { recursive: true });
    await writeFile(join(dir, "coverage", "lcov.info"), content);
}

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map((dir) => rm(dir, { recursive: true, force: true })),
    );
});

// --- parseLcov ---

test("parseLcov extracts line totals from lcov content", () => {
    const content = [
        "SF:/src/index.ts",
        "DA:1,5",
        "DA:2,0",
        "DA:3,10",
        "end_of_record",
        "LF:3",
        "LH:2",
        "BRF:4",
        "BRH:3",
        "FNF:5",
        "FNH:4",
    ].join("\n");
    const summary = parseLcov({ content });
    assert.equal(summary.linesFound, 3);
    assert.equal(summary.linesHit, 2);
    assert.equal(summary.branchesFound, 4);
    assert.equal(summary.branchesHit, 3);
    assert.equal(summary.functionsFound, 5);
    assert.equal(summary.functionsHit, 4);
});

test("parseLcov aggregates across multiple source files", () => {
    const content = [
        "SF:/src/a.ts",
        "DA:1,5",
        "LF:2",
        "LH:1",
        "BRF:2",
        "BRH:1",
        "FNF:2",
        "FNH:1",
        "end_of_record",
        "SF:/src/b.ts",
        "DA:1,3",
        "LF:3",
        "LH:3",
        "BRF:4",
        "BRH:4",
        "FNF:3",
        "FNH:3",
        "end_of_record",
    ].join("\n");
    const summary = parseLcov({ content });
    assert.equal(summary.linesFound, 5);
    assert.equal(summary.linesHit, 4);
    assert.equal(summary.branchesFound, 6);
    assert.equal(summary.branchesHit, 5);
    assert.equal(summary.functionsFound, 5);
    assert.equal(summary.functionsHit, 4);
});

test("parseLcov returns zeros for empty content", () => {
    const summary = parseLcov({ content: "" });
    assert.equal(summary.linesFound, 0);
    assert.equal(summary.linesHit, 0);
    assert.equal(summary.branchesFound, 0);
    assert.equal(summary.branchesHit, 0);
    assert.equal(summary.functionsFound, 0);
    assert.equal(summary.functionsHit, 0);
});

// --- checkThresholds ---

test("checkThresholds passes when above threshold", () => {
    const result = checkThresholds({
        summary: {
            linesFound: 100,
            linesHit: 90,
            branchesFound: 0,
            branchesHit: 0,
            functionsFound: 0,
            functionsHit: 0,
        },
        thresholds: { line: 80 },
    });
    assert.equal(result.pass, true);
    assert.equal(result.failures.length, 0);
});

test("checkThresholds fails when below threshold", () => {
    const result = checkThresholds({
        summary: {
            linesFound: 100,
            linesHit: 70,
            branchesFound: 0,
            branchesHit: 0,
            functionsFound: 0,
            functionsHit: 0,
        },
        thresholds: { line: 80 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /line:.*70\.0%.*80%/u);
});

test("checkThresholds checks branch when configured", () => {
    const result = checkThresholds({
        summary: {
            linesFound: 100,
            linesHit: 90,
            branchesFound: 50,
            branchesHit: 30,
            functionsFound: 0,
            functionsHit: 0,
        },
        thresholds: { line: 80, branch: 70 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /branch:.*60\.0%.*70%/u);
});

test("checkThresholds checks function when configured", () => {
    const result = checkThresholds({
        summary: {
            linesFound: 100,
            linesHit: 90,
            branchesFound: 0,
            branchesHit: 0,
            functionsFound: 10,
            functionsHit: 5,
        },
        thresholds: { line: 80, function: 70 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /function:.*50\.0%.*70%/u);
});

test("checkThresholds reports multiple failures", () => {
    const result = checkThresholds({
        summary: {
            linesFound: 100,
            linesHit: 50,
            branchesFound: 100,
            branchesHit: 50,
            functionsFound: 10,
            functionsHit: 4,
        },
        thresholds: { line: 80, branch: 70, function: 60 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 3);
});

test("checkThresholds treats zero lines found as 0%", () => {
    const result = checkThresholds({
        summary: {
            linesFound: 0,
            linesHit: 0,
            branchesFound: 0,
            branchesHit: 0,
            functionsFound: 0,
            functionsHit: 0,
        },
        thresholds: { line: 80 },
    });
    assert.equal(result.pass, false);
});

// --- runNodeCoverageStep ---

test("skips when no coverage.node in config", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({ version: SHA }),
    );
    const { runner, calls } = fakeRunner({});
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "skip");
    assert.equal(calls.length, 0);
});

test("skips when no .defined.json exists", async () => {
    const dir = await tempDir();
    const { runner, calls } = fakeRunner({});
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "skip");
    assert.equal(calls.length, 0);
});

test("fails when fix mode command fails", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: { node: { command: "false" } },
        }),
    );
    const { runner } = fakeRunner({ sh: { status: 1, stderr: "boom" } });
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, mode: "fix", repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "fail");
    assert.match(result.notice ?? "", /coverage command failed/u);
});

test("fails when no lcov.info after fix mode command", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: { node: { command: "echo ok" } },
        }),
    );
    const { runner } = fakeRunner({ sh: { status: 0 } });
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, mode: "fix", repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "fail");
    assert.match(result.notice ?? "", /no coverage report/u);
});

test("passes when coverage meets default 80% threshold", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: { node: { command: "npm t" } },
        }),
    );
    await writeLcov(dir, ["LF:100", "LH:85"].join("\n"));
    const { runner } = fakeRunner({});
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.match(result.notice ?? "", /85\.0%/u);
});

test("fails when coverage below default 80% threshold", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: { node: { command: "npm t" } },
        }),
    );
    await writeLcov(dir, ["LF:100", "LH:50"].join("\n"));
    const { runner } = fakeRunner({});
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "fail");
    assert.match(result.notice ?? "", /50\.0%.*80%/u);
});

test("uses custom threshold when configured", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: {
                node: { command: "npm t", thresholds: { line: 50 } },
            },
        }),
    );
    await writeLcov(dir, ["LF:100", "LH:60"].join("\n"));
    const { runner } = fakeRunner({});
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.match(result.notice ?? "", /60\.0%/u);
});

test("no-fix mode does not run the coverage command", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: { node: { command: "npm t" } },
        }),
    );
    await writeLcov(dir, ["LF:100", "LH:90"].join("\n"));
    const { runner, calls } = fakeRunner({});
    const result = await runNodeCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.equal(calls.filter((c) => c[0] === "sh").length, 0);
});

test("fix mode runs the consumer command", async () => {
    const dir = await tempDir();
    await writeFile(
        join(dir, ".defined.json"),
        JSON.stringify({
            version: SHA,
            coverage: { node: { command: "npm run test:coverage" } },
        }),
    );
    await writeLcov(dir, ["LF:100", "LH:90"].join("\n"));
    const { runner, calls } = fakeRunner({ sh: { status: 0 } });
    await runNodeCoverageStep({
        ctx: { ...baseCtx, mode: "fix", repoRoot: dir },
        trackedFiles: ["package.json"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]![0], "sh");
    assert.equal(calls[0]![1], "-c");
    assert.equal(calls[0]![2], "npm run test:coverage");
});
