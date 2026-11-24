import { Plugin } from "@opencode/plugin";
import { changesOf, findings, report } from "./comments.ts";
import { deletedPaths, testFindings, testReport } from "./tests-guard.ts";

const TOOLS = new Set(["edit", "write", "patch"]);

// Rejects an edit before it lands when it adds comments that a program can tell are noise, or switches off or
// deletes tests. The rejection fails
// that one call; the model sees the reason and sends the change again.
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

    await ctx.tool.hook("execute.before", async (event) => {
      if (!TOOLS.has(event.tool)) return;
      let message: string | undefined;
      try {
        const changes = changesOf(event.tool, event.input, await cwd(event.sessionID));
        const patchText = (event.input as { patchText?: unknown } | null)?.patchText;
        const tests = testFindings(changes, event.tool === "patch" && typeof patchText === "string" ? deletedPaths(patchText) : []);
        const comments = findings(changes);
        const parts = [...(tests.length > 0 ? [testReport(tests)] : []), ...(comments.length > 0 ? [report(comments)] : [])];
        message = parts.length > 0 ? parts.join("\n\n") : undefined;
      } catch (error) {
        console.error("[comment-checker]", error); // a bug here must not block edits
        return;
      }
      if (message !== undefined) throw new Error(message);
    });
  },
});
