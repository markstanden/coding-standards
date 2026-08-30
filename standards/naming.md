<!-- update: agent=opencode | date=2026-08-30 | scope=standards/naming.md -->

# Naming conventions

House filename grammar for workflow templates and pipeline modules. One rule
for the *jobs* (workflows) and one for the *building blocks* (modules) that
serve them — see PLAN.md decision log #20.

## Workflow templates: `<namespace>--<loose-verb>[--<target>].yml`

Reusable `workflow_call` templates under `.github/workflows/` are **jobs**.
The filename encodes three segments separated by `--`:

```text
<namespace>--<loose-verb>[--<target>].yml
```

- `--` separates the segments; `-` joins words **within** a segment
  (`azure-swa`, `common-test-runner`).
- **Loose verb**, not the tool: name the intent (`build`, `test`, `deploy`,
  `check`, `verify`, `analyse`), never the binary that happens to do it
  (`curl`, `swa`, `playwright`). `healthcheck--curl-endpoints` is wrong;
  `healthcheck--verify--endpoints` is right.
- **Target is optional**: workflows with no scope drop the last segment
  (`defined--publish`, `defined--test`, `defined--verify` — the repo's own
  CI, namespace only).

Examples:

```text
dotnet--build--blazor-frontend.yml    dotnet--analyse--sonarqube.yml
dotnet--test--playwright-tests.yml    node--test--playwright.yml
azure-swa--deploy--blazor-wasm.yml    opentofu--destroy--workspace.yml
healthcheck--verify--endpoints.yml
```

Consequences:

- The double hyphen makes the segment boundaries greppable and unambiguous:
  `rg '^dotnet--'` finds every dotnet workflow regardless of verb/target.
- A `--` inside a segment is impossible by construction, so single-hyphen
  namespaces/targets (`azure-swa`, `blazor-wasm`) need no escaping.

## Pipeline modules: `<namespace>-<loose-verb-or-short-purpose>.mts`

`pipelines/*.mts` are **building blocks**, not job mirrors. They are shared
across workflows (e.g. `tofu-init.mts` serves both opentofu jobs), so a module
name never encodes a target and never matches a specific workflow 1:1.

```text
<namespace>-<loose-verb-or-short-purpose>.mts
```

- Single-hyphen kebab, same vocabulary as the workflow grammar (`build`,
  `test`, `deploy`, `check`, `verify`, `analyse`).
- Prefer a loose verb (`azure-swa-parse-outputs`, `dotnet-json-to-env`,
  `azure-swa-replace-appsettings`). A short purpose noun is acceptable when
  it names the artifact produced (`dotnet-playwright-version`).
- Never name a module after its tool (`healthcheck-curl` is wrong;
  `healthcheck-verify` is right).

## Test colocation

- A module's tests live next to it as `<module>.test.mts` and run under
  `node --test`. No test grab-bags: one test file per module.
- **Hard rule: a runnable module never ends in `-test`.** Node's default test
  discovery globs `**/*-test.*`, so a module named `dotnet-test.mts` is
  executed as a test and its `main()` runs for real. Name it
  `dotnet-verify.mts`, never `dotnet-test.mts`.

## Scope

This grammar covers workflow templates and pipeline modules. Single-token
modules (`runtime/steps/*.mts` where filename == step id, `lib/*.mts` shared
helpers) and `standards/` files are not part of the segmented scheme.