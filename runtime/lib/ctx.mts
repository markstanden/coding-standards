// lib/ctx.mts — run-context assembly for the quality gate.
//
// Flag parsing (pure, table-testable) and context creation (derives the
// repo root from the invocation directory). Never imports steps.

import { deriveRepoRoot } from "../../lib/paths.mts";

export type StepMode = "fix" | "no-fix";

export interface ParsedArgs {
  mode: StepMode;
  silent: boolean;
  help: boolean;
}

export interface RunContext extends ParsedArgs {
  help: false;
  repoRoot: string;
}

/**
 * Parse gate flags. `--fix`/`--no-fix` are last-wins; unknown flags throw
 * so typos never silently change behaviour.
 */
export function parseArgs({ argv }: { argv: string[] }): ParsedArgs & { help: boolean } {
  let mode: StepMode = "no-fix";
  let silent = false;
  for (const arg of argv) {
    if (arg === "--fix") {
      mode = "fix";
    } else if (arg === "--no-fix") {
      mode = "no-fix";
    } else if (arg === "--silent") {
      silent = true;
    } else if (arg === "-h" || arg === "--help") {
      return { mode, silent, help: true };
    } else {
      throw new Error(`unknown flag: ${arg}`);
    }
  }
  return { mode, silent, help: false };
}

/** Assemble a full run context, deriving the repo root from startDir. */
export async function createRunContext({
  argv,
  startDir,
}: {
  argv: string[];
  startDir: string;
}): Promise<RunContext> {
  const parsed = parseArgs({ argv });
  const repoRoot = await deriveRepoRoot({ startDir });
  return { ...parsed, help: false, repoRoot };
}
