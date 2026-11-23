---
name: github-actions-ci
description: Use when setting up, changing, or reviewing a project's CI on GitHub Actions; runs every existing check on every pull request, proves each gate turns red, and follows GitHub's current security defaults.
---

# CI on GitHub Actions

Last verified: 2026-11-23

CI runs the project's own checks on a clean machine for every change and shows
the result on the commit or pull request. It does not make code correct; the
checks do. This skill decides what CI runs, how it runs, and how to prove it
blocks. Writing tests belongs to `tests-that-catch-bugs`; lint rules belong to
`mistakes-to-lint-rules`.

If the project already has CI, audit it against sections 1–4 and fix what
breaks them; do not rewrite what works.

Out of scope unless the user asks: deployment, releases, scheduled runs,
badges, notifications.

## 0. Check that this skill is still current

GitHub Actions changes often, and this skill is used rarely. Before designing,
look up each fact below in GitHub's changelog (github.blog/changelog) and docs
(docs.github.com). Other articles are leads, not sources. The older the date
above, the more carefully you check.

- Workflow lockfiles: status, the `gh actions-lock` commands, the file path.
- How `pull_request_target` behaves by default.
- The current major version of every action you will use.
- Which plans offer rulesets and required status checks for private repos.
- Dependabot support for the lockfile; how to run zizmor.

Where the docs differ from this skill, follow the docs and list each difference
in the report so the skill can be updated.

## 1. One entry command for all checks

- Collect every check the project has: build, types, lint, tests. Look in the
  project's AGENTS.md, package scripts, task runner, Makefile, and any existing
  CI.
- Expose them as one command through the project's existing runner (an npm
  script, a Makefile target, a `just` recipe). If there is none, add a
  Makefile target `check`. Do not install a task runner.
- The command must exit non-zero when any check fails. No `|| true`, no
  ignored exit codes, no test step that passes when it collects zero tests.
- Run it locally once. If it fails on unchanged code, report that before
  building CI; do not fix unrelated failures.
- Write the command in the project's AGENTS.md under Project Commands. CI runs
  this command and nothing else besides setup.

## 2. The workflow

Write `.github/workflows/ci.yml`:

- Triggers: `pull_request`, and `push` to the default branch. Never use
  `pull_request_target`, or `workflow_run` on code from a pull request.
- Top-level `permissions: contents: read`. Widen it only in the job that
  needs more.
- A new push cancels a stale PR run, but never a run on the default branch:
  ```yaml
  concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: ${{ github.event_name == 'pull_request' }}
  ```
- `defaults: run: shell: bash`. The explicit `bash` shell adds `pipefail`;
  the implicit default does not.
- `timeout-minutes` on every job; unique job names (required checks match by
  name).
- `actions/checkout` with `persist-credentials: false`.
- Toolchain versions come from the project's own files (`.python-version`,
  `.nvmrc`, `rust-toolchain.toml`, `go.mod`). Install dependencies from the
  lockfile in frozen mode (`npm ci`, `uv sync --locked`, `cargo build --locked`).
  Use the setup actions' built-in caching.
- A matrix only for operating systems or versions the project states it
  supports (GOALS.md, package metadata).
- Never put `${{ github.event.* }}` or `${{ github.head_ref }}` inside `run:`;
  pass them through `env:`.
- No secrets in CI unless a check cannot run without one; then ask.
- Lock every action with a workflow lockfile from the `gh actions-lock`
  extension and commit it. If the lockfile cannot be used, pin each `uses:` to
  a full 40-character commit SHA with a `# vX.Y.Z` comment, and write a
  decision record (`adr` skill) saying why.
- If the project keeps reference files of accepted output (`tests/golden/`,
  a snapshot directory; see `tests-that-catch-bugs` section 1), add a
  `spec-guard` job. A pull request that changes them must carry a
  `Spec-change:` line in at least one commit message, so a change to what
  counts as correct can never pass unnoticed:
  ```yaml
  spec-guard:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v7
        with: { fetch-depth: 0, persist-credentials: false }
      - env:
          BASE: ${{ github.event.pull_request.base.sha }}
          REFS: '^tests/golden/'
        run: |
          if git diff --name-only "$BASE"...HEAD | grep -qE "$REFS"; then
            git log --format=%B "$BASE"..HEAD | grep -q '^Spec-change:' \
              || { echo "::error::reference files changed without a Spec-change: line"; exit 1; }
          fi
  ```

## 3. When the full check is slow

Aim for under about 15 minutes. Speed it up without dropping anything: caching,
parallel jobs that each run a part of the entry command, test sharding if the
test runner supports it. If it is still slow, keep running everything and put
the timings in the report. Never move a check off pull requests on your own.

## 4. Prove every gate blocks

A green run proves nothing until each gate has been seen to turn red.

- Locally, run `actionlint` and `zizmor` on the workflow if they are already
  installed.
- First setup: open a throwaway draft pull request. Confirm the clean version
  is green. Then, one gate at a time, push a commit that breaks only that gate
  (a lint violation, a type error, a failing assertion, a build error, a
  reference file changed without `Spec-change:`). Wait
  with `gh pr checks <number> --watch --fail-fast`; it must fail at that gate
  with the expected message. Revert the commit and move to the next gate.
  Close the pull request and delete the branch when done.
- Later changes to CI: prove only new or changed gates.
- Also look for gates that can never fail: `continue-on-error`, an `if:` that
  skips the job, `paths` filters that skip relevant files, a job missing from
  the required checks.

## 5. One approval request

Prepare everything locally first. Then send one request that lists, with exact
commands:

- Installing the `gh actions-lock` extension (a global install).
- Pushing the CI branch, and the throwaway pull request from section 4.
- Merge blocking. Check the repository's visibility and the owner's plan
  (`gh repo view --json visibility`, `gh api user --jq .plan.name`).
  - Rulesets available: a ruleset on the default branch that requires the CI
    jobs to pass. Offer, as a separate choice, requiring branches to be up to
    date before merging.
  - Not available (a private repo on GitHub Free): say that CI will only
    report, not block. Add to the project's AGENTS.md that a pull request is
    merged only after `gh pr checks` is green.
- Optional, each the user's choice: Dependabot for GitHub Actions and the
  project's package ecosystem; a zizmor job that runs when workflow files
  change.

## 6. Record

- The project's AGENTS.md: the entry command, and how to wait for CI.
- A decision record only for a choice the next agent would undo: a lockfile
  fallback, a deliberate job split, why a matrix covers what it covers.

## 7. Report

| Failure it prevents | Job / command | Proof it blocks |
|---|---|---|
| Type error | `check` / `make check` | commit `<sha>` -> failed at `<step>`: `<message>` |

Then list: differences found in section 0; CI duration; whether merges are
blocked by a ruleset or CI only reports; actions awaiting approval.
