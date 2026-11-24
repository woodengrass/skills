import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";

const FILE_TOOLS = new Set(["read", "edit", "write", "patch"]);
const PATCH_PATH = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;

// Paths a file tool call touched, as the model typed them.
export function toolPaths(tool: string, input: unknown): string[] {
  if (!FILE_TOOLS.has(tool) || typeof input !== "object" || input === null) return [];
  const record = input as Record<string, unknown>;
  if (tool === "patch") {
    if (typeof record.patchText !== "string") return [];
    return [...record.patchText.matchAll(PATCH_PATH)].map((match) => match[1].trim());
  }
  return typeof record.path === "string" ? [record.path] : [];
}

// Skill URIs and machine-qualified paths are not files in the working tree.
export function resolvePath(path: string, cwd: string): string | undefined {
  if (path.length === 0 || /^[a-z][a-z0-9+.-]*:/i.test(path)) return undefined;
  return isAbsolute(path) ? path : resolve(cwd, path);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function repoRoot(start: string): string | undefined {
  for (let dir = start; ; dir = dirname(dir)) {
    if (existsSync(`${dir}${sep}.git`)) return dir;
    if (dirname(dir) === dir) return undefined;
  }
}

// From the file's own directory up to the repository root, nearest first.
// Outside a repository only the file's own directory counts.
export function scopeDirs(file: string): { root: string | undefined; dirs: string[] } {
  const own = isDirectory(file) ? file : dirname(file);
  const root = repoRoot(own);
  if (root === undefined) return { root, dirs: [own] };
  const dirs: string[] = [];
  for (let dir = own; ; dir = dirname(dir)) {
    dirs.push(dir);
    if (dir === root || dirname(dir) === dir) break;
  }
  return { root, dirs };
}

export function adrFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".adr.md"))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function title(text: string): string {
  const heading = text.split("\n").find((line) => line.startsWith("# "));
  return heading === undefined ? "" : heading.slice(2).trim();
}

function label(root: string | undefined, dir: string): string {
  if (root === undefined) return dir;
  const rel = relative(root, dir);
  return rel === "" ? "the repository root" : rel;
}

export function renderFull(root: string | undefined, dir: string, files: string[]): string {
  const body = files.map((name) => `--- ${name} ---\n${readFileSync(`${dir}${sep}${name}`, "utf8").trim()}`);
  return [`Decision records in ${label(root, dir)}. They apply to that directory and everything below it.`, ...body].join(
    "\n\n",
  );
}

// renderList output carries this sentence; the plugin uses it to tell list entries from full ones after a restart.
export const LIST_HINT = "Read one when its name bears on the task.";

export function renderList(root: string | undefined, dir: string, files: string[]): string {
  const lines = files.map((name) => {
    const heading = title(readFileSync(`${dir}${sep}${name}`, "utf8"));
    return heading === "" ? `- ${name}` : `- ${name}: ${heading}`;
  });
  return [
    `Decision records in ${label(root, dir)}. They apply to that directory and everything below it. ${LIST_HINT}`,
    ...lines,
  ].join("\n");
}

export function renderGoals(root: string): string | undefined {
  const path = `${root}${sep}GOALS.md`;
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, "utf8").trim();
  return text.length === 0 ? undefined : `Project goals (GOALS.md at the repository root):\n\n${text}`;
}

// Entry keys must match ^[a-z0-9][a-z0-9._-]*$; the hash keeps different directories apart.
export function entryKey(kind: "adr" | "goals", dir: string): string {
  const slug = basename(dir)
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .slice(0, 40);
  const hash = createHash("sha256").update(dir).digest("hex").slice(0, 8);
  return slug === "" ? `${kind}.${hash}` : `${kind}.${slug}.${hash}`;
}

export interface Entry {
  key: string;
  value: string | undefined; // undefined: remove the entry if it exists
  full?: boolean;
}

// fullKeys holds directories already shown in full in this session; they are never shortened back to a list.
export function entriesFor(file: string, fullKeys: ReadonlySet<string>): Entry[] {
  const { root, dirs } = scopeDirs(file);
  const entries: Entry[] = [];
  if (root !== undefined) entries.push({ key: entryKey("goals", root), value: renderGoals(root) });
  dirs.forEach((dir, index) => {
    const key = entryKey("adr", dir);
    const files = adrFiles(dir);
    if (files.length === 0) {
      entries.push({ key, value: undefined });
      return;
    }
    const full = index === 0 || fullKeys.has(key);
    entries.push({ key, value: full ? renderFull(root, dir, files) : renderList(root, dir, files), full });
  });
  return entries;
}
