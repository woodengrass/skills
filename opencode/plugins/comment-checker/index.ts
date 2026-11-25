import { Plugin } from "@opencode/plugin";
import { changesOf, findings, report, withNote } from "./comments.ts";
import { deletedPaths, testFindings, testReport } from "./tests-guard.ts";

const TOOLS = new Set(["edit", "write", "patch"]);

// Switching off or deleting tests is rejected before the edit lands. Noise comments are let through and a note
// asking for their removal is added to that call's result, so the model is not made to resend the whole change.
export default Plugin.define({
  id: "local.comment-checker",
  async setup(ctx) {
    const cwds = new Map<string, Promise<string>>();
    const cwd = (sessionID: string) => {
      let found = cwds.get(sessionID);
      if (found === undefined) {
        found = ctx.session.get({ sessionID }).then((session) => session.location.directory);
        found.catch(() => cwds.delete(sessionID));
        cwds.set(sessionID, found);
      }
      return found;
    };
    const notes = new Map<string, string>();

    await ctx.tool.hook("execute.before", async (event) => {
      if (!TOOLS.has(event.tool)) return;
      let blocked: string | undefined;
      try {
        const changes = changesOf(event.tool, event.input, await cwd(event.sessionID));
        const patchText = (event.input as { patchText?: unknown } | null)?.patchText;
        const tests = testFindings(changes, event.tool === "patch" && typeof patchText === "string" ? deletedPaths(patchText) : []);
        if (tests.length > 0) blocked = testReport(tests);
        const comments = findings(changes);
        if (blocked === undefined && comments.length > 0) notes.set(event.id, report(comments));
      } catch (error) {
        console.error("[comment-checker]", error); // a bug here must not block edits
        return;
      }
      if (blocked !== undefined) throw new Error(blocked);
    });

    await ctx.tool.hook("execute.after", (event) => {
      const note = notes.get(event.id);
      if (note === undefined) return;
      notes.delete(event.id);
      if (event.status !== "completed") return;
      event.result = { ...event.result, content: withNote(event.result.content, event.result.output, note) as typeof event.result.content };
    });
  },
});
