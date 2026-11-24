---
description: Optional extra viewpoint from a different model family. Lower weight than advisor; use it alongside advisor when an outside perspective would help, never instead of it.
mode: subagent
model: opencode-go/qwen4-max#high
steps: 25
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
  - action: webfetch
    resource: "*"
    effect: allow
  - action: websearch
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
