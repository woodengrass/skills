# Pull requests

When the task is done and verified on its branch, prepare the pull request
without being asked, then ask the user once to push and open it.

## Before asking

1. Run the project's full checks once on the final commit.
2. If you can start a subagent, have one that did not write the change review
   the diff and run what it needs to confirm problems (a reviewer agent). A
   check by the author tests what the author meant to build. Fix what it
   proves, then rerun the checks.
3. Rebase onto the current main if main has moved and the branch is not yet
   pushed; otherwise leave it.
4. Write the title and body below into a file, for example
   `.agent/pr-body.md`.

## Title and body

Title: `<type>(<scope>): <subject>`, the same form as a commit message.

Body: in English, 40 lines at most, these headings in this order, leaving out
any that would be empty:

```
## Why
The problem or goal, in one or two sentences.

## What changed
The changes a reviewer needs to know, grouped by area.

## Scope
What this deliberately does not do.

## Tradeoffs
Alternatives a reviewer would ask about, and why they were not taken.

## Blast radius
What else this could affect, and why it does not.

## Verification
Each check run, with the command and its result. For user-visible changes,
how the behavior was exercised and what was seen.
```

Put long logs and tables in a comment or a linked file, not in the body.

## Asking

List the exact commands in one request, for example:

```
git push -u origin fix/login-redirect
gh pr create --title "fix(auth): keep the return path when the session expires" --body-file .agent/pr-body.md
```

Open it ready for review, not as a draft. Do not merge it; the user merges,
with squash. After the user merges, delete the local branch with
`git branch -d <branch>`.
