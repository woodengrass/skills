import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface SystemText {
  type: "text";
  text: string;
}

// Agent IDs may be nested (team/reviewer) but must stay inside the roles directory.
export function readRole(dir: string, agent: string): string | undefined {
  if (agent.length === 0 || agent.split("/").some((part) => part === "" || part === "." || part === "..")) {
    return undefined;
  }
  let text: string;
  try {
    text = readFileSync(join(dir, `${agent}.md`), "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return undefined;
    }
    throw error;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

// The first part is OpenCode's base prompt for the model family; the role goes right after it.
export function insertRole(system: SystemText[], role: string): void {
  system.splice(Math.min(1, system.length), 0, { type: "text", text: role });
}

// The claude-agent provider runs Claude Code, which ignores the system parts above and builds its prompt from
// these options instead; an empty claudeCodeAgent is where an agent's own prompt goes.
export function insertRoleForClaudeCode(options: Record<string, unknown> | undefined, role: string): void {
  if (options === undefined || typeof options.claudeCodeAgent !== "string") return;
  const current = options.claudeCodeAgent.trim();
  if (current.includes(role)) return;
  options.claudeCodeAgent = current.length > 0 ? `${role}\n\n${current}` : role;
}
