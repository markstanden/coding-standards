// Tests for lib/agents-block.mts: managed-block upsert into AGENTS.md.
// Run: node --test quality/lib/agents-block.test.mts

import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import {
  BLOCK_END,
  BLOCK_START,
  readMarkedBlock,
  readContentsOrEmpty,
  writeMarkedBlock,
} from "./agents-block.mts";

const BLOCK = [
  BLOCK_START,
  "House standards index: https://github.com/markstanden/coding-standards",
  BLOCK_END,
].join("\n");

async function makeTempTree(): Promise<string> {
  return mkdtemp(join(tmpdir(), "quality-agents-block-"));
}

test("readMarkedBlock returns the marked span, newline-terminated", async () => {
  const root = await makeTempTree();
  try {
    const tpl = join(root, "template.md");
    await writeFile(tpl, `lead-in\n${BLOCK}\ntrailing\n`);
    assert.equal(await readMarkedBlock({ templatePath: tpl }), BLOCK);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readMarkedBlock throws when a marker is missing", async () => {
  const root = await makeTempTree();
  try {
    const tpl = join(root, "template.md");
    await writeFile(tpl, `only ${BLOCK_START} here\n`);
    await assert.rejects(() => readMarkedBlock({ templatePath: tpl }), /must contain/u);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeMarkedBlock creates AGENTS.md when absent", async () => {
  const root = await makeTempTree();
  try {
    const target = join(root, "AGENTS.md");
    await writeMarkedBlock({ filePath: target, block: BLOCK });
    assert.equal(await readFile(target, "utf8"), BLOCK);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeMarkedBlock appends after unmarked content, preserving it verbatim", async () => {
  const root = await makeTempTree();
  try {
    const target = join(root, "AGENTS.md");
    const mine = "# My Project\n\nSome private conventions.\n";
    await writeFile(target, mine);
    await writeMarkedBlock({ filePath: target, block: BLOCK });
    assert.equal(await readFile(target, "utf8"), `${mine}${BLOCK}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeMarkedBlock inserts a newline before the block when content lacks one", async () => {
  const root = await makeTempTree();
  try {
    const target = join(root, "AGENTS.md");
    await writeFile(target, "no trailing newline");
    await writeMarkedBlock({ filePath: target, block: BLOCK });
    assert.equal(await readFile(target, "utf8"), `no trailing newline\n${BLOCK}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeMarkedBlock replaces only marked lines on re-run, preserving neighbours", async () => {
  const root = await makeTempTree();
  try {
    const target = join(root, "AGENTS.md");
    const before = "# Project\n\nI own this bit.\n";
    const after = "\nCopyright: me.\n";
    await writeFile(target, `${before}${BLOCK}${after}`);
    const replacement = [BLOCK_START, "Newer standards pointer.", BLOCK_END].join("\n");
    await writeMarkedBlock({ filePath: target, block: replacement });
    assert.equal(await readFile(target, "utf8"), `${before}${replacement}${after}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeMarkedBlock is idempotent: a second run leaves the file byte-identical", async () => {
  const root = await makeTempTree();
  try {
    const target = join(root, "AGENTS.md");
    await writeFile(target, `# Project\n\n${BLOCK}\nabove all, be kind.\n`);
    await writeMarkedBlock({ filePath: target, block: BLOCK });
    const first = await readFile(target, "utf8");
    await writeMarkedBlock({ filePath: target, block: BLOCK });
    assert.equal(await readFile(target, "utf8"), first);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("writeMarkedBlock throws on a half-written block", async () => {
  const root = await makeTempTree();
  try {
    const target = join(root, "AGENTS.md");
    await writeFile(target, `${BLOCK_END} without its start\n`);
    await assert.rejects(
      () => writeMarkedBlock({ filePath: target, block: BLOCK }),
      /half-written or out-of-order/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("readContentsOrEmpty returns empty string for a missing file", async () => {
  const root = await makeTempTree();
  try {
    assert.equal(await readContentsOrEmpty({ filePath: join(root, "nope") }), "");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});