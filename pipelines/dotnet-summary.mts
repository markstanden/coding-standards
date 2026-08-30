// pipelines/dotnet-summary.mts — write a heading + pass/fail line to the step summary.
//
// Extracted from the "Add test summary" step in
// dotnet--test--playwright-tests.yml. The status (success/failure) drives the
// message; the summary file comes from GITHUB_STEP_SUMMARY.
//
// Inputs (env): SUMMARY_HEADING, SUMMARY_STATUS ("success"/other).

import { appendFile } from "node:fs/promises";

/**
 * Compose the summary block body for a heading + status.
 */
export function summaryBlock({ heading, status }: { heading: string; status: string }): string {
  const outcome = status === "success" ? "succeeded" : "failed";
  return `### ${heading}\n${heading}: ${outcome}`;
}

async function main(): Promise<void> {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (!file) return;

  const heading = process.env.SUMMARY_HEADING ?? "Results";
  const status = process.env.SUMMARY_STATUS ?? "failure";
  await appendFile(file, summaryBlock({ heading, status }) + "\n", "utf8");
}

if (import.meta.main) {
  await main();
}