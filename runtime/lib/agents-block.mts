// runtime/lib/agents-block.mts — decision #14: seed, never own, a consumer AGENTS.md.
//
// Writes a marker-delimited managed block (<!-- defined:start --> …
// <!-- defined:end -->) into a target AGENTS.md from a template. Re-runs
// rewrite only the marked lines; project content above and below is preserved
// verbatim. A half-written block (one marker present) is treated as a broken
// install and fails loudly rather than being clobbered.

import { readFile, writeFile } from "node:fs/promises";

export const BLOCK_START = "<!-- defined:start -->";
export const BLOCK_END = "<!-- defined:end -->";

export type MarkedBlockStatus = "present" | "absent" | "drift" | "corrupt";

function isErrno(err: unknown, code: string): boolean {
    return (err as NodeJS.ErrnoException).code === code;
}

/** Read a file's text, returning "" when it does not exist. */
export async function readContentsOrEmpty({
    filePath,
}: {
    filePath: string;
}): Promise<string> {
    try {
        return await readFile(filePath, "utf8");
    } catch (err) {
        if (isErrno(err, "ENOENT")) return "";
        throw err;
    }
}

/**
 * Extract the managed block from a template: the span from BLOCK_START to
 * BLOCK_END inclusive, as a newline-terminated string. Throws when either
 * marker is missing or out of order, so a malformed template fails in setup,
 * never mid-install.
 */
export async function readMarkedBlock({
    templatePath,
}: {
    templatePath: string;
}): Promise<string> {
    const text = await readFile(templatePath, "utf8");
    const lines = text.split("\n");
    const startLine = lines.findIndex((l) => l.includes(BLOCK_START));
    const endLine = lines.findIndex((l) => l.includes(BLOCK_END));
    if (startLine === -1 || endLine === -1 || startLine > endLine) {
        throw new Error(
            `template ${templatePath} must contain ${BLOCK_START} before ${BLOCK_END}`,
        );
    }
    return lines.slice(startLine, endLine + 1).join("\n");
}

/**
 * Upsert the managed block in filePath (line-oriented). Absent target: the
 * block becomes the whole file. Present but unmarked: the block is appended
 * (one newline separates it from existing content). Present and marked: only
 * the marked lines are replaced, everything else untouched.
 */
export async function writeMarkedBlock({
    filePath,
    block,
}: {
    filePath: string;
    block: string;
}): Promise<void> {
    const existing = await readContentsOrEmpty({ filePath });
    const lines = existing === "" ? [] : existing.split("\n");
    const startLine = lines.findIndex((l) => l.includes(BLOCK_START));
    const endLine = lines.findIndex((l) => l.includes(BLOCK_END));
    if (
        (startLine === -1) !== (endLine === -1) ||
        (startLine !== -1 && startLine > endLine)
    ) {
        throw new Error(
            `${filePath} has a half-written or out-of-order defined block — resolve by hand, do not rerun`,
        );
    }

    const blockLines = block.split("\n");
    let next: string;
    if (startLine === -1) {
        // A content file that ends with "\n" splits into a trailing ""; dropping
        // it before appending keeps the block's marker as the sole separator
        // (no stray blank line), and is stable across re-runs.
        const base = lines.at(-1) === "" ? lines.slice(0, -1) : lines;
        next = base.concat(blockLines).join("\n");
    } else {
        next = lines
            .slice(0, startLine)
            .concat(blockLines, lines.slice(endLine + 1))
            .join("\n");
    }
    await writeFile(filePath, next);
}

/**
 * Read-only counterpart of writeMarkedBlock: classify the managed block in
 * filePath without writing a byte. Used by `verify` to detect absence, drift
 * or marker corruption before the check pass.
 *
 * - `corrupt`: one marker present, the other missing, or out of order.
 * - `absent`: no markers in the file (or the file does not exist).
 * - `drift`: marked block present but differs from the template.
 * - `present`: marked block matches the template exactly.
 */
export async function checkMarkedBlock({
    filePath,
    block,
}: {
    filePath: string;
    block: string;
}): Promise<MarkedBlockStatus> {
    const existing = await readContentsOrEmpty({ filePath });
    const lines = existing === "" ? [] : existing.split("\n");
    const startLine = lines.findIndex((l) => l.includes(BLOCK_START));
    const endLine = lines.findIndex((l) => l.includes(BLOCK_END));
    if (
        (startLine === -1) !== (endLine === -1) ||
        (startLine !== -1 && startLine > endLine)
    ) {
        return "corrupt";
    }
    if (startLine === -1) {
        return "absent";
    }
    const present = lines.slice(startLine, endLine + 1).join("\n");
    return present === block ? "present" : "drift";
}
