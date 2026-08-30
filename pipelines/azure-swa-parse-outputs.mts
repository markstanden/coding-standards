// pipelines/azure-swa-parse-outputs.mts — parse OpenTofu infrastructure outputs.
//
// Extracted from the "Parse Infrastructure Outputs" steps of both SWA
// workflows. Validates the outputs JSON, extracts the SWA token (and the
// static-site deployment URL) by key, masks the token, and writes the values
// to GITHUB_OUTPUT. Replaces jq validation + extraction with Node.
//
// Inputs (env): OUTPUT_FILENAME, TOKEN_KEY, URL_KEY, GITHUB_OUTPUT.

import { resolve } from "node:path";

import { appendToFile, maskValue } from "../lib/gha.mts";
import { readJsonFile, tofuOutputValue } from "../lib/json.mts";

export interface ParseOutputsInput {
  outputFilename: string;
  tokenKey: string;
  urlKey?: string;
}

export interface ParseOutputsResult {
  token: string;
  url?: string;
  availableKeys: string[];
}

/**
 * Read and validate the outputs JSON, then extract the token (and optional
 * URL). Throws a descriptive error naming the missing key and the available
 * top-level keys, mirroring the original step's failure mode.
 */
export async function parseInfrastructureOutputs({
  outputFilename,
  tokenKey,
  urlKey,
}: ParseOutputsInput): Promise<ParseOutputsResult> {
  const filePath = resolve(outputFilename);
  const outputs = await readJsonFile<Record<string, unknown>>({ filePath });

  const token = tofuOutputValue<string>({ outputs, key: tokenKey }) ?? "";
  const url = urlKey ? tofuOutputValue<string>({ outputs, key: urlKey }) : undefined;

  if (token === "") {
    const keys = Object.keys(outputs);
    throw new Error(
      `${tokenKey}.value not found in infrastructure outputs JSON. Available top-level keys: ${keys.join(", ")}`,
    );
  }

  return { token, url, availableKeys: Object.keys(outputs) };
}

async function main(): Promise<void> {
  const tokenKey = process.env.TOKEN_KEY ?? "";
  const result = await parseInfrastructureOutputs({
    outputFilename: process.env.OUTPUT_FILENAME ?? "tofu_outputs.json",
    tokenKey,
    urlKey: process.env.URL_KEY,
  });

  maskValue(result.token);

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    const lines: Record<string, string> = { token: result.token };
    if (result.url !== undefined) {
      lines.url = result.url;
    }
    await appendToFile({ envName: "GITHUB_OUTPUT", lines });
  }
}

if (import.meta.main) {
  await main();
}