// Tests for pipelines/azure-swa-replace-appsettings.mts: appsettings token replacement.
// Run: node --test pipelines/azure-swa-replace-appsettings.test.mts

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { replaceAppsettings } from "./azure-swa-replace-appsettings.mts";

async function makeTemp(): Promise<string> {
  return mkdtemp(join(tmpdir(), "quality-swa-appsettings-"));
}

test("sets DeployEnvironment and AppVersion (short SHA)", async () => {
  const dir = await makeTemp();
  try {
    await writeFile(join(dir, "appsettings.json"), '{"DeployEnvironment":"staging","AppVersion":"old"}');
    const short = await replaceAppsettings({
      appsettingsPath: "appsettings.json",
      environment: "production",
      appVersion: "0123456789abcdef",
      cwd: dir,
    });
    assert.equal(short, "01234567");
    const next = JSON.parse(await import("node:fs/promises").then((m) => m.readFile(join(dir, "appsettings.json"), "utf8")));
    assert.deepEqual(next, { DeployEnvironment: "production", AppVersion: "01234567" });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("throws when appsettings.json is missing", async () => {
  const dir = await makeTemp();
  try {
    await assert.rejects(
      () => replaceAppsettings({ appsettingsPath: "appsettings.json", environment: "e", appVersion: "sha", cwd: dir }),
      /appsettings\.json not found/u,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("throws when appsettings.json is empty", async () => {
  const dir = await makeTemp();
  try {
    await writeFile(join(dir, "appsettings.json"), "   ");
    await assert.rejects(
      () => replaceAppsettings({ appsettingsPath: "appsettings.json", environment: "e", appVersion: "sha", cwd: dir }),
      /appsettings\.json is empty/u,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});