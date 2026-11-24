---
description: Read-only second opinion. Use for architecture trade-offs across systems or unfamiliar patterns, after two failed fixes of the same problem, for security or performance concerns, and to review a large change once it is done. Not for a first attempt, simple edits, or questions the code you already read answers.
mode: subagent
model: openai/gpt-6.2-astra#xhigh
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
