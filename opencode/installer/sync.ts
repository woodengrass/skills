// Copies the setup into ~/.config/opencode file by file without losing local edits.
//
// It keeps a copy of what it last installed (the base). For each file:
// - unchanged locally since the last install: replaced with the new version;
// - changed locally, unchanged upstream: kept;
// - changed on both sides: merged with `git merge-file` when the changes do not overlap; otherwise the local
//   file is kept and the new version is saved under the backup folder for the user to compare;
// - added locally: never touched;
// - removed upstream: moved to the backup folder if unchanged locally, otherwise kept.
// Without a base (the first install), a differing file is moved to the backup folder and replaced, as before,
// unless `--keep-unknown` is given (an update of a copy made before bases were kept): then it is kept.
import { spawnSync } from "node:child_process";
import { chmodSync, cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";

export type Item = { dest: string; src: string };
export type Options = { target: string; base: string; backup: string; keepUnknown: boolean };
export type Event = { path: string; what: "added" | "updated" | "merged" | "kept" | "conflict" | "replaced" | "removed" | "kept-removed" };

const isLink = (path: string) => {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
};
const read = (path: string) => (existsSync(path) && statSync(path).isFile() ? readFileSync(path) : undefined);
const same = (a?: Buffer, b?: Buffer) => a !== undefined && b !== undefined && a.equals(b);

function files(root: string): string[] {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return [""];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".DS_Store") continue;
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.isFile()) out.push(relative(root, path));
    }
  };
  walk(root);
  return out;
}

function write(path: string, data: Buffer, modeFrom?: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
  if (modeFrom !== undefined) chmodSync(path, statSync(modeFrom).mode & 0o777);
}

function moveTo(from: string, to: string) {
  mkdirSync(dirname(to), { recursive: true });
  renameSync(from, to);
}

// Three-way text merge; undefined when the changes overlap.
export function merge(local: Buffer, base: Buffer, incoming: Buffer): Buffer | undefined {
  const dir = join(tmpdir(), `opencode-sync-${process.pid}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir);
  try {
    const [l, b, n] = ["local", "base", "new"].map((name) => join(dir, name));
    writeFileSync(l, local);
    writeFileSync(b, base);
    writeFileSync(n, incoming);
    const result = spawnSync("git", ["merge-file", "-p", l, b, n]);
    return result.status === 0 ? result.stdout : undefined;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function sync(items: Item[], options: Options): Event[] {
  const events: Event[] = [];
  for (const item of items) {
    // A link left by --link would make every write land in the linked clone, so it is moved aside first.
    const top = join(options.target, item.dest);
    if (isLink(top)) {
      moveTo(top, join(options.backup, item.dest));
      events.push({ path: item.dest, what: "replaced" });
    }
    const at = (root: string, file: string) => (file === "" ? join(root, item.dest) : join(root, item.dest, file));
    const isFile = existsSync(item.src) && statSync(item.src).isFile();
    const names = new Set([...files(item.src), ...files(join(options.base, item.dest))]);
    for (const file of names) {
      const label = file === "" ? item.dest : join(item.dest, file);
      const srcPath = isFile ? item.src : join(item.src, file);
      const localPath = at(options.target, file);
      const backupPath = at(options.backup, file);
      const N = read(srcPath);
      const B = read(at(options.base, file));
      const L = read(localPath);
      if (same(N, L)) continue;
      if (L === undefined) {
        if (N === undefined) continue;
        if (B === undefined) {
          write(localPath, N, srcPath);
          events.push({ path: label, what: "added" });
        } else if (!same(N, B)) {
          write(at(join(options.backup, "new"), file), N);
          events.push({ path: label, what: "kept-removed" });
        }
        continue;
      }
      if (B === undefined) {
        if (N === undefined) continue;
        if (options.keepUnknown) {
          write(at(join(options.backup, "new"), file), N);
          events.push({ path: label, what: "conflict" });
        } else {
          moveTo(localPath, backupPath);
          write(localPath, N, srcPath);
          events.push({ path: label, what: "replaced" });
        }
        continue;
      }
      if (same(L, B)) {
        if (N === undefined) {
          moveTo(localPath, backupPath);
          events.push({ path: label, what: "removed" });
        } else {
          write(localPath, N, srcPath);
          events.push({ path: label, what: "updated" });
        }
        continue;
      }
      // Changed locally.
      if (N === undefined || same(N, B)) {
        events.push({ path: label, what: "kept" });
        continue;
      }
      const merged = merge(L, B, N);
      if (merged !== undefined) {
        write(backupPath, L);
        write(localPath, merged);
        events.push({ path: label, what: "merged" });
      } else {
        write(at(join(options.backup, "new"), file), N);
        events.push({ path: label, what: "conflict" });
      }
    }
    // The base becomes what this install delivered.
    const basePath = join(options.base, item.dest);
    rmSync(basePath, { recursive: true, force: true });
    if (existsSync(item.src)) {
      mkdirSync(dirname(basePath), { recursive: true });
      cpSync(item.src, basePath, { recursive: true, filter: (path) => !path.includes("node_modules") });
    }
  }
  return events;
}

const MESSAGES: Record<Event["what"], string> = {
  added: "新增",
  updated: "更新",
  merged: "合併了你的修改和新版本（合併前的檔案在備份資料夾）",
  kept: "保留你的修改",
  conflict: "保留你的版本；新版本和你的修改衝突，新版本放在備份資料夾的 new/ 底下",
  replaced: "原本的移到備份資料夾，換成新版本",
  removed: "新版已移除，原本的移到備份資料夾",
  "kept-removed": "你刪掉的檔案在新版有更新，維持刪除；新版本放在備份資料夾的 new/ 底下",
};

if (import.meta.main) {
  const args = process.argv.slice(2);
  const value = (flag: string) => {
    const i = args.indexOf(flag);
    if (i < 0 || i + 1 >= args.length) throw new Error(`missing ${flag}`);
    return args[i + 1];
  };
  const repo = value("--repo");
  const items: Item[] = [
    ...["agents", "roles", "scripts", "opencode.jsonc", "tui.json", "AGENTS.md"].map((name) => ({
      dest: name,
      src: join(repo, "opencode", name),
    })),
    ...readdirSync(join(repo, "opencode", "plugins"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({ dest: join("plugins", entry.name), src: join(repo, "opencode", "plugins", entry.name) })),
    { dest: "skills", src: join(repo, "skill") },
  ];
  // Plugins this setup no longer has: their base says which files were ours to remove.
  const basePlugins = join(value("--base"), "plugins");
  if (existsSync(basePlugins))
    for (const entry of readdirSync(basePlugins, { withFileTypes: true }))
      if (entry.isDirectory() && !items.some((item) => item.dest === join("plugins", entry.name)))
        items.push({ dest: join("plugins", entry.name), src: join(repo, "opencode", "plugins", entry.name) });
  const events = sync(items, {
    target: value("--target"),
    base: value("--base"),
    backup: value("--backup"),
    keepUnknown: args.includes("--keep-unknown"),
  });
  if (events.length === 0) console.log("沒有變更");
  for (const event of events) console.log(`${event.path}：${MESSAGES[event.what]}`);
}
