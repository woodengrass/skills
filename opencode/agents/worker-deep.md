---
description: Implements changes whose logic is hard or needs trade-offs (contracts other code depends on, no pattern to copy, correctness that must be argued). Same brief and report format as worker.
mode: subagent
model: openai/gpt-6.2-astra#medium
steps: 80
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
---
