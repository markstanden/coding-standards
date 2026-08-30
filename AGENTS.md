<!-- update: agent=opencode | date=2026-08-30 | scope=AGENTS.md -->

# AGENTS.md

## What this repo is

A source of truth for **other projects'** configuration — templates consumed
via git submodule + symlinks (`dotnet/setup.sh`). There is no application
here: no solution, no `package.json`, no test suite of its own. Verification
means shell/YAML sanity checks, not builds.

## Non-obvious structure

- Root `.github/workflows/*.yml` are **reusable `workflow_call` templates**
  for consumer repos, NOT CI for this repo. Naming convention:
  `<tool>--<purpose>.yml` (double hyphen), inputs parameterise paths/versions.
- `dotnet/workflows/pipeline.yml.example` — the `.example` suffix is
  deliberate: `setup.sh` copies it into consumer repos as `pipeline.yml`
  (README calls it `pipeline-example.yml`; the script is authoritative).
- `setup.sh` and hook scripts assume this repo is checked out as
  `.coding-standards/` inside the consumer project; path maths depends on it.
- `dotnet/editorconfig/.editorconfig` and
  `dotnet/directory-build-props/Directory.Build.props` are symlink *targets* —
  edits propagate to every consumer project on next checkout.

## Active work: portable quality gate

`quality/` is being built per `PLAN.md`. Read `PLAN.md` before touching
anything gate-related — its decisions log is law and exists so choices aren't
relitigated:

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
  end-to-end gate (`./quality/verify.sh`) — host-green does not mean
  gate-green (2026-08-30: unit suite passed 69/69 while the gate went red on
  real workflow-template findings). The gate is currently red on purpose
  (deferred workflow fixes, see PLAN.md status) and must stay that way until
  the fixes land — the failing `workflow` step is the tripwire that flags
  deviations.

## Conventions

- Shell scripts: `#!/usr/bin/env bash` with `[[ ]]`; never `#!/bin/sh`.
- Markdown files carry an update header:
  `<!-- update: agent=[name] | date=YYYY-MM-DD | scope=[path] -->`
  (get dates from `date +%F`, never guess).
