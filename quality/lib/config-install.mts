// lib/config-install.mts — decision #13: shared configs into the repo root.
//
// Copies every file in a gate config directory into the target repo root.
// Raises-only: an identical existing file is a no-op; a *different* existing
// file is a loud failure — the repo may have tightened its own rules and is
// never silently downgraded. Absent files are installed.

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readContentsOrEmpty } from "./agents-block.mts";

export type InstallStatus = "installed" | "unchanged";

export interface InstalledConfig {
  name: string;
  status: InstallStatus;
}

/**
 * Install root configs from sourceDir into repoRoot. Subdirectories are
 * ignored (root configs are flat files only). Throws on the first conflict;
 * earlier installs in the same pass are already written.
 */
export async function installRootConfigs({
  sourceDir,
  repoRoot,
}: {
  sourceDir: string;
  repoRoot: string;
}): Promise<InstalledConfig[]> {
  const entries = await readdir(sourceDir);
  const results: InstalledConfig[] = [];
  for (const name of entries) {
    const source = join(sourceDir, name);
    if ((await stat(source)).isDirectory()) {
      continue;
    }
    const desired = await readFile(source, "utf8");
    const target = join(repoRoot, name);
    const existing = await readContentsOrEmpty({ filePath: target });
    if (existing === "") {
      await writeFile(target, desired);
      results.push({ name, status: "installed" });
    } else if (existing === desired) {
      results.push({ name, status: "unchanged" });
    } else {
      throw new Error(
        `${target} differs from the gate's copy — resolve by hand; the gate never overwrites (raises-only)`,
      );
    }
  }
  return results;
}