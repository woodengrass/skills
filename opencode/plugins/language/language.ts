import { readFileSync } from "node:fs";

export interface MessagePart {
  type: string;
  text?: string;
}

export interface Message {
  role: string;
  content: MessagePart[];
}

// Missing file, unreadable JSON or an empty value turns the reminder off.
export function readLanguage(file: string): string | undefined {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  try {
    const value = (JSON.parse(raw) as { language?: unknown }).language;
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  } catch (error) {
    console.error(`[language] could not parse ${file}:`, error);
    return undefined;
  }
}

export function reminderFor(language: string): string {
  return `Write what you say to the user in ${language}.`;
}

// Every user message gets the same line, on every request, so the text sent for earlier turns never changes
// and the provider's prompt cache keeps matching. Only the newest message's copy is new each turn.
export function addReminder(messages: Message[], reminder: string): void {
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message.role !== "user") continue;
    const last = message.content[message.content.length - 1];
    if (last?.type === "text" && last.text === reminder) continue;
    messages[i] = { ...message, content: [...message.content, { type: "text", text: reminder }] };
  }
}
