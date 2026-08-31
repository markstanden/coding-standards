// Tests for lib/ctx.mts: command parsing and run-context assembly.
// Run: node --test lib/ctx.test.mts

import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, test } from "node:test";

import { createRunContext, parseCommand } from "./ctx.mts";

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(
        tempDirs
            .splice(0)
            .map((dir) => rm(dir, { recursive: true, force: true })),
    );
});

async function tempGitTree(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "quality-ctx-"));
    tempDirs.push(dir);
    await mkdir(join(dir, ".git"));
    return dir;
}

test("parseCommand accepts exactly comply and verify", () => {
    assert.deepEqual(parseCommand({ argv: ["comply"] }), {
        verb: "comply",
        help: false,
    });
    assert.deepEqual(parseCommand({ argv: ["verify"] }), {
        verb: "verify",
        help: false,
    });
});

test("parseCommand reports help", () => {
    assert.deepEqual(parseCommand({ argv: ["-h"] }), {
        verb: "verify",
        help: true,
    });
    assert.deepEqual(parseCommand({ argv: ["--help"] }), {
        verb: "verify",
        help: true,
    });
});

test("parseCommand rejects a missing command", () => {
    assert.throws(() => parseCommand({ argv: [] }), /missing command/u);
});

test("parseCommand rejects unknown verbs", () => {
    assert.throws(() => parseCommand({ argv: ["wat"] }), /unknown command/u);
    assert.throws(() => parseCommand({ argv: ["setup"] }), /no longer public/u);
});

test("parseCommand rejects the retired flags", () => {
    assert.throws(() => parseCommand({ argv: ["--fix"] }), /'--fix' is gone/u);
    assert.throws(
        () => parseCommand({ argv: ["--no-fix"] }),
        /'--no-fix' is gone/u,
    );
    assert.throws(
        () => parseCommand({ argv: ["--silent"] }),
        /'--silent' is gone/u,
    );
});

test("parseCommand rejects trailing arguments", () => {
    assert.throws(
        () => parseCommand({ argv: ["comply", "--silent"] }),
        /unexpected argument/u,
    );
    assert.throws(
        () => parseCommand({ argv: ["verify", "extra"] }),
        /unexpected argument/u,
    );
});

test("createRunContext derives repoRoot via git marker walk-up", async () => {
    const root = await tempGitTree();
    const nested = join(root, "deep");
    await mkdir(nested);
    const ctx = await createRunContext({ verb: "verify", startDir: nested });
    assert.equal(ctx.repoRoot, root);
    assert.equal(ctx.verb, "verify");
});
