---
description: Reviews finished work or an area of code for defects, and runs checks to confirm them. Read-only. Use for routine reviews; keep advisor for hard questions.
mode: subagent
model: openai/gpt-6.2-sol#high
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
