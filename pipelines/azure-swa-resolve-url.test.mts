// Tests for pipelines/azure-swa-resolve-url.mts: deployment URL resolution.
// Run: node --test pipelines/azure-swa-resolve-url.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveDeploymentUrl } from "./azure-swa-resolve-url.mts";

test("resolveDeploymentUrl prefers the SWA action URL", () => {
    assert.equal(
        resolveDeploymentUrl({ swaUrl: "https://a", outputsUrl: "https://b" }),
        "https://a",
    );
    assert.equal(
        resolveDeploymentUrl({ swaUrl: "", outputsUrl: "https://b" }),
        "https://b",
    );
});

test("resolveDeploymentUrl throws when no URL is available", () => {
    assert.throws(
        () => resolveDeploymentUrl({ swaUrl: "", outputsUrl: "" }),
        /No deployment URL/u,
    );
});
