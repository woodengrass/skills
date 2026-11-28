import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { addReminder, type Message, readLanguage, reminderFor } from "./language.ts";

const dir = mkdtempSync(join(tmpdir(), "language-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const write = (name: string, text: string) => {
  const file = join(dir, name);
  writeFileSync(file, text);
  return file;
};

describe("readLanguage", () => {
  test("reads the configured language", () => {
    expect(readLanguage(write("ok.json", '{ "language": " 日本語 " }'))).toBe("日本語");
  });
  test("turns off for a missing file, empty value or broken JSON", () => {
    expect(readLanguage(join(dir, "missing.json"))).toBeUndefined();
    expect(readLanguage(write("empty.json", '{ "language": "  " }'))).toBeUndefined();
    expect(readLanguage(write("broken.json", "{ language"))).toBeUndefined();
  });
});

describe("addReminder", () => {
  const reminder = reminderFor("Traditional Chinese (繁體中文)");
  const history = (): Message[] => [
    { role: "system", content: [{ type: "text", text: "rules" }] },
    { role: "user", content: [{ type: "text", text: "first question" }] },
    { role: "assistant", content: [{ type: "text", text: "answer" }] },
    { role: "tool", content: [{ type: "text", text: "output" }] },
    { role: "user", content: [{ type: "text", text: "second question" }] },
  ];

  test("adds the reminder to every user message and nothing else", () => {
    const messages = history();
    addReminder(messages, reminder);
    expect(messages.map((m) => m.content.at(-1)?.text)).toEqual(["rules", reminder, "answer", "output", reminder]);
  });

  test("earlier turns are sent identically when the conversation grows", () => {
    const before = history();
    addReminder(before, reminder);
    const after = [...history(), { role: "user", content: [{ type: "text", text: "third" }] }];
    addReminder(after, reminder);
    expect(JSON.stringify(after.slice(0, before.length))).toBe(JSON.stringify(before));
  });

  test("does not add a second copy", () => {
    const messages = history();
    addReminder(messages, reminder);
    addReminder(messages, reminder);
    expect(messages[4].content.filter((part) => part.text === reminder)).toHaveLength(1);
  });

  test("does not change the original message objects", () => {
    const messages = history();
    const original = messages[1];
    addReminder(messages, reminder);
    expect(original.content).toHaveLength(1);
  });
});
