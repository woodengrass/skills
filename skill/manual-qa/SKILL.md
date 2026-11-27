---
name: manual-qa
description: Use after changing anything a user sees or does (pages, components, styles, text users read, CLI or TUI output, API responses, app screens), before reporting it done or merging it, and when asked to try, demo or QA a behavior. You use the real program yourself, step by step as a person would, look at every result, and report what you saw and what is wrong.
---

# Manual QA

Tests check what someone thought to assert. A person using the app notices
what nobody asserted: a broken layout, a wrong color, a message nobody can
understand, a flow that feels stuck. Do that yourself: use the real program
one step at a time, look at what it shows, and judge it as its users would.

Scripts may launch the app and tools may click for you, but the judging is
yours. Reading back page text, or a script that only asserts, is a test, not
QA (see "Handing off to tests").

## 1. Get it running

Look in the project's AGENTS.md (Project Commands), README, package scripts,
Makefile, CI workflows and test directories for how to launch it, and use
that. Only when nothing exists, set up the smallest way, by surface:
[web.md](web.md), [cli.md](cli.md), [api.md](api.md), [ios.md](ios.md). For
another surface, follow the same shape and add a file for it here.

- Launch from a clean state, including any migrations or seed data it needs.
  Point data at a temporary or test location, never at the user's real data
  or a production database.
- Check that it is usable, not only that a process answers. A server can
  accept connections while its database is still loading.
- When done, stop what you started by its process ID or session name, never
  by process name.
- Add how to launch, how to tell it is ready and how to stop it to the
  project's AGENTS.md under Project Commands, one line each, if missing.

If the app cannot start as checked out, report exactly why before going on.

## 2. Decide what to try

List the situations the change touches, from the user's side: where they
start, what they do, what they should see. Include the ones around it that
the change could disturb, and what users do wrong: empty or too-long input,
pressing submit twice, going back, reloading, a slow or failed request.

Keep the lasting ones in the project's list of what users need to be able to
do (in GOALS.md, a spec or a design doc), or in `qa/scenarios.md` if there is
none:

```
## <what the user needs to do>
- Reach it: <where the user starts and what they do>
- Done when: <what the user sees, and any side effect that must happen>
```

## 3. Use it

1. When the change alters something already visible, capture the before
   state first, from the unchanged version (before editing, or the main
   branch in a separate worktree).
2. Go through the same entry points a user uses. Do not reach a result
   through internal setters, test-only endpoints or mocks of your own code.
3. After each step that matters, capture the screen and look at it: open the
   screenshot as an image, or read the captured terminal screen. A capture
   you did not look at is not evidence.
4. Check each result against this list:
   - It does what the scenario says, and stores what it should (files
     written, rows stored, requests sent).
   - Layout: nothing overflows, overlaps, is cut off or misaligned; it
     scrolls where it should.
   - States: empty, loading, success, warning and error each look like what
     they are; a notice is not styled as an error, and an error is not
     silent.
   - Variants the users have: narrow and wide (a phone and a desktop width,
     or a narrow and a wide terminal), light and dark when the app supports
     both, the languages it ships in.
   - Words: a user of this app understands every message and knows what to
     do next; nothing shows internal names, codes or raw errors.
   - Errors behind the screen: console errors, failed requests, log lines.
5. A dry-run or test mode may still touch the network or real data. Confirm
   what it skips by observing it, not by its name.

Save captures under `.agent/evidence/<short-task-name>/`, and add `.agent/`
to `.gitignore` if it is not listed. If you cannot edit files, report that
instead.

## 4. When something is wrong

Write down the exact steps that show it, and capture the state. That is a
finding, not yet a cause. If your task includes fixing it and the cause is
not something you have seen happen, find it from the running program first
(the `debugging` skill). After a fix, go through the same steps again and
look again.

## Handing off to tests

QA finds problems once; tests keep them from coming back. When a flow is
worth checking on every change, or the user accepts a particular look, turn
it into a test or a reference file in the project's test directory, following
`tests-that-catch-bugs`. Anything you wrote only to drive this session stays
under `.agent/` and is deleted at the end.

## Report

For each scenario: what you did, what you saw (described in words, plus the
evidence path), and whether it is right. Then the problems found, each with
the steps that show it and the variant it shows in. Say plainly which
scenarios or variants you could not try and what blocked them. A report that
lists file paths without saying what they show is not a QA report.
