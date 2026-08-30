// Tests for steps/tofu.mts: OpenTofu fmt, tflint, init, validate.
// Runner injected; no host binaries needed.
// Run: node --test steps/tofu.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { filterTofuFiles, runTofuStep } from "./tofu.mts";
import { baseCtx, fakeRunner } from "../test-helpers.mts";

test("filterTofuFiles finds .tf files", () => {
    assert.deepEqual(
        filterTofuFiles({
            files: ["main.tf", "variables.tf", "a.sh", "b.yml"],
        }),
        ["main.tf", "variables.tf"],
    );
});

test("runTofuStep skips when no .tf files tracked", async () => {
    const { runner, calls } = fakeRunner({}, true);
    const result = await runTofuStep({
        ctx: baseCtx,
        trackedFiles: ["a.sh", "b.yml"],
        runner,
    });
    assert.equal(result.status, "skip");
    assert.equal(calls.length, 0);
});

test("check mode runs fmt -check, tflint init+lint, init, validate", async () => {
    const { runner, calls } = fakeRunner({}, true);
    const result = await runTofuStep({
        ctx: baseCtx,
        trackedFiles: ["main.tf"],
        runner,
    });
    assert.equal(result.status, "pass");
    const cmds = calls.map((c) => `${c[0]} ${c[1]}`);
    assert.deepEqual(cmds, [
        "tofu fmt",
        "tflint --init",
        "tflint /repo",
        "tofu init",
        "tofu validate",
    ]);
});

test("fix mode runs fmt -write then re-check, tflint --fix, init, validate", async () => {
    const { runner, calls } = fakeRunner({}, true);
    const result = await runTofuStep({
        ctx: { ...baseCtx, mode: "fix" },
        trackedFiles: ["main.tf"],
        runner,
    });
    assert.equal(result.status, "pass");
    const cmds = calls.map((c) => `${c[0]} ${c[1]}`);
    assert.deepEqual(cmds, [
        "tofu fmt",
        "tofu fmt",
        "tflint --init",
        "tflint --fix",
        "tflint /repo",
        "tofu init",
        "tofu validate",
    ]);
    assert.equal(calls[0]![2], "-write");
    assert.equal(calls[1]![2], "-check");
});

type Outcome = { status?: number; stdout?: string; stderr?: string };
type FailureCase = {
    name: string;
    outcomes: Record<string, Outcome>;
    mode?: "fix";
    notice: string;
};

const failureCases: FailureCase[] = [
    {
        name: "fmt failure in fix mode",
        outcomes: { "tofu fmt": { status: 1, stderr: "fmt error" } },
        mode: "fix",
        notice: "tofu: fmt",
    },
    {
        name: "fmt check failure",
        outcomes: { "tofu fmt": { status: 1 } },
        notice: "tofu: fmt",
    },
    {
        name: "tflint init failure",
        outcomes: { "tflint --init": { status: 1, stderr: "plugin error" } },
        notice: "tflint --init",
    },
    {
        name: "tflint issues",
        outcomes: {
            "tflint --init": { status: 0 },
            tflint: { status: 2, stdout: "2 issue(s) found" },
        },
        notice: "2 issue(s) found",
    },
    {
        name: "init failure",
        outcomes: { "tofu init": { status: 1, stderr: "init error" } },
        notice: "tofu: init",
    },
    {
        name: "validate failure",
        outcomes: {
            "tofu validate": { status: 1, stdout: "validation error" },
        },
        notice: "tofu: validate",
    },
];

for (const c of failureCases) {
    test(`${c.name} fails the step`, async () => {
        const { runner } = fakeRunner(c.outcomes, true);
        const result = await runTofuStep({
            ctx: c.mode === "fix" ? { ...baseCtx, mode: "fix" } : baseCtx,
            trackedFiles: ["main.tf"],
            runner,
        });
        assert.equal(result.status, "fail");
        assert.ok((result.notice ?? "").includes(c.notice));
    });
}
