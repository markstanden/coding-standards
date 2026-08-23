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

### Research findings (2026-08-23)

**The same idea evolved independently at least four times** — every repo
converges on "one verify entry point", but with drifted implementations:

| Repo | Local entry point | CI | Ecosystem | Maturity |
| --- | --- | --- | --- | --- |
| `system-config` | `quality/verify.sh` (+ `--fix/--silent`, raises-only floor) | same script in `verify.yml` | node+shell+yaml+workflows | highest — repo-wide prettier, workflow gate |
| `rdd-astro` | `code-quality-checks/all.sh` (`npm run check/fix`, `--e2e`) | 16 per-area workflows | astro/node+shell+yaml | high — but CI is fragmented into many small workflows |
| `template`, `simple-greeter` | `scripts/verify.sh` (shellcheck → dotnet-format → build → test) | identical `verify.yml` ×2 | dotnet+shell | medium — one monolithic script, no --fix/--silent |
| `dev-tools` | `tools/check.sh` (lint → validate, `--workspace` discovery) | `check.yml` | dotnet+shell | medium — best-in-show workspace/solution discovery |
| `cv-server--ts` | none (npm scripts called directly by CI) | `run-tests.yml` | node | gap — no local/CI parity |
| `eph-db` | none | none | dotnet+bicep? | gap — nothing |

**Reusable patterns worth uniting on:**

1. **`lib.sh` helper lineage** — `check_run` / `check_section` /
   `check_init_silent` exist in three repos with visible drift
   (system-config and rdd-astro share ancestry). This becomes the shared core;
   one implementation, symlink/submodule-delivered.
2. **dev-tools' workspace discovery** (`discover_workspace`: explicit flag →
   env → single `.slnx`/`.sln` at root → repo root) — adopt verbatim for
   `gate.d/dotnet.sh`.
3. **system-config's skip semantics** (shfmt optional-but-loud,
   sonar probe-degrade) and **raises-only severity floors** — the default
   posture for all steps.
4. **template/simple-greeter's identical CI** proves the "one verify job"
   template works across repos — the drip-feed target shape for CI.

**Ruleset divergences that must be united (decisions, not preferences):**

Guiding principle (Mark, 2026-08-23): **hard rules, autofixing, stay close to
global standards** — prefer pre-accepted sensible defaults so prompt fatigue
never turns into rubber-stamping. Where repos disagree, the fix is mechanical
(`--fix` + commit the diff), never a debate.

- **DECIDED — Indentation: 4 spaces everywhere** (no tabs). rdd-astro's
  tab-formatted tree gets reformatted when the gate drip-feeds into it;
  `.editorconfig` ↔ `prettier.config.mjs` ↔ `SHFMT_INDENT` move in lockstep.
- **DECIDED — Shellcheck floor `error` universally**, raises-only per run
  (system-config's model).
- **DECIDED — Prettier scope is repo-wide** (markdown, JSONC, YAML, CSS),
  with `quality/config/prettierignore` travelling in the gate.
- **DECIDED — `.editorconfig` at each repo root is installed by gate setup**,
  not hand-maintained per repo (editors only read it from the project root).

**Gaps the portable gate closes immediately:** cv-server--ts gets local/CI
parity; eph-db gets any gating at all.

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
- [x] Research pass over ~/code/* (2026-08-23 — findings above)
- [x] Ruleset decisions (2026-08-23: 4-space, shellcheck floor `error`,
      prettier repo-wide, .editorconfig installed by gate setup)
- [ ] Step inventory + manifest design
- [ ] Extract lib.sh path resolution
- [ ] Port steps to gate.d/
- [ ] Move configs into quality/config/
- [ ] Auto-detection + skip semantics
- [ ] Delivery mechanism decided + wired
- [ ] Golden-test parity on system-config
