[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=markstanden_defined)](https://sonarcloud.io/summary/new_code?id=markstanden_defined)

# defined

A single source of truth for my development project configuration files, workflow templates, and development tools to ensure consistency across projects.

**defined** — a portable, drop-in quality gate. A single container image
(`runtime/`) that detects any project's stack and runs the right checks,
backed by shared building blocks (`lib/`) and house standards (`standards/`).
The design and decision log live in [PLAN.md](PLAN.md).

## The gate: one command owns local verification

Install the `defined` launcher, then run it from a project root:

```bash
install -m 755 cli/defined ~/.local/bin/defined   # one-time install

defined comply    # bootstrap (configs + AGENTS block) → repair → verify
```

**Always use `comply` for local and agent work.** It bootstraps the managed
configs, repairs safe findings, then re-verifies — one command, exit 0 only
when the checkout is green. `verify` exists solely for the pipeline: it is the
read-only check `defined--verify.yml` runs in CI (never writes), and is not the
command for a developer to reach for.

The launcher needs only git + podman/docker; it prefers podman, mounts the repo
read-write for `comply` and read-only for `verify`, and runs the exact image
pinned in the repo's `.defined-version` — so local green = merge green by
construction: CI runs that same image.

The gate detects the stack (steps run in order `naming → node → dotnet → shell
→ yaml → workflow → tofu`), skips cleanly when an ecosystem is absent, and
fails loudly when a pinned tool is missing. Tool versions are pinned in
[`runtime/tool-versions.env`](runtime/tool-versions.env) — a pin change rebuilds
the image.

## Adopt the gate in a consumer repo

1. **Install the launcher** — copy `cli/defined` onto PATH (normally
   `~/.local/bin/defined`); it needs only git + podman/docker.
2. **Commit the pin** — add a `.defined-version` file holding the immutable
   image tag you want (e.g. the git SHA of the gate commit you're adopting).
3. **Gate locally** — run `defined comply`. It bootstraps `.editorconfig` and
   `Directory.Build.props` into the repo root and seeds the AGENTS.md managed
   block (raises-only; your tightened rules are never overwritten), repairs
   safe findings, then re-verifies. Use `comply` every time — it is the whole
   local loop; `verify` is reserved for CI.
4. **Gate in CI** — call the reusable `defined--verify.yml` workflow, pinned
   to the same git sha as the pin:

    ```yaml
    jobs:
        quality:
            uses: markstanden/defined/.github/workflows/defined--verify.yml@<shortsha>
    ```

    The workflow reads `.defined-version` for the image tag — the same pin the
    local launcher reads — so local and CI always run the exact same image.
    Release identity is immutable: the workflow ref SHA and the `.defined-version`
    pin must match.

## Quality badges

SonarQube Cloud exposes quality-gate badges for the repo README. The badge
reflects the gate on the default branch; the link goes to the new-code
summary.

```markdown
[![Quality gate](https://sonarcloud.io/api/project_badges/quality_gate?project=<org>_<repo>)](https://sonarcloud.io/summary/new_code?id=<org>_<repo>)
```

- **Project key**: `<org>_<repo>` (the SonarQube Cloud project key — visible
  on the project dashboard).
- The badge works only once SonarQube Cloud has analysed the default branch
  at least once (a blank badge means no analysis yet).
- Add the same badge to client-project READMEs that adopt the gate — it is the
  public "is it green?" signal for a repo, and points reviewers at the new-code
  summary where the gate conditions are explained.

## SonarQube Cloud project artifacts

Two small files pin the SonarQube Cloud project identity so IDE analysis and
standalone scanning target the same project as CI. Neither contains secrets —
tokens live in CI secrets, never in the repo.

- `sonar-project.properties` — `sonar.projectKey` / `sonar.organization` /
  `sonar.sources` for the standalone scanner.
- `.sonarlint/connectedMode.json` — SonarLint connected mode (org, project
  key, region). No credentials: SonarLint keeps them in the IDE's secret
  store.

Client projects adopting the gate should add both, substituting their own
`<org>_<repo>` key, so IDE and CLI analysis agree with CI by construction. Keep
the `sonar.projectKey` in this repo's `sonar-project.properties`,
`.sonarlint/connectedMode.json` and the README badge in step.

## Workflow templates

The gate exposes exactly one consumer-facing reusable workflow:
`defined--verify.yml` — quality scan for any repo. Call it from a consumer
pipeline via a gitsha-pinned ref. Filename grammar:
`<namespace>--<loose-verb>[--<target>]` (see [`standards/naming.md`](standards/naming.md)).

```yaml
jobs:
    quality:
        uses: markstanden/defined/.github/workflows/defined--verify.yml@<shortsha>
        with:
            image-tag: <shortsha>
```

`defined--test.yml` and `defined--publish.yml` are this repo's own CI (tests
and image publication), not consumer templates.

A full example pipeline is in [`standards/workflows/pipeline.example.yml`](standards/workflows/pipeline.example.yml).

## Standards

- [`standards/naming.md`](standards/naming.md) — workflow filename grammar
- [`standards/testing/unit-testing.md`](standards/testing/unit-testing.md) — C#/xUnit testing patterns
- [`standards/testing/node-testing.md`](standards/testing/node-testing.md) — Node/TypeScript testing + module conventions
- [`practices/architecture.md`](practices/architecture.md) — delivery/structure/code preferences
- [`standards/.editorconfig`](standards/.editorconfig) — editor + dotnet code style (installed by gate setup)
- [`standards/Directory.Build.props`](standards/Directory.Build.props) — common MSBuild properties (installed by gate setup)
- [`standards/git-hooks/`](standards/git-hooks/) — .NET git hooks

## Project structure

```bash
coding-standards/
├── cli/                             # installed host launcher (no gate logic)
│   └── defined                      # needs only git + podman/docker
├── runtime/                         # the container image (the gate)
│   ├── Containerfile                # node 26 slim base, pinned tools
│   ├── tool-versions.env            # single source of tool version pins
│   ├── verify.sh                    # internal source-development shim
│   ├── verify.mts                   # comply/verify orchestration
│   ├── setup.mts                    # bootstrap/check implementation
│   ├── lib/                         # gate-specific core (ctx, severities, blocks)
│   ├── steps/                       # one module per ecosystem check
│   └── config/                      # tool configs travelling in the image
├── lib/                             # shared building blocks (proc, paths, git)
├── standards/                       # house standards and tools
├── practices/                       # docs / how-to
└── .github/workflows/                # defined--verify/test/publish
```

Consumers commit a `.defined-version` (one immutable image tag) read by both the
launcher and `defined--verify.yml`; this producer repo does not commit its own
(a file containing its own SHA is impossible by construction).
