// pipelines/azure-swa-replace-appsettings.mts — replace DeployEnvironment/AppVersion
// in appsettings.json.
//
// Extracted from azure-swa--deploy--blazor-wasm.yml ("Replace Tokens in
// appsettings.json" step). Verifies the file exists and is non-empty, sets
// `.DeployEnvironment` and `.AppVersion` (short SHA), writes atomically via a
// temp file, then validates the result. Replaces the jq `--arg` + `mv` flow.
//
// Inputs (env): APPSETTINGS_PATH (relative to app-location cwd),
// DEPLOY_ENVIRONMENT, APP_VERSION, CWD.

import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface ReplaceAppsettingsInput {
  appsettingsPath: string;
  environment: string;
  appVersion: string;
  cwd?: string;
}

/**
 * Set DeployEnvironment and AppVersion in appsettings.json. Returns the
 * short SHA used (first 8 chars of appVersion) for logging.
 */
export async function replaceAppsettings({
  appsettingsPath,
  environment,
  appVersion,
  cwd,
}: ReplaceAppsettingsInput): Promise<string> {
  const filePath = resolve(cwd ?? process.cwd(), appsettingsPath);

  let contents: string;
  try {
    contents = await readFile(filePath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`appsettings.json not found at ${appsettingsPath}`);
    }
    throw err;
  }
  if (contents.trim() === "") {
    throw new Error(`appsettings.json is empty at ${appsettingsPath}`);
  }

  const shortSha = appVersion.slice(0, 8);
  const json = JSON.parse(contents) as Record<string, unknown>;
  json.DeployEnvironment = environment;
  json.AppVersion = shortSha;

  const next = JSON.stringify(json, null, 2) + "\n";
  const temp = `${filePath}.tmp`;
  await writeFile(temp, next, "utf8");
  await rename(temp, filePath);

  // Validate the written JSON before reporting success.
  const written = await readFile(filePath, "utf8");
  try {
    JSON.parse(written);
  } catch (err) {
    throw new Error(`generated JSON is invalid: ${(err as Error).message}`);
  }

  return shortSha;
}

async function main(): Promise<void> {
  const shortSha = await replaceAppsettings({
    appsettingsPath: process.env.APPSETTINGS_PATH ?? "appsettings.json",
    environment: process.env.DEPLOY_ENVIRONMENT ?? "",
    appVersion: process.env.APP_VERSION ?? "",
    cwd: process.env.CWD,
  });
  console.log(`appsettings.json updated for ${process.env.DEPLOY_ENVIRONMENT} (v${shortSha})`);
}

if (import.meta.main) {
  await main();
}