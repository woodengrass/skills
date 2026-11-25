---
description: Read-only wide search of the codebase. Returns file and line references with one-line notes.
mode: subagent
model: openai/gpt-6.1-terra#medium
permissions:
  - action: edit
    resource: "*"
    effect: deny
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
---
