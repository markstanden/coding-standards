// Tests for pipelines/tofu-plan.mts: exit-code passthrough and arg
// construction. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-plan.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { runTofuPlan } from "./tofu-plan.mts";
import { scriptedRunner } from "./test-helpers.mts";

test("returns 0 on no changes and 2 on changes detected", () => {
    assert.equal(
        runTofuPlan({
            infraDir: "/repo/infra",
            runner: scriptedRunner({}).runner,
        }),
        0,
    );
    assert.equal(
        runTofuPlan({
            infraDir: "/repo/infra",
            runner: scriptedRunner({
                "tofu plan -detailed-exitcode -no-color -out=tfplan": {
                    status: 2,
                },
            }).runner,
        }),
        2,
    );
});

test("returns 1 (error) as-is for the caller to gate on", () => {
    assert.equal(
        runTofuPlan({
            runner: scriptedRunner({
                "tofu plan -detailed-exitcode -no-color -out=tfplan": {
                    status: 1,
                    stdout: "boom",
                },
            }).runner,
        }),
        1,
    );
});

test("passes detailed-exitcode, no-color and out=tfplan", () => {
    const { runner, calls } = scriptedRunner({});
    runTofuPlan({ runner });
    assert.deepEqual(calls[0], [
        "tofu",
        "plan",
        "-detailed-exitcode",
        "-no-color",
        "-out=tfplan",
    ]);
});
