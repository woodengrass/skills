---
description: Read-only second opinion. Use for architecture trade-offs across systems or unfamiliar patterns, after two failed fixes of the same problem, for security or performance concerns, and to review a large change once it is done. Not for a first attempt, simple edits, or questions the code you already read answers.
mode: subagent
model: openai/gpt-6.2-astra#xhigh
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
