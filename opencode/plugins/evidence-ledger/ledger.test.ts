import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changedFiles, editedPaths, entryKey, newRecord, observe, render, repoTop, snapshot, worthReporting } from "./ledger.ts";

const shell = (command: string) => ({ command });

describe("observe and render", () => {
  test("records edits and commands in order, and what ran after the last edit", () => {
    const r = newRecord("worker", undefined, undefined);
    observe(r, "shell", shell("npm test"), "completed", { exitCode: 1 });
    observe(r, "patch", { patchText: "*** Begin Patch\n*** Update File: src/a.ts\n@@\n-x\n+y\n*** End Patch" }, "completed", {});
    observe(r, "shell", shell("npm test"), "completed", { exitCode: 0 });
    const text = render(r, "ses_1", ["M src/a.ts"]);
    expect(text).toContain("Files changed in the working tree while it ran (git");
    expect(text).toContain("M src/a.ts");
    expect(text).toContain("- `npm test`: exit 1\n- `npm test`: exit 0");
    expect(text).toContain("After its last edit: `npm test` exit 0.");
    expect(text).toContain("the agent did not write it");
  });

  test("says so when no command ran after the last edit", () => {
    const r = newRecord("worker", undefined, undefined);
    observe(r, "shell", shell("npm test"), "completed", { exitCode: 0 });
    observe(r, "edit", { path: "a.ts", oldString: "x", newString: "y" }, "completed", {});
    expect(render(r, "s", [])).toContain("No command ran after its last edit.");
  });

  test("a failed edit does not count as an edit", () => {
    const r = newRecord("worker", undefined, undefined);
    observe(r, "shell", shell("npm test"), "completed", { exitCode: 0 });
    observe(r, "edit", { path: "a.ts" }, "error", undefined);
    expect(r.edited.size).toBe(0);
    expect(render(r, "s", undefined)).not.toContain("last edit");
  });

  test("background, failed and exit-less commands are labeled", () => {
    const r = newRecord("worker", undefined, undefined);
    observe(r, "shell", shell("npm run dev"), "completed", { exitCode: null, shellID: "sh_1" });
    observe(r, "shell", shell("bad"), "error", undefined);
    observe(r, "shell", shell("killed"), "completed", { exitCode: null });
    const text = render(r, "s", []);
    expect(text).toContain("`npm run dev`: still running in the background");
    expect(text).toContain("`bad`: the call failed");
    expect(text).toContain("`killed`: no exit code");
  });

  test("without git it lists edited files and warns that shell changes are invisible", () => {
    const r = newRecord("worker", undefined, undefined);
    observe(r, "write", { path: "b.ts", content: "" }, "completed", {});
    const text = render(r, "s", undefined);
    expect(text).toContain("Files it edited with edit/write/patch: b.ts");
    expect(text).toContain("No git");
  });

  test("keeps only the last 15 commands", () => {
    const r = newRecord("worker", undefined, undefined);
    for (let i = 0; i < 20; i++) observe(r, "shell", shell(`c${i}`), "completed", { exitCode: 0 });
    const text = render(r, "s", []);
    expect(text).toContain("(last 15 of 20)");
    expect(text).not.toContain("`c4`");
    expect(text).toContain("`c19`");
  });

  test("ignores read-only tools; a session with nothing to report is skipped", () => {
    const r = newRecord("explore", undefined, undefined);
    observe(r, "read", { path: "a.ts" }, "completed", {});
    observe(r, "grep", { pattern: "x" }, "completed", {});
    expect(worthReporting(r)).toBe(false);
    observe(r, "shell", shell("ls"), "completed", { exitCode: 0 });
    expect(worthReporting(r)).toBe(true);
  });

  test("editedPaths reads patch headers including move targets", () => {
    const patchText = "*** Begin Patch\n*** Update File: a.ts\n*** Move to: b.ts\n*** Delete File: c.ts\n*** End Patch";
    expect(editedPaths("patch", { patchText })).toEqual(["a.ts", "b.ts", "c.ts"]);
    expect(editedPaths("read", { path: "a.ts" })).toEqual([]);
  });

  test("entryKey is a valid key", () => {
    expect(entryKey("ses_df37AbC")).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
  });
});

describe("git snapshots", () => {
  let repo: string;
  const run = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" });

  beforeEach(() => {
    repo = realpathSync(mkdtempSync(join(tmpdir(), "ledger-")));
    run("init", "-q");
    writeFileSync(join(repo, "a.txt"), "1\n");
    writeFileSync(join(repo, ".gitignore"), "*.log\n");
    run("add", "a.txt", ".gitignore");
    run("-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "init");
  });
  afterEach(() => rmSync(repo, { recursive: true, force: true }));

  test("reports files changed by any means, including shell, but not ignored files", () => {
    const top = repoTop(repo)!;
    const before = snapshot(top)!;
    writeFileSync(join(repo, "a.txt"), "2\n");
    writeFileSync(join(repo, "new.txt"), "x");
    writeFileSync(join(repo, "noise.log"), "x");
    expect(changedFiles(top, before, snapshot(top)!)).toEqual(["M a.txt", "A new.txt"]);
  });

  test("no change gives an empty list, and the real index is untouched", () => {
    const top = repoTop(repo)!;
    writeFileSync(join(repo, "u.txt"), "x");
    const index = readFileSync(join(repo, ".git", "index"));
    const before = snapshot(top)!;
    expect(changedFiles(top, before, snapshot(top)!)).toEqual([]);
    expect(readFileSync(join(repo, ".git", "index")).equals(index)).toBe(true);
  });

  test("repoTop is undefined outside git", () => {
    const plain = realpathSync(mkdtempSync(join(tmpdir(), "ledger-plain-")));
    expect(repoTop(plain)).toBeUndefined();
    rmSync(plain, { recursive: true, force: true });
  });
});
