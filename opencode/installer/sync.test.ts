import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { merge, sync, type Item } from "./sync.ts";

let root: string;
let src: string, target: string, base: string, backup: string;
const put = (path: string, text: string) => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
};
const get = (path: string) => (existsSync(path) ? readFileSync(path, "utf8") : undefined);
const items = (): Item[] => [
  { dest: "roles", src: join(src, "roles") },
  { dest: "AGENTS.md", src: join(src, "AGENTS.md") },
];
const run = (keepUnknown = false, backupDir = backup) =>
  sync(items(), { target, base, backup: backupDir, keepUnknown }).map((e) => `${e.path} ${e.what}`).sort();

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sync-"));
  [src, target, base, backup] = ["src", "target", "base", "backup"].map((name) => join(root, name));
  put(join(src, "roles", "lead.md"), "a\nb\nc\nd\ne\n");
  put(join(src, "AGENTS.md"), "rules v1\n");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe("first install", () => {
  test("adds files and replaces differing ones with a backup", () => {
    put(join(target, "AGENTS.md"), "old rules\n");
    expect(run()).toEqual(["AGENTS.md replaced", "roles/lead.md added"]);
    expect(get(join(target, "AGENTS.md"))).toBe("rules v1\n");
    expect(get(join(backup, "AGENTS.md"))).toBe("old rules\n");
  });

  test("with keepUnknown a differing file is kept and the new one saved aside", () => {
    put(join(target, "AGENTS.md"), "mine\n");
    expect(run(true)).toEqual(["AGENTS.md conflict", "roles/lead.md added"]);
    expect(get(join(target, "AGENTS.md"))).toBe("mine\n");
    expect(get(join(backup, "new", "AGENTS.md"))).toBe("rules v1\n");
  });
});

test("a link left by --link is moved aside, so nothing is written into the linked clone", () => {
  const clone = join(root, "clone");
  put(join(clone, "lead.md"), "clone file\n");
  mkdirSync(target, { recursive: true });
  symlinkSync(clone, join(target, "roles"));
  expect(run()).toContain("roles replaced");
  expect(lstatSync(join(target, "roles")).isSymbolicLink()).toBe(false);
  expect(get(join(target, "roles", "lead.md"))).toBe("a\nb\nc\nd\ne\n");
  expect(get(join(clone, "lead.md"))).toBe("clone file\n");
});

