// Tests for pipelines/healthcheck-verify.mts: route parsing.
// Run: node --test pipelines/healthcheck-verify.test.mts
//
// The curl probing itself needs a network and curl, so only the pure route
// parsing is unit-tested here; the full loop is covered by the workflow.

import assert from "node:assert/strict";
import { test } from "node:test";

import { parseRoutes } from "./healthcheck-verify.mts";

test("parseRoutes parses a JSON array of routes", () => {
  assert.deepEqual(parseRoutes('["/health", "/ready"]'), ["/health", "/ready"]);
});

test("parseRoutes rejects non-array or non-string input", () => {
  assert.throws(() => parseRoutes("{}"), /JSON array of route strings/u);
  assert.throws(() => parseRoutes("[1, 2]"), /JSON array of route strings/u);
  assert.throws(() => parseRoutes("not json"), /JSON array of route strings/u);
});