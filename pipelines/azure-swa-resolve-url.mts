// pipelines/azure-swa-resolve-url.mts — resolve the deployed site URL.
//
// Extracted from azure-swa--deploy--static-site.yml ("Resolve deployment URL"
// step). Prefers the SWA action's URL, falls back to the infrastructure
// outputs URL, and fails when neither exists.
//
// Inputs (env): SWA_URL, OUTPUTS_URL, GITHUB_OUTPUT.

import { appendFile } from "node:fs/promises";

/**
 * Resolve the deployment URL by precedence (SWA action > infrastructure
 * outputs). Throws when neither is available.
 */
export function resolveDeploymentUrl({
  swaUrl,
  outputsUrl,
}: {
  swaUrl: string;
  outputsUrl: string;
}): string {
  if (swaUrl !== "") return swaUrl;
  if (outputsUrl !== "") return outputsUrl;
  throw new Error("No deployment URL from SWA action or infrastructure outputs");
}

async function main(): Promise<void> {
  const url = resolveDeploymentUrl({
    swaUrl: process.env.SWA_URL ?? "",
    outputsUrl: process.env.OUTPUTS_URL ?? "",
  });

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    await appendFile(file, `url=${url}\n`, "utf8");
  }
  console.log(`deployment URL: ${url}`);
}

if (import.meta.main) {
  await main();
}