<!-- update: agent=opencode | date=2026-08-30 | scope=HANDOFF.md -->

# HANDOFF — rebrand to `defined`, flat restructure, stage-2 pipeline refactor

**Continuation plan for a fresh agent.** Read this first, then PLAN.md for the
decision log and conventions.

> STATUS UPDATE (2026-08-30, same session): **Phase 1 is DONE** — the repo is
> rebranded and flattened (runtime/, lib/, pipelines/, practices/, standards/).
> 91/91 tests green, gate green except the intended workflow tripwire. Phase 2
> (retire setup.sh + config/root) and Phase 3 (pipelines/*.mts + option B)
> remain. Sections below marked Phase 1 are historical context; proceed to
> "Execution phases" Phase 2.

## What the repo is (and is becoming)

Source of truth for Mark's dev standards. Ships ONE build artifact: a
container image that is both a **drop-in quality gate** and a **workflow
runtime base**. Consumers reach it via the image (ghcr, gitsha-pinned) and
gitsha-pinned reusable workflow `uses:` refs — decision #15's "two channels
only". The old submodule/symlink model (`dotnet/setup.sh`) is legacy and is
being retired.

**Brand decision: `defined`.** Everything consumer-visible renames from
`quality-gate` → `defined`: image `ghcr.io/markstanden/defined`, workflows
`defined--*.yml`, AGENTS.md managed-block markers `<!-- defined:start/end -->`.
The GitHub repo itself keeps the name `coding-standards` for now — renamed
only once SHAs are stable (few consumers; rename churn deferred).

## Locked decisions (from the planning session)

1. **`runtime/`** — the former `quality/` + `quality/container/` directory
   becomes `runtime/` (expresses "the thing you run in"; covers gate + base roles).
2. **Root `lib/`** — genuinely useful small functional building blocks live at
   repo-root `lib/`, shared by BOTH `runtime/` and `pipelines/`. Core share:
   `proc`, `paths`, `git`. Gate-specific modules (`ctx`, `severities`,
   `step-result`, `agents-block`, `config-install`, `fixture`) stay in
   `runtime/lib`.
3. **`pipelines/`** — the stage-2 extracted `.mts` pipeline modules, at repo
   root (NOT `scripts/pipelines/`). Thin wrappers: they import and wrap
   `lib/` building blocks. **Principle: lib-heavy, pipelines-thin.** Keep
   pipeline scripts thin as `lib/` consumers so later refactors touch
   `lib/`, not every workflow.
4. **`standards/`** — enforceable rules (former `dotnet/`): `.editorconfig`,
   `Directory.Build.props`, `git-hooks/`, `testing/`, `workflows/pipeline.yml.example`.
5. **`practices/`** — docs / how-to (broadened from the rejected `agents/`).
6. **Retire `dotnet/setup.sh` + `dotnet/git-hooks/setup-hooks.sh`** — stale,
   superseded by `runtime/setup.mts` (bootstrap: config install + AGENTS.md
   seeding). Delete the submodule/symlink framing in README + AGENTS.md.
7. **Internal path change: `/opt/defined`** — all `/opt/quality` refs move
   atomically with the directory move (mount, ENTRYPOINT, `gateConfigPath`).
8. **Option B (selective)**: the 7 heavy workflows run in-container via
   `container: ghcr.io/markstanden/defined:<shortsha>` with
   `defaults.run.shell: bash` (container jobs default to `sh` — a gotcha).
   Drop redundant `setup-dotnet`/`setup-opentofu` steps in those jobs.
   Playwright browsers stay in-run (version-keyed + `actions/cache`);
   jq is eliminated by the `.mts` refactor (Node parses JSON); `az` was never
   invoked (actions handle auth/deploy).

## Target structure

```text
defined/                                # repo root (repo renamed later)
├── lib/                                # shared functional building blocks
│   ├── proc.mts   paths.mts   git.mts  #   moved from runtime/lib (core share)
│   ├── *.mts   …                       #   NEW building blocks from stage-2 extraction
│   └── *.test.mts
├── runtime/                            # the image (was quality/ + container/)
│   ├── Containerfile   tool-versions.env
│   ├── verify.sh   verify.mts   setup.mts
│   ├── lib/                            # gate-specific: ctx, severities, step-result,
│   │                                   #   agents-block, config-install, fixture
│   ├── steps/
│   ├── config/                         # prettierignore, yamllint.yml, agents-block.md
│   ├── test-helpers.mts   fixture.test.mts
│   └── (imports ../lib)
├── pipelines/                          # thin wrappers → consume ../lib
│   ├── tofu-*.mts   playwright-*.mts   azure-swa-*.mts   …
│   └── *.test.mts
├── standards/                          # enforceable rules (was dotnet/)
│   ├── .editorconfig   Directory.Build.props
│   ├── git-hooks/   testing/unit-testing.md
│   └── workflows/pipeline.yml.example
├── practices/                          # docs / how-to
├── .github/workflows/                  # defined--*.yml + pipeline templates
├── PLAN.md   README.md   AGENTS.md
```

## Rename surface (complete list)

Files currently containing `quality-gate` (image, markers, workflows):

- `AGENTS.md` (managed block + copy)
- `.github/workflows/quality-gate--verify.yml`
- `.github/workflows/quality-gate--test.yml`
- `.github/workflows/quality-gate--publish.yml`
- `PLAN.md`
- `quality/verify.sh` (`localhost/quality-gate:${PINHASH}`)
- `quality/setup.mts`
- `quality/config/agents-block.md` (markers)
- `quality/lib/agents-block.mts` (`BLOCK_START`/`BLOCK_END` markers)

Plus internal paths not containing "quality-gate" but tied to `/opt/quality`:

- `quality/verify.sh` mount: `-v "${QUALITY_DIR}:/opt/quality:ro"` →
  runtime+lib mounts at `/opt/defined/…`
- `quality/container/Containerfile`: `COPY . /opt/quality`, `WORKDIR /repo`,
  `ENTRYPOINT ["node", "/opt/quality/verify.mts"]`
- `quality/lib/paths.mts` `gateConfigPath` derives config dir from
  `dirname(dirname(import.meta.url))` — **breaks when `paths.mts` moves to
  root `lib/`; must resolve the runtime config dir explicitly, not by module
  location.**

## Execution phases (verification green at every step)

### Phase 1 — Rebrand + flatten, zero logic change
- `git mv` restructure: `quality/` → `runtime/`; `dotnet/` → `standards/`
  (content: editorconfig, directory-build-props, git-hooks, testing,
  workflows); create root `lib/` (move `proc.mts`, `paths.mts`, `git.mts` +
  their `.test.mts` out of `runtime/lib`); create `pipelines/` skeleton.
- Fix `gateConfigPath` derivation + all mount/bake/ENTRYPOINT paths.
- Rename image refs, workflows (`quality-gate--*.yml` → `defined--*.yml`),
  markers (`<!-- defined:start/end -->`), docs, module header comments.
- **Verify:** `node --test` green (in `runtime/`); `./runtime/verify.sh` (from
  repo root) green — gate red ONLY on the intended workflow tripwire
  (SC2086 in `azure-swa--deploy-blazor-wasm.yml` etc.), unchanged.
- Commit: small signed commits, verification passing between them.

### Phase 2 — Retire `setup.sh`, resolve config drift
- Delete `standards/setup.sh` (was `dotnet/setup.sh`), `git-hooks/setup-hooks.sh`,
  and the submodule instructions in README/AGENTS.
- Delete `runtime/config/root/` (the `.editorconfig`/`Directory.Build.props`
  copies — a known drift duplication). Bake `standards/.editorconfig` +
  `standards/Directory.Build.props` into the image as the bootstrap install
  source instead (single source of truth).

### Phase 3 — Stage-2 pipeline refactor (`pipelines/` + option B)
- Extract heavy multi-line `run:` blocks to `pipelines/*.mts` thin wrappers
  over `lib/` building blocks, colocated `*.test.mts`, `node --test`.
  Heaviest first (by complex-line count):
  - `opentofu-build-infrastructure.yml` (61) → `tofu-*.mts`
  - `azure-swa--deploy-blazor-wasm.yml` (34) + `deploy-static-site.yml` (22) → `azure-swa-*.mts`
  - `dotnet-test--playwright-tests.yml` (20, incl. jq version-detection) → `playwright-*.mts`
  - `dotnet-test--common-test-runner.yml` (12), `dotnet-build--blazor-frontend.yml` (15), `opentofu-destroy-workspace.yml` (11)
  - `healthcheck--curl-endpoints.yml` (7); tail: `node-build--frontend`,
    `dotnet-format--solution`, `dotnet-build--solution`, `dotnet-sonarqube`
  - Simple one-liners (`tofu validate`, `npm run format:check`) stay inline.
- Add `setup-node@…` `node-version: 26` to the ~10 light workflows that will
  consume `.mts` (runner default is Node 22/24; we pin 26 to match the image).
- Containerise the 7 heavy workflows (option B, decision #8 above).
- **Verify:** `node --test` green (runtime + pipelines); `./runtime/verify.sh`
  FULLY green (tripwire closed).

### Phase 4 — Sonar + docs + status
- Sonar issues fold in as files are reshaped:
  - **SC2086 ×28 tripwire** → vanishes as bash → `.mts`; stragglers fixed inline.
  - **S7637 ×7 hotspots** (unpinned `uses:` in `dotnet-test--common-test-runner`,
    `opentofu-build-infrastructure` ×4, `opentofu-destroy-workspace` ×2) →
    full-SHA pins as touched.
  - **S6505/S8543** (unpinned `npx playwright`) → pinned in the module.
  - **Gate code ×4** (S6557 endsWith, S6598 function type, S4036 PATH, S4624
    nested template in `quality/verify.mts` + `steps/shell.mts`) → fixed.
  - **`standards/` shell ×6** (S7688 `[`→`[[`, S7677 stderr) → fixed inline.
- PLAN.md: add the `defined` decision + stage-2 status; tick the stale
  `CI template` status item; AGENTS.md pattern note for `lib/`+`pipelines/`.

## Verification commands

- Gate suite: `cd runtime && node --test` (host; fixture test skips under
  `act`, runs for real under podman)
- Full gate: `./runtime/verify.sh` from repo root (needs podman + image;
  image builds on first run)
- `act` (optional, podman-backed): `DOCKER_HOST=unix:///run/user/1000/podman/podman.sock /tmp/opencode/act -j test`
- Sonar: `gh pr view` + SonarQube MCP tools (project `markstanden_coding-standards`)

## House rules (from AGENTS.md)

- British English; `date +%F` for dates; Markdown update header on every md
  edit: `<!-- update: agent=[name] | date=YYYY-MM-DD | scope=[path] -->`
- Shell: `#!/usr/bin/env bash`, `[[ ]]`, never `#!/bin/sh`
- TS: Node ≥ 26 strip-types, no enums/namespaces (bare string-literal unions),
  extensioned imports, zero deps, `node --test` colocated `*.test.mts`
- Small signed commits, verification passing between each; propose a commit
  message and ASK before committing (never silent). GPG sign (export GPG_TTY).
- Address Mark as "Guv"/"Guv'nor"; playful but get the work done.