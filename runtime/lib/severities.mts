// lib/severities.mts — raises-only severity-floor maths.
//
// The rankable `as const` object is deliberately reserved for this module
// alone (decision #7): severity comparison is the one place ordering maths
// earns its complexity. Floors may be raised per run or per project, never
// lowered.

export type Severity = "info" | "style" | "warning" | "error";

/** Higher number = stricter. Ordered from most lenient to most strict. */
export const SEVERITY_RANK = {
  info: 0,
  style: 1,
  warning: 2,
  error: 3,
} as const;

function rankOf({ severity }: { severity: Severity }): number {
  if (!(severity in SEVERITY_RANK)) {
    throw new Error(
      `unknown severity '${severity}' — expected one of: ${Object.keys(SEVERITY_RANK).join(", ")}`,
    );
  }
  return SEVERITY_RANK[severity];
}

/** True when a finding's severity meets or exceeds the floor. */
export function isAtLeastFloor({
  value,
  floor,
}: {
  value: Severity;
  floor: Severity;
}): boolean {
  return rankOf({ severity: value }) >= rankOf({ severity: floor });
}

/**
 * Return the stricter of two floors. Used to merge the default floor with
 * per-project/per-run requests; a request can only raise, never lower.
 */
export function raiseFloor({
  current,
  requested,
}: {
  current: Severity;
  requested: Severity;
}): Severity {
  return rankOf({ severity: requested }) > rankOf({ severity: current })
    ? requested
    : current;
}
