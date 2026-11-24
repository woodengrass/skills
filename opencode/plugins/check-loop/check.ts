import { spawn, spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";

export interface Options {
  command: string;
  maxFailures: number;
  timeoutMs: number;
}

export function parseOptions(raw: Record<string, unknown>): Options | string {
  const { command, maxFailures = 3, timeoutMs = 600_000 } = raw;
  if (typeof command !== "string" || command.trim() === "") return "options.command must be a non-empty string";
  if (typeof maxFailures !== "number" || !Number.isInteger(maxFailures) || maxFailures < 1)
    return "options.maxFailures must be a positive integer";
  if (typeof timeoutMs !== "number" || !Number.isInteger(timeoutMs) || timeoutMs < 1)
    return "options.timeoutMs must be a positive integer";
  return { command: command.trim(), maxFailures, timeoutMs };
}

export const CONFIG_FILE = join(".opencode", "check-loop.json");

// The nearest .opencode/check-loop.json from the session directory up to the repository root.
export function findConfig(cwd: string): string | undefined {
  for (let dir = cwd; ; dir = dirname(dir)) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) return candidate;
    if (existsSync(join(dir, ".git")) || dirname(dir) === dir) return undefined;
  }
}

// undefined: no config, so the project does not use check-loop. A string: the config is broken.
export function loadConfig(cwd: string): { path: string; text: string; options: Options | string } | undefined {
  const path = findConfig(cwd);
  if (path === undefined) return undefined;
  const text = readFileSync(path, "utf8");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    return { path, text, options: `${path} is not valid JSON: ${(error as Error).message}` };
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { path, text, options: `${path} must hold a JSON object` };
  return { path, text, options: parseOptions(raw as Record<string, unknown>) };
}

export interface CheckResult {
  code: number | null; // null: killed by timeout or a signal
  output: string;
}

const KEEP = 4_000;

export function tail(text: string, keep = KEEP): string {
  const trimmed = text.trimEnd();
  return trimmed.length <= keep ? trimmed : `[... ${trimmed.length - keep} earlier characters cut]\n${trimmed.slice(-keep)}`;
}

