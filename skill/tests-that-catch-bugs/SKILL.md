---
name: tests-that-catch-bugs
description: Use whenever writing, adding, changing, reviewing or reporting on tests, so every test is proven to fail when the behavior it guards breaks, instead of padding the test count.
---

# Tests that catch bugs

A test is worth exactly the bugs it would catch. Test count is not a goal.
A test that stays green when the code is broken is worse than no test: it creates false confidence and costs maintenance.

**Adding a new test is the last option, not the default.** Every change first checks how each behavior is already guarded.

## 1. Write the behavior statements first

Before writing tests, list 3–8 numbered, checkable statements of what the change must guarantee.

- Good: `B1: Pressing Enter and then moving the cursor quickly opens the file that was selected when Enter was pressed.`
- Bad: `File opening works correctly.` (cannot be checked)

## 2. Decide how each statement is guarded, before writing any test

For each statement, search the existing tests first: names, docstrings and assertions. Search by the key nouns and verbs of the behavior and their synonyms, not by the exact wording (`locked mode`, `lock`, `passes shortcut through` can all describe one behavior).

Then choose, in this order:

1. **Already guarded** by an existing test: read its assertion to confirm it really checks this behavior. Add nothing.
2. **Partly guarded**: extend that existing test (add an assertion or a case) instead of writing a new one.
3. **A type, a lint rule or a design change can guarantee it**: propose that in the report instead of a test.
4. **None of the above**: write a new test.
   - Put it next to the existing tests of the same behavior or module.
   - Name it after the behavior, not after the bug, ticket, date or "regression".
   - Test it at the lowest level that can observe the behavior. Use end-to-end tests only for behavior that exists only when the parts are wired together.

**Family rule.** If the test you are about to write checks the same kind of invariant as two or more existing tests, only at a different call site (for example "a failure at step X leaves state unchanged", "the style does not change on focus or hover", "never overwrites an existing file"), the problem is design, not test coverage. You may add the one test this change needs, but you must also put a centralization proposal in the report: one mechanism every call site goes through, one test of that mechanism (property-based if possible), and a lint rule that forbids bypassing it.

## 3. Bug fixes: first ask why the existing tests missed it

1. Look for an existing test that should have caught the bug.
2. If one exists, strengthen it until it fails on the bug. That strengthened test is your reproduction. Explain in the report why it missed the bug.
3. If none exists, write a new reproduction test following section 2.
4. Either way, see it fail before the fix and record the failure message.

## 4. Prove every new or changed test can fail, and is worth having

A new or changed test is not done until you have seen it fail for the right reason.

Use the cheapest order that applies:

1. **Write the test before the implementation.** It fails first. Record the failure message.
2. **Bug fix:** the reproduction from section 3 fails first. Record the failure message.
3. **Only if the implementation already exists**, break it on purpose (a mutant):
   - Aim each mutant at a behavior statement: make the code fail the way that statement would really be broken (off-by-one at its boundary, a dropped condition, a skipped call, the wrong branch, swapped arguments). A random edit elsewhere proves nothing.
   - If the repo already uses a mutation tool (mutmut, cargo-mutants, Stryker, PIT), run it only on the changed code and only against the new test, for example `cargo mutants --in-diff <diff file>`.
   - If it has none, finish this change with hand mutation below; do not stop to ask. Then, if the project has a test suite that is maintained over time, propose one tool that fits its language in the final approval request, with the exact install command (a dev dependency changes the lockfile; `cargo install` is global). Skip this if a `Source: user` record already declines it.
     - Approved: install it, rerun it on this change, and add its commands to the project's AGENTS.md.
     - Declined: write a `Source: user` decision record (`adr` skill) so it is not proposed again.
   - Hand mutation: copy the file first, change one thing, run only that test, restore the file from the copy, and confirm with `cmp` that it is identical to the copy. Never skip the restore check.
   - A mutant that cannot change any observable behavior (an equivalent mutant) is not evidence against the test; discard it and pick another.
   - At most two mutants per statement. If the test stays green on both, it guards nothing: delete or rewrite it. Do not hunt for a third, and do not chase a mutation score for code the test does not claim to guard.

**Value check.** Seeing a test fail proves it is sensitive, not that it is useful. Ask: is the line you broke logic, or a declaration? If the only way to make the test fail is to edit a constant, a default value, a field flag (such as `frozen=True`), a path or a key binding, and the test simply restates that value, it duplicates the declaration: delete it. The only exception is a value that other components depend on as a contract and that nothing else checks; say so in the report.

No proof needed for: pure refactors where no test file changed, or tests that were only renamed or moved.

## 5. Forbidden patterns

