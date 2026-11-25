import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CATALOG_KEY, catalogLimits, defaultDatabasePath, readCatalogLimits, restoredLimit } from "./limits.ts";

const full = { context: 1050000, input: 922000, output: 128000 };
const capped = { context: 400000, input: 272000, output: 128000 };
const stored = (models: object) => ({ updatedAt: 1, body: JSON.stringify({ openai: { models }, other: { models: {} } }) });

describe("restoredLimit", () => {
  const catalog = new Map([["gpt-6.2-astra", full]]);

  test("raises a capped model to the catalog limit", () => {
    expect(restoredLimit({ id: "gpt-6.2-astra", limit: capped }, catalog)).toEqual(full);
  });

  test("never lowers a limit", () => {
    const bigger = { context: 2000000, input: 1900000, output: 128000 };
    expect(restoredLimit({ id: "gpt-6.2-astra", limit: bigger }, catalog)).toBeUndefined();
    expect(restoredLimit({ id: "gpt-6.2-astra", limit: full }, catalog)).toBeUndefined();
  });

  test("leaves models the catalog does not list", () => {
    expect(restoredLimit({ id: "gpt-9", limit: capped }, catalog)).toBeUndefined();
  });

  test("finds the entry by modelID, then id, then id without -fast", () => {
    expect(restoredLimit({ id: "alias", modelID: "gpt-6.2-astra", limit: capped }, catalog)).toEqual(full);
    expect(restoredLimit({ id: "gpt-6.2-astra-fast", limit: capped }, catalog)).toEqual(full);
  });

  test("compares by context when input is missing", () => {
    const small = new Map([["m", { context: 300000, output: 1000 }]]);
    expect(restoredLimit({ id: "m", limit: { context: 200000, output: 1000 } }, small)).toEqual({ context: 300000, output: 1000 });
  });
});

describe("catalogLimits", () => {
  test("reads one provider's limits from the stored body", () => {
    const limits = catalogLimits(stored({ "gpt-6.2-astra": { limit: full }, "no-limit": {} }), "openai");
    expect(limits?.get("gpt-6.2-astra")).toEqual(full);
    expect(limits?.has("no-limit")).toBe(false);
  });

  test("undefined for a missing provider or an unknown shape", () => {
    expect(catalogLimits(stored({}), "missing")).toBeUndefined();
    expect(catalogLimits({ nothing: true }, "openai")).toBeUndefined();
  });
});

describe("readCatalogLimits", () => {
  let dir: string;
  beforeEach(() => (dir = mkdtempSync(join(tmpdir(), "openai-context-"))));
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  const makeDb = (rows: [string, string][]) => {
    const path = join(dir, "opencode.db");
    const db = new Database(path);
    db.run("create table kv (key text primary key, value text)");
    for (const [key, value] of rows) db.run("insert into kv values (?, ?)", [key, value]);
    db.close();
    return path;
  };

  test("reads the catalog from OpenCode's database", () => {
    const path = makeDb([[CATALOG_KEY, JSON.stringify(stored({ "gpt-6.2-astra": { limit: full } }))]]);
    expect(readCatalogLimits(path, "openai")?.get("gpt-6.2-astra")).toEqual(full);
  });

  test("undefined when the key or the database is missing", () => {
    expect(readCatalogLimits(makeDb([["other", "{}"]]), "openai")).toBeUndefined();
    expect(readCatalogLimits(join(dir, "none.db"), "openai")).toBeUndefined();
  });

  test("database path follows XDG_DATA_HOME", () => {
    expect(defaultDatabasePath({ XDG_DATA_HOME: "/x" })).toBe("/x/opencode/opencode.db");
  });
});
