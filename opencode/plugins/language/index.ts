import { fileURLToPath } from "node:url";
import { Plugin } from "@opencode/plugin";
import { addReminder, type Message, readLanguage, reminderFor } from "./language.ts";

// A language rule stated once in the system prompt fades in long sessions full of English tool output, and the
// model drifts back to English. This adds the rule to every user message of top-level sessions instead.
// Subagent sessions are left alone: their reports are read by the lead, not the user.
// Change the language in language.json next to this file; it is read on every request.
export default Plugin.define({
  id: "local.language",
  async setup(ctx) {
    const file = fileURLToPath(new URL("./language.json", import.meta.url));
    const topLevel = new Map<string, Promise<boolean>>();
    const isTopLevel = (sessionID: string) => {
      let found = topLevel.get(sessionID);
      if (found === undefined) {
        found = ctx.session.get({ sessionID }).then((session) => session.parentID === undefined);
        found.catch(() => topLevel.delete(sessionID));
        topLevel.set(sessionID, found);
      }
      return found;
    };

    await ctx.session.hook("context", async (event) => {
      try {
        const language = readLanguage(file);
        if (language === undefined) return;
        if (!(await isTopLevel(event.sessionID))) return;
        addReminder(event.messages as Message[], reminderFor(language));
      } catch (error) {
        console.error("[language]", error);
      }
    });
  },
});
