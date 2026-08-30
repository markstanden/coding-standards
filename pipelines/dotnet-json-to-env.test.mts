// Tests for pipelines/dotnet-json-to-env.mts: env-file JSON flattening.
// Run: node --test pipelines/dotnet-json-to-env.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { envLinesFromJson } from "./dotnet-json-to-env.mts";

test("envLinesFromJson flattens an object to KEY=value lines", () => {
    assert.deepEqual(envLinesFromJson('{"A":"1","B":"two words"}'), [
        "A=1",
        "B=two words",
    ]);
});

test("envLinesFromJson rejects non-object input", () => {
    assert.throws(
        () => envLinesFromJson("[1,2]"),
        /object of key\/value strings/u,
    );
});

test("envLinesFromJson rejects object values (would stringify as [object Object])", () => {
    assert.throws(
        () => envLinesFromJson('{"A":{"nested":1}}'),
        /must be a scalar/u,
    );
});
