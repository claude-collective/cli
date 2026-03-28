---
type: anti-pattern
severity: high
affected_files:
  - e2e/pages/steps/domain-step.ts
  - e2e/pages/constants.ts
standards_docs:
  - .ai-docs/standards/e2e/README.md
date: 2026-03-28
reporting_agent: cli-tester
category: testing
domain: e2e
root_cause: rule-not-specific-enough
---

## What Was Wrong

`DomainStep.acceptDefaults()` used `waitForStableRender()` to gate before pressing Enter. `waitForStableRender()` polls for the footer text `"select"` — but that word already exists in the xterm scrollback buffer from the stack step's footer. The wait returned immediately, firing Enter before Ink had re-rendered the domains step. The Enter hit the stack step's `useInput` instead of the `CheckboxGrid`, resetting back to domains without advancing to build. `passThroughAllDomains()` then waited for `"Framework"` (the build step text) indefinitely, causing a test hang.

## Fix Applied

1. Added `DOMAINS: "Select domains"` to `STEP_TEXT` in `e2e/pages/constants.ts`. This string is only rendered by `WizardLayout` when `store.step === "domains"` and does not appear in the xterm buffer on any other step.
2. Replaced `waitForStableRender()` with `waitForStep(STEP_TEXT.DOMAINS)` in `DomainStep.acceptDefaults()`. The Enter now fires only after Ink has confirmed the domains step is active.

## Proposed Standard

Add to `.ai-docs/standards/e2e/README.md` (Step Page Patterns section):

**Never use `waitForStableRender()` as a step-entry gate.** `waitForStableRender()` polls for footer text (`"select"`) that persists in the xterm scrollback buffer across step transitions. It is only safe for detecting render completion _within_ an already-confirmed step. To gate on entering a step, always use `waitForStep(STEP_TEXT.<STEP>)` with a step-specific string that appears exclusively in that step's UI. Every step page's entry method must begin with `waitForStep(STEP_TEXT.<STEP>)`, not `waitForStableRender()`.
