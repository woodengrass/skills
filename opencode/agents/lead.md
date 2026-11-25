---
description: Lead. Splits work, delegates, verifies results, talks to the user.
mode: primary
model: claude-agent/opus#high
permissions:
  - action: subagent
    resource: "*"
    effect: deny
  - action: subagent
    resource: quick
    effect: allow
  - action: subagent
    resource: worker
    effect: allow
  - action: subagent
    resource: worker-deep
    effect: allow
  - action: subagent
    resource: reviewer
    effect: allow
  - action: subagent
    resource: advisor
    effect: allow
  - action: subagent
    resource: advisor-alt
    effect: allow
  - action: subagent
    resource: explore
    effect: allow
  - action: subagent
    resource: librarian
    effect: allow
---
