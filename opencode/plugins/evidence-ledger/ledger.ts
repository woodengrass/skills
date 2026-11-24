import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

const EDIT_TOOLS = new Set(["edit", "write", "patch"]);
const PATCH_PATH = /^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm;
const MAX_COMMANDS = 15;

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): string | undefined {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: env ?? process.env });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

export function repoTop(cwd: string): string | undefined {
  return git(cwd, ["rev-parse", "--show-toplevel"]);
}

// Tree hash of every file git would track, untracked included, built in a throwaway index.
export function snapshot(top: string): string | undefined {
  const indexPath = git(top, ["rev-parse", "--git-path", "index"]);
  const dir = mkdtempSync(join(tmpdir(), "evidence-ledger-"));
  try {
    const temp = join(dir, "index");
    const real = indexPath === undefined ? undefined : isAbsolute(indexPath) ? indexPath : resolve(top, indexPath);
    if (real !== undefined && existsSync(real)) copyFileSync(real, temp);
    const env = { ...process.env, GIT_INDEX_FILE: temp };
    if (git(top, ["add", "--all", "--", "."], env) === undefined) return undefined;
    return git(top, ["write-tree"], env);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export function changedFiles(top: string, before: string, after: string): string[] {
  if (before === after) return [];
  const out = git(top, ["diff", "--name-status", "--no-renames", before, after]);
  return out === undefined || out === "" ? [] : out.split("\n").map((line) => line.replace("\t", " "));
}

export interface Command {
  command: string;
  exitCode: number | null;
  running: boolean;
  failed: boolean; // the tool call itself errored
  seq: number;
}

export interface Record {
  agent: string;
  startTree?: string;
  top?: string;
  edited: Set<string>;
  lastEditSeq: number;
  commands: Command[];
  seq: number;
}

export function newRecord(agent: string, top: string | undefined, startTree: string | undefined): Record {
  return { agent, top, startTree, edited: new Set(), lastEditSeq: -1, commands: [], seq: 0 };
}

export function editedPaths(tool: string, input: unknown): string[] {
  if (!EDIT_TOOLS.has(tool) || typeof input !== "object" || input === null) return [];
  const record = input as { path?: unknown; patchText?: unknown };
  if (tool === "patch")
    return typeof record.patchText === "string" ? [...record.patchText.matchAll(PATCH_PATH)].map((m) => m[1].trim()) : [];
  return typeof record.path === "string" ? [record.path] : [];
}

export function observe(record: Record, tool: string, input: unknown, status: "completed" | "error", output: unknown): void {
  record.seq += 1;
  if (EDIT_TOOLS.has(tool)) {
    if (status !== "completed") return;
    for (const path of editedPaths(tool, input)) record.edited.add(path);
    record.lastEditSeq = record.seq;
    return;
  }
  if (tool !== "shell" || typeof input !== "object" || input === null) return;
  const command = (input as { command?: unknown }).command;
  if (typeof command !== "string") return;
  const result = (output ?? {}) as { exitCode?: unknown; shellID?: unknown };
  record.commands.push({
    command: command.trim().replace(/\s+/g, " ").slice(0, 200),
    exitCode: typeof result.exitCode === "number" ? result.exitCode : null,
    running: status === "completed" && typeof result.shellID === "string",
    failed: status === "error",
    seq: record.seq,
  });
}

export function worthReporting(record: Record): boolean {
  return record.edited.size > 0 || record.commands.length > 0;
}

function outcome(command: Command): string {
  if (command.failed) return "the call failed";
  if (command.running) return "still running in the background";
  return command.exitCode === null ? "no exit code" : `exit ${command.exitCode}`;
}

export function render(record: Record, sessionID: string, changes: string[] | undefined): string {
  const lines = [
    `Harness record for subagent ${record.agent} (session ${sessionID}). The harness observed this; the agent did not write it.`,
  ];
  if (changes !== undefined) {
    lines.push(
      changes.length === 0
        ? "Files changed in the working tree while it ran (git): none."
        : `Files changed in the working tree while it ran (git; other agents working at the same time are included): ${changes.join(", ")}`,
    );
  } else {
    lines.push(
      record.edited.size === 0
        ? "Files it edited with edit/write/patch: none. (No git, so changes made through shell are not visible.)"
        : `Files it edited with edit/write/patch: ${[...record.edited].join(", ")}. (No git, so changes made through shell are not visible.)`,
    );
  }
  const shown = record.commands.slice(-MAX_COMMANDS);
  if (shown.length === 0) lines.push("Commands it ran: none.");
  else {
    const skipped = record.commands.length - shown.length;
    lines.push(`Commands it ran, in order${skipped > 0 ? ` (last ${shown.length} of ${record.commands.length})` : ""}:`);
    for (const command of shown) lines.push(`- \`${command.command}\`: ${outcome(command)}`);
  }
  if (record.lastEditSeq >= 0) {
    const after = record.commands.filter((command) => command.seq > record.lastEditSeq);
    lines.push(
      after.length === 0
        ? "No command ran after its last edit."
        : `After its last edit: ${after.map((command) => `\`${command.command}\` ${outcome(command)}`).join("; ")}.`,
    );
  }
  return lines.join("\n");
}

// Entry keys must match ^[a-z0-9][a-z0-9._-]*$.
export function entryKey(sessionID: string): string {
  return `ledger.${sessionID.toLowerCase().replace(/[^a-z0-9._-]/g, "-")}`;
}
