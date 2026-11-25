# Commits

Commit often. Each commit is a point the work can return to, which matters
more for agent work than for hand-written code: a later step can go wrong,
and the user merges with squash, so small commits cost nothing on main.

- Commit after each step that works: a passing test, a finished part, a
  verified fix. Commit before a risky change too, so you can return to the
  state before it.
- One commit, one purpose. Do not mix a refactor with a behavior change.
- For a bug fix with a test: commit the failing test first, then the fix, so
  the history shows the test caught the bug.
- Do not commit files that hold secrets (`.env`, credentials, keys), local
  machine config, or generated output the repository does not track.

## Message

```
<type>(<scope>): <what changed, imperative, lower case, no period>

<why, when it is not obvious from the subject. Wrap at 72 columns.>
```

- type: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `ci`, `perf`.
- scope: the area touched, such as a module or package name; leave it out if
  nothing fits.
- Name the real symbol, file or command when one carries the change.
- Example: `fix(auth): keep the return path when the session expires`
