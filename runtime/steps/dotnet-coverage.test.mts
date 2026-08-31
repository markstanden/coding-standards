// Tests for steps/dotnet-coverage.mts: Cobertura parser + minimum gate.
// Runner injected, so no host binaries are needed here.
// Run: node --test steps/dotnet-coverage.test.mts

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { afterEach, test } from "node:test";

import {
    checkMinimums,
    parseCobertura,
    runDotNetCoverageStep,
} from "./dotnet-coverage.mts";
import {
    baseCtx,
    cleanupTempDirs,
    fakeRunner,
    makeTempDir,
    setupCoverageRepo,
    TEST_SHA,
} from "../test-helpers.mts";

afterEach(cleanupTempDirs);

const SAMPLE_XML = `<?xml version="1.0" encoding="utf-8"?>
<coverage line-rate="0.85" branch-rate="0.7" version="1.9" timestamp="1234" lines-covered="85" lines-valid="100" branches-covered="35" branches-valid="50">
  <sources><source>/src</source></sources>
  <packages>
    <package name="MyLib" line-rate="0.85" branch-rate="0.7" complexity="10">
      <classes>
        <class name="Foo" filename="Foo.cs" line-rate="0.85" branch-rate="0.7">
          <methods>
            <method name="Bar" signature="()" line-rate="1" branch-rate="1">
              <lines>
                <line number="1" hits="5"/>
              </lines>
            </method>
          </methods>
          <lines>
            <line number="1" hits="5"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>`;

// --- parseCobertura ---

test("parseCobertura extracts line and branch rates", () => {
    const summary = parseCobertura({ content: SAMPLE_XML });
    assert.equal(summary.lineRate, 0.85);
    assert.equal(summary.branchRate, 0.7);
});

test("parseCobertura handles integer-style rates", () => {
    const xml = '<coverage line-rate="1" branch-rate="0.5"></coverage>';
    const summary = parseCobertura({ content: xml });
    assert.equal(summary.lineRate, 1);
    assert.equal(summary.branchRate, 0.5);
});

test("parseCobertura returns zero when rates absent", () => {
    const xml = "<coverage></coverage>";
    const summary = parseCobertura({ content: xml });
    assert.equal(summary.lineRate, 0);
    assert.equal(summary.branchRate, undefined);
});

test("parseCobertura returns zero for empty content", () => {
    const summary = parseCobertura({ content: "" });
    assert.equal(summary.lineRate, 0);
    assert.equal(summary.branchRate, undefined);
});

// --- checkMinimums ---

test("checkMinimums passes when above line minimum", () => {
    const result = checkMinimums({
        summary: { lineRate: 0.9, branchRate: 0.8 },
        minimums: { line: 80 },
    });
    assert.equal(result.pass, true);
    assert.equal(result.failures.length, 0);
});

test("checkMinimums fails when below line minimum", () => {
    const result = checkMinimums({
        summary: { lineRate: 0.7, branchRate: 0.8 },
        minimums: { line: 80 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /line:.*70\.0%.*80%/u);
});

test("checkMinimums checks branch when configured", () => {
    const result = checkMinimums({
        summary: { lineRate: 0.9, branchRate: 0.6 },
        minimums: { line: 80, branch: 70 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /branch:.*60\.0%.*70%/u);
});

test("checkMinimums fails on missing branch data when branch minimum configured", () => {
    const result = checkMinimums({
        summary: { lineRate: 0.9, branchRate: undefined },
        minimums: { line: 80, branch: 70 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /no branch-rate data/u);
});

test("checkMinimums fails on function minimum (no function data in Cobertura)", () => {
    const result = checkMinimums({
        summary: { lineRate: 0.9, branchRate: 0.8 },
        minimums: { line: 80, function: 70 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 1);
    assert.match(result.failures[0]!, /no function coverage/u);
});

test("checkMinimums reports multiple failures", () => {
    const result = checkMinimums({
        summary: { lineRate: 0.5, branchRate: 0.5 },
        minimums: { line: 80, branch: 70 },
    });
    assert.equal(result.pass, false);
    assert.equal(result.failures.length, 2);
});

// --- runDotNetCoverageStep ---

test("skips when no coverage.dotnet in config", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({ root: dir, config: { version: TEST_SHA } });
    const { runner, calls } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "skip");
    assert.equal(calls.length, 0);
});

test("skips when no .defined.json exists", async () => {
    const dir = await makeTempDir("quality-dc-");
    const { runner, calls } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "skip");
    assert.equal(calls.length, 0);
});

test("fails when fix mode command fails", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "false" } },
        },
    });
    const { runner } = fakeRunner({ sh: { status: 1, stderr: "boom" } });
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, mode: "fix", repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "fail");
    assert.match(result.notice ?? "", /coverage command failed/u);
});

test("fails when no cobertura report after fix mode command", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "echo ok" } },
        },
    });
    const { runner } = fakeRunner({ sh: { status: 0 } });
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, mode: "fix", repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "fail");
    assert.match(result.notice ?? "", /no coverage report/u);
});

test("passes when coverage meets default 80% minimum (root report)", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "dotnet test" } },
        },
        reportPath: "coverage.cobertura.xml",
        reportContent: SAMPLE_XML,
    });
    const { runner } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.match(result.notice ?? "", /85\.0%/u);
});

test("passes when coverage report lives under TestResults/", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "dotnet test" } },
        },
        reportPath: "TestResults/coverage.cobertura.xml",
        reportContent: SAMPLE_XML,
    });
    const { runner } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.match(result.notice ?? "", /85\.0%/u);
});

test("fails when coverage below default 80% line minimum", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "dotnet test" } },
        },
        reportPath: "coverage.cobertura.xml",
        reportContent:
            '<coverage line-rate="0.5" branch-rate="0.5"></coverage>',
    });
    const { runner } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "fail");
    assert.match(result.notice ?? "", /50\.0%.*80%/u);
});

test("uses custom minimum when configured", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: {
                dotnet: { command: "dotnet test", minimums: { line: 50 } },
            },
        },
        reportPath: "coverage.cobertura.xml",
        reportContent:
            '<coverage line-rate="0.6" branch-rate="0.5"></coverage>',
    });
    const { runner } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.match(result.notice ?? "", /60\.0%/u);
});

test("no-fix mode does not run the coverage command", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "dotnet test" } },
        },
        reportPath: "coverage.cobertura.xml",
        reportContent: SAMPLE_XML,
    });
    const { runner, calls } = fakeRunner({});
    const result = await runDotNetCoverageStep({
        ctx: { ...baseCtx, repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(result.status, "pass");
    assert.equal(calls.filter((c) => c[0] === "sh").length, 0);
});

test("fix mode runs the consumer command", async () => {
    const dir = await makeTempDir("quality-dc-");
    await setupCoverageRepo({
        root: dir,
        config: {
            version: TEST_SHA,
            coverage: { dotnet: { command: "dotnet run coverage" } },
        },
        reportPath: "coverage.cobertura.xml",
        reportContent: SAMPLE_XML,
    });
    const { runner, calls } = fakeRunner({ sh: { status: 0 } });
    await runDotNetCoverageStep({
        ctx: { ...baseCtx, mode: "fix", repoRoot: dir },
        trackedFiles: ["App.csproj"],
        runner,
        readFileFn: readFile,
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0]![0], "sh");
    assert.equal(calls[0]![1], "-c");
    assert.equal(calls[0]![2], "dotnet run coverage");
});
