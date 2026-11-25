---
name: git
description: Use for any git or GitHub work in a task - starting work on a branch, committing, keeping up with main, opening a pull request, fixing CI on it, finding why code changed, or undoing a change safely. The rules here apply to every repository; the linked files cover each part.
---

# Git

Work happens on a branch, in small commits, and reaches the main branch
through a pull request that the user merges.

Always:

- Stage only the files you changed, by name (`git add path/to/file`). Never
  `git add -A` or `git add .`; they pick up other people's work and stray
  files.
- Check `git status` and `git diff --staged` before each commit.
- Keep agent scratch files (evidence, drafts, PR text) in `.agent/` at the
  repository root. If `.gitignore` does not list `.agent/`, add it.
- Write commit messages, branch names and pull request text in English.
- Pushing and opening or merging a pull request change the remote. Prepare
  everything first, then ask the user once for all of it. The user merges.
- Never rewrite history that is already pushed, except your own unmerged
  branch with `git push --force-with-lease`.

Read the file for the part you are doing:

| Doing | Read |
|---|---|
| Starting work, keeping a branch up to date, resolving conflicts | [branches.md](branches.md) |
| Committing | [commits.md](commits.md) |
| Opening a pull request | [pr.md](pr.md) |
| A CI run failed | [ci.md](ci.md) |
| Finding why code is the way it is, or when something broke | [history.md](history.md) |
| Undoing or recovering a change | [recovery.md](recovery.md) |
