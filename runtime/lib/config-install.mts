// runtime/lib/config-install.mts — decision #13: shared configs into the repo root.
//
// Installs a named set of shared config files from a source directory (the
// standards/ dir) into the target repo root. Raises-only: an identical
// existing file is a no-op; a *different* existing file is a loud failure —
// the repo may have tightened its own rules and is never silently downgraded.
// Absent files are installed. Only the files in `names` are copied, so the
// standards dir stays the single source of truth and unrelated files never
// leak into a consumer repo root.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { readContentsOrEmpty } from "./agents-block.mts";

export type InstallStatus = "installed" | "unchanged";

export interface InstalledConfig {
    name: string;
    status: InstallStatus;
}

/**
 * Install the named root configs from sourceDir into repoRoot. Throws on the
 * first conflict; earlier installs in the same pass are already written.
 */
export async function installRootConfigs({
    sourceDir,
    names,
    repoRoot,
}: {
    sourceDir: string;
    names: string[];
    repoRoot: string;
}): Promise<InstalledConfig[]> {
    const results: InstalledConfig[] = [];
    for (const name of names) {
        const desired = await readFile(join(sourceDir, name), "utf8");
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
