// Tests for the simple resolver/summary/env pipeline modules.
// Run: node --test pipelines/simple.test.mts

import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

import { resolveSwaToken } from "./azure-swa-set-token.mts";
import { resolveDeploymentUrl } from "./azure-swa-resolve-url.mts";
import { envLinesFromJson } from "./dotnet-env-json.mts";
import { hasPackageJson } from "./dotnet-check-npm.mts";
import { summaryBlock } from "./summary.mts";

test("resolveSwaToken prefers the secret over the parsed token", () => {
  assert.equal(resolveSwaToken({ secretToken: "s", parsedToken: "p" }), "s");
  assert.equal(resolveSwaToken({ secretToken: "", parsedToken: "p" }), "p");
});

test("resolveSwaToken throws when no token is available", () => {
  assert.throws(() => resolveSwaToken({ secretToken: "", parsedToken: "" }), /No SWA token/u);
});

test("resolveDeploymentUrl prefers the SWA action URL", () => {
  assert.equal(resolveDeploymentUrl({ swaUrl: "https://a", outputsUrl: "https://b" }), "https://a");
  assert.equal(resolveDeploymentUrl({ swaUrl: "", outputsUrl: "https://b" }), "https://b");
});

test("resolveDeploymentUrl throws when no URL is available", () => {
  assert.throws(() => resolveDeploymentUrl({ swaUrl: "", outputsUrl: "" }), /No deployment URL/u);
});

test("envLinesFromJson flattens an object to KEY=value lines", () => {
  assert.deepEqual(envLinesFromJson('{"A":"1","B":"two words"}'), ["A=1", "B=two words"]);
});

test("envLinesFromJson rejects non-object input", () => {
  assert.throws(() => envLinesFromJson("[1,2]"), /object of key\/value strings/u);
});

test("hasPackageJson detects package.json presence", async () => {
  const dir = await mkdtemp(join(tmpdir(), "quality-check-npm-"));
  try {
    assert.equal(hasPackageJson({ webProjectPath: dir }), false);
    await writeFile(join(dir, "package.json"), "{}");
    assert.equal(hasPackageJson({ webProjectPath: dir }), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("summaryBlock renders heading + outcome", () => {
  assert.equal(summaryBlock({ heading: "Build Results", status: "success" }), "### Build Results\nBuild Results: succeeded");
  assert.equal(summaryBlock({ heading: "Tests", status: "failure" }), "### Tests\nTests: failed");
});