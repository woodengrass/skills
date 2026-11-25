---
description: Implements a clearly scoped change and runs its checks. Give it the task, the deliverable, the scope, how to verify, and when to stop.
mode: subagent
model: openai/gpt-6.2-sol#medium
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
---
