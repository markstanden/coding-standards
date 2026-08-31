<!-- update: agent=opencode | date=2026-08-31 | scope=AGENTS.md -->

# AGENTS.md

## What this repo is

A source of truth for **other projects'** configuration, delivered as one
container image (`defined`, built from `runtime/` + shared `lib/` +
`standards/`). There is no application here: no solution, no `package.json`.
Verification is the gate's own suite (`node --test`) plus the podman
end-to-end gate.

## Non-obvious structure

- `cli/defined` is the **installed host launcher** (decision #25): bash, no gate
  behaviour, needs only git + podman/docker. It reads the consumer's committed
  `.defined-version` pin, prefers podman, mounts the repo rw for `comply` / ro
  for `verify`. Tested via `cli/defined.test.mts` with fake engines injected on
  PATH (no real engine needed). The producer repo does not commit its own
  `.defined-version`.
- Root `.github/workflows/*.yml` hold one consumer-facing reusable workflow and
  two repository CI workflows. The only reusable workflow is `defined--verify.yml`
  (the gate). Naming convention: `<namespace>--<loose-verb>[--<target>].yml`
  (double hyphen separates the segments; the verb names the intent, not the tool
  — see `standards/naming.md`). The other two ARE CI for this repo:
  `defined--publish.yml` (builds + pushes the gate image to ghcr on main) and
  `defined--test.yml` (runs the gate's own unit + broken-fixture suite on PRs
  and merges).
- `standards/workflows/pipeline.example.yml` — the `.example` in the stem is
  deliberate: it is a template for consumer pipelines, not a real workflow
  here. The `.yml` extension means the gate's `yaml` step lints it, so the
  template stays valid YAML.
- `standards/.editorconfig` and `standards/Directory.Build.props` are the
  single source of truth for shared root configs — `comply`'s bootstrap
  installs them into consumer repo roots from the baked image. The repo's own
  root `.editorconfig` and `Directory.Build.props` are copies of the
  `standards/` versions (self-hosted: `comply` on this repo is a no-op
  beyond the AGENTS block). Managed files are compared byte-for-byte: any
  difference is drift and fails — there is no semantic merge. It drives prettier
  (pure-defaults config reads it natively), shfmt and IDEs from one source.

## The gate: how it works

`runtime/` + shared `lib/` are built per `PLAN.md` (the working, living plan of
record — read it before touching anything gate-related):

- Container-native runtime (official `node:<ver>-slim` base, digest-pinned
  via `tool-versions.env`); host surface is the installed `cli/defined`
  launcher (git + podman/docker plus standard coreutils) and the internal
  `runtime/comply.sh` source-development shim.
- TypeScript core, Node ≥26 strip-types: **no enums/namespaces** (bare string
  literal unions), extensioned imports, zero dependencies, tested with
  `node --test` colocated as `*.test.mts`.
- Steps run in fixed order `naming → node → dotnet → shell → smoke → yaml → workflow
→ tofu`; missing applicable tools fail loudly pointing at the Containerfile
  (no optional tier).
- **Run the full suite continuously**: host `node --test` _and_ the podman
  end-to-end gate (`./runtime/comply.sh`) — host-green does not mean
  gate-green. `node --test` also runs the broken-fixture integration test
  (`runtime/fixture.test.mts`), which drives the real gate against a
  deliberately-broken repo and skips cleanly without a container engine.
  Keeping the gate green is the tripwire — any workflow-template deviation
  fails the `workflow` step again.
- The image tag IS the toolchain — the gate image carries every pinned tool, so
  containerised CI jobs need no setup-opentofu/setup-dotnet/setup-node steps.

## Conventions

- Shell scripts: `#!/usr/bin/env bash` with `[[ ]]`; never `#!/bin/sh`.
- Markdown files carry an update header:
  `<!-- update: agent=[name] | date=YYYY-MM-DD | scope=[path] -->`
  (get dates from `date +%F`, never guess).

<!-- defined:start -->

This project is gated by Mark's portable defined gate. The house standards,
tool pins and how to adopt the gate are documented in the defined README
(<https://github.com/markstanden/defined>). Run `defined comply` — it
bootstraps, repairs and verifies in one pass; use it every time.
(`defined verify` is the pipeline-only read-only check.)
A missing ecosystem skips, a missing tool fails loudly.
<!-- defined:end -->
