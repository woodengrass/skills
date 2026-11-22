---
name: tests-that-catch-bugs
description: Use whenever writing, adding, changing or reporting on tests, so every test is proven to fail when the behavior it guards breaks, instead of padding the test count.
---

# Tests that catch bugs

A test is worth exactly the bugs it would catch. Test count is not a goal.
A test that stays green when the code is broken is worse than no test: it creates false confidence and costs maintenance.

## 1. Write the behavior statements first

Before writing tests, list 3–8 numbered, checkable statements of what the change must guarantee.

- Good: `B1: Pressing Enter and then moving the cursor quickly opens the file that was selected when Enter was pressed.`
- Bad: `File opening works correctly.` (cannot be checked)

Every test you write must point to one statement. A statement with no test is a gap; report it. A test with no statement probably should not exist.

## 2. Prove every new test can fail

A new or changed test is not done until you have seen it fail for the right reason.

Use the cheapest order that applies:

1. **Write the test before the implementation.** It fails first. Record the failure message.
2. **Bug fix: write a test that reproduces the bug before fixing it.** It fails first. Record the failure message.
3. **Only if the implementation already exists**, break it on purpose:
   - Change one thing: the line the test claims to guard (flip a condition, remove a call, change a boundary, return early).
   - Run only that test, not the whole suite.
   - Revert immediately, then confirm with `git diff` that no change to the implementation is left behind. Never skip this.
   - Try at most two different breakages. If the test stays green both times, it guards nothing: delete or rewrite it. Do not keep searching for a third breakage.

No proof needed for: pure refactors where no test file changed, or tests that were only renamed or moved.

## 3. Forbidden patterns

| Pattern | Why it fails |
|---|---|
| The only assertion is that a mock was called | Proves the call happened, not that it was correct |
| Asserting a constant equals its own value (`assert DEFAULT_THEME == "dark"`) | Copies the config; changes with it; catches nothing |
| Re-implementing the logic inside the test and comparing | Test and code are wrong together |
| `sleep()` then assert | Slow on fast machines, flaky on slow CI, hides races. Poll until the condition holds, fail on timeout |
| Loose assertions (`assert result`, `assert len(x) > 0`) or wrapping in `try/except` | The test can almost never fail |
| Snapshotting a whole output without naming the property it protects | Breaks on every change; people blindly update it |
| Parametrizing the same assertion over many inputs that take the same code path | Ten runs of one check are one test, not ten |

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

## 4. Never weaken existing tests to get green

- Do not edit, delete, skip, mark as expected-failure, or loosen an existing test to make your change pass.
- If you believe an existing test is wrong, stop. Report which test, which behavior it guards, and why you think it is wrong. Let the user decide.
- You may delete a test **you wrote in this change** if it guards nothing (section 2). Do not delete existing tests on your own; flag them instead (section 5).

## 5. Flag weak existing tests (do not delete them)

Fewer tests that catch more is a good outcome, so removing useless tests is real work. But you decide nothing alone here:

- Only look at existing tests related to your change: tests of the code you touched, or tests you read while working. Do not audit the whole suite unless asked.
- Flag a test as a **deletion or merge candidate** when it:
  - matches a forbidden pattern in section 3, or
  - guards exactly the same behavior as another test and adds nothing of its own.
- For each candidate, give the test name, the reason, and which other test (if any) already covers the behavior.
- Do not delete or rewrite candidates in the same change. The user decides.

## 6. Report format

Do not report test counts, file counts, or "all tests pass". Report this table:

| # | Behavior statement | Test(s) | How it was shown to fail |
|---|---|---|---|
| B1 | ... | `test_name` | written first / reproduced bug / broke `<line>` -> `<failure message>` |

Then list:

1. **Gaps**: statements without a test, and why.
2. **Existing tests changed**, with reasons (should be rare; see section 4).
3. **Weak existing tests**: deletion or merge candidates from section 5.
4. **Suggested rules**: mistakes that a lint rule, a type, or a design change could prevent instead of a test.
