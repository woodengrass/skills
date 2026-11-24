import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { entriesFor, entryKey, LIST_HINT, resolvePath, toolPaths } from "./adr.ts";

let repo: string;

beforeEach(() => {
  repo = realpathSync(mkdtempSync(join(tmpdir(), "adr-inject-")));
  mkdirSync(join(repo, ".git"));
  mkdirSync(join(repo, "src", "auth"), { recursive: true });
  writeFileSync(join(repo, "GOALS.md"), "# Goals\n- ship it\n");
  writeFileSync(join(repo, "root-rule.adr.md"), "# Root rule title\n\nRoot body text.\n");
  writeFileSync(join(repo, "src", "auth", "no-jwt.adr.md"), "# No JWT\n\nSessions must be revocable.\n");
  writeFileSync(join(repo, "src", "auth", "session.ts"), "");
  writeFileSync(join(repo, "src", "auth", "notes.md"), "# not a record\n");
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

const byKey = (entries: ReturnType<typeof entriesFor>) => new Map(entries.map((entry) => [entry.key, entry]));

describe("toolPaths", () => {
  test("reads the path of read, edit and write", () => {
    expect(toolPaths("read", { path: "a.ts" })).toEqual(["a.ts"]);
    expect(toolPaths("edit", { path: "b.ts", oldString: "x", newString: "y" })).toEqual(["b.ts"]);
    expect(toolPaths("write", { path: "c.ts", content: "" })).toEqual(["c.ts"]);
  });

  test("reads every file a patch names, including a move target", () => {
    const patchText = [
      "*** Begin Patch",
      "*** Update File: src/a.ts",
      "*** Move to: lib/a.ts",
      "@@",
      "-x",
      "+y",
      "*** Add File: docs/new.md",
      "+hello",
      "*** Delete File: old/gone.ts",
      "*** End Patch",
    ].join("\n");
    expect(toolPaths("patch", { patchText })).toEqual(["src/a.ts", "lib/a.ts", "docs/new.md", "old/gone.ts"]);
  });

  test("ignores other tools and malformed input", () => {
    expect(toolPaths("grep", { path: "src" })).toEqual([]);
    expect(toolPaths("shell", { command: "cat a.ts" })).toEqual([]);
    expect(toolPaths("read", { file: "a.ts" })).toEqual([]);
    expect(toolPaths("read", null)).toEqual([]);
    expect(toolPaths("patch", { patchText: 3 })).toEqual([]);
  });
});

describe("resolvePath", () => {
  test("resolves relative paths against the session directory", () => {
    expect(resolvePath("src/a.ts", "/work")).toBe("/work/src/a.ts");
    expect(resolvePath("/abs/a.ts", "/work")).toBe("/abs/a.ts");
  });

  test("skips skill URIs and empty paths", () => {
    expect(resolvePath("skill://adr/SKILL.md", "/work")).toBeUndefined();
    expect(resolvePath("", "/work")).toBeUndefined();
  });
});

describe("entriesFor", () => {
  test("shows the file's own directory in full and parents as names with titles", () => {
    const entries = byKey(entriesFor(join(repo, "src", "auth", "session.ts"), new Set()));
    const own = entries.get(entryKey("adr", join(repo, "src", "auth")));
    const root = entries.get(entryKey("adr", repo));
    expect(own?.value).toContain("Sessions must be revocable.");
    expect(own?.value).toContain("src/auth");
    expect(own?.full).toBe(true);
    expect(root?.value).toContain("- root-rule.adr.md: Root rule title");
    expect(root?.value).toContain(LIST_HINT);
    expect(root?.value).not.toContain("Root body text.");
    expect(root?.full).toBe(false);
  });

  test("includes GOALS.md from the repository root", () => {
    const entries = byKey(entriesFor(join(repo, "src", "auth", "session.ts"), new Set()));
    expect(entries.get(entryKey("goals", repo))?.value).toContain("- ship it");
  });

  test("ignores markdown files that are not decision records", () => {
    const own = byKey(entriesFor(join(repo, "src", "auth", "session.ts"), new Set())).get(
      entryKey("adr", join(repo, "src", "auth")),
    );
    expect(own?.value).not.toContain("not a record");
  });

  test("marks directories without records for removal", () => {
    const entries = byKey(entriesFor(join(repo, "src", "auth", "session.ts"), new Set()));
    const src = entries.get(entryKey("adr", join(repo, "src")));
    expect(src).toBeDefined();
    expect(src?.value).toBeUndefined();
  });

  test("keeps a directory in full once it was shown in full", () => {
    const rootKey = entryKey("adr", repo);
    const entries = byKey(entriesFor(join(repo, "src", "auth", "session.ts"), new Set([rootKey])));
    expect(entries.get(rootKey)?.value).toContain("Root body text.");
  });

  test("a file in the root shows root records in full", () => {
    const entries = byKey(entriesFor(join(repo, "README.md"), new Set()));
    expect(entries.get(entryKey("adr", repo))?.value).toContain("Root body text.");
    expect(entries.has(entryKey("adr", join(repo, "src", "auth")))).toBe(false);
  });

  test("a directory read counts as its own scope", () => {
    const entries = byKey(entriesFor(join(repo, "src", "auth"), new Set()));
    expect(entries.get(entryKey("adr", join(repo, "src", "auth")))?.value).toContain("Sessions must be revocable.");
  });

  test("a new file in a missing directory still finds the parents' records", () => {
    const entries = byKey(entriesFor(join(repo, "src", "billing", "new.ts"), new Set()));
    expect(entries.get(entryKey("adr", repo))?.value).toContain("root-rule.adr.md");
  });

  test("outside a repository only the own directory counts and there is no GOALS entry", () => {
    rmSync(join(repo, ".git"), { recursive: true });
    const entries = entriesFor(join(repo, "src", "auth", "session.ts"), new Set());
    expect(entries.map((entry) => entry.key)).toEqual([entryKey("adr", join(repo, "src", "auth"))]);
  });

  test("does not look above the repository root", () => {
    const keys = entriesFor(join(repo, "src", "auth", "session.ts"), new Set()).map((entry) => entry.key);
    expect(keys).not.toContain(entryKey("adr", join(repo, "..")));
  });
});

describe("entryKey", () => {
  test("produces valid, distinct keys", () => {
    const a = entryKey("adr", "/x/My Dir");
    const b = entryKey("adr", "/y/My Dir");
    expect(a).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
    expect(a).not.toBe(b);
    expect(entryKey("adr", "/")).toMatch(/^[a-z0-9][a-z0-9._-]*$/);
  });
});
