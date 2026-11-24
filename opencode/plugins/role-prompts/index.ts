import { fileURLToPath } from "node:url";
import { Plugin } from "@opencode/plugin";
import { insertRole, readRole } from "./roles.ts";

// Agent files carry no body, so OpenCode keeps its model-tuned base prompt; each agent's role
// text from ~/.config/opencode/roles/<agent>.md is added after it instead of replacing it.
export default Plugin.define({
  id: "local.role-prompts",
  async setup(ctx) {
    const dir = fileURLToPath(new URL("../../roles/", import.meta.url));
    await ctx.session.hook("context", (event) => {
      const role = readRole(dir, event.agent);
      if (role !== undefined) insertRole(event.system, role);
    });
  },
});
