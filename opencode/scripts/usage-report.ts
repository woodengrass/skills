// Usage report from OpenCode's database, read-only.
// Run: ~/.bun/bin/bun ~/.config/opencode/scripts/usage-report.ts [--days 14]
import { Database } from "bun:sqlite";
import { readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface Tool {
  name: string;
  status: string;
  input: Record<string, unknown>;
  error?: string;
  exit?: number | null;
  t: number;
}

const EDIT = new Set(["edit", "write", "patch"]);

export function statusOf(text: string): string | undefined {
  return /STATUS:\s*\**\s*(completed|partial|blocked)/i.exec(text)?.[1]?.toLowerCase();
}

export interface WorkerVerdict {
  status?: string;
  edits: number;
  afterEdit: "none" | "passed" | "failed" | "no-edit";
}

export function judgeWorker(tools: Tool[], finalText: string): WorkerVerdict {
  const edits = tools.filter((t) => EDIT.has(t.name) && t.status === "completed");
  const status = statusOf(finalText);
  if (edits.length === 0) return { status, edits: 0, afterEdit: "no-edit" };
  const lastEdit = Math.max(...edits.map((t) => t.t));
  const after = tools.filter((t) => t.name === "shell" && t.t > lastEdit);
  if (after.length === 0) return { status, edits: edits.length, afterEdit: "none" };
  const last = after[after.length - 1];
  return { status, edits: edits.length, afterEdit: last.status === "completed" && last.exit === 0 ? "passed" : "failed" };
}

export function addedAllowLines(tool: Tool): number {
  const text = tool.name === "patch" ? String(tool.input.patchText ?? "") : String(tool.input.newString ?? tool.input.content ?? "");
  const lines = tool.name === "patch" ? text.split("\n").filter((l) => l.startsWith("+")) : text.split("\n");
  return lines.filter((l) => /@allow\b/.test(l)).length;
}

const FILTERS = /\|\s*(head|tail|grep|rg|wc|jq|sed|awk|sort|uniq|cut)\b/;

export function pipeShape(command: string): string | undefined {
  const match = FILTERS.exec(command);
  if (match === undefined || match === null) return undefined;
  const program = command.trim().split(/\s+/).slice(0, 2).join(" ");
  return `${program} … | ${match[1]}`;
}

function main() {
  const daysArg = process.argv.indexOf("--days");
  const days = daysArg > 0 ? Number(process.argv[daysArg + 1]) : 14;
  const since = Date.now() - days * 86_400_000;
  const db = new Database(join(homedir(), ".local/share/opencode/opencode.db"), { readonly: true });
  const ours = new Set(readdirSync(join(homedir(), ".config/opencode/agents")).map((f) => f.replace(/\.md$/, "")));

  const sessions = db
    .query("select id, parent_id as parent, agent, tokens_input + tokens_output + tokens_reasoning as cost from session_v2 where time_created >= ?")
    .all(since) as Array<{ id: string; parent: string | null; agent: string | null; cost: number }>;
  const toolsOf = (sid: string): Tool[] =>
    (db.query("select data, time_created as t from session_part where session_id = ? and type = 'tool' order by time_created").all(sid) as Array<{ data: string; t: number }>).map(({ data, t }) => {
      const d = JSON.parse(data);
      return { name: d.name, status: d.state?.status, input: d.state?.input ?? {}, error: d.state?.error?.message, exit: d.state?.metadata?.exit, t };
    });
  const finalText = (sid: string): string => {
    const row = db.query("select data from session_part where session_id = ? and type = 'text' order by time_created desc limit 1").get(sid) as { data: string } | null;
    return row === null ? "" : (JSON.parse(row.data).text ?? "");
  };

  const out: string[] = [`# 用量報告（最近 ${days} 天）`, ""];

  out.push("## 各 agent 的 session 數與 token", "", "| agent | 主 session | 子 session | token（輸入＋輸出＋推理） |", "|---|---|---|---|");
  const byAgent = new Map<string, { root: number; child: number; cost: number }>();
  for (const s of sessions) {
    if (s.agent === null || !ours.has(s.agent)) continue;
    const row = byAgent.get(s.agent) ?? { root: 0, child: 0, cost: 0 };
    if (s.parent === null) row.root += 1;
    else row.child += 1;
    row.cost += s.cost;
    byAgent.set(s.agent, row);
  }
  for (const [agent, row] of [...byAgent].sort((a, b) => b[1].child - a[1].child))
    out.push(`| ${agent} | ${row.root} | ${row.child} | ${row.cost.toLocaleString("en-US")} |`);

  const workers = sessions.filter((s) => s.parent !== null && (s.agent === "worker" || s.agent === "worker-deep"));
  let completedNoCheck = 0;
  let completedFailing = 0;
  let small = 0;
  let readOnly = 0;
  const flagged: string[] = [];
  for (const w of workers) {
    const v = judgeWorker(toolsOf(w.id), finalText(w.id));
    if (v.afterEdit === "no-edit") readOnly += 1;
    else if (v.edits <= 1) small += 1;
    if (v.status === "completed" && v.afterEdit === "none") {
      completedNoCheck += 1;
      flagged.push(`${w.id}: completed，但最後一次修改之後沒有跑任何指令`);
    }
    if (v.status === "completed" && v.afterEdit === "failed") {
      completedFailing += 1;
      flagged.push(`${w.id}: completed，但最後一次修改之後的最後一條指令失敗`);
    }
  }
  out.push("", `## worker（共 ${workers.length} 個子 session）`, "");
  out.push(`- 回報 completed，但最後一次修改之後沒跑指令：${completedNoCheck}`);
  out.push(`- 回報 completed，但最後一次修改之後的指令失敗：${completedFailing}`);
  out.push(`- 只改了 1 次就結束（可能是小到不該派出去的任務）：${small}`);
  out.push(`- 完全沒改檔案（只讀，或許該派給 explore）：${readOnly}`);
  for (const line of flagged.slice(0, 10)) out.push(`  - ${line}`);

  let commentBlocks = 0;
  let testBlocks = 0;
  let allowLines = 0;
  const pipes = new Map<string, number>();
  for (const s of sessions) {
    for (const t of toolsOf(s.id)) {
      if (EDIT.has(t.name) && t.status === "error" && t.error?.startsWith("Not applied.")) {
        if (t.error.includes("switches off or removes tests")) testBlocks += 1;
        if (t.error.includes("Remove these added comments")) commentBlocks += 1;
      }
      if (EDIT.has(t.name) && t.status === "completed") allowLines += addedAllowLines(t);
      if (t.name === "shell" && typeof t.input.command === "string") {
        const shape = pipeShape(t.input.command);
        if (shape !== undefined) pipes.set(shape, (pipes.get(shape) ?? 0) + 1);
      }
    }
  }
  const synthetic = db
    .query("select data from session_message where type = 'synthetic' and time_created >= ?")
    .all(since) as Array<{ data: string }>;
  const checkLoop = synthetic.map((r) => JSON.parse(r.data)).filter((d) => d.metadata?.source === "check-loop");
  out.push("", "## 外掛", "");
  out.push(`- 外掛 3 擋下註解：${commentBlocks} 次；擋下關掉或刪除測試：${testBlocks} 次`);
  out.push(`- 寫入成功的修改中，新加且帶 @allow 的行：${allowLines}`);
  out.push(`- 外掛 2 送回失敗：${checkLoop.length} 次，其中要求停下回報：${checkLoop.filter((d) => /times in a row/.test(d.text ?? "")).length} 次`);

  out.push("", "## 最常見的管線繞路（指令 | 過濾）", "");
  const top = [...pipes].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length === 0) out.push("- 無");
  for (const [shape, n] of top) out.push(`- ${n} 次：\`${shape}\``);

  console.log(out.join("\n"));
}

if (import.meta.main) main();
