# History

The code shows what it does; the history shows why. Answer "why is it like
this" from commits and pull request discussion, and mark your own inferences
as inferences.

- Who last changed these lines and in which commit: `git blame -L <start>,<end> <file>`.
- Every commit that added or removed a string: `git log -S '<string>' --oneline`.
- How a function or range evolved: `git log -L :<function>:<file>` or
  `git log -L <start>,<end>:<file>`.
- The pull request behind a commit and its discussion:
  `gh pr list --search <sha> --state merged`, then
  `gh pr view <number> --comments`, or
  `gh api repos/<owner>/<repo>/commits/<sha>/pulls`.
- When something broke: `git bisect` with a command that exits non-zero on
  the failure (see the `debugging` skill).

Say what the record does not answer instead of filling the gap with a guess.
