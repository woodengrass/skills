import { afterAll, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { insertRole, readRole, type SystemText } from "./roles.ts";

const dir = mkdtempSync(join(tmpdir(), "roles-"));
writeFileSync(join(dir, "worker.md"), "\nWorker rules.\n");
writeFileSync(join(dir, "empty.md"), "  \n");
mkdirSync(join(dir, "team"));
writeFileSync(join(dir, "team", "reviewer.md"), "Reviewer rules.");
writeFileSync(join(dir, "..", "outside.md"), "Must never load.");
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
  rmSync(join(dir, "..", "outside.md"), { force: true });
});

const base = (): SystemText[] => [
  { type: "text", text: "BASE" },
  { type: "text", text: "INSTRUCTIONS" },
];

describe("role prompts", () => {
  test("adds an agent's role right after the base prompt and keeps the base", () => {
    const system = base();
    insertRole(system, readRole(dir, "worker")!);
    expect(system.map((part) => part.text)).toEqual(["BASE", "Worker rules.", "INSTRUCTIONS"]);
  });

  test("leaves the prompt alone for an agent without a role file", () => {
    expect(readRole(dir, "build")).toBeUndefined();
  });

  test("treats a blank role file as no role", () => {
    expect(readRole(dir, "empty")).toBeUndefined();
  });

  test("reads nested agent IDs", () => {
    expect(readRole(dir, "team/reviewer")).toBe("Reviewer rules.");
  });

  test("never reads outside the roles directory", () => {
    expect(readRole(dir, "../outside")).toBeUndefined();
  });

  test("still adds the role when there is no base part", () => {
    const system: SystemText[] = [];
    insertRole(system, "Worker rules.");
    expect(system.map((part) => part.text)).toEqual(["Worker rules."]);
  });
});
