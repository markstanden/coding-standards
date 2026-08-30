// Tests for pipelines/azure-swa-set-token.mts: SWA token resolution.
// Run: node --test pipelines/azure-swa-set-token.test.mts

import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveSwaToken } from "./azure-swa-set-token.mts";

test("resolveSwaToken prefers the secret over the parsed token", () => {
  assert.equal(resolveSwaToken({ secretToken: "s", parsedToken: "p" }), "s");
  assert.equal(resolveSwaToken({ secretToken: "", parsedToken: "p" }), "p");
});

test("resolveSwaToken throws when no token is available", () => {
  assert.throws(() => resolveSwaToken({ secretToken: "", parsedToken: "" }), /No SWA token/u);
});