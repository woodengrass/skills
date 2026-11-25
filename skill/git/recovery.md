# Undoing and recovering

Commands that throw away work without a trace (`git reset --hard`,
`git clean`, `git checkout -- <file>`) are blocked in some setups and are
never needed for the cases below.

- Discard your uncommitted edits to one file: `git restore <file>`. For staged
  edits: `git restore --staged <file>` first.
- Return one file to how it was in an earlier commit:
  `git restore --source=<commit> <file>`.
- Undo a commit that is already pushed: `git revert <commit>`. It adds a new
  commit and keeps history.
- Undo your last unpushed commit but keep its changes: `git reset --soft HEAD~1`.
- Set work aside: `git stash push -m "<what>" <files>`; bring it back with
  `git stash pop`.
- Find a commit that seems lost (after a rebase or reset): `git reflog`, then
  `git switch -c rescue <sha>`.

Before anything that cannot be undone, ask the user.
