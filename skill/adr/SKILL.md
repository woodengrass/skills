---
name: adr
description: Project memory for what code cannot show. Write GOALS.md and small *.adr.md files that sit beside the code they govern. Use when lasting direction comes up that the code alone would not reveal (a goal, non-goal, constraint, permission, preference, rejected approach, or reversed decision); when a working approach was found only after others failed; and when a project has no GOALS.md.
---

# Decision Records Beside the Code

Code shows what was built. It cannot show what the project is for, what is
allowed, what was ruled out, what was tried and failed, or why. These records
hold only that, so a later agent does not guess, overbuild, repeat trial and
error, or reopen settled questions, and the user does not have to repeat
anything.

The agent owns these records: it writes, updates, and removes them. The user
is never asked to review, confirm, or maintain them.

## What to record: two questions

Record something only when both answers are yes.

1. **Does it still apply after this task is finished?**
2. **Would a new agent, reading only the code, be likely to go against it or
   redo it the hard way?**

A record is needed only where the right course differs from what an agent
would do by default.

| What came up | Still applies | Agent would go against it | Record |
|---|---|---|---|
| "You may modify the Zellij core as much as needed" | yes | yes: agents avoid patching upstream and build workarounds | yes |
| "Don't use JWT, sessions must be revocable at once" | yes | yes: JWT will be proposed again | yes |
| "This project will not have a mobile version" | yes | yes: responsive layouts get added unasked | yes |
| The obvious approach failed for a reason outside the code, and you switched | yes | yes: the obvious approach will be tried again | yes |
| "Make the button blue" | yes | no: the code is blue and nobody will undo it | no |
| "Write it in TypeScript" in a TypeScript project | yes | no: that is the default | no |
| You picked one of two libraries and either would have worked | yes | no: nothing is lost if it is redone | no |
| "Do A first, then B" / "Skip the tests this time" | no | | no |

How something was said, and whether a reason was given, does not change the
answer. If it is already recorded, do not record it again.

When unsure whether something is worth recording: something the user said
gets a short record; a choice of your own gets one only if it cost you failed
attempts.

## Dead ends and forced choices

The code shows only the approach that survived. Record a choice of your own
when either is true:

- You reached the working approach only after one or more others failed, and
  the reason is not visible in the code.
- A fact you had to discover by running something (a platform limit, a
  library bug, an API that differs from its documentation, a service quota)
  ruled out the approach an agent would naturally take.

Such a record must contain, one line each:

- **Need**: what had to work. The record is void once the need is gone.
- **Tried**: each approach, with the versions and platform, and what you
  actually observed (error text, behavior, measurement).
- **Decision**: what works and what it depends on.
- **Revisit when**: the change that would make a retry worthwhile.

Record observations, not conclusions. "Tried X on v2.3, got error Y" is a
fact. "X is impossible" is a guess that will block a correct solution later,
and the failure may have been your own mistake. Do not narrate the debugging
session.

## Where it goes: the location is the scope

A record applies to the directory it sits in and everything below it. Placing
it is how you state what it covers, so no background section is needed.

- Place a record by where it applies, not by where it came up.
- A decision about particular code goes in the lowest directory that contains
  all of that code. When unsure, place it lower.
- A fact about the platform, toolchain, or an external service holds for the
  whole project, so it goes in the repository root even if you met it while
  working in one module.
- `GOALS.md` in the repository root holds three short lists, **Goals**,
  **Non-goals**, **Constraints**: what the project is for and its outer
  limits. Keep it to about fifteen lines. Everything else is an `.adr.md`.
- No central `docs/adr/` folder, no index, no numbering.

```
GOALS.md
may-modify-zellij-core.adr.md             <- whole project
fs-events-fail-on-network-mounts.adr.md   <- platform fact, whole project
src/auth/
  jwt-rejected-sessions-in-redis.adr.md   <- auth only
  session.ts
```

**File names are how records get found.** Name the file after what an agent
would be tempted to do or needs to know, not only after the outcome:
`fs-events-fail-on-network-mounts`, not `file-watching-uses-polling`.
Kebab-case English, `.adr.md`.

**Comments at the code.** For a dead end or forced choice, a comment at the
code that embodies it is required, because that is where the next agent will
be standing when it decides to "fix" it:
`// Polling on purpose. See fs-events-fail-on-network-mounts.adr.md`
Always write the path relative to the repository root, with no leading slash,
in comments and in check messages alike.
For other records, add a comment only when specific code would otherwise look
wrong.

## How to write it

