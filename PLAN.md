<!-- update: agent=opencode | date=2026-08-30 | scope=PLAN.md -->

# PLAN — portable quality gate ("pick up and drop")

## Goal

One `quality/` directory that works against **any** project: run the gate
(from a checkout, or straight from its published image) and it detects what
the project is, runs only the relevant checks, and enforces house style from
tool configs baked into the pinned container image.

Provenance: the working prototype is
[`~/bin/system-config/quality/`](https://github.com/markstanden/system-config)
(gate philosophy documented in its `lib/AGENTS.md`). It currently runs green
daily but is coupled to that one repo. This plan extracts it.

## Design principles (inherited, non-negotiable)

- One command owns verification: local green = merge green (CI runs the same script).
- Config owns style; agents/humans edit config and run `verify --fix`.
- Floors raise, never lower (see system-config's `SHELLCHECK_SEVERITY_DEFAULT`).
- Mechanical fixes are committed as mechanical diffs.

## Decisions log (2026-08-24 design review)

| # | Decision |
| --- | --- |
| 1 | **Container is the runtime** — Ubuntu image, tools pinned via `tool-versions.env`; host needs only podman/docker + git |
| 2 | **No native fallback** — missing container engine fails loudly with install guidance; one path, no drift |
| 3 | **In-container project deps** — named volumes shadow `node_modules`/`obj`/`bin`; gate restores inside the container (avoids host↔image ABI mismatch, e.g. Arch-built native modules) |
| 4 | **Build local, publish for CI** — `verify.sh` builds a cached local image on first run; CI consumes/publishes `ghcr.io/markstanden/quality-gate:<tag>`, tag derived from tool-pin hash |
| 5 | **Step order**: `naming → node → dotnet → shell → yaml → workflow → tofu` — semantic renames precede mechanical formatting so renamed symbols never land unformatted |
| 6 | **Tofu**: `fmt` always (fixable); `init` + `validate` accepted despite provider-download cost |
| 7 | **Types**: bare string-literal unions (`StepMode`, `StepStatus`) — enums banned under strip-types; a rankable `as const` object is reserved for severity-floor maths only |
| 8 | **Params**: public functions take a single destructured object (named-parameter style); positional params only for genuinely unary operations |
| 9 | **Tool policy**: no optional tier — missing tool = loud fail pointing at the Containerfile; degradation exists nowhere except sonar, which stays outside the manifest |
| 10 | **Scanning**: git-tracked files only (`git ls-files -co --exclude-standard`); per-tool ignores travel in `quality/config/` for committed-but-generated exceptions |
| 11 | **Detection**: sync only (`fs` existence checks); execution strictly sequential — `--fix` writes files, and ordered output keeps `--silent` log-dumps trustworthy |
| 12 | **Overrides**: `.qualityrc.json` at target repo root; raises-only; unknown step ids or lowered floors are config errors |
| 13 | **Gate is the bootstrap** — gate setup installs shared configs (`.editorconfig`, `Directory.Build.props`) into the repo root from versions baked into the image; `verify` fails loudly on drift. Editors read these files only from the project root, so install is part of setup, not verify |
| 14 | **Agent instructions are seeded, not owned** — gate setup writes a marker-delimited managed block (`<!-- quality-gate:start -->…<!-- quality-gate:end -->`) into consumer `AGENTS.md`: house standards summary + pointer home to this repo's README as canonical index. Idempotent re-runs rewrite the block only; project content outside it is never clobbered (raises-only) |
| 15 | **Distribution end-state: two channels only** — the pinned image (configs + bootstrap) and gitsha-pinned reusable-workflow `uses:` refs. Symlinks, submodules and release artifacts all retired; no release pipeline needed since the image tag *is* the release |
| 16 | **Standalone lint/security workflow templates dropped** — shellcheck/yamllint/gitleaks arrive via the image's `shell`/`yaml`/`workflow` steps consumed through a single `quality-gate--verify.yml`; thin wrapper templates would be immediate deletion work |
| 17 | **Base image: official `node:<ver>-slim`, digest-pinned** (2026-08-25, supersedes the "Ubuntu image" wording of #1) — multi-arch manifest digest gives arm64 free, deletes hand-maintained Node install code, Node team handles base patching. Digest lives in `tool-versions.env` and reaches `FROM` via build args so that file stays the single source of truth. Global pinned `tsc` is baked in for typechecking the gate's own code; the gate still *runs* on strip-types with no build step |
| 18 | **Shellcheck floor raised `error` → `style`** (2026-08-25, supersedes the 2026-08-23 "floor error universally" rule) — every shellcheck finding gates; inconsistencies are forced away, not tolerated. Raises-only means floors move up, never down. First run at this floor found 4 real findings, all fixed mechanically rather than suppressed |

## Roadmap (2026-08-25 brainstorm)

Three stages, strictly sequential — stage 1 unblocks everything else because
until first green nothing distributes configs or instructions.

1. **Gate to first green** — scaffold → lib/ via TDD → step modules →
   config/ migration → container dep volumes → ghcr CI template → golden-test
   parity. Includes the bootstrap/install step (decisions #13–14): shared
   configs into repo roots + AGENTS.md managed block seeding.
2. **Pipelines consume the gate** — `quality-gate--verify.yml` pulls the
   pinned ghcr image against consumer repos (local green = merge green by
   construction). Remaining genuinely pipeline-specific inline scripts
   (~65 `run:` blocks today; heaviest: opentofu-build-infrastructure ×13,
   dotnet-test--playwright-tests ×10) extract to zero-dep `scripts/pipelines/*.mts`
   modules with `node --test` coverage — same strip-types conventions,
   deliberately outside `quality/`, run on plain Node in the runner.
3. **Single static entrypoint** — this repo's README becomes the canonical
   human+agent index linking standards docs, pipeline catalogue and gate
   usage; expand standards docs (dotnet/testing/unit-testing.md, node
   equivalents, architecture preferences). Consumer adoption = pin a sha;
   `dotnet/setup.sh` symlink logic stays working but legacy until retired.

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
├── verify.sh              # bash shim: engine detect → ensure image → mount rw → exec
├── verify.mts             # orchestrator: step manifest, flags, summary; `setup` dispatch
├── setup.mts              # bootstrap (verify.sh setup): root configs + AGENTS.md block
├── lib/                   # testable core: paths, ctx, proc, severities, git,
│   │                      #   step-result, agents-block, config-install (+ tests)
├── steps/                 # filename == step id; one module per ecosystem
│   ├── naming.mts         # opt-in      semantic renames BEFORE any formatting
│   ├── node.mts           # auto-detect prettier + eslint + tsc + vitest
│   ├── dotnet.mts         # auto-detect format + build + test (workspace discovery)
│   ├── shell.mts          # default-on  shfmt + shellcheck over tracked *.sh
│   ├── yaml.mts           # default-on  yamllint over tracked YAML
│   ├── workflow.mts       # default-on* actionlint + zizmor + gitleaks (*needs .github/)
│   └── tofu.mts           # default-on* tofu fmt + init/validate (*needs tracked *.tf)
│                          #   [NEEDS DECISION 2026-08-25] also tflint —
│                          #   sonarqube-compatible; decide pin/delivery
│                          #   (apt vs release tarball) when the step lands
├── config/                # prettier.config.mjs prettierignore yamllint.yml schema
│   │                      #   agents-block.md root/ (installed to repo root)
├── container/
│   ├── Containerfile      # ubuntu base, node 26, apt-pinned tools
│   └── tool-versions.env  # single source of tool version pins
└── README.md              # usage, house conventions, add-a-step checklist
```

- Steps are idempotent, accept `--fix/--no-fix/--silent`, and skip cleanly
  (exit 0 with a notice) when their ecosystem is absent. Missing *tools*, by
  contrast, fail loudly pointing at the Containerfile — no optional tier.
- Per-project tailoring via `.qualityrc.json` in the target repo, following
  the raises-only philosophy: projects may add strictness, never remove
  defaults.
- Module conventions (unions not enums, object params, filename == step id,
  header comments stating tools/config/fix behaviour, `lib/` never knows
  steps, steps never import each other) are law, recorded in quality/README.md.

## Research: scour existing solutions before building

Mine these for patterns worth stealing (gates, hooks, CI templates):

- [ ] `~/code/system-config` — the prototype (source of the audit above)
- [ ] `~/code/rdd-astro` — original inspiration for the verify gate
- [ ] `~/code/template` — project template; likely CI skeleton to replace
- [ ] `~/code/dev-tools`, `~/code/simple-greeter`, `~/code/cv-server--ts`,
      `~/code/eph-db` — assorted Node/shell projects; what do they actually run today?
- [ ] `dotnet/` here — editorconfig/hooks/workflows already standardise .NET;
      the new `steps/dotnet.mts` should wrap, not duplicate, these
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
   one implementation. (2026-08-24: delivered as TS `lib/`, container-distributed.)
2. **dev-tools' workspace discovery** (`discover_workspace`: explicit flag →
   env → single `.slnx`/`.sln` at root → repo root) — adopt verbatim for
   `gate.d/dotnet.sh`.
3. **system-config's skip semantics** (shfmt optional-but-loud,
   sonar probe-degrade) and **raises-only severity floors** — the default
   posture for all steps. (2026-08-24: the optional-tool tier is superseded —
   see decisions log #9; only sonar's probe-degrade survives, outside the
   manifest.)
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

[DECIDED 2026-08-24] The container image **is** the delivery mechanism — the
submodule/symlink/package-manager trilemma dissolves:

- **Local**: `verify.sh` builds `localhost/quality-gate:<pinhash>` on first
  run (layer-cached; rebuilds only when pins change) and runs it against the
  mounted repo.
- **CI**: workflows pull `ghcr.io/markstanden/quality-gate:<tag>`; an
  identical tag means identical toolchain, so local green = merge green by
  construction.
- **Target projects vendor nothing.** A project may install a ~5-line shim
  that invokes the image (setup scripts can drop it alongside the dotnet
  standards) plus its own `.qualityrc.json`. The shim's first-run bootstrap
  also installs shared configs into the repo root and seeds `AGENTS.md`
  (decisions #13–14) — one wiring step covers configs, instructions and docs.
- End-state (decision #15): this image plus gitsha-pinned workflow refs are
  the *only* distribution channels; the submodule/symlink model in
  `dotnet/setup.sh` is legacy during transition, retired once the gate's
  bootstrap lands.

## Verification of the migration itself

- Every step keeps behaviour identical on system-config (golden test: same
  results before/after on the same tree).
- New-repo smoke tests: drop into a node-only project, a shell-only project,
  a dotnet project, an empty dir — expect clean skips, no false failures.

(2026-08-24: with the gate running inside a pinned image, golden-test parity
reduces to "run the same image tag on system-config before and after the
migration" — same tag, same results.)

## Architecture decision: TypeScript core, bash shim

[DECIDED 2026-08-23, pending first green] The gate is **TypeScript end to end**
(Node ≥ 26 strip-types, zero dependencies), tested with the experimental
`node --test` runner. Bash shrinks to a single locator shim.

```text
quality/
├── verify.sh          # ~30 lines: locate podman/docker, ensure pinned image,
│                      # mount repo rw, exec verify.mts inside; loud failure
│                      # with install guidance when an engine is absent
├── verify.mts         # orchestrator: step manifest, detection, skip semantics
├── lib/*.mts          # path/symlink resolution, workspace discovery, config
│                      # parsing — the testable core
├── steps/*.mts        # one module per check; linters invoked via child_process
└── *.test.mts         # node --test, colocated, zero-dep
```

Why:

- The bug-prone surface (path resolution, auto-detection, ignore parsing,
  severity maths) is exactly what bash cannot unit-test cheaply. In TS each
  rule gets a table-driven test.
- `node --test` over vitest for this repo: zero dependencies keeps the
  "drop in anywhere" promise honest — no `npm ci` to run the tests.
- Portability contract restated honestly (2026-08-24 revision): *any project
  on a machine with podman or docker*. Host Node is irrelevant to running the
  gate — it matters only for developing the gate's own tests. The shim fails
  loudly instead of silently skipping when no engine exists.
- Fresh build in mts beats porting working bash later — no translation step,
  no untested-shell-logic inheritance.

Risks / mitigations:

- Type-stripping constraints apply (no enums/namespaces, extensioned imports)
  — same rules as system-config `lib/`.
- External tools remain external binaries; steps assert presence up front and
  skip loudly (never silently) when absent.
- Parity with system-config's bash gate still verified by running both on the
  same tree during migration (results diff, not code diff).

### Runtime: container-native (2026-08-24)

The gate executes exclusively inside an Ubuntu image built from
`quality/container/Containerfile`, with every tool version pinned in
`tool-versions.env`. Consequences recorded here so they aren't relitigated:

- Tool installation *is* the Containerfile — no per-distro installer script.
  Missing binaries cannot occur at runtime: the image has them or the build
  fails.
- Project dependencies (`node_modules`, NuGet, `obj/`/`bin/`) resolve inside
  the container via named volumes shadowing those paths; the gate restores as
  needed. This sidesteps host↔image ABI mismatch (native modules built on a
  newer host glibc won't load under the image's older one, and vice versa).
- Golden-test parity collapses to "same image tag".
- The cross-platform note below predates this decision; the only host-side
  surface left is `verify.sh` (~30 lines), so the platform question reduces
  to "is there a container engine".

Cross-platform note (2026-08-23, corrected): the TS core *increases*
portability, not less — Node ≥ 26 goes LTS within two months and runs natively
on Linux, macOS and Windows. Only the launcher shim is platform-specific:

- `verify.sh` — `#!/usr/bin/env bash`, keeping house style (`[[ ]]`). macOS's
  bash 3.2 handles `[[ ]]` fine (it predates 3.x); the shim merely avoids
  post-3.2 features (`mapfile`, associative arrays, `${var,,}`). Never
  `#!/bin/sh` — that is dash on Debian/Ubuntu, which lacks `[[ ]]`.
- `verify.ps1` — same logic for Windows, added only if/when a Windows project
  actually needs it.
- Everything above the shim is identical everywhere. This also suits a public
  portfolio repo: the standards travel with the runtime, not the OS.

## Status

- [x] Audit current couplings (2026-08-23)
- [x] Research pass over ~/code/* (2026-08-23 — findings above)
- [x] Ruleset decisions (2026-08-23: 4-space, shellcheck floor `error`,
      prettier repo-wide, .editorconfig installed by gate setup)
- [x] Architecture: TypeScript core (strip-types, node --test)
- [x] Design review: manifest shape, naming/modularity conventions,
      container-native runtime, delivery mechanism, override file
      (2026-08-24 — decisions log above)
- [x] Scaffold quality/ (verify.sh shim, Containerfile, empty orchestrator)
      — first green container run (2026-08-25: podman-first shim, pinhash
      tag from tool-versions.env, node 26 tarball with build-time sha
      verification, smoke step proves in-container exec)
- [x] lib/ core via TDD: paths, ctx, proc, severities
      (2026-08-25: 20 table-driven tests; proc throws loudly naming missing
      binaries; severities is the sole owner of ranking maths)
- [x] Step modules + manifest wiring in naming → … → tofu order
      (2026-08-30: all seven steps landed with colocated tests — naming,
      node, dotnet, shell, yaml, workflow, tofu; fixed order enforced in
      verify.mts; 69 tests green)
- [x] config/ migration from prototype (incl. prettierignore CWD fix)
      (2026-08-30: prettier configs migrated and resolved from gate root;
      yamllint config baked into image — gate configs travel with the image)
- [x] Bootstrap/install step: configs into repo root + AGENTS.md managed block
      (decisions #13–14) (2026-08-30: `verify.sh setup` → setup.mts dispatches
      through verify.mts; config/root/ installs .editorconfig + DBP with
      raises-only no-clobber; config/agents-block.md seeds a marker-delimited
      block, idempotent; podman smoke on a throwaway repo: install, preserve,
      conflict-fail all verified. Drift note: config/root/ copies the canonical
      dotnet/ files — consolidate when the dotnet/ symlink surface retires)
- [ ] In-container deps: shadow volumes + restore behaviour
- [ ] CI template: publish/consume ghcr image tagged from pin hash
- [ ] Golden-test parity on system-config
- [ ] Deferred: workflow-template fixes on our own tree (2026-08-30,
      deliberately parked so the red gate keeps flagging them — see
      "Continuous verification" below). First in-container run of
      `./quality/verify.sh` went red; `workflow` step findings only:

      - SC2086 unquoted `$VAR` in 28 `run:` blocks (split across
        azure-swa--deploy-blazor-wasm, dotnet-build--blazor-frontend,
        dotnet-build--solution, dotnet-format--solution,
        dotnet-test--common-test-runner, dotnet-test--playwright-tests,
        opentofu-build-infrastructure, opentofu-destroy-workspace)
      - SC2129 merge redirects in dotnet-format--solution.yml:47
      - actionlint: `codecov/codecov-action@v3` too old for GitHub Actions
        (dotnet-test--common-test-runner.yml:108) — bump to v4

## Continuous verification

Host `node --test` green does not mean the gate is green: on 2026-08-30 the
unit suite passed 69/69 while the first in-container run went red on real
workflow-template findings. Run the full suite continuously — the host test
suite **and** the podman end-to-end gate (`./quality/verify.sh`) — so
deviations surface as they land, not at release time. Keeping the deferred
fixes above unfixed is deliberate: the failing `workflow` step is the tripwire
that proves the gate still catches these class of errors.
