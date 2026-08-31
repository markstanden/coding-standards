<!-- update: agent=opencode | date=2026-08-31 | scope=standards/naming.md -->

# Naming conventions

House filename grammar for the gate's own workflow templates. The gate exposes
exactly one consumer-facing reusable workflow and keeps two for its own CI; the
filename encodes the segments — see PLAN.md decision log #20 and the refocus
scope (#22, #25).

## Workflow templates: `<namespace>--<loose-verb>[--<target>].yml`

Reusable `workflow_call` templates under `.github/workflows/` are **jobs**.
The filename encodes three segments separated by `--`:

```text
<namespace>--<loose-verb>[--<target>].yml
```

- `--` separates the segments; `-` joins words **within** a segment.
- **Loose verb**, not the tool: name the intent (`build`, `test`, `verify`,
  `publish`), never the binary that happens to do it.
- **Target is optional**: workflows with no scope drop the last segment
  (`defined--publish`, `defined--test`, `defined--verify` — the repo's own
  gate workflows, namespace only).

The gate's three workflows:

```text
defined--verify.yml    defined--test.yml    defined--publish.yml
```

Consequences:

- The double hyphen makes the segment boundaries greppable and unambiguous:
  `rg '^defined--'` finds every gate workflow.
- A `--` inside a segment is impossible by construction, so single-hyphen
  namespaces/targets need no escaping.

## Scope

This grammar covers the gate's workflow templates. Internal modules
(`runtime/steps/*.mts` where filename == step id, `lib/*.mts` shared helpers)
and `standards/` files are not part of the segmented scheme.
