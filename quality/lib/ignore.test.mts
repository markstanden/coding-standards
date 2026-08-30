// Tests for lib/ignore.mts: effective ignore merging (base + host).
// Run: node --test quality/lib/ignore.test.mts

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { mergeIgnoreContents, writeMergedIgnore, removeMergedIgnore } from "./ignore.mts";

test("mergeIgnoreContents returns base unchanged when host is empty", () => {
  const base = "package-lock.json\ncoverage/\n";
  assert.equal(mergeIgnoreContents({ base, host: "" }), base);
  assert.equal(mergeIgnoreContents({ base, host: "  \n" }), base);
});

test("mergeIgnoreContents appends host additions after a separator comment", () => {
  const merged = mergeIgnoreContents({
    base: "package-lock.json\n",
    host: "dotfiles/nvim/\n*.toml\n",
  });
  assert.ok(merged.startsWith("package-lock.json\n\n# host repo additions\ndotfiles/nvim/\n*.toml\n"));
});

test("writeMergedIgnore materialises content to a file that readFile can load", async () => {
  const path = await writeMergedIgnore({ content: "# hi\nfoo\n" });
  try {
    assert.equal(await readFile(path, "utf8"), "# hi\nfoo\n");
  } finally {
    await removeMergedIgnore({ path });
  }
});

test("removeMergedIgnore cleans up the temp directory", async () => {
  const path = await writeMergedIgnore({ content: "# hi\nfoo\n" });
  await removeMergedIgnore({ path });
  await assert.rejects(() => readFile(path, "utf8"));
});