import type { Change } from "./comments.ts";

// Ways to switch a test off without deleting it, by framework.
const DISABLERS: Array<{ test: RegExp; label: string }> = [
  { test: /\b(?:describe|it|test|context|suite|bench)\.(?:skip|only|todo|fixme)\s*\(/, label: "skips or isolates tests (.skip/.only/.todo)" },
  { test: /(?:^|[^\w.])(?:xit|xdescribe|xtest|fit|fdescribe)\s*\(\s*['"`]/, label: "skips or isolates tests (xit/fit)" },
  { test: /@pytest\.mark\.(?:skip|skipif|xfail)\b|\bpytest\.skip\s*\(|@unittest\.skip|\.skipTest\s*\(/, label: "skips a Python test" },
  { test: /\bt\.Skip(?:f|Now)?\s*\(/, label: "skips a Go test" },
  { test: /#\[ignore\b/, label: "ignores a Rust test" },
  { test: /\bXCTSkip(?:If|Unless)?\b|@Test\([^)]*\.disabled/, label: "skips a Swift test" },
  { test: /@(?:Disabled|Ignore)\b/, label: "disables a JVM test" },
];

const TEST_FILE = /(?:^|\/)(?:tests?|__tests__|spec|specs)\/|[._-](?:test|spec)s?\.[a-z]+$|_test\.go$|(?:^|\/)test_[^/]*\.py$|Tests?\.swift$/i;

export function isTestFile(path: string): boolean {
  return TEST_FILE.test(path);
}

export interface TestFinding {
  path: string;
  line?: string;
  why: string;
}

export function deletedPaths(patchText: string): string[] {
  return [...patchText.matchAll(/^\*\*\* Delete File: (.+)$/gm)].map((match) => match[1].trim());
}

export function testFindings(changes: Change[], deleted: string[]): TestFinding[] {
  const found: TestFinding[] = [];
  for (const change of changes) {
    for (const line of change.added) {
      if (/@allow\b/.test(line)) continue;
      const hit = DISABLERS.find((rule) => rule.test.test(line));
      if (hit !== undefined) found.push({ path: change.path, line: line.trim(), why: hit.label });
    }
  }
  for (const path of deleted) if (isTestFile(path)) found.push({ path, why: "deletes a test file" });
  return found;
}

export function testReport(found: TestFinding[]): string {
  const lines = found.slice(0, 10).map((item) => (item.line === undefined ? `- ${item.path}: ${item.why}` : `- ${item.path}: \`${item.line}\` (${item.why})`));
  return [
    "Not applied. This change switches off or removes tests:",
    ...lines,
    "Fix the code so the tests pass instead. If the task itself retires or skips this behavior, keep the line with @allow and the reason; a test file to delete goes in your report for the user to approve.",
  ].join("\n");
}
