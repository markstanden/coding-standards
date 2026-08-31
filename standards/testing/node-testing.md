<!-- update: agent=opencode | date=2026-08-30 | scope=standards/testing/node-testing.md -->

# Node testing and quality standards

House conventions for Node/TypeScript projects, mirroring
[`unit-testing.md`](unit-testing.md) for .NET. These are the defaults the gate
enforces; the sibling doc defines the C# stack.

## Quality checks (what the gate runs)

The gate's `node` step runs these over a tracked npm project — local green =
merge green:

| Check      | Tool                               | Fix                          |
| ---------- | ---------------------------------- | ---------------------------- |
| Formatting | prettier (repo-wide, house config) | `comply` (repair pass)       |
| Lint       | eslint                             | project config               |
| Types      | `tsc --noEmit` (project)           | project config               |
| Tests      | node's test runner                 | `comply` reruns, never skips |

## Testing stack

- **Runner**: `node --test` (Node ≥ 26 strip-types) — zero dependencies keeps
  "drop in anywhere" honest; no vitest/jest required.
- **Assertions**: `node:assert/strict`.
- **Colocation**: tests live next to the module as `<module>.test.mts`.
- **No test grab-bags**: one test file per module.

## Module conventions (law, not preference)

- **No enums/namespaces**: bare string-literal unions (`"check" | "fix"`).
- **Extensioned imports**: `./foo.mts`, never extensionless.
- **Zero dependencies** in modules: Node built-ins + `lib/` shared blocks only.
- **Object params**: public functions take one destructured object; positional
  params only for genuinely unary operations.
- **Runnable modules never end in `-test`**: Node's `*-test.*` discovery glob
  would execute them (see `standards/naming.md`).
- **Injected runner**: modules that invoke binaries accept an optional
  `runner = run` param so tests need no host binaries.

## Test naming

`[methodName]_[condition]_[expectedBehaviour]` — same shape as the C#
convention in `unit-testing.md`.

## TDD

Write the failing test first, then the module. Keep changes small, testable,
one concept at a time.
