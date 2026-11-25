---
name: verify-app
description: Use when a change affects what a user sees or does and you need to show it works in the running program, when asked to verify or demo a behavior, or when a project has no way yet to launch and drive its app. Sets up a per-project way to launch, drive and capture evidence, and keeps a list of what users need to be able to do.
---

# Verify the app

Tests show what the code does in isolation. This skill shows what a user gets:
launch the real program, do what the user would do, and capture what happened.

## 1. Use what the project already has

Many projects already have a way to run and check the app: end-to-end or
PTY tests, golden screens, smoke scripts, a `make` target, a harness under
`tests/` or `scripts/`. Look in the project's AGENTS.md (Project Commands),
README, package scripts, Makefile, CI workflows and test directories first.

- If one covers the behavior you changed, use it as it is. Do not build a
  second way next to it.
- If it covers only part, extend it in its own style and place: add a case to
  its test file, a step to its script, a scenario to its harness.
- Respect what the project protects. Frozen files (golden outputs, lockfiles,
  recorded baselines) and anything its decision records forbid stay
  unchanged; if verifying needs them changed, report that instead.
- Only when nothing exists, use the default layout below.

## Default layout, when the project has none

- `verify/` scripts (committed): the smallest scripts that launch, drive and
  clean up the app, written as they are needed.
- `verify/requirements.md` (committed): what users need to be able to do, one
  entry per need. Format in section 3. If the project already keeps such a
  list (in GOALS.md, a spec or a design doc), add entries there instead.
- The project's AGENTS.md, under Project Commands: one line each for how to
  launch, how to tell it is ready, how to run a drive script, and how to
  clean up. Existing methods you found in step 1 go there too, if missing.
- `.agent/` (ignored): screenshots, logs and other evidence, under
  `.agent/evidence/<short-task-name>/`. If `.gitignore` does not list
  `.agent/`, add it.

## 2. Set up what is missing

Only the parts this change needs and step 1 did not find, by surface: [web.md](web.md),
[cli.md](cli.md), [api.md](api.md), [ios.md](ios.md). For another surface,
follow the same shape and add a file for it here.

- Launch: one command that starts the app from a clean state, including any
  migrations or seed data it needs.
- Ready: a check that the app is usable, not only that a process answers. A
  server can accept connections while its database is still loading.
- Drive: a script that does what the user does, through the same entry points
  the user uses. Prefer stable handles (roles, labels, test ids, prompts,
  routes) over coordinates or tab order.
- Clean up: stop what you started, by the process ID or session you created,
  never by process name. Evidence stays.

If the app cannot start as checked out, report exactly why before building
anything on top of it.

## 3. Requirements list

Before verifying, make sure the behavior you changed has an entry, and add or
update it if not. Each entry is written from the user's side:

```
## <what the user needs to do>
- Reach it: <where the user starts and what they do>
- Done when: <what the user sees, and any side effect that must happen>
- Drive: <script or command that exercises it>
```

Keep entries short. Remove an entry when the need goes away.

## 4. Verify

1. Run the ready check. If it fails, fix the setup or report it; do not drive
   an app you have not checked.
2. Drive the real user path for each entry the change touches. Do not reach
   the result through internal setters, test-only endpoints, or mocks of your
   own code.
3. Capture the action and the resulting state, not only the last screen.
   Check side effects too: files written, rows stored, requests sent.
4. A dry-run or test mode may still touch the network or real data. Confirm
   what it skips by observing it, not by its name.
5. Clean up, and confirm the evidence is still where you saved it.

## Report

For each requirement entry: the command run, what was seen (screen text,
output, log lines, stored values), and the evidence path. Say plainly which
entries could not be checked and what blocked them.
