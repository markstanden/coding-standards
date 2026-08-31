// lib/ctx.mts — command parsing and run-context assembly for the gate.
//
// The public contract is exactly two verbs (decision #23): `comply` (bootstrap
// + repair + verify) and `verify` (read-only check). Everything else — no
// verb, unknown verbs, the old public `setup`, and the retired `--fix` /
// `--no-fix` / `--silent` flags — is a concise usage error with a non-zero
// exit. Never imports steps.

import { deriveRepoRoot } from "../../lib/paths.mts";

export type Verb = "comply" | "verify";
export type StepMode = "fix" | "no-fix";

export interface ParsedCommand {
    verb: Verb;
    help: boolean;
}

export interface RunContext {
    verb: Verb;
    repoRoot: string;
}

/**
 * Parse the positional verb. Returns help for `-h`/`--help`; throws a concise
 * usage error for anything else so typos never silently change behaviour.
 */
export function parseCommand({ argv }: { argv: string[] }): ParsedCommand {
    if (argv.length === 0) {
        throw new Error("missing command — expected 'comply' or 'verify'");
    }
    if (argv[0] === "-h" || argv[0] === "--help") {
        if (argv.length > 1) {
            throw new Error(`unexpected argument: ${argv[1]}`);
        }
        return { verb: "verify", help: true };
    }
    if (argv.length > 1) {
        throw new Error(`unexpected argument: ${argv[1]}`);
    }
    const verb = argv[0];
    if (verb === "comply" || verb === "verify") {
        return { verb, help: false };
    }
    if (verb === "setup") {
        throw new Error(
            "'setup' is no longer public — run 'comply' to bootstrap",
        );
    }
    if (verb === "--fix") {
        throw new Error("'--fix' is gone — run 'comply' to repair");
    }
    if (verb === "--no-fix" || verb === "--silent") {
        throw new Error(`'${verb}' is gone — run 'verify' to check`);
    }
    throw new Error(
        `unknown command '${verb}' — expected 'comply' or 'verify'`,
    );
}

/** Assemble a full run context, deriving the repo root from startDir. */
export async function createRunContext({
    verb,
    startDir,
}: {
    verb: Verb;
    startDir: string;
}): Promise<RunContext> {
    const repoRoot = await deriveRepoRoot({ startDir });
    return { verb, repoRoot };
}
