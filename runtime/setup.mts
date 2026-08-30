#!/usr/bin/env node
// setup.mts — gate bootstrap (decisions #13–14).
//
// Invoked via ./runtime/verify.sh setup (verify.mts dispatches). Installs
// shared root configs from standards/ into the repo root and seeds the
// AGENTS.md managed block from config/agents-block.md. Idempotent: re-runs
// rewrite the block only and leave unchanged configs alone (raises-only —
// differences fail loudly).
//
// Pure module: no top-level main — verify.mts owns the entry point, so this
// file is never double-executed when imported.

import { join } from "node:path";

import { readMarkedBlock, writeMarkedBlock } from "./lib/agents-block.mts";
import { installRootConfigs } from "./lib/config-install.mts";
import { gateConfigPath, standardsDir } from "./lib/config-path.mts";
import { deriveRepoRoot } from "../lib/paths.mts";

// Root configs shared with every consumer repo. standards/ is the single
// source of truth (decision #19): these files live there and are installed
// from it — no copied config/root/ that can drift.
const ROOT_CONFIG_NAMES = [".editorconfig", "Directory.Build.props"] as const;

/**
 * Bootstrap a target repo (startDir's git root): install root configs then
 * upsert the AGENTS.md managed block. Order matters — the summary mentions the
 * installed configs, so the block references reality by the time it is written.
 */
export async function runSetup({ startDir }: { startDir: string }): Promise<void> {
  const repoRoot = await deriveRepoRoot({ startDir });
  const installed = await installRootConfigs({
    sourceDir: await standardsDir(),
    names: [...ROOT_CONFIG_NAMES],
    repoRoot,
  });
  for (const c of installed) {
    console.log(`config ${c.name} — ${c.status}`);
  }

  const block = await readMarkedBlock({
    templatePath: await gateConfigPath({ name: "agents-block.md" }),
  });
  await writeMarkedBlock({ filePath: join(repoRoot, "AGENTS.md"), block });
  console.log("AGENTS.md — defined block written or refreshed");
}