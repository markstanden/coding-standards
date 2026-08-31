<!-- update: agent=opencode | date=2026-08-31 | scope=PLAN.md -->

# PLAN — defined: portable quality gate

`defined` is a portable engineering quality gate that works against **any**
project. Standards are defined once, distilled into agent guidance, and enforced
mechanically by one pinned container runtime, exposed through an agent-first
local CLI and one reusable pipeline workflow: local green = pipeline green by
construction.

`defined` is deliberately **not** a general CI/CD runtime: no release artifacts,
deployment, infrastructure operations, hosted service wrappers, or bespoke
build/test pipeline catalogue. A universally-applicable check belongs in the
gate; a project-specific delivery action stays with that project.

## Where we are (2026-08-31)

Built and green to date:

- **Container-native runtime** — official `node:<ver>-slim`, digest-pinned via
  `tool-versions.env`; TypeScript core (strip-types, extensioned imports, no
  enums/namespaces, zero deps), bash shrunk to a ~30-line shim (`comply.sh`).
- **Fixed step order** `naming → node → dotnet → shell → yaml → workflow →
tofu`; missing applicable tools fail loudly pointing at the Containerfile
  (no optional tier except Sonar, outside the manifest).
- **Self-contained image** `ghcr.io/markstanden/defined` — gate code, shared
  `lib/` and standards baked at `/opt/defined`; local shim bind-mounts ro for
  live edits. CI via `defined--test.yml`; publication via
  `defined--publish.yml` (linux/amd64+arm64, pinhash + shortsha tags).
- **Bootstrap** — `comply` installs `.editorconfig` + `Directory.Build.props`
  into repo roots (raises-only) and seeds a marker-delimited managed block in
  consumer `AGENTS.md` (raises-only, idempotent); `verify` detects
  absence/drift/corruption read-only.
- **Two-verb runtime contract (Phase 2, 2026-08-31)** — `defined comply` is the
  always-use local/agent loop: bootstraps → repairs → re-verifies; `defined
verify` is the pipeline-only check: managed artifacts then a complete no-fix
  pass, never writing. Output is one stable `compliant` line on green; a stable
  agent-actionable breakdown otherwise. The retired `setup` verb and
  `--fix`/`--no-fix`/`--silent` flags are usage errors.
- **Installed launcher + shared pin (Phase 3, 2026-08-31)** — `cli/defined`
  (bash, no gate logic) reads the consumer's `.defined-version`, prefers
  podman, mounts rw for `comply` / ro for `verify`, and runs the exact pinned
  image. Unit tests inject fake engines on PATH; smoke-tested against a
  throwaway consumer. `defined--verify.yml` reads `.defined-version` (no
  `image-tag` input); `runtime/comply.sh` stays the source-development shim
  (it builds/live-edits the local image, which the launcher does not).
- **Product rename (Phase 4, 2026-08-31)** — GitHub repo is `markstanden/defined`
  (redirect from the old name verified), SonarQube key is `markstanden_defined`,
  GHCR image `ghcr.io/markstanden/defined` is public; README/workflow/tests use
  the new identity and the local `origin` points at the renamed repo. Remaining
  after this branch merges to `main`: `defined--publish.yml` publishes a fresh
  image SHA, and the local checkout directory gets renamed last (machine state).
- **Tested** — 145+ host unit tests (colocated `*.test.mts`) + a broken-fixture
  integration test (`runtime/fixture.test.mts`) driving the real gate
  in-container (hash-proves `verify` is side-effect free) + the podman
  end-to-end gate (`./runtime/comply.sh`). Run the full suite
  continuously: host-green does not mean gate-green.
- **Current repo target** — `runtime/`, root `lib/`, `standards/`, `practices/`,
  `.github/workflows/{defined--verify|defined--test|defined--publish}.yml`.
