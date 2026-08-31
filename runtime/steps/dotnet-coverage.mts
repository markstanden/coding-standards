// steps/dotnet-coverage.mts — .NET coverage gate: parse Cobertura, enforce thresholds.
//
// Tools:    none (parses existing coverage reports)
// Config:   .defined.json "coverage.dotnet" — command + thresholds
// Fix:      runs the consumer's coverage command, then validates the report
// Skip:     no .defined.json entry for "dotnet", or no Cobertura XML found
//
// Detection is config-driven: the step only activates when .defined.json
// includes a "coverage.dotnet" entry. The consumer provides the shell command
// to generate coverage reports; the gate parses the resulting Cobertura XML
// and enforces line/branch thresholds.
// The runner is injected so tests need no host binaries.

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import {
    failed,
    passed,
    skipped,
    type StepResult,
} from "../lib/step-result.mts";
import { run } from "../../lib/proc.mts";
import { loadConfig, type CoverageThresholds } from "../lib/config.mts";

export interface DotNetCoverageRunContext {
    mode: "fix" | "no-fix";
    repoRoot: string;
}

type Runner = typeof run;

const COBERTURA_NAME = "coverage.cobertura.xml";

export interface CoberturaSummary {
    /** 0.0–1.0 */
    lineRate: number;
    /** 0.0–1.0 */
    branchRate: number | undefined;
}

function tryParseFloat(attr: string | undefined): number | undefined {
    if (attr === undefined || attr === "") {
        return undefined;
    }
    const value = Number(attr);
    return Number.isFinite(value) ? value : undefined;
}

/**
 * Parse a Cobertura XML document. Extracts `line-rate` and `branch-rate` from
 * the root `<coverage>` element. Rates are 0.0–1.0. Returns zeros when the
 * rates are absent.
 */
export function parseCobertura({
    content,
}: {
    content: string;
}): CoberturaSummary {
    const lineRate = tryParseFloat(extractAttribute(content, "line-rate"));
    const branchRate = tryParseFloat(extractAttribute(content, "branch-rate"));
    return {
        lineRate: lineRate ?? 0,
        branchRate,
    };
}

/**
 * Extract a single attribute value from the first tag in an XML string.
 * Handles single/double quotes and decimal forms. Returns undefined when the
 * attribute is not present.
 */
function extractAttribute(xml: string, name: string): string | undefined {
    const re = new RegExp(
        `${name}\\s*=\\s*["']([^"']*)["']`,
        "u",
    );
    const match = xml.match(re);
    return match?.[1];
}

export function checkThresholds({
    summary,
    thresholds,
}: {
    summary: CoberturaSummary;
    thresholds: CoverageThresholds;
}): { pass: boolean; failures: string[] } {
    const failures: string[] = [];

    if (thresholds.line !== undefined) {
        const pct = summary.lineRate * 100;
        if (pct < thresholds.line) {
            failures.push(
                `line: ${pct.toFixed(1)}% < ${thresholds.line}% threshold`,
            );
        }
    }

    if (thresholds.branch !== undefined) {
        if (summary.branchRate === undefined) {
            failures.push(
                `branch: report has no branch-rate data (threshold ${thresholds.branch}%)`,
            );
        } else {
            const pct = summary.branchRate * 100;
            if (pct < thresholds.branch) {
                failures.push(
                    `branch: ${pct.toFixed(1)}% < ${thresholds.branch}% threshold`,
                );
            }
        }
    }

    if (thresholds.function !== undefined) {
        // Cobertura XML from coverlet does not expose a single function-rate
        // attribute; function-level coverage is not a stable top-level metric
        // we can aggregate reliably. A configured function threshold cannot be
        // satisfied, so fail loudly rather than silently ignoring it.
        failures.push(
            `function: report format has no function coverage (threshold ${thresholds.function}%)`,
        );
    }

    return { pass: failures.length === 0, failures };
}

function effectiveThresholds(
    configThresholds: CoverageThresholds | undefined,
): CoverageThresholds {
    if (configThresholds === undefined) {
        return { line: 80 };
    }
    return configThresholds;
}

function findCoberturaFile({ repoRoot }: { repoRoot: string }): string | null {
    const candidates = [
        join(repoRoot, COBERTURA_NAME),
        join(repoRoot, "TestResults", COBERTURA_NAME),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate)) {
            return candidate;
        }
    }
    return null;
}

/**
 * Run dotnet coverage gate. Skips when no config entry; in fix mode, runs the
 * consumer's command; always validates the report against configured
 * thresholds. Looks for coverage.cobertura.xml at repo root or TestResults/.
 */
export async function runDotNetCoverageStep({
    ctx,
    trackedFiles,
    runner = run,
    readFileFn = readFile,
}: {
    ctx: DotNetCoverageRunContext;
    trackedFiles: string[];
    runner?: Runner;
    readFileFn?: typeof readFile;
}): Promise<StepResult> {
    const config = await loadConfig({ repoRoot: ctx.repoRoot, readFileFn });
    if (!config.coverage?.dotnet) {
        return skipped({
            notice: "dotnet-coverage: no coverage.dotnet entry in .defined.json",
        });
    }

    const coverageConfig = config.coverage.dotnet;

    if (ctx.mode === "fix") {
        const result = runner({
            cmd: "sh",
            args: ["-c", coverageConfig.command],
            cwd: ctx.repoRoot,
        });
        if (result.status !== 0) {
            return failed({
                notice: `dotnet-coverage: coverage command failed: ${result.stderr.trim() || result.stdout.trim()}`,
            });
        }
    }

    const coberturaPath = findCoberturaFile({ repoRoot: ctx.repoRoot });
    if (coberturaPath === null) {
        return failed({
            notice: `dotnet-coverage: no coverage report at ${COBERTURA_NAME} (or TestResults/coverage.cobertura.xml) — run coverage in a prior step or check command`,
        });
    }

    const content = await readFileFn(resolve(coberturaPath), "utf8");
    const summary = parseCobertura({ content });

    if (summary.lineRate === 0 && summary.branchRate === undefined) {
        return failed({
            notice: "dotnet-coverage: Cobertura XML contains no coverage data",
        });
    }

    const thresholds = effectiveThresholds(coverageConfig.thresholds);
    const { pass, failures } = checkThresholds({ summary, thresholds });

    if (!pass) {
        return failed({
            notice: `dotnet-coverage: ${failures.join("; ")}`,
        });
    }

    const pct = (summary.lineRate * 100).toFixed(1);
    return passed({
        notice: `dotnet-coverage: ${pct}% line coverage`,
    });
}
