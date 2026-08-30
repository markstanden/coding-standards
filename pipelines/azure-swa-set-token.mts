// pipelines/azure-swa-set-token.mts — resolve the SWA deployment token.
//
// Extracted from azure-swa--deploy-blazor-wasm.yml ("Set SWA Token" step).
// Token precedence: a provided secret wins; otherwise the token parsed from
// infrastructure outputs; otherwise the step fails loudly.
//
// Inputs (env): SWA_TOKEN (secret, may be empty), PARSED_TOKEN, GITHUB_OUTPUT.

import { appendFile } from "node:fs/promises";

import { maskValue } from "../lib/gha.mts";

/**
 * Resolve the deployment token by precedence (secret > parsed). Throws when
 * neither is available.
 */
export function resolveSwaToken({
  secretToken,
  parsedToken,
}: {
  secretToken: string;
  parsedToken: string;
}): string {
  if (secretToken !== "") return secretToken;
  if (parsedToken !== "") return parsedToken;
  throw new Error("No SWA token provided (via secret or infrastructure outputs)");
}

async function main(): Promise<void> {
  const token = resolveSwaToken({
    secretToken: process.env.SWA_TOKEN ?? "",
    parsedToken: process.env.PARSED_TOKEN ?? "",
  });

  maskValue(token);

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    await appendFile(file, `token=${token}\n`, "utf8");
  }
}

if (import.meta.main) {
  await main();
}