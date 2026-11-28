# Personal Skills

[繁體中文](./README.zh-TW.md)

This repository contains the skills and working instructions I use with coding agents.

- [`AGENTS.md`](./AGENTS.md): Working instructions covering scope, verification, and decision records.
- [`adr`](./skill/adr/SKILL.md): Document project goals in `GOALS.md` and record lasting decisions in `*.adr.md` files next to the relevant code.
- [`tests-that-catch-bugs`](./skill/tests-that-catch-bugs/SKILL.md): Write and review tests that fail when the behavior they cover breaks.
- [`mistakes-to-lint-rules`](./skill/mistakes-to-lint-rules/SKILL.md): Prevent recurring, objectively detectable mistakes with types or API constraints, or catch them with lint rules that explain how to fix them.
- [`github-actions-ci`](./skill/github-actions-ci/SKILL.md): Set up or review GitHub Actions CI, run existing checks on every pull request, and verify that each gate fails when it should.
- [`git`](./skill/git/SKILL.md): Branches, frequent commits, pull requests, CI failures, history and safe undo, one file per part.
- [`debugging`](./skill/debugging/SKILL.md): Find a bug's cause by observing the running program, testing one hypothesis at a time, and keep a hypothesis log.
- [`manual-qa`](./skill/manual-qa/SKILL.md): Use the real app yourself, step by step as a person would (web through Chrome DevTools, CLI and TUI, API, iOS), look at every screen, and report what is wrong. Automated checks stay with `tests-that-catch-bugs`.
- [`bro`](./skill/bro/SKILL.md): Type `/bro` to have the agent restate its last message in plain words, without jargon or analogies.
- [`opencode/`](./opencode/README.md): Optional. My OpenCode V2 setup (agent roles, permissions, plugins) with its own `AGENTS.md`, using the skills above; installed by the prompt below or with `opencode/install.sh`.

Some instructions ask the agent to write in Traditional Chinese: replies to the user in the root `AGENTS.md` and in `opencode/plugins/language/language.json`, and decision records in the `adr` skill. Change them to your own language before using them.

## Installation

Paste this prompt into your coding agent:

```text
Read https://raw.githubusercontent.com/woodengrass/skills/main/INSTALL.md and follow the instructions to help me install.
```
