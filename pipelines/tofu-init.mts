// pipelines/tofu-init.mts — OpenTofu init + workspace select-or-create.
//
// Extracted from opentofu-build-infrastructure.yml (the "Initialize and Select
// Workspace" steps) and opentofu-destroy-workspace.yml (the "Initialize
// Backend" step). Runs in the defined image where tofu is baked in, so the
// workflow needs no setup-opentofu step.
//
// Inputs (env): TF_PLUGIN_CACHE_DIR, INFRA_DIR (working dir), BACKEND_RG,
// BACKEND_SA, BACKEND_CONTAINER, BACKEND_KEY, BUILD_ENV (select-or-create
// workspace when set and not "default"). Uses process cwd when INFRA_DIR is
// absent so destroy (which inits in-place) works unmodified.

import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { run } from "../lib/proc.mts";

export interface TofuInitInput {
  pluginCacheDir: string;
  infraDir?: string;
  backendRg: string;
  backendSa: string;
  backendContainer: string;
  backendKey: string;
  buildEnv?: string;
}

/**
 * Prepare the plugin cache dir, init with the remote Azure backend, then
 * select-or-create the workspace when buildEnv is set and not "default".
 */
export function runTofuInit({ pluginCacheDir, infraDir, backendRg, backendSa, backendContainer, backendKey, buildEnv }: TofuInitInput): void {
  mkdirSync(pluginCacheDir, { recursive: true });

  const cwd = infraDir ? resolve(infraDir) : process.cwd();

  // Clear any stale `.terraform/environment` marker so the workspace select
  // below starts from a clean slate.
  const envMarker = `${cwd}/.terraform/environment`;
  if (existsSync(envMarker)) {
    run({ cmd: "rm", args: ["-f", envMarker], cwd });
  }

  const init = run({
    cmd: "tofu",
    args: [
      "init",
      "-reconfigure",
      "-input=false",
      "-backend-config=resource_group_name=" + backendRg,
      "-backend-config=storage_account_name=" + backendSa,
      "-backend-config=container_name=" + backendContainer,
      "-backend-config=key=" + backendKey,
    ],
    cwd,
  });
  if (init.status !== 0) {
    throw new Error(`tofu init failed:\n${init.stderr}`);
  }

  if (buildEnv && buildEnv !== "default") {
    const select = run({ cmd: "tofu", args: ["workspace", "select", buildEnv], cwd });
    if (select.status !== 0) {
      const create = run({ cmd: "tofu", args: ["workspace", "new", buildEnv], cwd });
      if (create.status !== 0) {
        throw new Error(`tofu workspace select|new failed:\n${create.stderr}`);
      }
    }
  }
}

async function main(): Promise<void> {
  runTofuInit({
    pluginCacheDir: process.env.TF_PLUGIN_CACHE_DIR ?? ".tofu-plugin-cache",
    infraDir: process.env.INFRA_DIR,
    backendRg: process.env.BACKEND_RG ?? "",
    backendSa: process.env.BACKEND_SA ?? "",
    backendContainer: process.env.BACKEND_CONTAINER ?? "",
    backendKey: process.env.BACKEND_KEY ?? "",
    buildEnv: process.env.BUILD_ENV,
  });
  console.log("tofu init complete");
}

if (import.meta.main) {
  await main();
}