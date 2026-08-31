// steps/node-coverage.mts — Node/JS coverage gate: parse lcov, enforce thresholds.
//
// Tools:    none (parses existing coverage reports)
// Config:   .defined.json "coverage.node" — command + thresholds
// Fix:      runs the consumer's coverage command, then validates the report
// Skip:     no .defined.json entry for "node", or no coverage/lcov.info found
//
// Detection is config-driven: the step only activates when .defined.json
// includes a "coverage.node" entry. The consumer provides the shell command
// to generate coverage reports; the gate parses the resulting lcov.info
// and enforces line/branch/function thresholds.
// The runner is injected so tests need no host binaries.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import {
    failed,
    passed,
    skipped,
    type StepResult,
} from "../lib/step-result.mts";
import { run } from "../../lib/proc.mts";
import { loadConfig, type CoverageThresholds } from "../lib/config.mts";

export interface NodeCoverageRunContext {
    mode: "fix" | "no-fix";
    repoRoot: string;
}

type Runner = typeof run;

export interface LcovSummary {
    linesFound: number;
    linesHit: number;
    branchesFound: number;
    branchesHit: number;
    functionsFound: number;
    functionsHit: number;
}

const LCOV_PATH = "coverage/lcov.info";

/**
 * Parse an lcov string and aggregate coverage across all source files.
 * Returns the summed line/branch/function counters. Returns zeros when no
 * data found.
 */
export function parseLcov({ content }: { content: string }): LcovSummary {
    let linesFound = 0;
    let linesHit = 0;
    let branchesFound = 0;
    let branchesHit = 0;
    let functionsFound = 0;
    let functionsHit = 0;

    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (trimmed.startsWith("LF:")) {
            linesFound += Number(trimmed.slice(3));
        } else if (trimmed.startsWith("LH:")) {
            linesHit += Number(trimmed.slice(3));
        } else if (trimmed.startsWith("BRF:")) {
            branchesFound += Number(trimmed.slice(4));
        } else if (trimmed.startsWith("BRH:")) {
            branchesHit += Number(trimmed.slice(4));
        } else if (trimmed.startsWith("FNF:")) {
            functionsFound += Number(trimmed.slice(4));
        } else if (trimmed.startsWith("FNH:")) {
            functionsHit += Number(trimmed.slice(4));
        }
    }

    return {
        linesFound,
        linesHit,
        branchesFound,
        branchesHit,
        functionsFound,
        functionsHit,
    };
}

export function checkThresholds({
    summary,
    thresholds,
}: {
    summary: LcovSummary;
    thresholds: CoverageThresholds;
}): { pass: boolean; failures: string[] } {
    const failures: string[] = [];

    if (thresholds.line !== undefined) {
        const pct =
            summary.linesFound > 0
                ? (summary.linesHit / summary.linesFound) * 100
                : 0;
        if (pct < thresholds.line) {
            failures.push(
                `line: ${pct.toFixed(1)}% < ${thresholds.line}% threshold`,
            );
        }
    }

    if (thresholds.branch !== undefined) {
        const pct =
            summary.branchesFound > 0
                ? (summary.branchesHit / summary.branchesFound) * 100
                : 0;
        if (pct < thresholds.branch) {
            failures.push(
                `branch: ${pct.toFixed(1)}% < ${thresholds.branch}% threshold`,
            );
        }
    }

    if (thresholds.function !== undefined) {
        const pct =
            summary.functionsFound > 0
                ? (summary.functionsHit / summary.functionsFound) * 100
                : 0;
        if (pct < thresholds.function) {
            failures.push(
                `function: ${pct.toFixed(1)}% < ${thresholds.function}% threshold`,
            );
        }
    }

    return { pass: failures.length === 0, failures };
}

/**
 * Effective thresholds: consumer-provided thresholds override the 80% line
 * default. When thresholds key is absent entirely, default to 80% line only.
 */
function effectiveThresholds(
    configThresholds: CoverageThresholds | undefined,
): CoverageThresholds {
    if (configThresholds === undefined) {
        return { line: 80 };
    }
    return configThresholds;
}

/**
 * Run Node.js coverage gate. Skips when no config entry or no report found;
 * in fix mode, runs the consumer's command first; always validates the report
 * against configured thresholds.
 */
export async function runNodeCoverageStep({
    ctx,
    trackedFiles,
    runner = run,
    readFileFn = readFile,
}: {
    ctx: NodeCoverageRunContext;
    trackedFiles: string[];
    runner?: Runner;
    readFileFn?: typeof readFile;
}): Promise<StepResult> {
    const config = await loadConfig({ repoRoot: ctx.repoRoot, readFileFn });
    if (!config.coverage?.node) {
        return skipped({
            notice: "node-coverage: no coverage.node entry in .defined.json",
        });
    }

    const coverageConfig = config.coverage.node;

    if (ctx.mode === "fix") {
        const result = runner({
            cmd: "sh",
            args: ["-c", coverageConfig.command],
            cwd: ctx.repoRoot,
        });
        if (result.status !== 0) {
            return failed({
                notice: `node-coverage: coverage command failed: ${result.stderr.trim() || result.stdout.trim()}`,
            });
        }
    }

    const lcovPath = join(ctx.repoRoot, LCOV_PATH);
    if (!existsSync(lcovPath)) {
        return failed({
            notice: `node-coverage: no coverage report at ${LCOV_PATH} — run coverage in a prior step or check command`,
        });
    }

    const content = await readFileFn(lcovPath, "utf8");
    const summary = parseLcov({ content });

    if (summary.linesFound === 0) {
        return failed({
            notice: "node-coverage: lcov report contains no line data",
        });
    }

    const thresholds = effectiveThresholds(coverageConfig.thresholds);
    const { pass, failures } = checkThresholds({ summary, thresholds });

    if (!pass) {
        return failed({
            notice: `node-coverage: ${failures.join("; ")}`,
        });
    }

    const pct = ((summary.linesHit / summary.linesFound) * 100).toFixed(1);
    return passed({
        notice: `node-coverage: ${pct}% line coverage (${summary.linesHit}/${summary.linesFound})`,
    });
}
