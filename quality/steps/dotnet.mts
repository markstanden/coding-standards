// steps/dotnet.mts — .NET projects: format, build, test via dotnet CLI.
//
// Tools:    dotnet SDK (format, build, test)
// Config:   .editorconfig, Directory.Build.props installed by gate setup;
//           projects may add stricter rules via .qualityrc.json
// Fix:      dotnet format rewrites, then step re-verifies — a fix that
//           leaves diffs can never read as success
//
// Detection is sync and data-driven: activation = at least one tracked
// *.csproj, *.sln, or *.slnx file. Workspace discovery follows
// dev-tools' pattern: explicit flag/env → single slnx/sln at root → repo root.
// The runner is injected so tests need no host binaries.

import { failed, passed, skipped, type StepResult } from "../lib/step-result.mts";
import { run } from "../lib/proc.mts";

export interface DotNetRunContext {
  mode: "fix" | "no-fix";
  repoRoot: string;
}

type Runner = typeof run;

export function filterDotNetFiles({ files }: { files: string[] }): string[] {
  return files.filter((file) => /\.(csproj|sln|slnx)$/u.test(file));
}

export interface DiscoverWorkspaceInput {
  repoRoot: string;
  workspaceEnv?: string;
  slnxFiles: string[];
  slnFiles: string[];
}

/**
 * Discover the .NET workspace to operate on.
 * Priority: explicit env → single .slnx → single .sln → repo root.
 * Throws on multiple solutions without explicit selection.
 */
export function discoverWorkspace({
  repoRoot,
  workspaceEnv,
  slnxFiles,
  slnFiles,
}: DiscoverWorkspaceInput): string {
  if (workspaceEnv && workspaceEnv.length > 0) {
    return workspaceEnv;
  }
  if (slnxFiles.length === 1 && slnFiles.length === 0) {
    return `${repoRoot}/${slnxFiles[0]!}`;
  }
  if (slnFiles.length === 1 && slnxFiles.length === 0) {
    return `${repoRoot}/${slnFiles[0]!}`;
  }
  if (slnxFiles.length + slnFiles.length > 1) {
    throw new Error(
      `Multiple solution files found at repo root; use --workspace or TOOL_WORKSPACE: ${[
        ...slnxFiles,
        ...slnFiles,
      ].join(", ")}`,
    );
  }
  return repoRoot;
}

async function runDotNetCommand(
  runner: Runner,
  args: string[],
  cwd: string,
): Promise<{ status: number; stdout: string; stderr: string }> {
  return runner({ cmd: "dotnet", args, cwd });
}

/**
 * Run dotnet format, build, test over the discovered workspace.
 * Returns skip when no .NET files tracked; fail naming the failing phase.
 */
export async function runDotNetStep({
  ctx,
  trackedFiles,
  runner = run,
}: {
  ctx: DotNetRunContext;
  trackedFiles: string[];
  runner?: Runner;
}): Promise<StepResult> {
  const dotnetFiles = filterDotNetFiles({ files: trackedFiles });
  if (dotnetFiles.length === 0) {
    return skipped({ notice: "dotnet: no tracked *.csproj/*.sln/*.slnx files" });
  }

  const slnxFiles = trackedFiles.filter((f) => f.endsWith(".slnx"));
  const slnFiles = trackedFiles.filter((f) => f.endsWith(".sln"));
  const workspace = discoverWorkspace({
    repoRoot: ctx.repoRoot,
    workspaceEnv: process.env.TOOL_WORKSPACE,
    slnxFiles,
    slnFiles,
  });

  // Fix mode: format (write) then verify; check mode: verify only.
  if (ctx.mode === "fix") {
    const formatWrite = await runDotNetCommand(runner, ["format", workspace], ctx.repoRoot);
    if (formatWrite.status !== 0) {
      return failed({ notice: `dotnet: format failed: ${formatWrite.stderr.trim()}` });
    }
  }

  // Always verify formatting is clean.
  const formatCheck = await runDotNetCommand(runner, ["format", "--verify-no-changes", workspace], ctx.repoRoot);
  if (formatCheck.status !== 0) {
    return failed({ notice: "dotnet: format found diffs (run with --fix)" });
  }

  const build = await runDotNetCommand(runner, ["build", workspace, "--no-restore"], ctx.repoRoot);
  if (build.status !== 0) {
    return failed({ notice: `dotnet: build failed: ${build.stderr.trim()}` });
  }

  const test = await runDotNetCommand(runner, ["test", workspace, "--no-build", "--no-restore"], ctx.repoRoot);
  if (test.status !== 0) {
    return failed({ notice: `dotnet: test failed: ${test.stdout.trim() || test.stderr.trim()}` });
  }

  return passed({ notice: `dotnet: format/build/test clean (${dotnetFiles.length} project(s))` });
}