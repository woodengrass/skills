# Branches

## Starting work

- If you are on the main branch with work to do, create a branch first:
  `git switch -c <type>/<short-description>`, for example `fix/login-redirect`.
  Any name that says what the work is will do.
- Start from an up-to-date main: `git fetch origin` and branch from
  `origin/main` (or the repository's default branch).
- If the working tree has changes you did not make, leave them alone and keep
  them out of your commits.

## Keeping up with main

- Bring in new main commits with `git fetch origin` then
  `git rebase origin/main` while the branch is only yours and unpushed, or
  `git merge origin/main` once it is pushed and someone else may have it.
- Rebase or merge only when you need something from main or main conflicts
  with your change. Every update restarts CI.

## Conflicts

- Read both sides before choosing. Keep what each side meant, not just one
  side's text: a conflict usually means main changed something your change
  depends on.
- After resolving, run the checks for the touched code before continuing.
- If the right result depends on a decision only the user can make, stop and
  report the conflict with both versions.
