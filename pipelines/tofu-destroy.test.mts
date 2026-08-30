// Tests for pipelines/tofu-destroy.mts: workspace select gating and destroy
// failure handling. Runner injected, no host tofu.
// Run: node --test pipelines/tofu-destroy.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { runTofuDestroy } from "./tofu-destroy.mts";
import { scriptedRunner } from "./test-helpers.mts";

test("returns false without destroying when a non-default workspace is absent", () => {
    const { runner, calls } = scriptedRunner({
        "tofu workspace select dev": { status: 1 },
    });
    assert.equal(
        runTofuDestroy({ infraDir: "/repo/infra", buildEnv: "dev", runner }),
        false,
    );
    assert.ok(!calls.some((c) => c[1] === "destroy"));
});

test("destroys the default workspace in place", () => {
    const { runner, calls } = scriptedRunner({});
    assert.equal(
        runTofuDestroy({
            infraDir: "/repo/infra",
            buildEnv: "default",
            runner,
        }),
        true,
    );
    assert.ok(calls.some((c) => c[1] === "destroy"));
});

test("throws on destroy failure, including the state listing for diagnostics", () => {
    const { runner } = scriptedRunner({
        "tofu destroy -auto-approve -input=false": {
            status: 1,
            stderr: "boom",
        },
    });
    assert.throws(
        () =>
            runTofuDestroy({
                infraDir: "/repo/infra",
                buildEnv: "default",
                runner,
            }),
        /tofu destroy failed \(1\):\nboom/u,
    );
});
