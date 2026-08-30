// Tests for lib/config-install.mts: raises-only root config install.
// Run: node --test lib/config-install.test.mts

import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { installRootConfigs } from "./config-install.mts";

async function makeTempTree(): Promise<string> {
  return mkdtemp(join(tmpdir(), "quality-config-install-"));
}

test("installs the named absent files into the repo root", async () => {
  const root = await makeTempTree();
  try {
    const src = join(root, "config");
    const repo = join(root, "repo");
    await mkdir(src);
    await mkdir(repo);
    await writeFile(join(src, ".editorconfig"), "root = true\n");
    await writeFile(join(src, "Directory.Build.props"), "<Project />\n");

    const result = await installRootConfigs({
      sourceDir: src,
      names: [".editorconfig", "Directory.Build.props"],
      repoRoot: repo,
    });
    assert.deepEqual(result, [
      { name: ".editorconfig", status: "installed" },
      { name: "Directory.Build.props", status: "installed" },
    ]);
    assert.equal(await readFile(join(repo, ".editorconfig"), "utf8"), "root = true\n");
    assert.equal(await readFile(join(repo, "Directory.Build.props"), "utf8"), "<Project />\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("leaves an identical existing file untouched and reports unchanged", async () => {
  const root = await makeTempTree();
  try {
    const src = join(root, "config");
    const repo = join(root, "repo");
    await mkdir(src);
    await mkdir(repo);
    await writeFile(join(src, ".editorconfig"), "root = true\n");
    await writeFile(join(repo, ".editorconfig"), "root = true\n");

    const result = await installRootConfigs({
      sourceDir: src,
      names: [".editorconfig"],
      repoRoot: repo,
    });
    assert.deepEqual(result, [{ name: ".editorconfig", status: "unchanged" }]);
    assert.equal(await readFile(join(repo, ".editorconfig"), "utf8"), "root = true\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("throws loudly on a differing existing file and does not overwrite it", async () => {
  const root = await makeTempTree();
  try {
    const src = join(root, "config");
    const repo = join(root, "repo");
    await mkdir(src);
    await mkdir(repo);
    await writeFile(join(src, ".editorconfig"), "indent_size = 4\n");
    await writeFile(join(repo, ".editorconfig"), "indent_size = 2\n");

    await assert.rejects(
      () =>
        installRootConfigs({
          sourceDir: src,
          names: [".editorconfig"],
          repoRoot: repo,
        }),
      /raises-only/u,
    );
    assert.equal(await readFile(join(repo, ".editorconfig"), "utf8"), "indent_size = 2\n");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("installs only the named files, ignoring others in the source dir", async () => {
  const root = await makeTempTree();
  try {
    const src = join(root, "config");
    const repo = join(root, "repo");
    await mkdir(src);
    await mkdir(repo);
    await writeFile(join(src, ".editorconfig"), "root = true\n");
    await writeFile(join(src, "unrelated.sh"), "echo hi\n");

    const result = await installRootConfigs({
      sourceDir: src,
      names: [".editorconfig"],
      repoRoot: repo,
    });
    assert.deepEqual(result, [{ name: ".editorconfig", status: "installed" }]);
    assert.equal(await readFile(join(repo, ".editorconfig"), "utf8"), "root = true\n");
    assert.equal(await readFile(join(repo, "unrelated.sh"), "utf8").then(() => "exists").catch(() => "missing"), "missing");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("re-running after a clean install is a no-op (unchanged)", async () => {
  const root = await makeTempTree();
  try {
    const src = join(root, "config");
    const repo = join(root, "repo");
    await mkdir(src);
    await mkdir(repo);
    await writeFile(join(src, ".editorconfig"), "root = true\n");

    const opts = { sourceDir: src, names: [".editorconfig"], repoRoot: repo };
    await installRootConfigs(opts);
    const second = await installRootConfigs(opts);
    assert.deepEqual(second, [{ name: ".editorconfig", status: "unchanged" }]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});