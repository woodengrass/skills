---
name: debugging
description: Use when something behaves wrongly and the cause is not yet known (a bug report, a failing test or build, a crash, wrong output, a regression), before changing code to fix it. Finds the cause from what the program does at run time instead of from reading code, and leaves a hypothesis log the reader can check.
---

# Debugging

Reading code tells you what it might do. Running it tells you what it does.
Agents that debug by reading tend to ship their first plausible guess and walk
it back later; most of that comes from not observing the running program, not
from weak reasoning. This skill is about observing.

## 1. Reproduce it

- Make the failure happen yourself, on the same surface the user saw it
  (the app, the CLI, the test, the API), and keep the exact output.
- If it does not reproduce, narrow the conditions (input, data, environment,
  timing) or add logging until it does. If you still cannot see it, say what
  you would need to observe it (access, a log, a step from the user) and stop
  there. A fix for a failure you never saw is a guess.
- When a cheap test can reproduce it, write that test now and see it fail
  (`tests-that-catch-bugs`). Otherwise keep a script or command that shows it.

## 2. Look before you theorize

- Read the whole error message and stack trace.
- Check what changed: `git log` and `git diff` on the files involved, new
  dependencies, config, environment.
- If it used to work, let git find the commit: `git bisect start <bad> <good>`,
  then `git bisect run <command that exits non-zero on the failure>`. Finish
  with `git bisect reset`.

## 3. Test hypotheses, one at a time

1. List the plausible causes. Write each as one sentence that could be wrong.
2. Pick the experiment that rules out the most of them at once, usually one
   that splits the path in half: is the value already wrong when it enters
   this function, or does this function make it wrong?
3. Run it and read the actual values. Mark the hypothesis rejected, supported
   or undecided. Undecided means the experiment was too weak; design a
   sharper one rather than guessing.
4. Repeat until one cause survives and you have seen it happen.

Ways to observe, in order of preference:

- Print or log at the boundaries between parts: what data goes in, what comes
  out. One run shows which part breaks.
- A debugger in batch mode, when you need state in the middle of execution or
  inside code you cannot edit. The shell is not interactive, so pass all
  commands up front:
  - Python: `python -m pdb -c 'b app.py:42' -c c -c 'p x' -c q app.py`
  - Swift, C, C++, Rust: `lldb -b -o 'b file.swift:42' -o run -o 'p x' -- ./app`
  - Never start an interactive debugger session (`pdb` without `-c ... -c q`,
    `node inspect`, `gdb` without `-batch`): it waits for input forever.

## 4. Find where it first went wrong

Follow the bad value backwards to the first place the program did something
it should not have. Then ask whether the state that triggered the failure
should exist at all:

- If it should, handle it where the code broke.
- If it should not, find and fix what produced it. A guard, retry, swallowed
  error or clamped value at the point of failure hides the bug.

Fix the same fault everywhere it occurs, not only where it surfaced.

## 5. Fix with one change

- Change one thing and rerun the reproduction.
- When an experiment rejects a hypothesis, undo every change that hypothesis
  motivated. Nothing ships because it "might help".
- After two attempts that taught you nothing new, stop fixing. Write down the
  assumption those attempts shared and test it directly.

## 6. Verify and clean up

- Rerun the original reproduction from step 1 and show it now passes. A unit
  test passing does not show the bug is gone if the bug was seen elsewhere.
- Remove every print, log line and temporary file you added to observe.

## Report

- The reproduction: the command and its output before and after the fix.
- The root cause, at the place it first went wrong, with file and line.
- The hypothesis log, one line each: the hypothesis, the experiment, what it
  showed, and rejected, supported or undecided. Include the rejected ones;
  they show the cause was found, not assumed.
- Anything you could not observe, and what it would take to observe it.
