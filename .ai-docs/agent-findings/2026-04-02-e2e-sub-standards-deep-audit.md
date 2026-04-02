---
type: convention-drift
severity: medium
affected_files:
  - .ai-docs/standards/e2e/page-objects.md
  - .ai-docs/standards/e2e/test-data.md
  - .ai-docs/standards/e2e/test-structure.md
  - .ai-docs/standards/e2e/assertions.md
  - .ai-docs/standards/e2e/README.md
standards_docs:
  - .ai-docs/standards/e2e/page-objects.md
  - .ai-docs/standards/e2e/test-data.md
  - .ai-docs/standards/e2e/test-structure.md
  - .ai-docs/standards/e2e/assertions.md
  - .ai-docs/standards/e2e/README.md
date: 2026-04-02
reporting_agent: codex-keeper
category: testing
domain: e2e
root_cause: convention-undocumented
---

## What Was Wrong

Deep audit of E2E sub-standards against actual code found 14 issues across 5 files:

**page-objects.md (7 issues):**

1. StackStep listed `openHelp()` and `closeHelp()` methods that don't exist in code
2. BuildStep listed `passThroughWebAndSharedDomains()` -- actual method is `passThroughWebAndMethodologyDomains()`
3. BuildStep missing 5 methods: `selectSkill()`, `navigateToNextCategory()`, `toggleLabels()`, `toggleFilterIncompatible()`, `passThroughScratchDomains()`
4. BaseStep missing `pressArrowRight()` from protected methods table
5. BaseStep missing `navigateRight()` from public methods table
6. InitWizard missing `acceptStackDefaults()` composite flow
7. InitWizard missing `loadTimeout` launch option

**test-data.md (4 issues):**

1. Skill count claimed "10 skills" -- actual E2E source has 9 skills
2. Domain listed as "shared" -- actual third domain is "meta"
3. `runCLI()` docs claimed it sets `AGENTSINC_SOURCE=undefined` by default -- it does not (only `CLI.run()` does)
4. Missing 13 exports from test-utils.ts table (`ensureBinaryExists`, `BIN_RUN`, `CLI_ROOT`, render helpers, fs utils, exec re-exports)

**test-structure.md (1 issue):**

1. Claimed `TerminalScreen.waitForText()` has CI-aware timeouts (10s local, 20s CI) -- no such logic exists; timeout is always the passed `timeoutMs` parameter

**assertions.md (1 issue):**

1. `toHaveSettings` example showed `keyValue: ["Read(*)"]` which wouldn't work due to reference equality (`!==`). Fixed to show `hasKey` usage with a note about the `keyValue` limitation.

**README.md (1 issue):**

1. Missing `create-e2e-plugin-source.ts` and `node-pty.d.ts` from directory listing

## Fix Applied

All 14 issues fixed in their respective documentation files. Changes verified via re-read after edit.

## Proposed Standard

E2E documentation should be validated against actual code whenever step classes or fixture helpers gain new methods. Consider adding a lightweight check: grep for `async` methods in step files and compare against documented method counts.
