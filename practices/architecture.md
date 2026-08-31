<!-- update: agent=opencode | date=2026-08-31 | scope=practices/architecture.md -->

# Architecture preferences

Working principles for how I design and structure projects. These are
preferences, recorded so agents and reviewers apply them consistently — the
hard rules (gate steps, module conventions, naming) live in
`standards/naming.md` and the gate's PLAN.md.

## Delivery

- **One container image is the toolchain.** Pin versions in one place
  (`tool-versions.env`); the image tag IS the release. No per-distro installer
  scripts, no drift between environments.
- **Local green = merge green by construction.** CI runs the same image as
  the developer; nothing is environment-specific.
- **Two distribution channels only**: the pinned image and gitsha-pinned
  reusable-workflow refs. No submodules, no symlinks, no release artifacts.
- **One gate workflow**: `defined--verify.yml` is the sole consumer-facing
  reusable workflow. Delivery actions live in the consumer's own pipelines.

## Structure

- **Flat over nested**: `runtime/`, `lib/`, `standards/`, `practices/`.
  Modules named by what they do.
- **Filename == purpose**: `runtime/steps/<id>.mts`; the file names the step.

## Code

- **TypeScript core, strip-types runtime**: no enums/namespaces, extensioned
  imports, zero dependencies. Bash shrinks to a ~30-line shim.
- **Testability by injection**: anything that shells out accepts a runner
  parameter; pure logic is extracted and table-tested.
- **Floors raise, never lower**: defaults are strict; projects may add
  strictness, never remove it. Mechanical fixes are committed as mechanical
  diffs — a `--fix` that leaves diffs reads as failure.

## Tools

- **No optional tier**: a tool the image should contain must exist; its
  absence is a Containerfile problem, not a soft skip.
- **Config owns style**: edit config and run `verify --fix`, never hand-tune
  generated output.
