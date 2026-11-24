---
description: Read-only wide search of the codebase. Returns file and line references with one-line notes.
mode: subagent
model: openai/gpt-6.1-terra#medium
steps: 30
permissions:
  - action: "*"
    resource: "*"
    effect: deny
  - action: read
    resource: "*"
    effect: allow
  - action: read
    resource: "*.env"
    effect: deny
  - action: read
    resource: "*.env.*"
    effect: deny
  - action: glob
    resource: "*"
    effect: allow
  - action: grep
    resource: "*"
    effect: allow
  - action: external_directory
    resource: "*"
    effect: allow
  - action: skill
    resource: "*"
    effect: allow
  - action: "chrome?devtools_*"
    resource: "*"
    effect: allow
---
