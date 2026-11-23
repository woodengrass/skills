# Personal Skills

[繁體中文](./README.zh-TW.md)

This repository contains the skills and working instructions I use with coding agents.

- [`AGENTS.md`](./AGENTS.md): Working instructions covering scope, verification, and decision records.
- [`adr`](./skill/adr/SKILL.md): Document project goals in `GOALS.md` and record lasting decisions in `*.adr.md` files next to the relevant code.
- [`tests-that-catch-bugs`](./skill/tests-that-catch-bugs/SKILL.md): Write and review tests that fail when the behavior they cover breaks.
- [`mistakes-to-lint-rules`](./skill/mistakes-to-lint-rules/SKILL.md): Prevent recurring, objectively detectable mistakes with types or API constraints, or catch them with lint rules that explain how to fix them.
- [`github-actions-ci`](./skill/github-actions-ci/SKILL.md): Set up or review GitHub Actions CI, run existing checks on every pull request, and verify that each gate fails when it should.

## Installation

Paste this prompt into your coding agent:

```text
Read https://raw.githubusercontent.com/woodengrass/skills/main/INSTALL.md and follow the instructions to help me install.
```
