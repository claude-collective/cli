---
type: anti-pattern
severity: high
affected_files:
  - /home/vince/dev/skills/src/skills/web-testing-vitest/SKILL.md
  - /home/vince/dev/skills/src/skills/web-testing-vitest/metadata.yaml
  - /home/vince/dev/skills/src/skills/web-testing-vitest/examples/core.md
  - /home/vince/dev/skills/src/skills/web-testing-vitest/reference.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

The `web-testing-vitest` skill was severely coupled to two other skills' domains: Playwright (E2E testing) and React Testing Library (component testing). Specific violations:

1. **Description** contained "Playwright E2E, Vitest, React Testing Library" - naming three separate tools
2. **Quick Guide** said "E2E for user flows (Playwright). Unit for pure functions (Vitest)." - prescribing Playwright
3. **Critical Requirements** mandated "You MUST use Playwright for E2E tests" - explicitly recommending another skill's tool
4. **Auto-detection** keywords included "Playwright, React Testing Library"
5. **Pattern 1** was titled "E2E Testing with Playwright (PRIMARY)" with full Playwright import examples (`import { test, expect } from "@playwright/test"`)
6. **examples/core.md** contained ~100 lines of pure Playwright E2E code with `@playwright/test` imports
7. **reference.md** decision tree said "Write E2E test (Playwright)" and "Is it a React component? -> Write E2E test, NOT unit test"
8. **metadata.yaml** usageGuidance said "Use when writing E2E tests (Playwright)"

This constituted Category 1 (Import Coupling), Category 2 (Explicit Tool Recommendations), and Category 4 (Decision Tree Exits) violations per the atomicity bible.

## Fix Applied

1. Rewrote SKILL.md description, quick guide, critical requirements, auto-detection, when-to-use, philosophy, and patterns to focus exclusively on Vitest's domain (test runner, mocking, assertions, configuration)
2. Removed Pattern 1 (E2E with Playwright) entirely - this content already exists in the `web-testing-playwright-e2e` skill
3. Renumbered remaining patterns
4. Removed all Playwright import examples from examples/core.md
5. Rewrote reference.md decision framework to stay within Vitest's scope
6. Updated metadata.yaml cliDescription and usageGuidance to remove Playwright references
7. Updated critical reminders to match new critical requirements

## Proposed Standard

Testing skills must not prescribe or import from other testing tools' domains. The Vitest skill owns: test runner configuration, mocking APIs (vi.fn, vi.mock, vi.spyOn), assertions, fake timers, coverage, workspaces. It does NOT own: E2E browser testing (Playwright/Cypress), component rendering queries (RTL/Vue Test Utils). This boundary should be documented in the atomicity bible's testing domain examples.
