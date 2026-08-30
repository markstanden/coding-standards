// Tests for pipelines/dotnet-summary.mts: summary block rendering.
// Run: node --test pipelines/dotnet-summary.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { summaryBlock } from "./dotnet-summary.mts";

test("summaryBlock renders heading + outcome", () => {
    assert.equal(
        summaryBlock({ heading: "Build Results", status: "success" }),
        "### Build Results\nBuild Results: succeeded",
    );
    assert.equal(
        summaryBlock({ heading: "Tests", status: "failure" }),
        "### Tests\nTests: failed",
    );
});