describe("update", () => {
  beforeEach(() => {
    run();
  });

  test("nothing changed anywhere: no events", () => {
    expect(run(false, join(root, "b2"))).toEqual([]);
  });

  test("an untouched file takes the new version", () => {
    put(join(src, "AGENTS.md"), "rules v2\n");
    expect(run(false, join(root, "b2"))).toEqual(["AGENTS.md updated"]);
    expect(get(join(target, "AGENTS.md"))).toBe("rules v2\n");
  });

  test("a local edit is kept when upstream did not change the file", () => {
    put(join(target, "AGENTS.md"), "my rules\n");
    expect(run(false, join(root, "b2"))).toEqual(["AGENTS.md kept"]);
    expect(get(join(target, "AGENTS.md"))).toBe("my rules\n");
  });

  test("edits on both sides that do not overlap are merged", () => {
    put(join(target, "roles", "lead.md"), "A\nb\nc\nd\ne\n");
    put(join(src, "roles", "lead.md"), "a\nb\nc\nd\nE\n");
    const b2 = join(root, "b2");
    expect(run(false, b2)).toEqual(["roles/lead.md merged"]);
    expect(get(join(target, "roles", "lead.md"))).toBe("A\nb\nc\nd\nE\n");
    expect(get(join(b2, "roles", "lead.md"))).toBe("A\nb\nc\nd\ne\n");
  });

  test("overlapping edits keep the local file and save the new version aside", () => {
    put(join(target, "roles", "lead.md"), "mine\nb\nc\nd\ne\n");
    put(join(src, "roles", "lead.md"), "theirs\nb\nc\nd\ne\n");
    const b2 = join(root, "b2");
    expect(run(false, b2)).toEqual(["roles/lead.md conflict"]);
    expect(get(join(target, "roles", "lead.md"))).toBe("mine\nb\nc\nd\ne\n");
    expect(get(join(b2, "new", "roles", "lead.md"))).toBe("theirs\nb\nc\nd\ne\n");
  });

  test("after a conflict the next update merges against the version it saved aside", () => {
    put(join(target, "roles", "lead.md"), "mine\nb\nc\nd\ne\n");
    put(join(src, "roles", "lead.md"), "theirs\nb\nc\nd\ne\n");
    run(false, join(root, "b2"));
    put(join(src, "roles", "lead.md"), "theirs\nb\nc\nd\nE\n");
    expect(run(false, join(root, "b3"))).toEqual(["roles/lead.md merged"]);
    expect(get(join(target, "roles", "lead.md"))).toBe("mine\nb\nc\nd\nE\n");
  });

  test("files the user added are never touched", () => {
    put(join(target, "roles", "custom.md"), "my agent\n");
    put(join(src, "AGENTS.md"), "rules v2\n");
    run(false, join(root, "b2"));
    expect(get(join(target, "roles", "custom.md"))).toBe("my agent\n");
  });

  test("a file removed upstream is moved to the backup when untouched, kept when edited", () => {
    put(join(src, "roles", "extra.md"), "x\n");
    put(join(src, "roles", "other.md"), "y\n");
    run(false, join(root, "b2"));
    put(join(target, "roles", "other.md"), "edited\n");
    rmSync(join(src, "roles", "extra.md"));
    rmSync(join(src, "roles", "other.md"));
    const b3 = join(root, "b3");
    expect(run(false, b3)).toEqual(["roles/extra.md removed", "roles/other.md kept"]);
    expect(get(join(target, "roles", "extra.md"))).toBeUndefined();
    expect(get(join(b3, "roles", "extra.md"))).toBe("x\n");
    expect(get(join(target, "roles", "other.md"))).toBe("edited\n");
  });

  test("a file the user deleted stays deleted", () => {
    rmSync(join(target, "AGENTS.md"));
    expect(run(false, join(root, "b2"))).toEqual([]);
    put(join(src, "AGENTS.md"), "rules v2\n");
    const b3 = join(root, "b3");
    expect(run(false, b3)).toEqual(["AGENTS.md kept-removed"]);
    expect(get(join(target, "AGENTS.md"))).toBeUndefined();
    expect(get(join(b3, "new", "AGENTS.md"))).toBe("rules v2\n");
  });
});

test("merge returns undefined on overlapping changes", () => {
  const b = Buffer.from("x\n");
  expect(merge(Buffer.from("l\n"), b, Buffer.from("n\n"))).toBeUndefined();
  expect(merge(Buffer.from("x\n"), b, Buffer.from("n\n"))?.toString()).toBe("n\n");
});

test("a link moved aside after an earlier install is still replaced by the full setup", () => {
  run();
  const clone = join(root, "clone");
  put(join(clone, "lead.md"), "clone file\n");
  rmSync(join(target, "roles"), { recursive: true });
  symlinkSync(clone, join(target, "roles"));
  expect(run()).toEqual(["roles replaced", "roles/lead.md added"]);
  expect(get(join(target, "roles", "lead.md"))).toBe("a\nb\nc\nd\ne\n");
});

test("merge handles output larger than a megabyte", () => {
  const body = ("x".repeat(99) + "\n").repeat(15000);
  const merged = merge(Buffer.from(`top-local\n${body}end\n`), Buffer.from(`top\n${body}end\n`), Buffer.from(`top\n${body}end-new\n`));
  expect(merged?.toString()).toBe(`top-local\n${body}end-new\n`);
});
