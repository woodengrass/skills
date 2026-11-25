---
description: Read-only second opinion on a hard question - architecture trade-offs across systems, a problem that survived two fixes, security or performance concerns. Not for routine reviews (use reviewer), first attempts, or questions the code you already read answers.
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
