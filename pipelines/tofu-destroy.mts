// pipelines/tofu-destroy.mts — OpenTofu workspace select + destroy.
//
// Extracted from opentofu-destroy-workspace.yml ("Select Workspace (if
// exists)", "Show current state" and "Destroy workspace" steps). Selects the
// target workspace when it exists, shows the current state, then destroys it.
// With buildEnv "default" it destroys the default workspace in place. When a
// non-default workspace is absent it reports so and destroys nothing — the
// original gated these steps on `selected != '' || environment == 'default'`,
// which this module collapses into one safe call.
//
// Inputs (env): INFRA_DIR, BUILD_ENV, GITHUB_OUTPUT.

import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";

import { run } from "../lib/proc.mts";

export interface TofuDestroyInput {
  infraDir?: string;
  buildEnv: string;
}

/**
 * Select the target workspace when it exists, show state, then destroy.
 * Returns whether anything was destroyed.
 */
export function runTofuDestroy({ infraDir, buildEnv }: TofuDestroyInput): boolean {
  const cwd = infraDir ? resolve(infraDir) : process.cwd();

  if (buildEnv !== "default") {
    const select = run({ cmd: "tofu", args: ["workspace", "select", buildEnv], cwd });
    if (select.status !== 0) {
      return false;
    }
  }

  // Show current state for diagnostics (the original "Show current state"
  // step; failures are non-fatal there, so ignore the status).
  run({ cmd: "tofu", args: ["workspace", "show"], cwd });
  run({ cmd: "tofu", args: ["state", "list"], cwd });

  const destroy = run({ cmd: "tofu", args: ["destroy", "-auto-approve", "-input=false"], cwd });
  if (destroy.status !== 0) {
    // Mirrors the original: destroy failure prints state for diagnostics.
    const state = run({ cmd: "tofu", args: ["state", "list"], cwd });
    throw new Error(
      `tofu destroy failed (${destroy.status}):\n${destroy.stderr}\n${state.stdout}`,
    );
  }
  return true;
}

async function main(): Promise<void> {
  const buildEnv = process.env.BUILD_ENV ?? "default";
  const destroyed = runTofuDestroy({
    infraDir: process.env.INFRA_DIR,
    buildEnv,
  });

  const file = process.env.GITHUB_OUTPUT;
  if (file) {
    await appendFile(file, `selected=${destroyed ? buildEnv : ""}\n`, "utf8");
  }
  if (!destroyed) {
    console.log(`workspace '${buildEnv}' does not exist; nothing to destroy`);
  }
}

if (import.meta.main) {
  await main();
}