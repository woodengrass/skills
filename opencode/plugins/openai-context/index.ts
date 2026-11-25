import { Plugin } from "@opencode/plugin";
import { defaultDatabasePath, readCatalogLimits, restoredLimit } from "./limits.ts";

// With a ChatGPT sign-in, OpenCode's built-in openai-context-caps plugin cuts GPT models to 272K or 500K input.
// The same sign-in ran GPT past 890K under OpenCode V1, so this restores each OpenAI model's limit from the
// models.dev catalog that OpenCode itself downloaded. It only raises limits and leaves models the catalog lacks.
export default Plugin.define({
  id: "local.openai-context",
  async setup(ctx) {
    await ctx.model.transform((editor) => {
      let catalog;
      try {
        catalog = readCatalogLimits(defaultDatabasePath(), "openai");
      } catch (error) {
        console.error("[openai-context] could not read the model catalog:", error);
        return;
      }
      if (catalog === undefined) {
        console.error("[openai-context] model catalog not found; OpenAI limits left as they are");
        return;
      }
      for (const model of editor.list("openai")) {
        const limit = restoredLimit(model, catalog);
        if (limit !== undefined)
          editor.update(model.providerID, model.id, (draft) => {
            draft.limit = limit;
          });
      }
    });
  },
});
