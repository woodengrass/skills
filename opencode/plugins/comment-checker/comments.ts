import { existsSync, readFileSync } from "node:fs";
import { extname, basename, isAbsolute, resolve } from "node:path";

type Style = "slash" | "hash" | "dash";

const STYLES: Record<string, Style> = {};
for (const ext of "js jsx ts tsx mjs cjs mts cts java kt kts swift go rs c h cc cpp hpp cs scala dart php zig m mm groovy".split(" "))
  STYLES[ext] = "slash";
for (const ext of "py rb sh bash zsh fish yaml yml toml pl r ex exs nim ps1 tf cmake".split(" ")) STYLES[ext] = "hash";
for (const ext of "sql lua hs elm".split(" ")) STYLES[ext] = "dash";
const NAMED: Record<string, Style> = { Makefile: "hash", Dockerfile: "hash", Rakefile: "hash", Gemfile: "hash" };

export function styleOf(path: string): Style | undefined {
  return NAMED[basename(path)] ?? STYLES[extname(path).slice(1).toLowerCase()];
}

// The text of a whole-line comment, or undefined for code. Trailing comments are not read: telling them apart
// from "//" inside strings needs a parser.
export function commentText(line: string, style: Style): string | undefined {
  const t = line.trim();
  if (style === "slash") {
    if (t.startsWith("//")) return t.replace(/^\/\/[/!]?/, "").trim();
    if (t.startsWith("/*") || t.startsWith("*/") || (t.startsWith("*") && !t.startsWith("**")))
      return t.replace(/^\/\*+!?|^\*\/|^\*/, "").replace(/\*+\/$/, "").trim();
    return undefined;
  }
  if (style === "hash") return t.startsWith("#") ? t.replace(/^#/, "").trim() : undefined;
  return t.startsWith("--") ? t.replace(/^--/, "").trim() : undefined;
}

const ALLOWED = [
  /@allow\b/,
  /\.adr\.md\b/, // a pointer to a decision record is required by the adr rules
  /^(eslint|prettier|biome|deno-lint|@ts-|ts-|istanbul|c8|v8 |jshint|global |@jsx|@flow|webpack|@vite|@license|@preserve|#?region|#?endregion|MARK:|SAFETY:|noqa|type:|pylint|mypy|pyright|ruff|fmt:|isort|nolint|go:|\+build|swiftlint|rubocop|frozen_string_literal|-\*-|coding[:=]|NOSONAR|NOLINT|clang-format|shellcheck|language=|@vitest|@jest)/i,
];

const RULES: Array<{ test: RegExp; why: string }> = [
  { test: /\b(obviously|clearly|simply|basically|needless to say|as you can see|of course)\b/i, why: "filler word" },
  {
    test: /^(added|changed|updated|removed|fixed|refactored|modified|replaced|reverted|deleted)\s+(the|a|an|this|new|missing|support|logic|check|handling|call|import|bug|code|line|param\w*|function|method|field|type|test)\b/i,
    why: "describes the edit, not the code",
  },
  {
    test: /\b(as requested|per (the )?request|for this task|this (change|fix|edit|commit|pr)\b|the old (code|version|implementation)|instead of the old|previous version|originally (this|it) )/i,
    why: "describes the edit, not the code",
  },
  { test: /^(TODO|FIXME|XXX|HACK)\b[:\s-]*$/i, why: "TODO without what is left to do" },
];

const SEPARATOR = /^([=\-*#~_+/<>])\1{3,}|([=\-*#~_+/<>])\2{3,}$/;

export function problem(text: string): string | undefined {
  if (text === "" || ALLOWED.some((pattern) => pattern.test(text))) return undefined;
  if (SEPARATOR.test(text)) return "decorative separator";
  return RULES.find((rule) => rule.test.test(text))?.why;
}

export interface Change {
  path: string;
  added: string[];
}

function addedLines(before: string, after: string): string[] {
  const old = new Set(before.split("\n").map((line) => line.trim()));
  return after.split("\n").filter((line) => !old.has(line.trim()));
}

export function parsePatch(patchText: string): Change[] {
  const changes: Change[] = [];
  let current: { path: string; plus: string[]; minus: string[] } | undefined;
  const flush = () => {
    if (current === undefined) return;
    const removed = new Set(current.minus.map((line) => line.trim()));
    changes.push({ path: current.path, added: current.plus.filter((line) => !removed.has(line.trim())) });
    current = undefined;
  };
  for (const line of patchText.split("\n")) {
    const header = /^\*\*\* (Add File|Update File|Delete File): (.+)$/.exec(line);
    if (header) {
      flush();
      if (header[1] !== "Delete File") current = { path: header[2].trim(), plus: [], minus: [] };
      continue;
    }
    if (current === undefined || line.startsWith("***")) continue;
    if (line.startsWith("+")) current.plus.push(line.slice(1));
    else if (line.startsWith("-")) current.minus.push(line.slice(1));
  }
  flush();
  return changes;
}

export function changesOf(tool: string, input: unknown, cwd: string): Change[] {
  if (typeof input !== "object" || input === null) return [];
  const record = input as Record<string, unknown>;
  if (tool === "patch") return typeof record.patchText === "string" ? parsePatch(record.patchText) : [];
  if (typeof record.path !== "string") return [];
  if (tool === "edit" && typeof record.newString === "string")
    return [{ path: record.path, added: addedLines(typeof record.oldString === "string" ? record.oldString : "", record.newString) }];
  if (tool === "write" && typeof record.content === "string") {
    const file = isAbsolute(record.path) ? record.path : resolve(cwd, record.path);
    const before = existsSync(file) ? readFileSync(file, "utf8") : "";
    return [{ path: record.path, added: addedLines(before, record.content) }];
  }
  return [];
}

export interface Finding {
  path: string;
  comment: string;
  why: string;
}

export function findings(changes: Change[]): Finding[] {
  const found: Finding[] = [];
  for (const change of changes) {
    const style = styleOf(change.path);
    if (style === undefined) continue;
    for (const line of change.added) {
      const text = commentText(line, style);
      if (text === undefined) continue;
      const why = problem(text);
      if (why !== undefined) found.push({ path: change.path, comment: line.trim(), why });
    }
  }
  return found;
}

export function report(found: Finding[]): string {
  const shown = found.slice(0, 10).map((item) => `- ${item.path}: \`${item.comment}\` (${item.why})`);
  if (found.length > shown.length) shown.push(`- and ${found.length - shown.length} more`);
  return [
    "Not applied. Remove these added comments, then send the change again:",
    ...shown,
    "A comment that has to stay can carry @allow.",
  ].join("\n");
}
