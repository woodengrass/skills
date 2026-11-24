import { describe, expect, test } from "bun:test";
import { changesOf } from "./comments.ts";
import { deletedPaths, isTestFile, testFindings, testReport } from "./tests-guard.ts";

const added = (path: string, ...lines: string[]) => testFindings([{ path, added: lines }], []);

describe("flags switched-off tests", () => {
  test.each([
    ["a.test.ts", "  it.skip('adds', () => {"],
    ["a.test.ts", "describe.only('x', () => {"],
    ["a.test.ts", "test.todo('later')"],
    ["a.spec.ts", "  xit('adds', () => {"],
    ["a.spec.ts", "fdescribe('x', () => {"],
    ["test_a.py", "@pytest.mark.skip(reason='flaky')"],
    ["test_a.py", "@pytest.mark.xfail"],
    ["test_a.py", "    pytest.skip('later')"],
    ["test_a.py", "        self.skipTest('x')"],
    ["a_test.go", "\tt.Skip(\"flaky\")"],
    ["lib.rs", "#[ignore]"],
    ["ATests.swift", "throw XCTSkip(\"later\")"],
    ["ATests.swift", "@Test(.disabled(\"broken\")) func adds() {"],
    ["ATest.java", "@Disabled"],
  ])("%s: %s", (path, line) => {
    expect(added(path, line)).toHaveLength(1);
  });
});

describe("leaves normal code alone", () => {
  test.each([
    ["a.test.ts", "it('adds', () => {"],
    ["a.ts", "const skip = items.skip(2)"],
    ["a.ts", "function fit(x) { return x }"],
    ["a.ts", "obj.fit(x)"],
    ["a.ts", "outfit('large')"],
    ["a.ts", "model.fit('x')"],
    ["a.py", "def skip_header(rows):"],
    ["a.go", "t.Run(\"x\", func(t *testing.T) {"],
    ["a.test.ts", "it.skip('retired with the v1 API', () => { // @allow user removed v1"],
  ])("%s: %s", (path, line) => {
    expect(added(path, line)).toEqual([]);
  });
});

describe("deleted test files", () => {
  test("patch deletions of test files are flagged, other deletions are not", () => {
    const patchText = [
      "*** Begin Patch",
      "*** Delete File: src/a.test.ts",
      "*** Delete File: tests/test_b.py",
      "*** Delete File: pkg/c_test.go",
      "*** Delete File: src/old.ts",
      "*** End Patch",
    ].join("\n");
    const found = testFindings(changesOf("patch", { patchText }, "/"), deletedPaths(patchText));
    expect(found.map((item) => item.path)).toEqual(["src/a.test.ts", "tests/test_b.py", "pkg/c_test.go"]);
  });

  test("isTestFile", () => {
    for (const path of ["__tests__/x.ts", "spec/x.rb", "x.spec.tsx", "AppTests.swift", "test/x.js"]) expect(isTestFile(path)).toBe(true);
    for (const path of ["src/contest.ts", "latest.ts", "src/x.ts", "testing.md"]) expect(isTestFile(path)).toBe(false);
  });
});

test("report explains what to do instead and lists at most ten", () => {
  const many = Array.from({ length: 12 }, (_, i) => ({ path: `f${i}.test.ts`, line: "it.skip(", why: "w" }));
  const text = testReport(many);
  expect(text.startsWith("Not applied.")).toBe(true);
  expect(text.split("\n").filter((line) => line.startsWith("- "))).toHaveLength(10);
  expect(text).toContain("Fix the code so the tests pass instead.");
  expect(testReport([{ path: "a.test.ts", why: "deletes a test file" }])).toContain("- a.test.ts: deletes a test file");
});
