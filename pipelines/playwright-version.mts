// pipelines/playwright-version.mts — detect the Microsoft.Playwright version
// for the browser cache key.
//
// Extracted from dotnet-test--playwright-tests.yml ("Compute Playwright cache
// key" step). Resolution order:
//   1. packages.lock.json `.dependencies["Microsoft.Playwright"].resolved`
//   2. obj/project.assets.json first microsoft.playwright/ library key
//   3. `playwright --version` output
// Replaces the three jq probes with Node. The version (possibly empty) is
// written to GITHUB_OUTPUT; an empty value makes the cache action fall back to
// a hashFiles key.
//
// Inputs (env): PROJECT_DIR (working dir), GITHUB_OUTPUT.

import { readFile, readdir, appendFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { run } from "../lib/proc.mts";

export interface PlaywrightVersionInput {
  projectDir?: string;
}

/**
 * Detect the Microsoft.Playwright version using the resolution order above.
 * Returns "" when nothing yields a version.
 */
export async function detectPlaywrightVersion({ projectDir }: PlaywrightVersionInput): Promise<string> {
  const cwd = projectDir ? resolve(projectDir) : process.cwd();

  // 1. packages.lock.json
  const lock = await readFile(join(cwd, "packages.lock.json"), "utf8").catch(() => "");
  if (lock !== "") {
    try {
      const data = JSON.parse(lock) as {
        dependencies?: Record<string, Record<string, { resolved?: string; version?: string }>>;
      };
      const dep = data.dependencies?.["Microsoft.Playwright"];
      const v = dep?.resolved ?? dep?.version;
      if (v) return v;
    } catch {
      // fall through to the assets file
    }
  }

  // 2. obj/project.assets.json — first microsoft.playwright/ library key.
  const assetsPath = await findAssetsFile(cwd);
  if (assetsPath) {
    try {
      const text = await readFile(assetsPath, "utf8");
      const data = JSON.parse(text) as {
        libraries?: Record<string, { type?: string }>;
      };
      const lib = Object.keys(data.libraries ?? {})
        .filter((k) => k.toLowerCase().startsWith("microsoft.playwright/"))
        .sort()[0];
      if (lib) {
        return lib.split("/")[1] ?? "";
      }
    } catch {
      // fall through to the CLI probe
    }
  }

  // 3. playwright CLI (best-effort: a missing binary is just "no version").
  let probe: { status: number; stdout: string; stderr: string } | undefined;
  try {
    probe = run({ cmd: "playwright", args: ["--version"], cwd });
  } catch {
    return "";
  }
  if (probe?.status === 0) {
    const token = probe.stdout.trim().split(/\s+/u).pop();
    if (token) return token;
  }
  return "";
}

/**
 * Find the first obj/project.assets.json at or under cwd. Mirrors the
 * original `find . -maxdepth 3 -path '*"/"obj/project.assets.json'` scan:
 * walk directories down to depth 3, checking each `obj/` for the file.
 */
async function findAssetsFile(cwd: string): Promise<string | undefined> {
  const root = resolve(cwd);
  let found: string | undefined;

  async function walk(dir: string, depth: number): Promise<void> {
    if (found || depth > 3) return;
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = join(dir, entry.name);
      if (entry.name === "obj") {
        const exists = await readFile(join(candidate, "project.assets.json"), "utf8")
          .then(() => true)
          .catch(() => false);
        if (exists) {
          found = join(candidate, "project.assets.json");
          return;
        }
      } else {
        await walk(candidate, depth + 1);
      }
    }
  }

  await walk(root, 1);
  return found;
}

async function main(): Promise<void> {
  const version = await detectPlaywrightVersion({ projectDir: process.env.PROJECT_DIR });
  console.log(`Detected Microsoft.Playwright version: ${version}`);

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    await appendFile(file, `version=${version}\n`, "utf8");
  }
}

if (import.meta.main) {
  await main();
}