// pipelines/healthcheck-verify.mts — cURL healthchecks against a route list.
//
// Extracted from healthcheck--verify--endpoints.yml ("Test endpoints" step).
// Parses the JSON routes array (jq replaced by Node), curls each endpoint with
// retries, and fails the run when any endpoint fails. curl is baked in the
// image.
//
// Inputs (env): BASE_URL, ROUTES_ARRAY (JSON array of routes), MAX_TIMEOUT,
// RETRY_ATTEMPTS, RETRY_DELAY.

import { run } from "../lib/proc.mts";

export interface HealthcheckInput {
  baseUrl: string;
  routes: string[];
  maxTimeout: string;
  retryAttempts: string;
  retryDelay: string;
}

export interface HealthcheckResult {
  ok: string[];
  failed: string[];
}

/**
 * Probe every route with curl and collect the outcomes. curl uses
 * `-f -sS --retry N --retry-all-errors --retry-delay D --max-time T -o /dev/null`.
 */
export function runHealthcheck({
  baseUrl,
  routes,
  maxTimeout,
  retryAttempts,
  retryDelay,
}: HealthcheckInput): HealthcheckResult {
  const ok: string[] = [];
  const failed: string[] = [];

  for (const route of routes) {
    const fullUrl = `${baseUrl}${route}`;
    const result = run({
      cmd: "curl",
      args: [
        "-f", "-sS",
        "--max-time", maxTimeout,
        "--retry", retryAttempts,
        "--retry-all-errors",
        "--retry-delay", retryDelay,
        "-o", "/dev/null",
        fullUrl,
      ],
    });
    if (result.status === 0) {
      ok.push(fullUrl);
    } else {
      failed.push(fullUrl);
    }
  }
  return { ok, failed };
}

export function parseRoutes(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((r) => typeof r === "string")) {
      return parsed;
    }
  } catch {
    // fall through to the throw below
  }
  throw new Error("ROUTES_ARRAY must be a JSON array of route strings");
}

async function main(): Promise<void> {
  const result = runHealthcheck({
    baseUrl: process.env.BASE_URL ?? "",
    routes: parseRoutes(process.env.ROUTES_ARRAY ?? "[]"),
    maxTimeout: process.env.MAX_TIMEOUT ?? "30",
    retryAttempts: process.env.RETRY_ATTEMPTS ?? "5",
    retryDelay: process.env.RETRY_DELAY ?? "5",
  });

  for (const url of result.ok) {
    console.log(`✓ ${url} is responding`);
  }
  for (const url of result.failed) {
    console.log(`✗ ${url} failed`);
  }

  if (result.failed.length > 0) {
    console.error(`${result.failed.length} endpoint(s) failed:`);
    for (const url of result.failed) {
      console.error(`  - ${url}`);
    }
    process.exit(1);
  }
  console.log("All endpoints are responding");
}

if (import.meta.main) {
  await main();
}