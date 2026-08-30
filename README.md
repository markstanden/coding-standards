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
output). Bootstrap (`./runtime/verify.sh setup`) installs shared configs and
seeds the AGENTS.md managed block.

### Legacy: Submodule + symlinks

The submodule model is legacy during transition (decision #15); the gate's
bootstrap supersedes it once adopted.

```bash
git submodule add https://github.com/markstanden/coding-standards .coding-standards
```

### Using .NET Standards (legacy)

Run the setup script to configure all .NET standards at once:

```bash
sudo chmod +x .coding-standards/standards/setup.sh
.coding-standards/standards/setup.sh
```

This will:

- Copy or symlink the `.editorconfig` and `Directory.Build.props` to your project root
- Set up git hooks for .NET formatting
- Create a GitHub Actions workflow pipeline file if it doesn't exist

### Manual Setup (legacy)

1. Symlink the `.editorconfig` to your project root:

```bash
ln -s .coding-standards/standards/.editorconfig .editorconfig
```

2. Symlink the `Directory.Build.props` to your project root:

```bash
ln -s .coding-standards/standards/Directory.Build.props Directory.Build.props
```

3. Set up git hooks:

```bash
.coding-standards/standards/git-hooks/setup-hooks.sh
```

4. Set up GitHub workflows:

```bash
mkdir -p .github/workflows
cp .coding-standards/standards/workflows/pipeline.yml.example .github/workflows/pipeline.yml
```