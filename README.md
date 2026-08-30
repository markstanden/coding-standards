# Coding Standards

A single source of truth for my development project configuration files, workflow templates, and development tools to ensure consistency across projects.

In progress: **defined** — a portable, drop-in quality gate (`runtime/`) plus a
flat set of standards (`standards/`), shared building blocks (`lib/`), and
pipeline modules (`pipelines/`). See [PLAN.md](PLAN.md).

## Project Structure

```bash
coding-standards/
├── runtime/                          # the container image (the quality gate)
│   ├── Containerfile                 # node 26 slim base, pinned tools
│   ├── tool-versions.env             # single source of tool version pins
│   ├── verify.sh                     # host shim: engine → mount → exec
│   ├── verify.mts                    # orchestrator
│   ├── setup.mts                     # bootstrap (configs + AGENTS.md block)
│   ├── lib/                          # gate-specific core (ctx, steps, blocks)
│   ├── steps/                        # one module per ecosystem check
│   └── config/                       # tool configs travelling in the image
├── lib/                              # shared building blocks (proc, paths, git)
├── pipelines/                        # zero-dep pipeline modules (stage 2)
├── standards/                        # house standards and tools
│   ├── .editorconfig                 # code formatting rules
│   ├── Directory.Build.props         # common build properties
│   ├── git-hooks/                    # .NET-specific git hooks
│   ├── testing/                      # testing docs
│   └── workflows/                    # GitHub Actions workflow templates
├── practices/                        # docs / how-to
└── .github/workflows/                # defined--*.yml (gate CI) + pipeline templates
```

## Getting Started

The gate is the primary way in — run `./runtime/verify.sh` from a project
root to gate it (add `--fix` to repair mechanically, `--silent` for log-style
output). Bootstrap (`./runtime/verify.sh setup`) installs shared configs
(`standards/.editorconfig`, `standards/Directory.Build.props`) and seeds the
AGENTS.md managed block — raises-only, so a consumer's tightened rules are
never overwritten.

To use the gate in a GitHub Actions pipeline, call the reusable
`defined--verify.yml` workflow from a gitsha-pinned ref with the matching
`image-tag` (see `.github/workflows/defined--verify.yml`).