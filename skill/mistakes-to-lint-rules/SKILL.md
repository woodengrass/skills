---
name: mistakes-to-lint-rules
description: Use when the user or a review corrects a mistake in code, after fixing a bug whose cause was a wrong way of writing code, when a centralization proposal was approved, or when asked to add or change a lint rule. Searches for other occurrences, and when there are two, turns the mistake into a checked rule whose message says what to do instead.
---

# Mistakes to lint rules

A correction written in prose (AGENTS.md, prompts, review comments) is easy to miss or ignore. A rule that fails the check cannot be ignored, and it applies to every future change without anyone remembering it.
Move recurring corrections out of prose and into the codebase.

## 1. Check that the mistake deserves a rule

- Describe the mistake in one sentence: what was written, and what should have been written instead.
- Show at least **two real occurrences**: file and line, or the review comments that corrected it. One occurrence is not enough unless the user asked for the rule.
  Look for them instead of relying on memory: search the code for the same pattern, `git log -S '<pattern>'` for earlier fixes of it, and the pull request review comments (`gh pr view <n> --comments`). The correction that brought you here counts as one.
- Found only one: stop here, and say in the report that a rule would make sense if it happens again.
- If spotting the mistake needs judgment (code is "too complex", a name is "unclear"), it is not a lint rule. Say so and stop.

## 2. Choose the cheapest enforcement, in this order

Assume the next contributor is an agent that sees only the files it opened, copies the nearest example, and takes the shortest path that compiles. The fix must make a change that looks right from one file right for the whole repository.

1. **Change the design so the mistake cannot be written**: make the dangerous function private, require a specific type, route every caller through one entry point, and delete the old way and dead code an agent would copy. This is the strongest option.
2. **Configure a linter the repo already runs.** Most linters can do each of these; find the setting in the one this repo uses:
   - ban a function, method, type or import, with a custom message;
   - forbid imports from one module or layer into another;
   - limit visibility, so code outside a module cannot reach what it should not.
   For example, Ruff `banned-api` and Clippy `disallowed-methods` ban calls; import-linter and dependency-cruiser forbid imports between layers.
3. **A structural rule** (for example ast-grep) when a configuration cannot express the pattern.
4. **A custom check script**, only as a last resort. It costs the most to maintain.

In the report, explain why each stronger option did not work. Adding a new tool to the repo is the user's decision; propose it, do not install it on your own.

## 3. Write the message

Every rule must carry a message in this form:

`<what to use instead>: <why, in one clause>.` Add a pointer to documentation only if one exists.

- Good: `Use files.ops.delete(): it refuses paths outside the listed directory.`
- Bad: `os.remove is forbidden.` (the next agent swaps in another wrong call)

The message alone must be enough for an agent to fix the code without reading anything else.

Examples:

```toml
# pyproject.toml (Ruff; enable rule TID251)
[tool.ruff.lint.flake8-tidy-imports.banned-api]
"os.remove".msg = "Use files.ops.delete(): it refuses paths outside the listed directory."
"subprocess.run".msg = "Use runtime.spawn(): it restores the user's original PATH."
```

```toml
# clippy.toml
disallowed-methods = [
    { path = "std::fs::remove_file", reason = "use crate::ops::remove(): it refuses paths outside the listing root" },
]
```

## 4. Prove the rule works

1. Write a small snippet with the mistake. Run the check: it must fail and show your message.
2. Write a snippet using the recommended alternative. Run the check: it must pass.
3. If the tool supports rule tests (for example `ast-grep test`), save both snippets as tests. Otherwise show the commands and outputs in the report.
4. Run the rule on the whole repo. Look at a sample of the hits. If some are false positives, narrow the rule instead of suppressing them.

## 5. Handle existing violations

- Replacing a violation with the recommended alternative can change behavior (the new helper may refuse inputs the old call accepted). Treat these fixes as behavior changes and guard them with tests.
- **If the existing violations can all be fixed safely in this change**, fix them.
- **Otherwise**, list every existing violation in the tool's exception mechanism, scoped as narrowly as the tool allows (per line or per file). Never disable the rule for a whole directory or the whole repo. Add a plan to clean them up in batches.
- Cleaning up old violations is part of the work, not optional: agents copy the code they find in the repo, so every old violation teaches the mistake again.

## 6. Suppressions

- A suppression needs a reason next to it:
  - Python: `# noqa: TID251` with the reason in a comment on the same line or the line above.
  - Rust: prefer `#[expect(clippy::disallowed_methods, reason = "...")]`; it warns when the suppression is no longer needed.
- **Never add a suppression, edit a rule, or disable a rule to make your own change pass.** Stop and report why the rule blocks you. The user decides.

## 7. Get approval

Adding or changing a rule changes what the whole repo is allowed to do, so it is a proposal. Prepare everything (configuration, message, proof, violation plan) so the user can approve it in one look. Do not merge it before approval.

## 8. Report format

1. **Mistake**: one sentence, with the occurrences.
2. **Enforcement**: what you chose, and why each stronger option did not work.
3. **Message**: the full text.
4. **Proof**: the check output for the bad snippet and the good snippet.
5. **Existing violations**: how many, fixed or listed as exceptions, and the cleanup plan.
6. **Suppressions added**, with reasons.
7. **Unprotected setup**, if you notice it: the check does not run in CI, or nothing stops changes to the lint configuration. Mention it once.