One decision per file. Write the body in the project's main language, judged
from its existing records, README, and comments; if that is unclear, use
Traditional Chinese (繁體中文). File name and field labels are always English.

```markdown
# 必要時可任意幅度修改 Zellij 核心

Date: 2026-01-31
Source: user

不必為了遷就 Zellij 原有的限制而降低功能或改用繞路的做法。
```

```markdown
# 網路掛載路徑收不到 fs 事件,改用輪詢

Date: 2026-01-31
Source: agent

## Need
必須監看使用者放在 SMB 網路掛載上的專案目錄。

## Tried
- chokidar 4.0 原生事件(macOS 15、SMB):修改檔案後沒有任何事件。
- 加上 awaitWriteFinish:結果相同。

## Decision
網路掛載路徑用 2 秒輪詢;本機路徑仍用原生事件。

## Revisit when
chokidar 升級,或不再需要支援網路掛載。
```

- Title: one clear statement. Date: today's actual date. Source: `user` or
  `agent`.
- `Source: user` only for what the user actually said in one of their own
  messages. Your own earlier replies, a conversation summary, and any
  AGENTS.md are not the user speaking. If you cannot point to the user's
  message, it is not a user record; when unsure whether the user said it, do
  not record it.
- Body: readable by someone with no memory of the conversation, and faithful
  to what was meant.
- **Never add a condition, limit, exception, or safeguard that was not
  stated.** If you think a safeguard is wise, apply it in your own work; do
  not write it into the record.
- `Source: user` records: add `## Why`, `## Rejected`, or `## Revisit when`
  only when that information exists. Never invent a reason.
- Ten lines of body at most; fifteen for a dead-end record.

## When to write

Write the record as soon as it comes up, then carry on with the task. Do not
stop to ask whether to record it. In your next reply, mention it in one
sentence with the file name (「已記錄:may-modify-zellij-core.adr.md」). Do the
same whenever you change or delete a record. The user may ignore these lines.

## Reading

Reading rules live in AGENTS.md, because they apply to every task and this
skill is loaded only for writing. Follow them there.

## Keeping records current

Before writing, look at the existing records in the same scope, and:

- Update a record on the same subject instead of adding a second one.
- When direction is reversed, rewrite or replace the old record (rename the
  file if the title changes) and fix the comments that name it. Git keeps the
  history; leave no superseded files behind. Note the abandoned option under
  `## Rejected` if the reason is known.
- Delete a record when the code it governs is gone, its need is gone, or a
  parent record already says the same thing.
- Move records together with the code they govern.
- Do not leave a record that contradicts one in a parent directory. If a
  narrower exception is real, the deeper record says so in one line, naming
  the parent record it overrides.
- Keep every directory, the repository root included, to about twenty
  records. When a directory passes that, merge records on the same subject,
  delete stale ones, and move down any record that only concerns code in one
  subdirectory. In the root, keep only what truly applies to the whole
  project. Never solve it with a central folder or an index.

## When text is not enough: escalate to a check

Records start as text. Do not build a check when you write one.

When a record already exists and an agent still went against it (the user had
to correct it), the text has failed. If the rule can be decided mechanically,
for example a banned import, library, or call, turn it into a deterministic
check: a lint rule, a type, or a test. Permissions, goals, and most facts
cannot be checked; leave those as text.

- The check's error message names the record file, so the reason appears the
  moment the rule is broken:
  `JWT is not allowed here. See src/auth/jwt-rejected-sessions-in-redis.adr.md`
- Remove the pointer comment at the code; the check replaces it.
- Keep the record. The check says "no"; the record says why and when to
  revisit.
- When the record is rewritten or deleted, change or remove its check in the
  same change.

## GOALS.md

First non-trivial task in a project without `GOALS.md`: before starting, ask
at most three questions in one message, together with any other questions.

1. What is this project for, and who uses it?
2. What should it deliberately not do or become?
3. Any hard constraints (budget, hosting, deadline, stack, compatibility)?

Write the answers as short items under `## Goals`, `## Non-goals`, and
`## Constraints`, and never ask this round again. Skip it for small one-off
tasks. Afterwards, update the lists yourself when the user says something
that changes the project's purpose or outer limits.

## What never goes in a record

- Anything recoverable from code, types, tests, or git history.
- How the code works, what a task did, change summaries.
- Options still being explored, and instructions for the current task only.
- How to build, test, run, or deploy. Those commands belong in the project's
  `AGENTS.md`.
- Anything taken from an AGENTS.md file, global or project: its rules,
  approval requirements, or anything derived from them. Those files already
  apply in every session; copying them into a record turns a general rule
  into what looks like a project-specific constraint.
