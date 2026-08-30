// Tests for lib/ctx.mts: flag parsing and run-context assembly.
// Run: node --test lib/ctx.test.mts

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { createRunContext, parseArgs } from "./ctx.mts";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

async function tempGitTree(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "quality-ctx-"));
  tempDirs.push(dir);
  await mkdir(join(dir, ".git"));
  return dir;
}

test("parseArgs defaults to check-only, non-silent", () => {
  assert.deepEqual(parseArgs({ argv: [] }), {
    mode: "no-fix",
    silent: false,
    help: false,
  });
});

test("parseArgs recognises --fix and --silent", () => {
  assert.deepEqual(parseArgs({ argv: ["--fix", "--silent"] }), {
    mode: "fix",
    silent: true,
    help: false,
  });
});

test("parseArgs lets the last of --fix/--no-fix win", () => {
  assert.equal(parseArgs({ argv: ["--fix", "--no-fix"] }).mode, "no-fix");
  assert.equal(parseArgs({ argv: ["--no-fix", "--fix"] }).mode, "fix");
});

test("parseArgs reports help without other effects", () => {
  assert.deepEqual(parseArgs({ argv: ["--help"] }), {
    mode: "no-fix",
    silent: false,
    help: true,
  });
});

test("parseArgs rejects unknown flags loudly", () => {
  assert.throws(() => parseArgs({ argv: ["--wat"] }), /unknown flag: --wat/u);
});

test("createRunContext derives repoRoot via git marker walk-up", async () => {
  const root = await tempGitTree();
  const nested = join(root, "deep");
  await mkdir(nested);
  const ctx = await createRunContext({ argv: [], startDir: nested });
  assert.equal(ctx.repoRoot, root);
  assert.deepEqual(
    { mode: ctx.mode, silent: ctx.silent },
    { mode: "no-fix", silent: false },
  );
});
