import { Plugin } from "@opencode/plugin";
import { entriesFor, LIST_HINT, resolvePath, toolPaths } from "./adr.ts";

interface SessionState {
  cwd: string;
  fullKeys: Set<string>;
  last: Map<string, string>;
}

// Records go into session instruction entries rather than tool output: they reach the model even when the
// call ran inside Code Mode, and OpenCode keeps them in the baseline after compaction.
export default Plugin.define({
  id: "local.adr-inject",
  async setup(ctx) {
    const states = new Map<string, Promise<SessionState>>();
    const queues = new Map<string, Promise<void>>();

    const state = (sessionID: string) => {
      let existing = states.get(sessionID);
      if (existing === undefined) {
        existing = (async () => {
          const session = await ctx.session.get({ sessionID });
          const entries = await ctx.session.instructions.entry.list({ sessionID });
          const last = new Map<string, string>();
          const fullKeys = new Set<string>();
          for (const entry of entries) {
            if (typeof entry.value !== "string") continue;
            if (entry.key.startsWith("adr.") || entry.key.startsWith("goals.")) last.set(entry.key, entry.value);
            if (entry.key.startsWith("adr.") && !entry.value.includes(LIST_HINT))
              fullKeys.add(entry.key);
          }
          return { cwd: session.location.directory, fullKeys, last };
        })();
        existing.catch(() => states.delete(sessionID));
        states.set(sessionID, existing);
      }
      return existing;
    };

    const sync = async (sessionID: string, paths: string[]) => {
      const current = await state(sessionID);
      for (const path of paths) {
        const file = resolvePath(path, current.cwd);
        if (file === undefined) continue;
        for (const entry of entriesFor(file, current.fullKeys)) {
          if (entry.value === undefined) {
            if (!current.last.has(entry.key)) continue;
            await ctx.session.instructions.entry.remove({ sessionID, key: entry.key });
            current.last.delete(entry.key);
            current.fullKeys.delete(entry.key);
            continue;
          }
          if (entry.full) current.fullKeys.add(entry.key);
          if (current.last.get(entry.key) === entry.value) continue;
          await ctx.session.instructions.entry.put({ sessionID, key: entry.key, value: entry.value });
          current.last.set(entry.key, entry.value);
        }
      }
    };

    await ctx.tool.hook("execute.after", (event) => {
      if (event.status !== "completed") return;
      const paths = toolPaths(event.tool, event.input);
      if (paths.length === 0) return;
      // One session's updates run in order so parallel calls do not race on the same entry.
      const previous = queues.get(event.sessionID) ?? Promise.resolve();
      const next = previous
        .then(() => sync(event.sessionID, paths))
        .catch((error) => console.error("[adr-inject]", error));
      queues.set(event.sessionID, next);
      return next;
    });
  },
});
