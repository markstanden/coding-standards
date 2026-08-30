// Tests for runtime/lib/config-path.mts: runtime config dir resolution.
// Run: node --test runtime/lib/config-path.test.mts

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";

import { gateConfigPath } from "./config-path.mts";

test("gateConfigPath resolves under the runtime's own config directory", async () => {
  const path = await gateConfigPath({ name: "yamllint.yml" });
  assert.match(path, /\/config\/yamllint\.yml$/u);
  assert.equal(existsSync(path), true);
});