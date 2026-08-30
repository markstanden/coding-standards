// pipelines/tofu-diagnose.mts — print OpenTofu workspace/state diagnostics.
//
// Extracted from opentofu--build--infrastructure.yml ("Diagnose State and
// Outputs" step) and opentofu--destroy--workspace.yml ("Show current state"
// step). All probes are best-effort (failures printed, never fatal), matching
// the original `|| true` guard on each. jq output-key listing replaced by
// Node JSON parsing.
//
// Inputs (env): INFRA_DIR.

import { resolve } from "node:path";

import { run, type Runner } from "../lib/proc.mts";

/**
 * Print workspace show/list, state list, and (optionally) output keys.
 * Never throws: every probe failure is printed and skipped.
 */
export function diagnoseTofu({ infraDir, showOutputKeys = false, runner = run }: { infraDir?: string; showOutputKeys?: boolean; runner?: Runner }): void {
  const cwd = infraDir ? resolve(infraDir) : process.cwd();

  console.log("--- Current Workspace ---");
  const show = runner({ cmd: "tofu", args: ["workspace", "show"], cwd });
  if (show.status !== 0) console.log(show.stderr.trim());

  console.log("--- All Workspaces ---");
  const list = runner({ cmd: "tofu", args: ["workspace", "list"], cwd });
  if (list.status !== 0) console.log(list.stderr.trim());
  else console.log(list.stdout);

  console.log("--- Managed Resources ---");
  const state = runner({ cmd: "tofu", args: ["state", "list"], cwd });
  if (state.status !== 0) console.log("(no resources in state)");
  else console.log(state.stdout);

  if (showOutputKeys) {
    console.log("--- Output Keys ---");
    const out = runner({ cmd: "tofu", args: ["output", "-json"], cwd });
    if (out.status !== 0) {
      console.log("(no outputs)");
      return;
    }
    try {
      const keys = Object.keys(JSON.parse(out.stdout) as Record<string, unknown>);
      console.log(keys.length > 0 ? keys.join("\n") : "(no outputs)");
    } catch {
      console.log("(no outputs)");
    }
  }
}

async function main(): Promise<void> {
  diagnoseTofu({
    infraDir: process.env.INFRA_DIR,
    showOutputKeys: (process.env.SHOW_OUTPUT_KEYS ?? "false") === "true",
  });
}

if (import.meta.main) {
  await main();
}