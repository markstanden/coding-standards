// lib/json.mts — safe JSON file reading (jq replacement).
//
// Shared building block for pipelines: reads and validates a JSON file,
// throwing a clear error on absence or malformed content. Pipeline modules
// use this instead of shelling out to jq, which is not baked in the image.

import { readFile } from "node:fs/promises";

/**
 * Read and parse a JSON file. Throws a descriptive error when the file is
 * missing or contains invalid JSON, so callers never conflate the two.
 */
export async function readJsonFile<T>({
    filePath,
}: {
    filePath: string;
}): Promise<T> {
    let text: string;
    try {
        text = await readFile(filePath, "utf8");
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(`JSON file not found: ${filePath}`);
        }
        throw err;
    }
    try {
        return JSON.parse(text) as T;
    } catch (err) {
        throw new Error(
            `invalid JSON in ${filePath}: ${(err as Error).message}`,
        );
    }
}

/**
 * Extract the `.value` field of an OpenTofu output entry by key, if present.
 * OpenTofu outputs have the shape { "<key>": { "value": ..., "sensitive": bool } }.
 * Returns undefined when the key is absent, so callers can distinguish
 * "not there" from a genuinely empty value.
 */
export function tofuOutputValue<T>({
    outputs,
    key,
}: {
    outputs: Record<string, unknown>;
    key: string;
}): T | undefined {
    const entry = outputs[key] as { value?: T } | undefined;
    return entry?.value;
}
