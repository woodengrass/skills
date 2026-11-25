# CI failures

- Find the failed run and read only the failing part:
  `gh pr checks <pr>`, then `gh run view <run-id> --log-failed`.
- Reproduce the failure locally with the same command before changing code.
- Fix only failures this change caused. If the same check also fails on the
  main branch, report it in one line and do not fix it here.
- A failure that does not reproduce locally and looks unrelated (a timeout, a
  network error, a runner problem) gets one rerun:
  `gh run rerun <run-id> --failed`. If it fails again, treat it as real.
- Never skip, disable or loosen a check, or mark a test as expected to fail,
  to make CI pass.
- Changing the workflow files themselves belongs to the `github-actions-ci`
  skill.
