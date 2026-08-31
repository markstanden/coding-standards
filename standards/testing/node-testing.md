<!-- update: agent=opencode | date=2026-08-31 | scope=standards/testing/node-testing.md -->

# Node testing and quality standards

House conventions for Node/TypeScript projects, mirroring
[`unit-testing.md`](unit-testing.md) for .NET.

## What the gate enforces

The gate's `node` step activates when a repo has a tracked `package.json` or
`*.md` file. It runs repo-wide prettier (house config + `.editorconfig` for
indentation):

| Check      | Tool     | Fix                    |
| ---------- | -------- | ---------------------- |
| Formatting | prettier | `comply` (repair pass) |

The gate does not run ESLint, `tsc --noEmit`, or project tests for consumers —
those need project-local dependency restore and stay with the project (or a
future gate extension).

## Testing stack (gate-internal, guidance)

These conventions apply to the `defined` runtime's own `*.test.mts` suite and
are a recommendation for consumer Node projects, not a mechanically enforced
rule:

- **Runner**: `node --test` (Node ≥ 26 strip-types) — zero dependencies keeps
  "drop in anywhere" honest; no vitest/jest required.
- **Assertions**: `node:assert/strict`.
- **Colocation**: tests live next to the module as `<module>.test.mts`.
- **No test grab-bags**: one test file per module.

## Module conventions (gate-internal, law)

These are conventions for the gate's own `runtime/` and `lib/` TypeScript
modules, not enforced against consumer code:

- **No enums/namespaces**: bare string-literal unions (e.g. `"fix" | "no-fix"`).
- **Extensioned imports**: `./foo.mts`, never extensionless.
- **Zero dependencies** in modules: Node built-ins + `lib/` shared blocks only.
- **Object params**: public functions take one destructured object; positional
  params only for genuinely unary operations.
- **Runnable modules never end in `-test`**: Node's `*-test.*` discovery glob
  would execute them.
- **Injected runner**: modules that invoke binaries accept an optional
  `runner` param so tests need no host binaries.

## Test naming

`[methodName]_[condition]_[expectedBehaviour]` — same shape as the C#
convention in `unit-testing.md`.

## TDD

Write the failing test first, then the module. Keep changes small, testable,
one concept at a time.
