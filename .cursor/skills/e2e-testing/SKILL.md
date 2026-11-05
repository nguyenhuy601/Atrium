---
name: e2e-testing
description: >-
  Guides Atrium end-to-end checks on https://atrium.dev for critical UX flows. Use for large FE regressions.
---

# e2e testing

## When to use

Critical UX flow verification on LAN HTTPS.

## When NOT to use

Unit-only logic changes.

## Related Rules

- `.cursor/rules/atrium-constraints.mdc`
- `.cursor/rules/deep-agents-dispatch.mdc` (agent: `implementer`)

## Input

User journeys

## Workflow

1. Define journeys and expected UI outcomes.
2. Verify via browser or documented manual steps on atrium.dev.
3. Record pass/fail/blockers.

## Expected output

E2E results

## Tools

Read, optional browser tools.
