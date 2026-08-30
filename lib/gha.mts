// lib/gha.mts — GitHub Actions output-file helpers for pipeline modules.
//
// Thin, testable writers for the GITHUB_OUTPUT / GITHUB_ENV / GITHUB_STEP_SUMMARY
// files. Pipeline modules call these instead of inline `echo "x=y" >> $GITHUB_OUTPUT`
// bash, so every workflow file stops carrying shell-append logic.

import { appendFile } from "node:fs/promises";

/**
 * Append `key=value` lines to a GitHub Actions file (GITHUB_OUTPUT, GITHUB_ENV,
 * GITHUB_STEP_SUMMARY, ...). The file path comes from the matching environment
 * variable; an absent path (local runs) is a no-op so modules stay runnable
 * outside CI.
 */
export async function appendToFile({
    envName,
    lines,
}: {
    envName: string;
    lines: Record<string, string>;
}): Promise<void> {
    const file = process.env[envName];
    if (!file) return;
    const body = Object.entries(lines)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n");
    await appendFile(file, `${body}\n`, "utf8");
}

/**
 * Mask a value in the workflow log (`::add-mask::`). No-op when the value is
 * empty, so callers can mask unconditionally.
 */
export function maskValue(value: string): void {
    if (value !== "") {
        console.log(`::add-mask::${value}`);
    }
}
