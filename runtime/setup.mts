#!/usr/bin/env node
// setup.mts — gate bootstrap (decisions #13–14).
//
// runSetup is the write path, invoked as the first phase of `comply`; it
// installs shared root configs from standards/ into the repo root and seeds
// the AGENTS.md managed block from config/agents-block.md. Idempotent:
// re-runs rewrite the block only and leave unchanged configs alone
// (raises-only — differences fail loudly). checkSetup is the read-only path
// used by `verify`; it reports bootstrap state without writing a byte.
//
// Pure module: no top-level main — verify.mts owns the entry point, so this
// file is never double-executed when imported.

import { join } from "node:path";

import {
    checkMarkedBlock,
    readMarkedBlock,
    writeMarkedBlock,
    type MarkedBlockStatus,
} from "./lib/agents-block.mts";
import {
    checkRootConfigs,
    installRootConfigs,
    type CheckedConfig,
} from "./lib/config-install.mts";
import { gateConfigPath, standardsDir } from "./lib/config-path.mts";
import { deriveRepoRoot } from "../lib/paths.mts";

// Root configs shared with every consumer repo. standards/ is the single
// source of truth (decision #19): these files live there and are installed
// from it — no copied config/root/ that can drift.
const ROOT_CONFIG_NAMES = [".editorconfig", "Directory.Build.props"] as const;

/**
 * Bootstrap a target repo (startDir's git root): install root configs then
 * upsert the AGENTS.md managed block. Order matters — the block references
 * the installed configs, so it reflects reality by the time it is written.
 * Prints nothing: `comply` renders output via the report contract.
 */
export async function runSetup({
    startDir,
}: {
    startDir: string;
}): Promise<void> {
    const repoRoot = await deriveRepoRoot({ startDir });
    await installRootConfigs({
        sourceDir: await standardsDir(),
        names: [...ROOT_CONFIG_NAMES],
        repoRoot,
    });

    const block = await readMarkedBlock({
        templatePath: await gateConfigPath({ name: "agents-block.md" }),
    });
    await writeMarkedBlock({ filePath: join(repoRoot, "AGENTS.md"), block });
}

export interface SetupCheck {
    configs: CheckedConfig[];
    agents: MarkedBlockStatus;
}

/**
 * Read-only bootstrap state for `verify`: report every managed artifact
 * (root configs + AGENTS.md block) without writing a byte. `comply` installs
 * and repairs these; `verify` must detect absence/drift/corruption and fail
 * loudly so local green always implies a fully bootstrapped checkout.
 */
export async function checkSetup({
    startDir,
}: {
    startDir: string;
}): Promise<SetupCheck> {
    const repoRoot = await deriveRepoRoot({ startDir });
    const configs = await checkRootConfigs({
        sourceDir: await standardsDir(),
        names: [...ROOT_CONFIG_NAMES],
        repoRoot,
    });
    const block = await readMarkedBlock({
        templatePath: await gateConfigPath({ name: "agents-block.md" }),
    });
    const agents = await checkMarkedBlock({
        filePath: join(repoRoot, "AGENTS.md"),
        block,
    });
    return { configs, agents };
}
