// test-helpers.mts — shared scaffolding for pipeline module tests.
//
// Every tofu test used to carry its own byte-identical scriptedRunner;
// one source of truth now. Keyed on the full command line ("tofu workspace
// select dev") so subcommand variants are distinguishable — the runtime's
// fakeRunner (cmd subcommand only) cannot tell `select` from `new`.
// Not a lib/ module — it is test-only and must never be imported by gate code.

import type { Runner } from "../lib/proc.mts";

type RunResult = { status?: number; stdout?: string; stderr?: string };

/**
 * Scriptable fake runner: maps a full command line to canned results and
 * records every call as [cmd, ...args]. Unlisted commands succeed by default.
 */
export function scriptedRunner(
  outcomes: Record<string, RunResult>,
): { runner: Runner; calls: string[][] } {
  const calls: string[][] = [];
  const runner = (({ cmd, args }: { cmd: string; args: string[] }) => {
    calls.push([cmd, ...args]);
    const key = `${cmd} ${args.join(" ")}`.trim();
    const o = outcomes[key] ?? { status: 0 };
    return { status: o.status ?? 0, stdout: o.stdout ?? "", stderr: o.stderr ?? "" };
  }) as Runner;
  return { runner, calls };
}