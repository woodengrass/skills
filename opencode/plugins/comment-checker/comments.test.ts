import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { changesOf, commentText, findings, parsePatch, problem, report, styleOf } from "./comments.ts";

const flagged = (path: string, ...lines: string[]) => findings([{ path, added: lines }]);

describe("flags noise comments", () => {
  test.each([
    ["// Added the cache check", "describes the edit, not the code"],
    ["// Fixed bug where totals were off", "describes the edit, not the code"],
    ["// Updated the function to accept null", "describes the edit, not the code"],
    ["// Use the new API as requested", "describes the edit, not the code"],
    ["// This change keeps the old order", "describes the edit, not the code"],
    ["// ==========", "decorative separator"],
    ["// ===== Helpers =====", "decorative separator"],
    ["//////////////", "decorative separator"],
    ["// Obviously this cannot be null", "filler word"],
    ["// Simply forward the call", "filler word"],
    ["// TODO", "TODO without what is left to do"],
    ["// FIXME:", "TODO without what is left to do"],
  ])("%s", (line, why) => {
    expect(flagged("a.ts", line)).toEqual([{ path: "a.ts", comment: line, why }]);
  });

  test("hash and dash languages, and block comment lines", () => {
    expect(flagged("a.py", "    # Added the retry logic")).toHaveLength(1);
    expect(flagged("a.py", "##########")).toHaveLength(1);
    expect(flagged("q.sql", "-- --------")).toHaveLength(1);
    expect(flagged("a.ts", " * Obviously fast")).toHaveLength(1);
    expect(flagged("Makefile", "# Removed the old target")).toHaveLength(1);
  });
});

describe("leaves real comments and code alone", () => {
  test.each([
    "// Polling on purpose. See fs-events-fail-on-network-mounts.adr.md",
    "// Replaced the watcher with polling. See fs-events-fail-on-network-mounts.adr.md",
    "// Removed items stay in the trash for 30 days, so restore must check it first.",
    "// Updated rows are flushed in batches because the driver caps statements at 1000.",
    "// The API no longer returns ids after v3; derive them from the URL.",
    "// TODO: drop the shim once Safari 18 ships the fix",
    "// eslint-disable-next-line no-console",
    "// @ts-expect-error the type is wrong upstream",
    "// Added the cache check @allow",
    "// ---",
    "// Wait for the socket....",
    "/**",
    " */",
    "//",
  ])("%s", (line) => {
    expect(flagged("a.ts", line)).toEqual([]);
  });

  test("code lines, including ones that look like comments inside strings", () => {
    expect(flagged("a.ts", 'const url = "http://x" // Added the cache check', "const sep = '======';")).toEqual([]);
    expect(flagged("a.py", "x = 1  # Added the retry logic")).toEqual([]);
    expect(flagged("run.sh", "#!/bin/sh")).toEqual([]);
  });

  test("files that are not code", () => {
    expect(flagged("README.md", "// Added the cache check", "# ======", "---------")).toEqual([]);
    expect(flagged("data.json", "// TODO")).toEqual([]);
  });
});

describe("only added lines count", () => {
  test("edit: a comment already in oldString is not flagged", () => {
    const input = { path: "a.ts", oldString: "// TODO\nlet x = 1", newString: "// TODO\nlet x = 2" };
    expect(findings(changesOf("edit", input, "/"))).toEqual([]);
  });

  test("edit: a new noise comment is flagged", () => {
    const input = { path: "a.ts", oldString: "let x = 1", newString: "// Changed the value\nlet x = 2" };
    expect(findings(changesOf("edit", input, "/"))).toHaveLength(1);
  });

  describe("write", () => {
    let dir: string;
    afterEach(() => rmSync(dir, { recursive: true, force: true }));

    test("compares with the file on disk, relative to the session directory", () => {
      dir = mkdtempSync(join(tmpdir(), "comment-checker-"));
      writeFileSync(join(dir, "a.ts"), "// ==========\nlet x = 1\n");
      const keep = { path: "a.ts", content: "// ==========\nlet x = 2\n" };
      const add = { path: "a.ts", content: "// ==========\n// TODO\nlet x = 2\n" };
      expect(findings(changesOf("write", keep, dir))).toEqual([]);
      expect(findings(changesOf("write", add, dir)).map((item) => item.comment)).toEqual(["// TODO"]);
    });

    test("a new file counts every line as added", () => {
      dir = mkdtempSync(join(tmpdir(), "comment-checker-"));
      expect(findings(changesOf("write", { path: "new.ts", content: "// TODO\n" }, dir))).toHaveLength(1);
    });
  });

  test("patch: added lines per file, moved lines are not new", () => {
    const patchText = [
      "*** Begin Patch",
      "*** Update File: src/a.ts",
      "@@",
      "-  // TODO",
      "+// TODO",
      "+// Added the cache check",
      " let x = 1",
      "*** Add File: src/b.py",
      "+# ==========",
      "+x = 1",
      "*** Delete File: src/c.ts",
      "*** End Patch",
    ].join("\n");
    expect(parsePatch(patchText)).toEqual([
      { path: "src/a.ts", added: ["// Added the cache check"] },
      { path: "src/b.py", added: ["# ==========", "x = 1"] },
    ]);
    expect(findings(changesOf("patch", { patchText }, "/")).map((item) => item.path)).toEqual(["src/a.ts", "src/b.py"]);
  });

  test("other tools and malformed input produce nothing", () => {
    expect(changesOf("read", { path: "a.ts" }, "/")).toEqual([]);
    expect(changesOf("edit", { path: "a.ts" }, "/")).toEqual([]);
    expect(changesOf("patch", { patchText: 1 }, "/")).toEqual([]);
    expect(changesOf("write", null, "/")).toEqual([]);
  });
});

describe("helpers", () => {
  test("styleOf", () => {
    expect(styleOf("x/a.TSX")).toBe("slash");
    expect(styleOf("a.py")).toBe("hash");
    expect(styleOf("Dockerfile")).toBe("hash");
    expect(styleOf("a.md")).toBeUndefined();
  });

  test("commentText", () => {
    expect(commentText("  /// doc", "slash")).toBe("doc");
    expect(commentText("/* a */", "slash")).toBe("a");
    expect(commentText("x = 1", "hash")).toBeUndefined();
  });

  test("problem ignores empty text", () => {
    expect(problem("")).toBeUndefined();
  });

  test("report lists at most ten and says how to keep one", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ path: `f${i}.ts`, comment: "// TODO", why: "w" }));
    const text = report(many);
    expect(text.split("\n").filter((line) => line.startsWith("- f"))).toHaveLength(10);
    expect(text).toContain("and 2 more");
    expect(text).toContain("@allow");
    expect(text.startsWith("Not applied.")).toBe(true);
  });
});
