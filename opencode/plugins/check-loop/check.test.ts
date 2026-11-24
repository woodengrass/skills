import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CheckLoop, type CheckResult, findConfig, fingerprint, loadConfig, parseOptions, runCheck, tail } from "./check.ts";

const options = { command: "npm test", maxFailures: 3, timeoutMs: 1000 };

function harness(results: CheckResult[] = []) {
  let files = "v0";
  const sent: string[] = [];
  const runs: string[] = [];
  const loop = new CheckLoop(options, {
    run: async (command) => {
      runs.push(command);
      return results.shift() ?? { code: 0, output: "ok" };
    },
    fingerprint: () => files,
    send: async (_sessionID, text) => {
      sent.push(text);
    },
  });
  const idle = (extra: Partial<{ isChild: boolean; backgroundBusy: boolean }> = {}) =>
    loop.idle({ sessionID: "s", cwd: "/w", isChild: false, backgroundBusy: false, ...extra });
  return {
    loop,
    sent,
    runs,
    idle,
    change: (next: string) => {
      files = next;
    },
  };
}

const fail = (output = "1 test failed"): CheckResult => ({ code: 1, output });

describe("CheckLoop.idle", () => {
  test("runs the check after the session changed files, and stays quiet when it passes", async () => {
    const h = harness();
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    expect(await h.idle()).toBe("passed");
    expect(h.runs).toEqual(["npm test"]);
    expect(h.sent).toEqual([]);
  });

  test("sends the failing output back instead of the task", async () => {
    const h = harness([fail("FAIL src/a.test.ts: expected 2, got 3")]);
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    expect(await h.idle()).toBe("failed");
    expect(h.sent).toHaveLength(1);
    expect(h.sent[0]).toContain("expected 2, got 3");
    expect(h.sent[0]).toContain("`npm test` failed (exit 1)");
  });

  test("does not run when the session made no tool call", async () => {
    const h = harness();
    h.change("v1");
    expect(await h.idle()).toBe("skipped");
    expect(h.runs).toEqual([]);
  });

  test("does not run when the files are as the session found them", async () => {
    const h = harness();
    h.loop.beforeTool("s", "/w");
    expect(await h.idle()).toBe("skipped");
    expect(h.runs).toEqual([]);
  });

  test("skips subagent sessions", async () => {
    const h = harness();
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    expect(await h.idle({ isChild: true })).toBe("skipped");
    expect(h.runs).toEqual([]);
  });

  test("waits while the session's background work is running", async () => {
    const h = harness();
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    expect(await h.idle({ backgroundBusy: true })).toBe("skipped");
    expect(h.runs).toEqual([]);
  });

  test("does not repeat a check that already passed on the same files", async () => {
    const h = harness();
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    await h.idle();
    expect(await h.idle()).toBe("skipped");
    expect(h.runs).toHaveLength(1);
  });

  test("does not rerun when the agent stopped without changing the failing files", async () => {
    const h = harness([fail()]);
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    await h.idle();
    expect(await h.idle()).toBe("skipped");
    expect(h.runs).toHaveLength(1);
  });

  test("stops after maxFailures consecutive failures and asks for a report", async () => {
    const h = harness([fail("a"), fail("b"), fail("c"), fail("d")]);
    h.loop.beforeTool("s", "/w");
    const outcomes = [];
    for (const v of ["v1", "v2", "v3", "v4"]) {
      h.change(v);
      outcomes.push(await h.idle());
    }
    expect(outcomes).toEqual(["failed", "failed", "gave-up", "skipped"]);
    expect(h.sent[2]).toContain("failed 3 times in a row");
    expect(h.sent[2]).toContain("Stop changing files");
  });

  test("a pass resets the failure count", async () => {
    const h = harness([fail(), fail(), { code: 0, output: "" }, fail(), fail()]);
    h.loop.beforeTool("s", "/w");
    const outcomes = [];
    for (const v of ["v1", "v2", "v3", "v4", "v5"]) {
      h.change(v);
      outcomes.push(await h.idle());
    }
    expect(outcomes).toEqual(["failed", "failed", "passed", "failed", "failed"]);
  });

  test("a new user prompt clears a give-up", async () => {
    const h = harness([fail(), fail(), fail(), fail()]);
    h.loop.beforeTool("s", "/w");
    for (const v of ["v1", "v2", "v3"]) {
      h.change(v);
      await h.idle();
    }
    h.loop.userPrompt("s");
    h.change("v4");
    expect(await h.idle()).toBe("failed");
  });

  test("a timeout counts as a failure", async () => {
    const h = harness([{ code: null, output: "[timed out after 1000 ms]" }]);
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    expect(await h.idle()).toBe("failed");
    expect(h.sent[0]).toContain("no exit code");
  });
});

