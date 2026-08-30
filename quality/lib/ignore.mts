// lib/ignore.mts — effective ignore files for gate steps.
//
// The gate's travelling ignore (quality/config/*ignore) is a *base*; the host
// repo's own ignore file is additive — it knows what to ignore in its tree
// (decision #10). NOTE (2026-08-30): prettier resolves ignore patterns
// relative to the ignore FILE, not CWD, so the merged file must be
// materialised at the repo root for repo-relative patterns to match (see
// PLAN.md "Confirmed: prettier resolves ignore patterns…").

import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

/**
 * Merge base + host ignore content into the effective ignore file content.
 * Host additions follow a separator comment so a dump is readable. Pure and
 * table-testable.
 */
export function mergeIgnoreContents({
  base,
  host,
}: {
  base: string;
  host: string;
}): string {
  const hostTrimmed = host.trim();
  if (hostTrimmed === "") {
    return base;
  }
  const baseTrimmed = base.trimEnd();
  return `${baseTrimmed}\n\n# host repo additions\n${hostTrimmed}\n`;
}

/**
 * Materialise the merged ignore content to a throwaway file and return its
 * path. Used only when the host has its own ignore file; otherwise steps pass
 * the gate config path directly. The temp dir is cleaned up on close.
 */
export async function writeMergedIgnore({
  content,
}: {
  content: string;
}): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "quality-ignore-"));
  const file = join(dir, "prettierignore");
  await writeFile(file, content);
  return file;
}

/** Best-effort cleanup for a temp file created by writeMergedIgnore. */
export async function removeMergedIgnore({ path }: { path: string }): Promise<void> {
  await rm(dirname(path), { recursive: true, force: true });
}