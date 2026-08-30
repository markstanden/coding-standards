<!-- update: agent=opencode | date=2026-08-30 | scope=AGENTS.md -->

# AGENTS.md

## What this repo is

A source of truth for **other projects'** configuration, delivered as one
container image (`defined`, built from `runtime/` + shared `lib/` +
`standards/`). There is no application here: no solution, no `package.json`.
Verification is the gate's own suite (`node --test`) plus the podman
end-to-end gate.

## Non-obvious structure

- Root `.github/workflows/*.yml` are mostly **reusable `workflow_call` templates**
  for consumer repos, NOT CI for this repo. Naming convention:
  `<tool>--<purpose>.yml` (double hyphen), inputs parameterise paths/versions.
  Exceptions that ARE CI for this repo: `defined--publish.yml` (builds +
  pushes the gate image to ghcr on main) and `defined--test.yml` (runs
  the gate's own unit + broken-fixture suite on PRs and merges).
- `standards/workflows/pipeline.yml.example` — the `.example` suffix is
  deliberate: it is a template for consumer pipelines, not run here.
- `standards/.editorconfig` and `standards/Directory.Build.props` are the
  single source of truth for shared root configs — the gate's `setup`
  installs them into consumer repo roots (raises-only) from the baked image.

## Active work: portable quality gate

`runtime/` + shared `lib/` are being built per `PLAN.md`. Read `PLAN.md` before
touching anything gate-related — its decisions log is law and exists so choices
aren't relitigated:

- Container-native runtime (official `node:<ver>-slim` base, digest-pinned
  via `tool-versions.env`; global pinned `tsc` for typechecking gate code);
  only host surface is a ~30-line bash shim.
- TypeScript core, Node ≥26 strip-types: **no enums/namespaces** (bare string
  literal unions), extensioned imports, zero dependencies, tested with
  `node --test` colocated as `*.test.mts`.
- Steps run in fixed order `naming → node → dotnet → shell → yaml → workflow
  → tofu`; missing tools fail loudly pointing at the Containerfile (no
  optional tier).
- **Run the full suite continuously**: host `node --test` *and* the podman
  end-to-end gate (`./runtime/verify.sh`) — host-green does not mean
  gate-green (2026-08-30: the unit suite passed while the gate went red on
  real workflow-template findings until the stage-2 refactor fixed them).
  `node --test` also runs the broken-fixture integration test
  (`runtime/fixture.test.mts`), which drives the real gate against a
  deliberately-broken repo and skips cleanly without a container engine.
  The gate is now fully green; keeping it green is the tripwire — any new
  workflow-template deviation fails the `workflow` step again.
- Pipeline modules live in `pipelines/*.mts` (thin zero-dep wrappers over the
  shared `lib/` building blocks), baked into the image at
  `/opt/defined/pipelines` and invoked by containerised workflow jobs as
  `node /opt/defined/pipelines/<module>.mts` with inputs via env. The image
  tag IS the toolchain for containerised workflows — no setup-opentofu/
  setup-dotnet/setup-node steps needed.

## Conventions

- Shell scripts: `#!/usr/bin/env bash` with `[[ ]]`; never `#!/bin/sh`.
- Markdown files carry an update header:
  `<!-- update: agent=[name] | date=YYYY-MM-DD | scope=[path] -->`
  (get dates from `date +%F`, never guess).
<!-- defined:start -->
This project is gated by Mark's portable defined gate (`runtime/`).
House standards, tool pins and the decision log live in the gate's PLAN.md;
the canonical cross-project index is the coding-standards README. Run
`./runtime/verify.sh` to gate (add `--fix` to repair mechanically, `--silent`
for log-style output); a missing ecosystem skips, a missing tool fails loudly.
<!-- defined:end -->