export function runCheck(command: string, cwd: string, timeoutMs: number): Promise<CheckResult> {
  return new Promise((done) => {
    const child = spawn(command, { cwd, shell: true, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let output = "";
    const add = (chunk: Buffer) => {
      output += chunk.toString("utf8");
      if (output.length > 4 * KEEP * 16) output = output.slice(-4 * KEEP);
    };
    child.stdout.on("data", add);
    child.stderr.on("data", add);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid!, "SIGKILL"); // the whole process group, not only the shell
      } catch {}
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      done({ code: null, output: `${output}\n${error.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      done({ code: timedOut ? null : code, output: timedOut ? `${output}\n[timed out after ${timeoutMs} ms]` : output });
    });
  });
}

function git(cwd: string, args: string[], env?: NodeJS.ProcessEnv): string | undefined {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: env ?? process.env });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

// A tree hash of every file git would track, untracked files included, built in a throwaway index so the real
// index is left alone. Undefined outside a git work tree.
export function fingerprint(cwd: string): string | undefined {
  const top = git(cwd, ["rev-parse", "--show-toplevel"]);
  if (top === undefined) return undefined;
  const indexPath = git(top, ["rev-parse", "--git-path", "index"]);
  const dir = mkdtempSync(join(tmpdir(), "check-loop-"));
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

export function failureMessage(command: string, result: CheckResult): string {
  return [
    `The project check \`${command}\` failed (${result.code === null ? "no exit code" : `exit ${result.code}`}) on the current files.`,
    "```",
    tail(result.output),
    "```",
    "Fix what it reports. If passing it would mean undoing what the task asked for, or the failure is outside this task, leave the files as they are and say so in your report.",
  ].join("\n");
}

export function giveUpMessage(command: string, failures: number, result: CheckResult): string {
  return [
    `The project check \`${command}\` has failed ${failures} times in a row. Stop changing files. Tell the user what still fails and what you tried.`,
    "```",
    tail(result.output),
    "```",
  ].join("\n");
}

const MUTATING_TOOLS = new Set(["edit", "write", "patch"]);

interface SessionState {
  okFingerprint?: string; // a state known not to need a check: the session's starting files, or a passing run
  failedFingerprint?: string;
  failures: number;
  gaveUp: boolean;
  dirty: boolean; // only used outside git, where there is no fingerprint
  started: boolean;
}

export interface Deps {
  run(command: string, cwd: string, timeoutMs: number): Promise<CheckResult>;
  fingerprint(cwd: string): string | undefined;
  send(sessionID: string, text: string): Promise<void>;
}

export type IdleOutcome = "skipped" | "passed" | "failed" | "gave-up";

export class CheckLoop {
  private sessions = new Map<string, SessionState>();

  constructor(
    private options: Options,
    private deps: Deps,
  ) {}

  private state(sessionID: string): SessionState {
    let state = this.sessions.get(sessionID);
    if (state === undefined) {
      state = { failures: 0, gaveUp: false, dirty: false, started: false };
      this.sessions.set(sessionID, state);
    }
    return state;
  }

  // Before the session's first tool call, remember its starting files so a session that changes nothing is never checked.
  beforeTool(sessionID: string, cwd: string): void {
    const state = this.state(sessionID);
    if (state.started) return;
    state.started = true;
    state.okFingerprint = this.deps.fingerprint(cwd);
  }

  afterTool(sessionID: string, cwd: string, tool: string, input: unknown, output: unknown): void {
    const state = this.state(sessionID);
    if (MUTATING_TOOLS.has(tool)) state.dirty = true;
    if (tool !== "shell" || typeof input !== "object" || input === null) return;
    const { command, workdir } = input as { command?: unknown; workdir?: unknown };
    if (typeof command !== "string" || command.trim() !== this.options.command) return;
    if (workdir !== undefined && (typeof workdir !== "string" || resolve(cwd, workdir) !== resolve(cwd))) return;
    const { exitCode, shellID } = (output ?? {}) as { exitCode?: unknown; shellID?: unknown };
    if (exitCode !== 0 || shellID !== undefined) return;
    // The agent ran the same check itself and it passed on these files, so the idle check would only repeat it.
    state.okFingerprint = this.deps.fingerprint(cwd);
    state.dirty = false;
  }

  userPrompt(sessionID: string): void {
    const state = this.state(sessionID);
    state.failures = 0;
    state.gaveUp = false;
    state.failedFingerprint = undefined;
  }

  async idle(input: { sessionID: string; cwd: string; isChild: boolean; backgroundBusy: boolean }): Promise<IdleOutcome> {
    if (input.isChild || input.backgroundBusy) return "skipped";
    const state = this.state(input.sessionID);
    if (state.gaveUp || !state.started) return "skipped";
    const before = this.deps.fingerprint(input.cwd);
    if (before === undefined ? !state.dirty : before === state.okFingerprint || before === state.failedFingerprint)
      return "skipped";

    const result = await this.deps.run(this.options.command, input.cwd, this.options.timeoutMs);
    state.dirty = false;
    if (result.code === 0) {
      state.okFingerprint = this.deps.fingerprint(input.cwd);
      state.failedFingerprint = undefined;
      state.failures = 0;
      return "passed";
    }
    // After the run, since a check that rewrites files (a formatter) changes the fingerprint.
    state.failedFingerprint = this.deps.fingerprint(input.cwd);
    state.failures += 1;
    if (state.failures >= this.options.maxFailures) {
      state.gaveUp = true;
      await this.deps.send(input.sessionID, giveUpMessage(this.options.command, state.failures, result));
      return "gave-up";
    }
    await this.deps.send(input.sessionID, failureMessage(this.options.command, result));
    return "failed";
  }
}