| Pattern | Why it fails |
|---|---|
| The only assertion is that a mock was called | Proves the call happened, not that it was correct |
| Asserting a constant, default or config value equals itself (`assert DEFAULT_THEME == "dark"`) | Copies the declaration; changes with it; catches nothing |
| Testing the language or a library (a frozen dataclass rejects assignment, exception chaining keeps the cause) | Tests Python or the library, not your code |
| Re-implementing the logic inside the test and comparing | Test and code are wrong together |
| `sleep()` then assert | Slow on fast machines, flaky on slow CI, hides races. Poll until the condition holds, fail on timeout |
| Loose assertions (`assert result`, `assert len(x) > 0`) or wrapping in `try/except` | The test can almost never fail |
| Snapshotting a whole output without naming the property it protects | Breaks on every change; people blindly update it |
| Parametrizing the same assertion over many inputs that take the same code path | Ten runs of one check are one test, not ten |
| Files grouped by when bugs were found (`test_*_regressions.py`) | Hides duplicates; tests belong with the behavior they guard |

**Names must stay true.** When an implementation or behavior changes, update the names and docstrings of the affected tests, and search test names for the old component or technology names. A misleading test name is a defect, not a style issue.

Mock only what you do not control: external network APIs, the clock, third-party services. Do not mock your own code, the filesystem (use a temp directory), or processes and terminals you start yourself. When you need to control an external program, use a fake real program instead of a mock:

```python
# Bad: passes even if the path is split into two arguments
def test_open_editor(mocker):
    run = mocker.patch("app.editor.subprocess.run")
    open_in_editor("/tmp/a b.txt")
    run.assert_called_once()

# Good: a real subprocess; only the editor is replaced by a script that records its arguments
def test_open_editor_with_space(tmp_path, monkeypatch):
    log = tmp_path / "argv.txt"
    fake = tmp_path / "fake-editor"
    fake.write_text(f'#!/bin/sh\nprintf "%s\\n" "$@" > {log}\n')
    fake.chmod(0o755)
    monkeypatch.setenv("EDITOR", str(fake))
    open_in_editor("/tmp/a b.txt")
    assert log.read_text().splitlines() == ["/tmp/a b.txt"]
```

## 6. Never weaken existing tests to get green

- Do not edit, delete, skip, mark as expected-failure, or loosen an existing test to make your change pass.
- If you believe an existing test is wrong, stop. Report which test, which behavior it guards, and why you think it is wrong. Let the user decide.
- Strengthening an existing test (section 2 or 3) is allowed and encouraged. Report it.
- You may delete a test **you wrote in this change** if it guards nothing (section 4). Do not delete existing tests on your own; propose a consolidation plan instead (section 7).

## 7. Weak and duplicate existing tests: propose a consolidation plan

Fewer tests that catch more is a good outcome, so removing useless tests is real work. But the user decides.

- During a normal change, look only at existing tests related to the change: tests of the code you touched, or tests you read while working.
- A test is a candidate when it matches a forbidden pattern, fails the value check, guards the same behavior as another test, belongs to a family (section 2), or repeats a behavior already tested at a lower level without a reason.
- Do not just list candidates. Give a concrete plan for each group:
  - which test to keep, and which to delete,
  - what the merged test is called and what it asserts,
  - confirmation that every behavior the deleted tests guarded is still guarded.
- Do not apply the plan in the same change. The user approves or rejects it.

## 8. When asked to review or audit tests

Checking tests one by one (sections 4 and 5) is not enough; most problems only show up across the set. Also check:

1. **Duplicates**: the same behavior guarded by several tests. Compare behaviors, not names; duplicates usually have different names.
2. **Families**: the same invariant checked at many call sites (section 2).
3. **Levels**: the same behavior tested at several levels without a reason.
4. **Not run**: tests that the standard test command or CI never executes.
5. **Stale names**: names or docstrings that no longer match the implementation.

If per-test coverage data is available (for example coverage.py with `--cov-context=test`), use it: tests that execute nearly the same lines are duplicate candidates.

The output of a review is consolidation plans (section 7) and centralization proposals (section 2), not an inventory of test names.

## 9. Report format

Do not report test counts, file counts, or "all tests pass". Report this table:

| # | Behavior statement | Guarded by | Proof it fails |
|---|---|---|---|
| B1 | ... | new `test_x` / existing `test_y` / extended `test_z` / proposed lint, type or design | written first / reproduced bug / mutant `<what was changed>` -> `<failure message>` / not applicable (existing, unchanged) |

Then list:

1. **Gaps**: statements that are not guarded, and why.
2. **Existing tests changed**: strengthened or extended tests, and for bug fixes, why the existing test missed the bug.
3. **Consolidation plans** (section 7).
4. **Centralization proposals** (section 2 family rule).
5. **Suggested rules**: mistakes that a lint rule, a type or a design change could prevent instead of a test.
