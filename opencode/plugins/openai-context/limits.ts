import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type Limit = { context: number; input?: number; output: number };

// OpenCode keeps the models.dev catalog in its own database under this key.
export const CATALOG_KEY = "models-dev:v3:catalog";

export function defaultDatabasePath(env: Record<string, string | undefined> = process.env): string {
  return join(env.XDG_DATA_HOME || join(homedir(), ".local", "share"), "opencode", "opencode.db");
}

// The catalog's limits for one provider, by model ID. Undefined when the database or the entry is missing,
// for example after an OpenCode update renames the key.
export function readCatalogLimits(path: string, provider: string): Map<string, Limit> | undefined {
  if (!existsSync(path)) return undefined;
  const db = new Database(path, { readonly: true });
  try {
    const row = db.query("select value from kv where key = ?").get(CATALOG_KEY) as { value: string } | null;
    if (row === null) return undefined;
    return catalogLimits(JSON.parse(row.value), provider);
  } finally {
    db.close();
  }
}

export function catalogLimits(stored: unknown, provider: string): Map<string, Limit> | undefined {
  const body = (stored as { body?: unknown })?.body;
  const catalog = typeof body === "string" ? JSON.parse(body) : body;
  const models = catalog?.[provider]?.models;
  if (models === null || typeof models !== "object") return undefined;
  const limits = new Map<string, Limit>();
  for (const [id, model] of Object.entries(models as Record<string, { limit?: Limit }>)) {
    const limit = model?.limit;
    if (typeof limit?.context === "number" && typeof limit.output === "number") limits.set(id, limit);
  }
  return limits;
}

// The catalog limit to use instead of the current one, or undefined to keep the current one. Only raises.
export function restoredLimit(model: { id: string; modelID?: string; limit: Limit }, catalog: Map<string, Limit>) {
  const names = [model.modelID, model.id, model.id.replace(/-fast$/, "")].filter((name): name is string => !!name);
  const limit = names.map((name) => catalog.get(name)).find((found) => found !== undefined);
  if (limit === undefined) return undefined;
  const size = (l: Limit) => l.input ?? l.context;
  return size(limit) > size(model.limit) ? { ...limit } : undefined;
}