describe("CheckLoop.afterTool", () => {
  test("the agent's own passing run of the same command makes the idle check unnecessary", async () => {
    const h = harness();
    h.loop.beforeTool("s", "/w");
    h.change("v1");
    h.loop.afterTool("s", "/w", "shell", { command: " npm test " }, { exitCode: 0 });
    expect(await h.idle()).toBe("skipped");
    expect(h.runs).toEqual([]);
  });

  test("a failing, different, backgrounded or elsewhere run does not count", async () => {
    for (const [input, output] of [
      [{ command: "npm test" }, { exitCode: 1 }],
      [{ command: "npm test -- a.test.ts" }, { exitCode: 0 }],
      [{ command: "npm test" }, { exitCode: null, shellID: "sh_1" }],
      [{ command: "npm test", workdir: "packages/a" }, { exitCode: 0 }],
    ] as const) {
      const h = harness();
      h.loop.beforeTool("s", "/w");
      h.change("v1");
      h.loop.afterTool("s", "/w", "shell", input, output);
      expect(await h.idle()).toBe("passed");
    }
  });

  test("outside git, only edit, write or patch calls trigger the check", async () => {
    const h = harness();
    h.change(undefined as unknown as string);
    h.loop.beforeTool("s", "/w");
    h.loop.afterTool("s", "/w", "read", { path: "a" }, {});
    expect(await h.idle()).toBe("skipped");
    h.loop.afterTool("s", "/w", "patch", { patchText: "" }, {});
    expect(await h.idle()).toBe("passed");
    expect(await h.idle()).toBe("skipped");
  });
});

describe("parseOptions", () => {
  test("requires a command and applies defaults", () => {
    expect(parseOptions({ command: " bun test " })).toEqual({ command: "bun test", maxFailures: 3, timeoutMs: 600_000 });
    expect(typeof parseOptions({})).toBe("string");
    expect(typeof parseOptions({ command: "x", maxFailures: 0 })).toBe("string");
    expect(typeof parseOptions({ command: "x", timeoutMs: 1.5 })).toBe("string");
  });
});

describe("tail", () => {
  test("keeps the end of long output", () => {
    const text = `${"a".repeat(100)}END`;
    expect(tail(text, 10)).toEndWith("aaaaaaaEND");
    expect(tail(text, 10)).toContain("earlier characters cut");
    expect(tail("short\n\n", 10)).toBe("short");
  });
});

describe("fingerprint and runCheck on a real repository", () => {
  let repo: string;
  const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), "check-loop-")));
    git("init", "-q");
    writeFileSync(join(repo, "a.txt"), "one\n");
    writeFileSync(join(repo, ".gitignore"), "ignored.log\n");
    git("add", "a.txt", ".gitignore");
    git("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  });

  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  test("changes with tracked edits and new untracked files, not with ignored files", () => {
    const start = fingerprint(repo);
    expect(start).toMatch(/^[0-9a-f]{40}$/);
    writeFileSync(join(repo, "ignored.log"), "noise");
    expect(fingerprint(repo)).toBe(start);
    writeFileSync(join(repo, "new.txt"), "x");
    const withNew = fingerprint(repo);
    expect(withNew).not.toBe(start);
    writeFileSync(join(repo, "new.txt"), "y");
    expect(fingerprint(repo)).not.toBe(withNew);
  });

  test("leaves the real index untouched", () => {
    writeFileSync(join(repo, "new.txt"), "x");
    const before = readFileSync(join(repo, ".git", "index"));
    fingerprint(repo);
    expect(readFileSync(join(repo, ".git", "index")).equals(before)).toBe(true);
    expect(git("status", "--porcelain").stdout).toContain("?? new.txt");
  });

  test("is undefined outside git", () => {
    const plain = realpathSync(mkdtempSync(join(tmpdir(), "check-loop-plain-")));
    expect(fingerprint(plain)).toBeUndefined();
    rmSync(plain, { recursive: true, force: true });
  });

  test("runCheck reports exit code and combined output, and kills on timeout", async () => {
    expect(await runCheck("echo out; echo err >&2; exit 4", repo, 5000)).toEqual({ code: 4, output: "out\nerr\n" });
    const slow = await runCheck("sleep 5", repo, 200);
    expect(slow.code).toBeNull();
    expect(slow.output).toContain("timed out");
  });
});

describe("project config", () => {
  let root: string;
  beforeEach(() => {
    root = realpathSync(mkdtempSync(join(tmpdir(), "check-loop-config-")));
    mkdirSync(join(root, ".git"));
    mkdirSync(join(root, "packages", "app"), { recursive: true });
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  const write = (dir: string, text: string) => {
    mkdirSync(join(dir, ".opencode"), { recursive: true });
    writeFileSync(join(dir, ".opencode", "check-loop.json"), text);
  };

  test("no file means the project does not use check-loop", () => {
    expect(loadConfig(join(root, "packages", "app"))).toBeUndefined();
  });

  test("found from a subdirectory, nearest first", () => {
    write(root, '{"command":"make check"}');
    expect(findConfig(join(root, "packages", "app"))).toBe(join(root, ".opencode", "check-loop.json"));
    write(join(root, "packages", "app"), '{"command":"bun test"}');
    const config = loadConfig(join(root, "packages", "app"));
    expect(config?.options).toEqual({ command: "bun test", maxFailures: 3, timeoutMs: 600_000 });
  });

  test("does not look above the repository root", () => {
    write(join(root, ".."), '{"command":"x"}');
    try {
      expect(findConfig(join(root, "packages"))).toBeUndefined();
    } finally {
      rmSync(join(root, "..", ".opencode"), { recursive: true, force: true });
    }
  });

  test("broken files are reported, not used", () => {
    write(root, "{not json");
    expect(typeof loadConfig(root)?.options).toBe("string");
    write(root, "[]");
    expect(loadConfig(root)?.options).toContain("JSON object");
    write(root, '{"maxFailures":2}');
    expect(loadConfig(root)?.options).toContain("command");
  });
});
