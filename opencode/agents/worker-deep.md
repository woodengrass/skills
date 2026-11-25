---
description: Designs and implements a change whose approach is not settled and where a wrong choice breaks correctness, such as new data shapes or module boundaries. Can report the design before editing when asked. Use rarely; a brief that already states the behavior goes to worker, however hard the area. Same brief and report format as worker.
mode: subagent
model: openai/gpt-6.2-astra#medium
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: question
    resource: "*"
    effect: deny
---
