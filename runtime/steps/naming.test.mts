// Tests for steps/naming.mts: opt-in naming conventions step.
// Runner injected; no host binaries needed.
// Run: node --test steps/naming.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { runNamingStep } from "./naming.mts";
import { baseCtx, fakeRunner } from "../test-helpers.mts";

test("runNamingStep skips cleanly when not enabled", async () => {
    const { runner, calls } = fakeRunner({});
    const result = await runNamingStep({
        ctx: baseCtx,
        trackedFiles: ["a.sh"],
        runner,
        enabled: false,
    });
    assert.equal(result.status, "skip");
    assert.ok((result.notice ?? "").includes("not enabled"));
    assert.equal(calls.length, 0);
});

test("runNamingStep runs when enabled (placeholder implementation)", async () => {
    const { runner, calls } = fakeRunner({});
    const result = await runNamingStep({
        ctx: baseCtx,
        trackedFiles: ["a.sh"],
        runner,
        enabled: true,
    });
    assert.equal(result.status, "skip");
    assert.ok((result.notice ?? "").includes("placeholder"));
    assert.equal(calls.length, 0);
});
