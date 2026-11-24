import { Plugin } from "@opencode/plugin";
import { changedFiles, entryKey, newRecord, observe, type Record, render, repoTop, snapshot, worthReporting } from "./ledger.ts";

const KEEP_PER_PARENT = 5;

// When a subagent finishes a round, put what it actually changed and ran into the parent's instructions, so the
// lead can compare the worker's report with observed facts.
export default Plugin.define({
  id: "local.evidence-ledger",
  async setup(ctx) {
    const sessions = new Map<string, Promise<{ parentID?: string; cwd: string }>>();
    const records = new Map<string, Record>();
    const recent = new Map<string, string[]>(); // parent -> ledger keys, oldest first

    const info = (sessionID: string) => {
      let found = sessions.get(sessionID);
      if (found === undefined) {
        found = ctx.session
          .get({ sessionID })
          .then((session) => ({ parentID: session.parentID, cwd: session.location.directory }));
        found.catch(() => sessions.delete(sessionID));
        sessions.set(sessionID, found);
      }
      return found;
    };
    const guard = (what: string, run: () => Promise<void>) =>
      run().catch((error) => console.error(`[evidence-ledger] ${what}:`, error));

    await ctx.tool.hook("execute.before", (event) =>
      guard("before", async () => {
        if (records.has(event.sessionID)) return;
        const session = await info(event.sessionID);
        if (session.parentID === undefined || records.has(event.sessionID)) return;
        const top = repoTop(session.cwd);
        records.set(event.sessionID, newRecord(event.agent, top, top === undefined ? undefined : snapshot(top)));
      }),
    );

    await ctx.tool.hook("execute.after", (event) =>
      guard("after", async () => {
        const record = records.get(event.sessionID);
        if (record === undefined) return;
        observe(record, event.tool, event.input, event.status, event.status === "completed" ? event.result.output : undefined);
      }),
    );

    await ctx.session.hook("experimental.idle", (event) =>
      guard("idle", async () => {
        const record = records.get(event.sessionID);
        if (record === undefined || !worthReporting(record)) return;
        if (event.background.some((work) => work.sessionID === event.sessionID)) return;
        const { parentID } = await info(event.sessionID);
        if (parentID === undefined) return;
        const end = record.top === undefined ? undefined : snapshot(record.top);
        const changes =
          record.top === undefined || record.startTree === undefined || end === undefined
            ? undefined
            : changedFiles(record.top, record.startTree, end);
        const key = entryKey(event.sessionID);
        await ctx.session.instructions.entry.put({ sessionID: parentID, key, value: render(record, event.sessionID, changes) });
        const keys = (recent.get(parentID) ?? []).filter((existing) => existing !== key);
        keys.push(key);
        while (keys.length > KEEP_PER_PARENT) {
          await ctx.session.instructions.entry.remove({ sessionID: parentID, key: keys.shift()! });
        }
        recent.set(parentID, keys);
      }),
    );
  },
});
