import { expect, test } from "bun:test";
import { addedAllowLines, judgeWorker, pipeShape, statusOf, type Tool } from "./usage-report.ts";

const t = (name: string, at: number, extra: Partial<Tool> = {}): Tool => ({ name, status: "completed", input: {}, t: at, ...extra });

test("statusOf reads the worker's status field", () => {
  expect(statusOf("**STATUS: partial** — ...")).toBe("partial");
  expect(statusOf("STATUS: completed\nDONE: x")).toBe("completed");
  expect(statusOf("all good")).toBeUndefined();
});

test("judgeWorker looks only at commands after the last edit", () => {
  expect(judgeWorker([t("shell", 1, { exit: 0 }), t("patch", 2)], "STATUS: completed").afterEdit).toBe("none");
  expect(judgeWorker([t("patch", 1), t("shell", 2, { exit: 1 })], "").afterEdit).toBe("failed");
  expect(judgeWorker([t("patch", 1), t("shell", 2, { exit: 1 }), t("shell", 3, { exit: 0 })], "").afterEdit).toBe("passed");
  expect(judgeWorker([t("read", 1)], "").afterEdit).toBe("no-edit");
  expect(judgeWorker([t("patch", 1, { status: "error" }), t("shell", 2, { exit: 0 })], "").afterEdit).toBe("no-edit");
});

test("addedAllowLines counts only added patch lines", () => {
  const patch = t("patch", 1, { input: { patchText: "*** Update File: a\n- x // @allow\n+ y // @allow r\n+ z" } });
  expect(addedAllowLines(patch)).toBe(1);
  expect(addedAllowLines(t("edit", 1, { input: { newString: "a @allow\nb" } }))).toBe(1);
});

test("pipeShape names the program and the filter", () => {
  expect(pipeShape("npm test 2>&1 | tail -40")).toBe("npm test … | tail");
  expect(pipeShape("git status")).toBeUndefined();
});
