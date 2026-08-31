// lib/config.mts — .defined.json reader and typed configuration.
//
// Reads the consumer's .defined.json at the repo root. The file is the single
// source of truth: it holds the optional immutable image pin (replacing the
// old .defined-version) and optional per-ecosystem coverage configuration.
//
// Version contract: an omitted `version` means "use the current published
// default image" (the launcher resolves it); a present `version` is an
// immutable pin and must be a 7–40 char hex SHA. The gate itself never uses
// the pin — only the launcher does — so an empty version is always valid here.
//
// Public surface:
//   loadConfig({ repoRoot })  — read + validate, or return empty config
//   CoverageConfig            — per-ecosystem coverage minimums
//   DefinedConfig             — full parsed config shape
//
// The runner is injected so tests need no filesystem.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CONFIG_FILE = ".defined.json";

export interface CoverageMinimums {
    /** Line coverage percentage (0–100). Omitted = not checked. */
    line?: number;
    /** Branch coverage percentage (0–100). Omitted = not checked. */
    branch?: number;
    /** Function coverage percentage (0–100). Omitted = not checked. */
    function?: number;
}

export interface CoverageConfig {
    /** Shell command to generate coverage reports (fix mode). */
    command: string;
    /** Minimums to enforce. Omitted key = not checked. */
    minimums?: CoverageMinimums;
}

export interface DefinedConfig {
    /**
     * Immutable image tag (7–40 hex chars). Empty when omitted — the launcher
     * then uses the current published default image (`latest`).
     */
    version: string;
    /** Per-ecosystem coverage configuration. Absent key = step skips. */
    coverage?: {
        node?: CoverageConfig;
        dotnet?: CoverageConfig;
    };
}

/** Empty config: all coverage steps skip, version is empty. */
const EMPTY: DefinedConfig = { version: "" };

const SHA_RE = /^[0-9a-f]{7,40}$/u;

function validateVersion(version: unknown): string {
    if (typeof version !== "string" || !SHA_RE.test(version)) {
        throw new Error(
            `.defined.json: "version" must be a 7–40 character hex SHA`,
        );
    }
    return version;
}

function validateMinimums(
    key: string,
    raw: unknown,
): CoverageMinimums | undefined {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        throw new TypeError(
            `.defined.json: "coverage.${key}.minimums" must be an object`,
        );
    }
    const result: CoverageMinimums = {};
    for (const [metric, value] of Object.entries(
        raw as Record<string, unknown>,
    )) {
        if (metric !== "line" && metric !== "branch" && metric !== "function") {
            throw new Error(
                `.defined.json: unknown minimum metric "${metric}" in "coverage.${key}.minimums"`,
            );
        }
        if (typeof value !== "number" || value < 0 || value > 100) {
            throw new Error(
                `.defined.json: "coverage.${key}.minimums.${metric}" must be a number 0–100`,
            );
        }
        result[metric as keyof CoverageMinimums] = value;
    }
    return result;
}

function validateCoverageEntry(key: string, raw: unknown): CoverageConfig {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error(`.defined.json: "coverage.${key}" must be an object`);
    }
    const entry = raw as Record<string, unknown>;
    if (typeof entry.command !== "string" || entry.command.trim() === "") {
        throw new Error(
            `.defined.json: "coverage.${key}.command" must be a non-empty string`,
        );
    }
    return {
        command: entry.command,
        minimums: validateMinimums(key, entry.minimums),
    };
}

function validateCoverage(raw: unknown): DefinedConfig["coverage"] {
    if (raw === undefined || raw === null) {
        return undefined;
    }
    if (typeof raw !== "object" || Array.isArray(raw)) {
        throw new TypeError(`.defined.json: "coverage" must be an object`);
    }
    const coverage = raw as Record<string, unknown>;
    const result: NonNullable<DefinedConfig["coverage"]> = {};
    for (const [key, value] of Object.entries(coverage)) {
        if (key !== "node" && key !== "dotnet") {
            throw new Error(
                `.defined.json: unknown coverage ecosystem "${key}"`,
            );
        }
        result[key as keyof NonNullable<DefinedConfig["coverage"]>] =
            validateCoverageEntry(key, value);
    }
    return result;
}

function validateParsed(raw: unknown): DefinedConfig {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        throw new Error(`.defined.json: must be a JSON object`);
    }
    const obj = raw as Record<string, unknown>;
    // Omitted version = "use the current published default image". A present
    // version must be an immutable pin; empty/null/non-string are errors.
    const version =
        obj.version === undefined ? "" : validateVersion(obj.version);
    const coverage = validateCoverage(obj.coverage);
    return { version, coverage };
}

/**
 * Read and validate .defined.json from repoRoot. Returns empty config when the
 * file is absent (coverage steps skip). Throws on malformed content.
 */
export async function loadConfig({
    repoRoot,
    readFileFn = readFile,
}: {
    repoRoot: string;
    readFileFn?: typeof readFile;
}): Promise<DefinedConfig> {
    const path = join(repoRoot, CONFIG_FILE);
    if (!existsSync(path)) {
        return EMPTY;
    }
    const content = await readFileFn(path, "utf8");
    let parsed: unknown;
    try {
        parsed = JSON.parse(content);
    } catch {
        throw new Error(`.defined.json: invalid JSON`);
    }
    return validateParsed(parsed);
}
