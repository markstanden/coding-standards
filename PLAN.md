<!-- update: agent=opencode | date=2026-08-30 | scope=PLAN.md -->

# PLAN — defined: portable quality gate ("pick up and drop")

## Goal

One `runtime/` directory (the container image) that works against **any**
project: run the gate (from a checkout, or straight from its published image)
and it detects what the project is, runs only the relevant checks, and
enforces house style from tool configs baked into the pinned container image.

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
| 4 | **Build local, publish for CI** — `verify.sh` builds a cached local image on first run; CI consumes/publishes `ghcr.io/markstanden/defined:<tag>`, tag derived from tool-pin hash |
| 5 | **Step order**: `naming → node → dotnet → shell → yaml → workflow → tofu` — semantic renames precede mechanical formatting so renamed symbols never land unformatted |
| 6 | **Tofu**: `fmt` always (fixable); `init` + `validate` accepted despite provider-download cost |
| 7 | **Types**: bare string-literal unions (`StepMode`, `StepStatus`) — enums banned under strip-types; a rankable `as const` object is reserved for severity-floor maths only |
| 8 | **Params**: public functions take a single destructured object (named-parameter style); positional params only for genuinely unary operations |
| 9 | **Tool policy**: no optional tier — missing tool = loud fail pointing at the Containerfile; degradation exists nowhere except sonar, which stays outside the manifest |
| 10 | **Scanning**: git-tracked files only (`git ls-files -co --exclude-standard`); per-tool ignores travel in `runtime/config/` for committed-but-generated exceptions |
| 11 | **Detection**: sync only (`fs` existence checks); execution strictly sequential — `--fix` writes files, and ordered output keeps `--silent` log-dumps trustworthy |
| 12 | **Overrides**: `.qualityrc.json` at target repo root; raises-only; unknown step ids or lowered floors are config errors |
| 13 | **Gate is the bootstrap** — gate setup installs shared configs (`.editorconfig`, `Directory.Build.props`) into the repo root from versions baked into the image; `verify` fails loudly on drift. Editors read these files only from the project root, so install is part of setup, not verify |
| 14 | **Agent instructions are seeded, not owned** — gate setup writes a marker-delimited managed block (`<!-- defined:start -->…<!-- defined:end -->`) into consumer `AGENTS.md`: house standards summary + pointer home to this repo's README as canonical index. Idempotent re-runs rewrite the block only; project content outside it is never clobbered (raises-only) |
| 15 | **Distribution end-state: two channels only** — the pinned image (configs + bootstrap) and gitsha-pinned reusable-workflow `uses:` refs. Symlinks, submodules and release artifacts all retired; no release pipeline needed since the image tag *is* the release |
| 16 | **Standalone lint/security workflow templates dropped** — shellcheck/yamllint/gitleaks arrive via the image's `shell`/`yaml`/`workflow` steps consumed through a single `defined--verify.yml`; thin wrapper templates would be immediate deletion work |
| 17 | **Base image: official `node:<ver>-slim`, digest-pinned** (2026-08-25, supersedes the "Ubuntu image" wording of #1) — multi-arch manifest digest gives arm64 free, deletes hand-maintained Node install code, Node team handles base patching. Digest lives in `tool-versions.env` and reaches `FROM` via build args so that file stays the single source of truth. Global pinned `tsc` is baked in for typechecking the gate's own code; the gate still *runs* on strip-types with no build step |
| 18 | **Shellcheck floor raised `error` → `style`** (2026-08-25, supersedes the 2026-08-23 "floor error universally" rule) — every shellcheck finding gates; inconsistencies are forced away, not tolerated. Raises-only means floors move up, never down. First run at this floor found 4 real findings, all fixed mechanically rather than suppressed |
| 19 | **Brand: `defined`; repo flattened** (2026-08-30) — the container's role outgrew "quality gate" (it is also the workflow runtime base), so consumer-visible naming is `defined`: image `ghcr.io/markstanden/defined`, workflows `defined--*.yml`, AGENTS.md markers `<!-- defined:start/end -->`. The repo restructures flat: `quality/` → `runtime/` (the image), root `lib/` (shared building blocks used by both runtime and pipelines), `pipelines/` (thin zero-dep pipeline modules consuming `lib/`), `dotnet/` → `standards/`, docs under `practices/`. The GitHub repo keeps the name `coding-standards` for now — renamed once SHAs stabilise. Legacy `dotnet/setup.sh` retired (decision #15 made real) |

## Roadmap (2026-08-25 brainstorm)

Three stages, strictly sequential — stage 1 unblocks everything else because
until first green nothing distributes configs or instructions.

1. **Gate to first green** — scaffold → lib/ via TDD → step modules →
   config/ migration → container dep volumes → ghcr CI template → golden-test
   parity. Includes the bootstrap/install step (decisions #13–14): shared
   configs into repo roots + AGENTS.md managed block seeding.
   [DONE 2026-08-30 — see Status]
2. **Pipelines consume the gate** — `defined--verify.yml` pulls the
   pinned ghcr image against consumer repos (local green = merge green by
   construction). Remaining genuinely pipeline-specific inline scripts
   extract to zero-dep `pipelines/*.mts` modules with `node --test` coverage —
   same strip-types conventions, thin consumers of the shared `lib/` building
   blocks, run on plain Node in the runner.
   [DONE 2026-08-30 — see Status]
3. **Single static entrypoint** — this repo's README becomes the canonical
   human+agent index linking standards docs, pipeline catalogue and gate
   usage; expand standards docs (standards/testing/unit-testing.md, node
   equivalents, architecture preferences). Consumer adoption = pin a sha;
   the legacy submodule/symlink flow is retired.

## Current couplings to remove (audit of system-config `quality/`, 2026-08-23)

| Coupling | Where | Fix |
| --- | --- | --- |
| Tool configs live at repo root (`prettier.config.mjs`, `.prettierignore`, `.yamllint.yml`) | `typescript.sh`, `yaml.sh` | Move into `runtime/config/`; pass explicitly (`--config`, `--ignore-path`, `yamllint -c`) |
| Prettier resolves `.prettierignore` relative to CWD, not target tree | `typescript.sh` (already carries a comment about this) | Always pass `--ignore-path` |
| Hardcoded `lib/` TypeScript package | `typescript.sh` (`LIB_DIR`) | Auto-detect: run only if a JS/TS package with the right scripts exists |
| Repo-specific naming doctrine | `naming.sh` | Opt-in step, not default-on |
| Fixed step list + LocalQube probe in orchestrator | `verify.sh` | Manifest-driven steps; sonar stays a separate opt-in tool |
| Symlink-blind path resolution | `lib.sh:5` (`dirname BASH_SOURCE`, no `readlink -f`) | Resolve symlinks; derive repo root from invocation CWD's git root |
| `.gitleaksignore` expected at scan root | `workflow.sh` | Absence must be fine (it is); document as per-project file |

## Target shape

```text
runtime/                 # the container image (was quality/ + container/)
├── verify.sh            # bash shim: engine detect → ensure image → mount rw → exec
├── verify.mts           # orchestrator: step manifest, flags, summary; `setup` dispatch
├── setup.mts            # bootstrap (verify.sh setup): root configs + AGENTS.md block
├── Containerfile        # node 26 slim base, pinned tools, bakes runtime/ + lib/
├── tool-versions.env    # single source of tool version pins
├── lib/                 # gate-specific core: ctx, severities, step-result,
│   │                    #   agents-block, config-path, config-install, fixture
│   │                    #   (+ tests); imports ../../lib for shared modules
├── steps/               # filename == step id; one module per ecosystem
│   ├── naming.mts       # opt-in      semantic renames BEFORE any formatting
│   ├── node.mts         # auto-detect prettier + eslint + tsc + vitest
│   ├── dotnet.mts       # auto-detect format + build + test (workspace discovery)
│   ├── shell.mts        # default-on  shfmt + shellcheck over tracked *.sh
│   ├── yaml.mts         # default-on  yamllint over tracked YAML
│   ├── workflow.mts     # default-on* actionlint + zizmor + gitleaks (*needs .github/)
│   └── tofu.mts         # default-on* tofu fmt + init/validate (*needs tracked *.tf)
│                        #   [NEEDS DECISION 2026-08-25] also tflint —
│                        #   sonarqube-compatible; decide pin/delivery
│                        #   (apt vs release tarball) when the step lands
├── config/              # prettier.config.mjs prettierignore yamllint.yml schema
│   │                    #   agents-block.md root/ (installed to repo root)
└── (tests)              # fixture.test.mts, setup.test.mts, test-helpers.mts
lib/                     # shared building blocks: paths, proc, git (+ tests)
pipelines/               # zero-dep pipeline modules (stage 2), consume ../lib
standards/               # house standards (was dotnet/): .editorconfig,
                         #   Directory.Build.props, git-hooks/, testing/,
                         #   workflows/pipeline.yml.example
practices/               # docs / how-to
```

- Steps are idempotent, accept `--fix/--no-fix/--silent`, and skip cleanly
  (exit 0 with a notice) when their ecosystem is absent. Missing *tools*, by
  contrast, fail loudly pointing at the Containerfile — no optional tier.
- Per-project tailoring via `.qualityrc.json` in the target repo, following
  the raises-only philosophy: projects may add strictness, never remove
  defaults.
- Module conventions (unions not enums, object params, filename == step id,
  header comments stating tools/config/fix behaviour, `lib/` never knows
  steps, steps never import each other) are law, recorded in AGENTS.md.

## Research: scour existing solutions before building

Mine these for patterns worth stealing (gates, hooks, CI templates):

- [ ] `~/bin/system-config` — the prototype (source of the audit above)
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
  with `runtime/config/prettierignore` travelling in the gate.
- **DECIDED — `.editorconfig` at each repo root is installed by gate setup**,
  not hand-maintained per repo (editors only read it from the project root).

**Gaps the portable gate closes immediately:** cv-server--ts gets local/CI
parity; eph-db gets any gating at all.

### Confirmed: prettier resolves ignore patterns relative to the ignore file, not CWD (2026-08-30)

Experiment (golden-test debug against system-config, prettier 3.9.6 in the
gate image) overturned the prototype's "resolves relative to CWD" assumption:

- Prettier source (`index.mjs`, `createSingleIsIgnoredFunction`):
  `ignore.checkIgnore(slash(getRelativePath(file, ignoreFile)))` — the matched
  path is computed **relative to the ignore file's location**, then tested
  against the ignore patterns.
- Consequence: a travelling ignore file at `/opt/defined/runtime/config/prettierignore`
  (or a merged temp file in `/tmp`) yields `../../…`-prefixed relative paths,
  so repo-root-relative patterns like `dotfiles/nvim` **never match**. Only
  patterns that match against *any* path segment (`coverage/`, `*.toml`,
  `**/lazy-lock.json`) survive.
- The prototype "worked" only because its `.prettierignore` sat at the repo
  root **and** prettier ran from the repo root — ignore file and CWD
  coincided, so `getRelativePath` produced repo-relative paths.
- Design consequence (RESOLVED 2026-08-30): prettier's CLI accepts *repeated*
  `--ignore-path` (its `ignorePath` is an array), each file's patterns
  resolving against its own location. The node step now passes both the
  travelling ignore AND the host's own `.prettierignore` — no merged temp file
  needed, and host directory patterns (e.g. `dotfiles/nvim/`) match correctly
  because the host file sits at the repo root. Verified on system-config and
  in the broken-fixture integration test.

**Gaps the portable gate closes immediately:** cv-server--ts gets local/CI
parity; eph-db gets any gating at all.

## Delivery mechanism

[DECIDED 2026-08-24] The container image **is** the delivery mechanism — the
submodule/symlink/package-manager trilemma dissolves:

- **Local**: `verify.sh` builds `localhost/defined:<pinhash>` on first
  run (layer-cached; rebuilds only when pins change) and runs it against the
  mounted repo.
- **CI**: workflows pull `ghcr.io/markstanden/defined:<tag>`; the image
  is self-contained (gate code + shared lib baked at /opt/defined), so
  consumers vendor nothing. Two tags are pushed: `<pinhash>` (stable
  toolchain) and `:<shortsha>` (pinned release) — consumers pin the shortsha
  for full reproducibility. An identical tag means identical toolchain, so
  local green = merge green by construction.
- **Target projects vendor nothing.** A project may install a ~5-line shim
  that invokes the image (setup scripts can drop it alongside the standards)
  plus its own `.qualityrc.json`. The shim's first-run bootstrap also installs
  shared configs into the repo root and seeds `AGENTS.md` (decisions #13–14) —
  one wiring step covers configs, instructions and docs.
- End-state (decision #15): this image plus gitsha-pinned workflow refs are
  the *only* distribution channels; the submodule/symlink model is legacy
  during transition, retired once the gate's bootstrap lands.

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
runtime/
├── verify.sh          # ~30 lines: locate podman/docker, ensure pinned image,
│                      # mount repo rw, exec verify.mts inside; loud failure
│                      # with install guidance when an engine is absent
├── verify.mts         # orchestrator: step manifest, detection, skip semantics
├── lib/*.mts          # gate-specific core; shared helpers live in lib/ at the
│                      # repo root (proc/paths/git) — the testable core
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

The gate executes exclusively inside a node slim image built from
`runtime/Containerfile`, with every tool version pinned in
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
- [x] Scaffold runtime/ (verify.sh shim, Containerfile, empty orchestrator)
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
      through verify.mts; installs .editorconfig + DBP from the single-source
      standards/ dir (config/root/ copies retired, decision #19) with
      raises-only no-clobber; config/agents-block.md seeds a marker-delimited
      block, idempotent; podman smoke on a throwaway repo: install, preserve,
      conflict-fail all verified)
- [x] In-container deps: shadow volumes + restore behaviour
      (2026-08-30: verify.sh mounts named volumes — node_modules keyed
      pinhash+repo, npm/nuget caches repo-keyed; dotnet step restores first
      into the shadowed NuGet cache, then format/build/test with --no-restore;
      podman smoke on throwaway node + dotnet repos: volumes mount, host
      node_modules/nuget cache stay untouched, writes land in the volumes.
      DECIDED 2026-08-30: dotnet SDK 10 lands via apt from Microsoft's
      Debian-13 feed (Debian main ships no dotnet; MS feed is x64+arm64) —
      `DOTNET_SDK_VERSION` pin + build-time assertion + first-run priming
      (`dotnet --info`) so the first real invocation is clean. Also fixed
      workspace discovery: a lone nested .csproj is passed by path, since the
      CLI cannot operate on a bare directory that merely contains a project;
      multiple projects with no solution now fail loudly)
- [x] CI template: publish/consume ghcr image tagged from pin hash
      (2026-08-30: image made self-contained — build context is now the repo
      root and the gate code + shared lib + standards + pipelines are baked at
      /opt/defined, so CI consumers vendor nothing; local verify.sh still
      bind-mounts runtime/ + lib/ + standards/ + pipelines/ ro, shadowing the
      baked copies for live edits. Publish workflow
      `.github/workflows/defined--publish.yml` (main push on runtime/** +
      lib/** + standards/** + pipelines/** + dispatch) builds linux/amd64+arm64
      via buildx and pushes `ghcr.io/markstanden/defined:<pinhash>` +
      `:<shortsha>`. Consumer template `defined--verify.yml` is a reusable
      workflow_call taking `image-tag`/`fix`/`silent`. DECIDED: tag scheme is
      pinhash (stable toolchain) AND shortsha (pinned release) — consumers pin
      shortsha for full reproducibility. CI shadow volumes intentionally
      omitted: a fresh runner has no host deps to leak, and the NuGet cache
      volume is pointless on ephemeral runners. 2026-08-30: added
      `defined--test.yml` — fires on PRs + main merges, sets up Node 26,
      pre-pulls the published image (falls back to verify.sh building), runs
      `node --test` (unit + broken-fixture) from the repo root. Consumer
      template `defined--verify.yml` tightened: `image-tag` is now REQUIRED
      (the publish workflow never pushes `latest`; consumers pin shortsha),
      misleading `working-directory` input removed (the gate scans the whole
      repo regardless of cwd), usage comment added. NOTE: the local shim's
      image tag keys only on tool-versions.env, so a Containerfile change
      without a pin change leaves a stale cached local image — CI is immune
      (always fresh build); dev must rm the tag)
- [x] Golden-test parity on system-config
      (2026-08-30: ran the new gate in-container against ~/bin/system-config
      (the prototype repo — plan's `~/code/system-config` path corrected, it
      lives at ~/bin). Result: node/yaml/workflow pass identically to the
      prototype's bash gate; shell flags 2 SC2129 style findings in
      bootstrap.sh:233/238 that the prototype's lenient `-S info` floor hid —
      the intended decision #18 raise, not a regression. The run exposed
      prettier's ignore-file-relative resolution (see "Confirmed:" note above);
      resolved by passing both the travelling ignore AND the host's own
      `.prettierignore` via repeated --ignore-path. Parity verdict: gate
      detects and gates the same ecosystems on the real tree; divergences are
      raises-only by design. Remaining divergence is a mechanical `--fix` on
      the prototype, not a gate defect)
- [x] Broken-fixture integration test
      (2026-08-30: runtime/fixture.test.mts + runtime/lib/fixture.mts build a
      deliberately-broken git repo at test time (never stored in the gate's
      tracked tree, which would poison the coding-standards repo's own gate)
      and drive the real gate in-container: check mode fails on every broken
      ecosystem (node/shell/yaml/workflow/tofu), --fix repairs the
      auto-fixable ones (workflow stays red — actionlint is check-only), and a
      file behind the host .prettierignore is proven untouched. Skips cleanly
      without a container engine)
- [x] Workflow-template fixes on our own tree (2026-08-30, resolved in the
      stage-2 refactor below — the deferred findings and the gate's own
      tripwire are gone):
      - SC2086 unquoted `$VAR` in 28 `run:` blocks → eliminated by extracting
        the bash into pipelines/*.mts modules (no bash left to flag)
      - SC2129 merge redirects in dotnet-format--solution.yml:47 → inline fix
      - `codecov/codecov-action@v3` too old → bumped to v4 (SHA-pinned)
      - zizmor errors (previously masked by actionlint short-circuiting):
        unpinned `uses:` → full-SHA pins across all templates; template-
        injection (`${{ inputs.* }}` in run:) → moved into env: and referenced
        by env var; workflow step now runs zizmor with `--min-severity high`
        so accepted warnings (upload-artifact artipacked, fromJSON secret
        projection) don't fail the gate. Gate is now FULLY GREEN (exit 0).
- [x] Rebrand to `defined` + flat restructure (2026-08-30, decision #19)
      — quality/ → runtime/, shared core to root lib/, dotnet/ → standards/,
      pipelines/ + practices/ skeletons; image, workflows, markers, mount
      paths (/opt/defined) and docs renamed; gateConfigPath moved to
      runtime/lib/config-path.mts so shared lib/ never resolves the runtime's
      config; shell step now flags the legacy standards/*.sh (they gained a
      .editorconfig ancestor after the flatten) — fixed mechanically via
      --fix (tabs → 4-space, whitespace only); gate still red on the
      workflow tripwire only. 91/91 unit + fixture green
- [x] Retire legacy setup.sh + config/root drift (2026-08-30, decision #15/#19)
      — `standards/setup.sh` + `standards/git-hooks/setup-hooks.sh` deleted
      (submodule/symlink distribution retired); `runtime/config/root/` copies
      deleted — setup.mts now installs `.editorconfig` + `Directory.Build.props`
      from the single-source `standards/` dir (installRootConfigs takes an
      explicit names list), baked into the image at /opt/defined/standards and
      mounted ro by verify.sh; publish workflow triggers on standards/**;
      README/AGENTS submodule instructions removed
- [x] Stage 2: pipelines consume the gate (2026-08-30) — heavy multi-line
      `run:` bash extracted to zero-dep `pipelines/*.mts` modules (thin
      wrappers over the shared lib/ building blocks: json, gha, proc) with
      colocated `node --test` tests. The 7 heaviest workflows (opentofu
      build/destroy, both azure-swa deploys, dotnet common-test/playwright/
      blazor-frontend) are containerised (option B): jobs run in
      `container: ghcr.io/markstanden/defined:<image-tag>` with
      `defaults.run.shell: bash`; redundant setup-opentofu/setup-dotnet/
      azure-login/setup-node steps dropped (tools baked in the image);
      modules invoked as `node /opt/defined/pipelines/<module>.mts` with
      inputs via env. `pipelines/` baked into the image and mounted ro by
      verify.sh. jq eliminated (Node JSON parsing); playwright stays in-run.
      Light workflows: healthcheck containerised; node-* command inputs passed
      via env + `bash -c` (template-injection fix); build/format solution
      summary blocks fixed inline (SC2086/SC2129). All actions SHA-pinned
      (zizmor unpinned-uses + Sonar S7637). `dotnet-version`/`opentofu-version`
      inputs retired from containerised workflows — the image tag IS the
      toolchain. 120/120 tests green; gate FULLY green (exit 0).

## Local workflow testing (2026-08-30)

Three ways to test `.github/workflows/*.yml` before merge; trade-offs:

| Approach | Offline? | Fidelity | Gate-in-container | Verdict |
| --- | --- | --- | --- | --- |
| `act` (nektos/act) | yes — runs working tree, any branch | good for unit steps, weak for actions needing GitHub context | ❌ impossible — step runs in act's runner container; the gate nests a container via `verify.sh`, and the fixture's temp repo lives in the runner's namespace, invisible to the host engine (even with `--container-daemon-socket`) | daily iteration + syntax checks |
| Real self-hosted runner (`actions/runner` in podman) | no — registers with GitHub, polls for jobs; workflow must be on a remote ref, triggered via `gh workflow run` | highest — actual runner, real `actions/` execution | ✅ possible in principle (socket mount) but runner label must match `runs-on` (self-hosted ≠ `ubuntu-latest` without relabelling) | final pre-merge fidelity check on main |
| Direct podman / `verify.sh` | yes | exact for the gate's own steps | ✅ the gate itself | the gate's own suite (unit + fixture) |

Notes from the `act` experiment on this box:

- `act` connects to podman via `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock`
  (podman exposes a Docker-compatible API). `--container-daemon-socket` mounts
  it into the runner container, so `docker` CLI inside acts against the host
  engine — but the fixture still can't work (namespace boundary, see table).
- The broken-fixture integration test therefore skips under `act`
  (`ACT=true`), and runs for real under host podman / the real runner. The
  skip is deliberate and documented in `runtime/fixture.test.mts`.
- `act` used Node 24.19.0 (setup-node resolved the workflow's `26` to a
  cached 24 on the box) — another reason real CI is the authority on tool
  versions, not `act`.

Host `node --test` green does not mean the gate is green: on 2026-08-30 the
unit suite passed while the first in-container run went red on real
workflow-template findings (the deferred findings, resolved in stage 2). Run
the full suite continuously — the host test suite **and** the podman
end-to-end gate (`./runtime/verify.sh`) — so deviations surface as they land,
not at release time. The gate is now fully green; keeping it green is the
tripwire — any new workflow-template deviation fails the `workflow` step
again.
