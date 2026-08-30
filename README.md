# Coding Standards

A single source of truth for my development project configuration files, workflow templates, and development tools to ensure consistency across projects.

**defined** — a portable, drop-in quality gate and workflow runtime base. A
single container image (`runtime/`) that detects any project's stack and runs
the right checks, backed by shared building blocks (`lib/`), pipeline modules
(`pipelines/`) and house standards (`standards/`). The design and decision log
live in [PLAN.md](PLAN.md).

## The gate: one command owns verification

`./runtime/verify.sh` from a project root gates it. Local green = merge green:
CI runs the same image.

```bash
./runtime/verify.sh            # check mode
./runtime/verify.sh --fix      # repair mechanically (fmt/lint autofix)
./runtime/verify.sh --silent   # log-style output for CI
./runtime/verify.sh setup      # bootstrap: installs root configs + AGENTS.md block
```

The gate detects the stack (steps run in order `naming → node → dotnet → shell
→ yaml → workflow → tofu`), skips cleanly when an ecosystem is absent, and
fails loudly when a pinned tool is missing. Tool versions are pinned in
[`runtime/tool-versions.env`](runtime/tool-versions.env) — a pin change rebuilds
the image.

## Adopt the gate in a consumer repo

1. **Bootstrap** — run `verify.sh setup` to install `.editorconfig` and
   `Directory.Build.props` into the repo root and seed the AGENTS.md managed
   block (raises-only; your tightened rules are never overwritten).
2. **Gate locally** — `./runtime/verify.sh` (add `--fix` to repair).
3. **Gate in CI** — call the reusable `defined--verify.yml` workflow, pinned
   to a git sha with a matching image tag:

    ```yaml
    jobs:
        quality:
            uses: markstanden/coding-standards/.github/workflows/defined--verify.yml@<shortsha>
            with:
                image-tag: <shortsha>
    ```

    The image tag IS the release: pin the workflow ref and image tag to the
    same commit so local green = merge green by construction.

## Workflow template catalogue

Reusable `workflow_call` templates under `.github/workflows/`. Call any of
these from a consumer pipeline via a gitsha-pinned ref. Filename grammar:
`<namespace>--<loose-verb>[--<target>]` (see [`standards/naming.md`](standards/naming.md)).

| Template                              | What it runs                                    |
| ------------------------------------- | ----------------------------------------------- |
| `defined--verify.yml`                 | The gate itself (quality scan for any repo)     |
| `dotnet--analyse--sonarqube.yml`      | SonarQube analysis (outside the gate by design) |
| `dotnet--build--blazor-frontend.yml`  | Blazor WASM frontend build (npm + dotnet)       |
| `dotnet--test--playwright-tests.yml`  | Playwright end-to-end tests                     |
| `node--build--frontend.yml`           | Node frontend build                             |
| `node--test--playwright.yml`          | Playwright tests for a node project             |
| `azure-swa--deploy--blazor-wasm.yml`  | Deploy Blazor WASM to Azure Static Web Apps     |
| `azure-swa--deploy--static-site.yml`  | Deploy a static site to Azure Static Web Apps   |
| `opentofu--build--infrastructure.yml` | OpenTofu init/plan/apply with outputs           |
| `opentofu--destroy--workspace.yml`    | OpenTofu workspace destroy                      |
| `healthcheck--verify--endpoints.yml`  | cURL healthchecks against a route list          |

A full example pipeline is in [`standards/workflows/pipeline.example.yml`](standards/workflows/pipeline.example.yml).

## Standards

- [`standards/naming.md`](standards/naming.md) — workflow + pipeline filename grammar
- [`standards/testing/unit-testing.md`](standards/testing/unit-testing.md) — C#/xUnit testing patterns
- [`standards/testing/node-testing.md`](standards/testing/node-testing.md) — Node/TypeScript testing + module conventions
- [`practices/architecture.md`](practices/architecture.md) — delivery/structure/code preferences
- [`standards/.editorconfig`](standards/.editorconfig) — editor + dotnet code style (installed by gate setup)
- [`standards/Directory.Build.props`](standards/Directory.Build.props) — common MSBuild properties (installed by gate setup)
- [`standards/git-hooks/`](standards/git-hooks/) — .NET git hooks

## Project structure

```bash
coding-standards/
├── runtime/                          # the container image (gate + runtime base)
│   ├── Containerfile                 # node 26 slim base, pinned tools
│   ├── tool-versions.env             # single source of tool version pins
│   ├── verify.sh                     # host shim: engine → mount → exec
│   ├── verify.mts                    # orchestrator (step manifest + setup dispatch)
│   ├── setup.mts                     # bootstrap (configs + AGENTS.md block)
│   ├── lib/                          # gate-specific core (ctx, severities, blocks)
│   ├── steps/                        # one module per ecosystem check
│   └── config/                       # tool configs travelling in the image
├── lib/                              # shared building blocks (proc, paths, git, json, gha)
├── pipelines/                        # zero-dep pipeline modules (thin lib/ consumers)
├── standards/                        # house standards and tools
├── practices/                        # docs / how-to
└── .github/workflows/                # defined--*.yml (gate CI) + pipeline templates
```
