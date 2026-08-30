// pipelines/tofu-outputs.mts — collect and verify OpenTofu outputs.
//
// Extracted from opentofu--build--infrastructure.yml ("Get OpenTofu Outputs"
// and "Verify outputs file" steps). Masks each raw output value (jq + bash
// replaced by Node), writes the full JSON to the artifact file, then verifies
// it exists. The image has no jq, so JSON handling lives here.
//
// Inputs (env): INFRA_DIR, OUTPUT_JSON_FILENAME, GITHUB_OUTPUT.

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { maskValue } from "../lib/gha.mts";
import { run, type Runner } from "../lib/proc.mts";

export interface TofuOutputsInput {
    infraDir?: string;
    outputJsonFilename?: string;
}

export interface TofuOutputsResult {
    keys: string[];
    artifactPath: string;
}

/**
 * Collect tofu outputs: parse `tofu output -json`, mask every key's value,
 * and write the outputs JSON to the artifact file. Returns the keys seen and
 * the artifact path so callers can verify.
 */
export async function collectTofuOutputs({
    infraDir,
    outputJsonFilename = "tofu_outputs.json",
    runner = run,
}: TofuOutputsInput & { runner?: Runner }): Promise<TofuOutputsResult> {
    const cwd = infraDir ? resolve(infraDir) : process.cwd();
    const artifactPath = resolve(cwd, outputJsonFilename);

    const result = runner({ cmd: "tofu", args: ["output", "-json"], cwd });
    let outputs: Record<string, { value?: string }>;
    try {
        outputs = JSON.parse(result.stdout) as Record<
            string,
            { value?: string }
        >;
    } catch {
        outputs = {};
    }

    const keys = Object.keys(outputs);
    for (const key of keys) {
        const value = outputs[key]?.value;
        if (value !== undefined) {
            maskValue(value);
        }
    }

    await writeFile(artifactPath, result.stdout || "{}", "utf8");
    return { keys, artifactPath };
}

/** Verify the artifact file exists and is non-empty; throws otherwise. */
export async function verifyOutputsFile({
    artifactPath,
}: {
    artifactPath: string;
}): Promise<void> {
    try {
        const contents = await readFile(artifactPath, "utf8");
        if (contents.trim() === "") {
            throw new Error(`outputs file is empty: ${artifactPath}`);
        }
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            throw new Error(`outputs file does not exist: ${artifactPath}`);
        }
        throw err;
    }
}

async function main(): Promise<void> {
    const { artifactPath } = await collectTofuOutputs({
        infraDir: process.env.INFRA_DIR,
        outputJsonFilename: process.env.OUTPUT_JSON_FILENAME,
    });
    await verifyOutputsFile({ artifactPath });
    console.log(`outputs artifact verified: ${artifactPath}`);
}

if (import.meta.main) {
    await main();
}
