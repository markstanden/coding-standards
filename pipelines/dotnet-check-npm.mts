// pipelines/dotnet-check-npm.mts — detect whether a frontend project uses npm.
//
// Extracted from dotnet--build--blazor-frontend.yml ("Check for npm
// requirements" step). Writes npm-required=true/false to GITHUB_OUTPUT based
// on package.json presence.
//
// Inputs (env): WEB_PROJECT_PATH, GITHUB_OUTPUT.

import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { appendFile } from "node:fs/promises";

/**
 * Whether a package.json exists under the web project path.
 */
export function hasPackageJson({ webProjectPath }: { webProjectPath: string }): boolean {
  return existsSync(join(resolve(webProjectPath), "package.json"));
}

async function main(): Promise<void> {
  const required = hasPackageJson({ webProjectPath: process.env.WEB_PROJECT_PATH ?? "" });

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    await appendFile(file, `npm-required=${required ? "true" : "false"}\n`, "utf8");
  }
}

if (import.meta.main) {
  await main();
}