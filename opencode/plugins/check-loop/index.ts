import { Plugin } from "@opencode/plugin";
import { CheckLoop, fingerprint, loadConfig, runCheck } from "./check.ts";

// Loaded everywhere, active only in projects with .opencode/check-loop.json, for example
// { "command": "npm test", "maxFailures": 3, "timeoutMs": 600000 }. The file is read on each use, so edits apply
// at once; editing it resets that project's failure count.
export default Plugin.define({
  id: "local.check-loop",
  async setup(ctx) {
    const loops = new Map<string, { text: string; loop: CheckLoop }>();
    const reported = new Set<string>();
    const loopFor = (cwd: string): CheckLoop | undefined => {
      const config = loadConfig(cwd);
      if (config === undefined) return undefined;
      if (typeof config.options === "string") {
        if (!reported.has(config.text)) console.error(`[check-loop] disabled: ${config.options}`);
        reported.add(config.text);
        return undefined;
      }
      const cached = loops.get(config.path);
      if (cached !== undefined && cached.text === config.text) return cached.loop;
      const loop = new CheckLoop(config.options, {
        run: runCheck,
        fingerprint,
        send: async (sessionID, text) => {
          await ctx.session.synthetic({ sessionID, text, metadata: { source: "check-loop" } });
        },
      });
      loops.set(config.path, { text: config.text, loop });
      return loop;
    };

    const sessions = new Map<string, Promise<{ cwd: string; isChild: boolean }>>();
    const info = (sessionID: string) => {
      let found = sessions.get(sessionID);
      if (found === undefined) {
        found = ctx.session
          .get({ sessionID })
          .then((session) => ({ cwd: session.location.directory, isChild: session.parentID !== undefined }));
        found.catch(() => sessions.delete(sessionID));
        sessions.set(sessionID, found);
      }
      return found;
    };
    const guard = (what: string, run: () => Promise<void>) =>
      run().catch((error) => console.error(`[check-loop] ${what}:`, error));

    await ctx.tool.hook("execute.before", (event) =>
      guard("before", async () => {
        const session = await info(event.sessionID);
        if (!session.isChild) loopFor(session.cwd)?.beforeTool(event.sessionID, session.cwd);
      }),
    );
    await ctx.tool.hook("execute.after", (event) =>
      guard("after", async () => {
        if (event.status !== "completed") return;
        const session = await info(event.sessionID);
        if (!session.isChild)
          loopFor(session.cwd)?.afterTool(event.sessionID, session.cwd, event.tool, event.input, event.result.output);
      }),
    );
    await ctx.session.hook("prompt", (event) =>
      guard("prompt", async () => {
        const session = await info(event.sessionID);
        loopFor(session.cwd)?.userPrompt(event.sessionID);
      }),
    );
    await ctx.session.hook("experimental.idle", (event) =>
      guard("idle", async () => {
        const session = await info(event.sessionID);
        await loopFor(session.cwd)?.idle({
          sessionID: event.sessionID,
          cwd: session.cwd,
          isChild: session.isChild,
          backgroundBusy: event.background.some((work) => work.sessionID === event.sessionID),
        });
      }),
    );
  },
});
