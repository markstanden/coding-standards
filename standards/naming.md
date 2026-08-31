<!-- update: agent=opencode | date=2026-08-31 | scope=standards/naming.md -->

# Naming conventions

House filename grammar for the gate's own workflow files. The gate exposes
exactly one consumer-facing reusable workflow and keeps two for its own CI; the
filename encodes the segments.

## Workflow files: `<namespace>--<loose-verb>[--<target>].yml`

Workflow files under `.github/workflows/` follow this grammar. The filename
encodes three segments separated by `--`:

```text
<namespace>--<loose-verb>[--<target>].yml
```

- `--` separates the segments; `-` joins words **within** a segment.
- **Loose verb**, not the tool: name the intent (`build`, `test`, `verify`,
  `publish`), never the binary that happens to do it.
- **Target is optional**: workflows without a scope are namespace + verb only
  (`defined--publish`, `defined--test`, `defined--verify`).

The gate's three workflow files:

```text
defined--verify.yml    defined--test.yml    defined--publish.yml
```

Only `defined--verify.yml` is a reusable workflow a consumer invokes at a job
level; the other two are ordinary CI for this repo.

Consequences:

- The double hyphen makes the segment boundaries greppable and unambiguous:
  `rg '^defined--'` finds every gate workflow.
- A `--` inside a segment is impossible by construction, so single-hyphen
  namespaces/targets need no escaping.

## Scope and enforcement

This grammar covers the gate's workflow files. Internal modules
(`runtime/steps/*.mts` where filename == step id, `lib/*.mts` shared helpers)
and `standards/` files are not part of the segmented scheme.

The grammar is currently upheld by convention (naming is reviewed, not yet
mechanically enforced — the gate's `naming` step is reserved and disabled).