- **Scope correction applied (Phase 1 of the refocus, 2026-08-31)** — the ten
  delivery workflow templates, the `pipelines/` layer (14 modules + 14 tests +
  helper) and the orphaned `lib/gha.mts`/`lib/json.mts` helpers are removed;
  `defined--verify.yml` is the sole consumer-facing workflow. Git history is
  the archive.

## Decisions log (condensed)

1. **Container is the runtime** — tools pinned via `tool-versions.env`; host needs only podman/docker + git.
2. **No native fallback** — missing engine fails loudly; one path, no drift.
3. **In-container project deps** — named volumes shadow `node_modules`/`obj`/`bin`; restore inside the container (avoids host↔image ABI mismatch).
4. **Build local, publish for CI** — `comply.sh` builds a cached local image; CI consumes/publishes `ghcr.io/markstanden/defined:<tag>`.
5. **Step order** — `naming → node → dotnet → shell → yaml → workflow → tofu`; semantic renames precede mechanical formatting.
6. **Tofu** — `fmt` always (fixable); `init` + `validate` accepted despite provider cost.
7. **Types** — bare string-literal unions; enums banned under strip-types.
8. **Params** — public functions take a single destructured object.
9. **Tool policy** — no optional tier; missing tool = loud fail pointing at the Containerfile.
10. **Scanning** — git-tracked files only; per-tool ignores travel in `runtime/config/`.
11. **Detection** — sync, sequential execution; `--fix` writes files, ordered output keeps `--silent` trustworthy.
12. **Overrides** — `.qualityrc.json` raises-only; unknown ids or lowered floors are config errors.
13. **Gate is the bootstrap** — setup installs shared root configs from image-baked versions; verify fails loudly on drift.
14. **Agent instructions seeded, not owned** — managed `<!-- defined:start/end -->` block in consumer AGENTS.md, rewritten idempotently, never clobbering project content.
15. **Distribution: two channels** — pinned image + gitsha-pinned reusable-workflow `uses:` refs.
16. **Standalone lint/security workflow templates dropped** — arrive via the gate's steps through one `defined--verify.yml`.
17. **Base image `node:<ver>-slim`, digest-pinned** — multi-arch manifest digest; pins live in `tool-versions.env`, reach `FROM` via build args.
18. **Shellcheck floor `error → style`** (raises-only) — every finding gates.
19. **Brand: `defined`; repo flattened** — image/workflows/markers named `defined`; `quality/`→`runtime/`, root `lib/`, `dotnet/`→`standards/`, docs under `practices/`.
20. **Filename grammar** — `<namespace>--<loose-verb>[--<target>]` for workflows, `<namespace>-<loose-verb>` for pipeline modules; runnable modules never end in `-test`. Canonical: `standards/naming.md`.
21. **tflint folded into `tofu`** — pinned release zip; order fmt → tflint → init → validate.
22. **Scope contracts to the universal quality gate** (2026-08-31, supersedes delivery parts of #19-20) — three surfaces (agent, local, pipeline); other consumer workflows and the `pipelines/` layer are removed. Git history is the archive.
23. **Public CLI: `comply` + `verify`** (2026-08-31) — `comply` bootstraps, repairs, then verifies; `verify` is side-effect-free and the only pipeline verb.
24. **Agent-first output** (2026-08-31) — success = exit 0 + one status line; failure = non-zero + stable agent-actionable breakdown.
25. **Installed thin launcher + project-owned image pin** (2026-08-31) — users install a small `defined` launcher; each consumer commits `.defined-version` (immutable image tag) read by both launcher and workflow.
26. **Repository becomes `markstanden/defined`** (2026-08-31, completes #19) — rename repo, README identity, links, launcher source and SonarQube key (`markstanden_coding-standards` → `markstanden_defined`, preserving history).

## Scope and API refocus (2026-08-31) — current plan

Follows the 2026-08-30 feedback review (`practices/defined-feedback.md`) and
supersedes the earlier assumption that `defined` hosts common delivery
workflows.

### Product boundary

One universal quality gate, three execution surfaces:

```text
                         STANDARDS
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
        AGENT GUIDANCE               DEFINED IMAGE
                │                         │
                │              ┌──────────┼──────────┐
                ▼              ▼          ▼          ▼
              AGENT         comply     verify     CI verify
                │              │          │          │
                └──────────────┴──────────┴──────────┘
                                      │
                                      ▼
                                COMPLIANT CODE
```

- **Standards** define what good looks like (shared config, practices, floors).
- **Agent guidance** gives an LLM the minimum completion contract.
- **The image** is the only enforcement runtime — detects ecosystems, repairs
  safe findings, verifies the rest.
- **Local/agent** execution uses the installed `defined` launcher; **pipeline**
  execution uses only `defined--verify.yml` (read-only verify).

Explicitly **outside** the product: release-artifact build/publish, SWA/app
deployment, OpenTofu plan/apply/destroy, healthcheck orchestration, bespoke
Playwright runners, hosted SonarQube wrappers, and workflow/pipeline-module
catalogues generally. No replacement delivery repository: git history is the
archive.

### ChatGPT feedback disposition

- **Adopt:** defined is the product; local green = pipeline green; standards
  authoritative; agent completion gate-owned; auto-fix first-class; missing
  tools fail loudly; verify deterministic; instructions small; adoption
  raises-only; release identity immutable; no red-X surprises.
- **Amend #11-12:** repair verb is `comply`, not `fix`; `setup` not public
  (bootstrap is the first phase of `comply`).
- **Amend #15:** pipeline is an execution surface for the gate, not a separate
  delivery responsibility hosted by this repo.
- **Defer #4:** full guidance compilation from standards is a later design
  problem, not a prerequisite for the scope correction.
- **Defer #7:** FIX/REPORT/REVIEW stays diagnostic language, not a new type
  hierarchy.
- **Defer `explain` / `--verbose`:** not in the initial public API.

### Final public API

```bash
defined comply   # always: the local/agent loop
defined verify   # pipeline-only: the read-only check
```

- **`comply`** (the only verb a developer or agent reaches for): resolve git
  root → read/validate `.defined-version` → pull image → bootstrap managed
  configs + AGENTS block (raises-only) → full internal `fix` pass → fresh
  internal `no-fix` verify pass → exit 0 only when green. The second pass is
  mandatory. Always use `comply` for local work; `verify` is not it.
- **`verify`**: resolve pin → check managed artifacts present/current (never
  install) → full `no-fix` pass → non-zero for any drift/finding/failure.
  Pipeline-only — the sole verb callable from `defined--verify.yml`, and not
  the command for local use.
- **Output contract:** success = exit 0 + one stable `compliant` line (success
  chatter suppressed); failure = non-zero + stable agent-actionable detail
  (phase, step, tool/rule, files, whether repair attempted, what remains).
  Diagnostics distinguish FIX / REPORT / REVIEW without making them types.

### Launcher and release identity

- Installable `cli/defined` bash launcher (`#!/usr/bin/env bash`, `[[ ]]`),
  installed on PATH (normally `~/.local/bin/defined`); no gate behaviour; needs
  only git + podman/docker; prefers podman; mounts repo read-write for
  `comply`, read-only for `verify`.
- `.defined-version` holds one immutable image tag; rejects empty, `latest`,
  malformed or conflicting overrides. Offline runs succeed only with the exact
  image present.
- `runtime/comply.sh` stays an internal source-development shim until the
  launcher covers local image development; not a third public API. It defaults
  to the `comply` verb; `--check-only` runs the read-only no-fix pass.
- Release identity is immutable (same SHA across all three):

```text
Git SHA
├── reusable workflow ref: markstanden/defined/...@<sha>
├── image tag:             ghcr.io/markstanden/defined:<sha>
└── consumer pin:          .defined-version → <sha>
```

GitHub forbids an expression in a reusable workflow `uses:` ref, so the
consumer writes the workflow SHA in YAML; `.defined-version` removes the
separate `image-tag` input so local and CI share one source.

### Target repository shape

```text
defined/
├── cli/
│   └── defined                       # installed host launcher; no gate logic
├── runtime/
│   ├── Containerfile                 # pinned, self-contained gate image
│   ├── tool-versions.env             # tool pins used to build the image
│   ├── verify.mts                    # comply/verify orchestration
│   ├── setup.mts                     # internal bootstrap/check implementation
│   ├── lib/                          # gate-specific core + tests
│   ├── steps/                        # detected ecosystem checks + tests
│   └── config/                       # travelling tool/agent configuration
├── lib/                              # shared gate helpers: git, paths, proc
├── standards/                        # authoritative house standards/config
├── practices/                        # explanatory guidance
└── .github/workflows/
    ├── defined--verify.yml           # sole consumer-facing workflow
    ├── defined--test.yml             # this repo's CI
    └── defined--publish.yml          # image publication
```

No `pipelines/`; `lib/` is shared only where runtime modules need it. The
producer repo does not commit a self-referential `.defined-version` (committing
a file containing its own SHA is impossible) — it is the contract in consumer
repos.

## Refocus implementation roadmap

### Phase 1 — Remove the workflow catalogue

- [x] Delete the ten consumer workflows outside the gate boundary:
      `azure-swa--deploy--blazor-wasm.yml`, `azure-swa--deploy--static-site.yml`,
      `dotnet--analyse--sonarqube.yml`, `dotnet--build--blazor-frontend.yml`,
      `dotnet--test--playwright-tests.yml`, `healthcheck--verify--endpoints.yml`,
      `node--build--frontend.yml`, `node--test--playwright.yml`,
      `opentofu--build--infrastructure.yml`, `opentofu--destroy--workspace.yml`.
- [x] Keep exactly one consumer-facing workflow, `defined--verify.yml`; keep
      `defined--test.yml` and `defined--publish.yml` as this repo's own CI.
- [x] Delete `pipelines/` in full (14 modules + 14 tests + helper). Git history
      is the archive; no `archive/` directory.
- [x] Delete root `lib/gha.mts`, `lib/json.mts` + tests after proving no runtime
      consumers; retain `git.mts`, `paths.mts`, `proc.mts`.
- [x] Remove `pipelines/` from the Containerfile copy, the comply.sh bind mount,
      the publish path trigger and the pipeline test glob. Keep `curl` (image
      build still fetches gate tools).
- [x] Reduce `standards/naming.md` to conventions exercised by the gate and its
      three `defined--*.yml` workflows.
- [x] Update README, AGENTS, architecture guidance and the pipeline example to
      describe one gate workflow, not a catalogue.
- [x] Add a status entry recording the scope correction and exact removals.
- [x] Host tests + full podman gate green; workflow step green against the
      smaller `.github/workflows/` tree.

### Phase 2 — Two-verb runtime contract

- [x] Positional verb parsing tests: only `comply`/`verify`; no verb, unknown
      verbs, public `setup`, `--fix`, `--no-fix`, `--silent` → concise usage
      errors, non-zero.
- [x] Split bootstrap into write vs check: `comply` idempotent/no-clobber;
      `verify` detects absence/drift/marker corruption without writing a byte.
- [x] `comply` = bootstrap → complete fix pass → fresh complete verify pass;
      prove the second pass runs after repairs and surviving failures set exit.
- [x] `verify` = managed-artifact check → complete no-fix pass; hash fixture
      files to prove side-effect freedom.
- [x] Success = one stable line, chatter suppressed; table-driven failure-output
      tests for bootstrap drift, findings, failed builds, missing tools.
- [x] Broken fixture drives both verbs: `verify` fails read-only; `comply`
      repairs safe findings, stays red for check-only ones; both green after
      semantic repair.
- [x] Keep internal `StepMode = "fix" | "no-fix"` unless simplification shows
      otherwise.
- [x] Host tests + podman gate after each behaviour slice.

### Phase 3 — Installed launcher and shared pin

- [x] `.defined-version` parsing unit: trim, validate immutable tag, reject
      mutable aliases, report path in errors.
- [x] `cli/defined` tests: engine preference, absent engine, repo-root
      discovery, exact image selection, missing image/pull failure, arg
      forwarding, mount modes (inject runner; no real engine for unit tests).
- [x] Launcher smoke against throwaway consumer with podman: first pull, cached
      run, `comply` bootstrap/repair, side-effect-free `verify`, malformed/
      unavailable pin.
- [x] Keep `.defined-version` out of this producer repo; test with fixture
      consumers; use `runtime/comply.sh` for source development.
- [x] `defined--verify.yml` takes no `fix`/`silent`/`image-tag` inputs; reads
      `.defined-version`, runs the exact image with `verify`, fails clearly on
      invalid pin.
- [x] Document install into `~/.local/bin`, `.defined-version` adoption, and the
      workflow-ref/image-pin match invariant.
- [x] Decide whether internal `runtime/comply.sh` still adds value; retire only
      when equivalent local image build/live-edit is covered elsewhere.
- [x] Launcher unit/integration + host + podman gate.

### Phase 4 — Rename the product repository

- [x] Confirm `markstanden/defined` is available and GHCR publication
      permissions hold. (GitHub repo already renamed externally; GHCR image
      `ghcr.io/markstanden/defined` verified public + fetchable.)
- [x] Replace active `markstanden/coding-standards` links/names with
      `markstanden/defined` in README, workflow examples, generated AGENTS and
      tests (historical prose may retain the old name as provenance).
- [x] Rename the GitHub repo only after the new default branch is green; update
      the local `origin` URL; do not rewrite history. (Repo renamed externally;
      local origin now `git@github.com:markstanden/defined.git`.)
- [x] Rename the SonarQube project key `markstanden_coding-standards` →
      `markstanden_defined` via its supported update (preserves history); update
      `sonar-project.properties`, `.sonarlint/connectedMode.json`, README
      badge/link together. (Key renamed externally; local files aligned.)
- [x] Verify old repo URL redirects and a historical pinned workflow remains
      fetchable (migration grace, not a guarantee).
- [ ] Rename the local checkout directory last (machine state, not a diff).
      (Pending: do after this branch lands, so the session's working tree stays
      intact.)
- [ ] Publish a matching image SHA and run final host, podman, launcher and
      reusable-workflow checks under the new name via a throwaway consumer.
      (Image publishes on `main` via `defined--publish.yml` after this branch
      merges; the current GHCR pinhash tag predates the two-verb runtime, so
      the final launcher check must run against the freshly published SHA.)

### Consumer migration

One consumer (`rdd-astro`) pins nine workflow calls to an older
`coding-standards` SHA; none uses current filenames or
`ghcr.io/markstanden/defined`, so the refocus does not break existing pins.
Leave `rdd-astro` untouched; historical SHA pins keep resolving via the repo
redirect; migrate it separately (adopt `.defined-version` + `defined--verify.yml`,
move its delivery logic into its own pipeline). The pinned old workflows are an
exit ramp, not supported.

### Completion criteria

- Public CLI surface is exactly `defined comply` and `defined verify`.
- Only consumer-facing reusable workflow is `defined--verify.yml`.
- Local and pipeline execution select the exact image from the same committed
  `.defined-version`.
- `comply` bootstraps → repairs → verifies; `verify` provably never writes to
  the checkout.
- Success is one stable line; every failure is agent-actionable.
- `pipelines/`, delivery workflows and orphaned helpers are absent.
- Active identity is `markstanden/defined` across GitHub, GHCR, SonarQube,
  generated guidance and docs.
- Host tests, broken fixture, podman gate and launcher smoke tests all pass
  under the renamed product.
