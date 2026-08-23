<!-- update: agent=opencode | date=2026-08-23 | scope=PLAN.md -->

# PLAN — portable quality gate ("pick up and drop")

## Goal

One `quality/` directory that can be copied — or symlinked — into **any**
project and just works: `./quality/verify.sh` detects what the project is,
runs only the relevant checks, and enforces house style from tool configs
that travel *inside* the directory.

Provenance: the working prototype is
[`~/bin/system-config/quality/`](https://github.com/markstanden/system-config)
(gate philosophy documented in its `lib/AGENTS.md`). It currently runs green
daily but is coupled to that one repo. This plan extracts it.

## Design principles (inherited, non-negotiable)

- One command owns verification: local green = merge green (CI runs the same script).
- Config owns style; agents/humans edit config and run `verify --fix`.
- Floors raise, never lower (see system-config's `SHELLCHECK_SEVERITY_DEFAULT`).
- Mechanical fixes are committed as mechanical diffs.

## Current couplings to remove (audit of system-config `quality/`, 2026-08-23)

| Coupling | Where | Fix |
| --- | --- | --- |
| Tool configs live at repo root (`prettier.config.mjs`, `.prettierignore`, `.yamllint.yml`) | `typescript.sh`, `yaml.sh` | Move into `quality/config/`; pass explicitly (`--config`, `--ignore-path`, `yamllint -c`) |
| Prettier resolves `.prettierignore` relative to CWD, not target tree | `typescript.sh` (already carries a comment about this) | Always pass `--ignore-path` |
| Hardcoded `lib/` TypeScript package | `typescript.sh` (`LIB_DIR`) | Auto-detect: run only if a JS/TS package with the right scripts exists |
| Repo-specific naming doctrine | `naming.sh` | Opt-in step, not default-on |
| Fixed step list + LocalQube probe in orchestrator | `verify.sh` | Manifest-driven steps; sonar stays a separate opt-in tool |
| Symlink-blind path resolution | `lib.sh:5` (`dirname BASH_SOURCE`, no `readlink -f`) | Resolve symlinks; derive repo root from invocation CWD's git root |
| `.gitleaksignore` expected at scan root | `workflow.sh` | Absence must be fine (it is); document as per-project file |

## Target shape

```text
quality/
├── lib.sh              # symlink-resolving paths; REPO_ROOT from CWD's git root
├── verify.sh           # runs enabled steps in fixed order; honours per-project overrides
├── gate.d/             # one self-contained step per file
│   ├── shell.sh        # default-on   shfmt + shellcheck over tracked *.sh
│   ├── yaml.sh         # default-on   yamllint over tracked YAML
│   ├── workflow.sh     # default-on*  actionlint + zizmor + gitleaks; *skips without .github/
│   ├── node.sh         # auto-detect  prettier + eslint + tsc + vitest when package.json says so
│   ├── dotnet.sh       # auto-detect  format + build + test when .sln/.csproj present
│   └── naming.sh       # opt-in      repo-specific conventions
└── config/
    ├── prettier.config.mjs
    ├── prettierignore
    └── yamllint.yml
```

- Steps are idempotent, accept `--fix/--no-fix/--silent`, and skip cleanly
  (exit 0 with a notice) when their ecosystem is absent.
- Per-project tailoring via a small file in the *target* repo (name TBD),
  following the raises-only philosophy: projects may add strictness, not remove defaults.

## Research: scour existing solutions before building

Mine these for patterns worth stealing (gates, hooks, CI templates):

- [ ] `~/code/system-config` — the prototype (source of the audit above)
- [ ] `~/code/rdd-astro` — original inspiration for the verify gate
- [ ] `~/code/template` — project template; likely CI skeleton to replace
- [ ] `~/code/dev-tools`, `~/code/simple-greeter`, `~/code/cv-server--ts`,
      `~/code/eph-db` — assorted Node/shell projects; what do they actually run today?
- [ ] `dotnet/` here — editorconfig/hooks/workflows already standardise .NET;
      the new `gate.d/dotnet.sh` should wrap, not duplicate, these
- [ ] External worth a look: bloom-style `scripts/verify.sh` pattern
      (single entry point), pre-commit framework (config-driven hooks)

Output of research: notes appended below, then a step inventory before any code moves.

## Delivery mechanism

[NEEDS DECISION] Submodule vs package-manager dependency vs installer copy:

- **Submodule** (this README's existing pattern): version-pinned per project,
  but submodules are friction (init, update, detached heads).
- **Installer/symlink** (system-config bootstrap installs/symlinks
  `~/.config/opencode/quality` → this repo): always current, zero per-project
  pins; risk = gate drifts between machines/projects mid-work.
- **npm/pip-style dependency**: versioned and lockfiled, but adds an ecosystem
  requirement to non-node projects.

Lean towards: symlink for Mark's boxes (fresh = current), submodule for
anything shared or CI-only. Decide after the research pass.

## Verification of the migration itself

- Every step keeps behaviour identical on system-config (golden test: same
  results before/after on the same tree).
- New-repo smoke tests: drop into a node-only project, a shell-only project,
  a dotnet project, an empty dir — expect clean skips, no false failures.

## Status

- [x] Audit current couplings (2026-08-23)
- [ ] Research pass over ~/code/*
- [ ] Step inventory + manifest design
- [ ] Extract lib.sh path resolution
- [ ] Port steps to gate.d/
- [ ] Move configs into quality/config/
- [ ] Auto-detection + skip semantics
- [ ] Delivery mechanism decided + wired
- [ ] Golden-test parity on system-config
