// pipelines/dotnet-test.mts — run dotnet test, optionally collecting coverage.
//
// Extracted from dotnet-test--common-test-runner.yml ("Run Tests" step).
// Adds the coverage collector and results directory when requested. Runs in
// the defined image (dotnet baked in), so no setup-dotnet step is needed.
//
// Inputs (env): TEST_FILTER, COLLECT_COVERAGE ("true"/"false").

import { run } from "../lib/proc.mts";

export interface DotNetTestInput {
  testFilter: string;
  collectCoverage: boolean;
}

/**
 * Run dotnet test with the given filter, adding XPlat Code Coverage
 * collection when requested. Throws on failure.
 */
export function runDotNetTests({ testFilter, collectCoverage }: DotNetTestInput): void {
  const args = ["test", "--filter", testFilter, "--no-build", "--verbosity", "normal"];
  if (collectCoverage) {
    args.push("--collect:XPlat Code Coverage", "--results-directory", "./coverage");
  }

  const result = run({ cmd: "dotnet", args });
  if (result.status !== 0) {
    throw new Error(`dotnet test failed (${result.status}):\n${result.stderr}`);
  }
}

async function main(): Promise<void> {
  runDotNetTests({
    testFilter: process.env.TEST_FILTER ?? "FullyQualifiedName~Tests",
    collectCoverage: (process.env.COLLECT_COVERAGE ?? "false") === "true",
  });
}

if (import.meta.main) {
  await main();
}