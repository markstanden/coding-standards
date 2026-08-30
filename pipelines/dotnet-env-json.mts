// pipelines/dotnet-env-json.mts — set environment variables from a JSON input.
//
// Extracted from dotnet-build--blazor-frontend.yml ("Set environment
// variables" step). Parses the JSON input ({"KEY1":"value1",...}) and appends
// KEY=value lines to GITHUB_ENV. Replaces `echo ... | jq -r 'to_entries[]'`.
//
// Inputs (env): ENV_JSON, GITHUB_ENV.

import { appendFile } from "node:fs/promises";

/**
 * Parse a JSON object and produce KEY=value lines for GITHUB_ENV.
 */
export function envLinesFromJson(raw: string): string[] {
  const parsed = JSON.parse(raw) as unknown;
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("ENV_JSON must be a JSON object of key/value strings");
  }
  return Object.entries(parsed as Record<string, unknown>).map(
    ([k, v]) => `${k}=${String(v)}`,
  );
}

async function main(): Promise<void> {
  const raw = process.env.ENV_JSON ?? "";
  if (raw === "") return;

  const file = process.env.GITHUB_ENV;
  if (!file) return;

  await appendFile(file, envLinesFromJson(raw).join("\n") + "\n", "utf8");
}

if (import.meta.main) {
  await main();
}