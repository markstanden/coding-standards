// test-helpers.mts — shared scaffolding for the gate's own tests.
//
// Every step test used to carry its own byte-identical fakeRunner and baseCtx;
// SonarQube flagged the duplication (new_duplicated_lines_density 9.2% on the
// PR gate). Single source of truth now: step tests import from here.
// Not a lib/ module — it is test-only and must never be imported by gate code.

import type { CommandResult } from "./lib/proc.mts";

type RunResult = { status: number; stdout?: string; stderr?: string };

/**
 * Scriptable fake runner: maps command name (or "cmd subcommand") to canned
 * results and records every call as [cmd, ...args] (plus trailing cwd when
 * present). `withCwd` selects the cwd-aware variant used by steps whose
 * commands take a working directory.
 */
export function fakeRunner(
  outcomes: Record<string, RunResult>,
  withCwd = false,
): { runner: typeof import("./lib/proc.mts").run; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args, cwd }: { cmd: string; args: string[]; cwd?: string }) => {
    if (withCwd) {
      calls.push([cmd, ...args, cwd ?? ""]);
      const key = `${cmd} ${args[0] ?? ""}`.trim();
      const o = outcomes[key] ?? outcomes[cmd] ?? { status: 0 };
      return {
        status: o.status,
        stdout: o.stdout ?? "",
        stderr: o.stderr ?? "",
      } satisfies CommandResult;
    }
    calls.push([cmd, ...args]);
    const o = outcomes[cmd] ?? { status: 0 };
    return {
      status: o.status,
      stdout: o.stdout ?? "",
      stderr: o.stderr ?? "",
    } satisfies CommandResult;
  }) as typeof import("./lib/proc.mts").run;
  return { runner, calls };
}

/** Default step context: check-only, non-silent, repo at /repo. */
export const baseCtx = {
  mode: "no-fix" as const,
  silent: false,
  help: false as const,
  repoRoot: "/repo",
};