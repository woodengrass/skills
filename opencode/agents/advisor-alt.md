---
description: Optional extra viewpoint from a different model family. Lower weight than advisor; use it alongside advisor when an outside perspective would help, never instead of it.
mode: subagent
model: opencode-go/qwen4-max#high
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
