---
type: convention-drift
severity: high
affected_files:
  - .ai-docs/standards/clean-code-standards.md
  - .ai-docs/standards/e2e-testing-bible.md
  - .ai-docs/standards/e2e/README.md
  - .ai-docs/standards/e2e/test-data.md
  - .ai-docs/standards/e2e/patterns.md
  - .ai-docs/standards/e2e/page-objects.md
standards_docs:
  - .ai-docs/standards/clean-code-standards.md
  - .ai-docs/standards/e2e-testing-bible.md
  - .ai-docs/standards/e2e/README.md
  - .ai-docs/standards/e2e/test-data.md
  - .ai-docs/standards/e2e/patterns.md
  - .ai-docs/standards/e2e/page-objects.md
date: 2026-04-02
reporting_agent: codex-keeper
category: architecture
domain: e2e
root_cause: convention-undocumented
---

## What Was Wrong

Standards docs in `.ai-docs/standards/` had extensive drift from the actual codebase after the POM framework migration, eject rename, and E2E constant reorganization:

1. **`utils/yaml.ts` removed** -- clean-code-standards Section 7.3 referenced `safeLoadYamlFile()` from this deleted file
2. **CLI_COLORS incomplete** -- Section 4.1 was missing `WHITE` and `LABEL_BG` constants
3. **E2E POM migration not reflected** -- e2e-testing-bible still showed direct `TerminalSession` usage, old helper functions (`navigateInitWizardToCompletion`, `navigateEditWizardToCompletion`, `passThroughAllBuildDomains`), and `plugin-assertions.ts` (deleted)
4. **Timing constants renamed** -- Old `*_TIMEOUT_MS` names replaced by `TIMEOUTS.*` in `pages/constants.ts`; `WIZARD_LOAD` value changed from 10s to 15s
5. **`COMPILE_ENV` and `OCLIF_EXIT_CODES` removed** -- referenced in bible Section 11 but never existed as constants
6. **`waitForStableRender()` footer text** -- docs said "navigate", actual code uses "select"
7. **Vitest retry config** -- README said `retry: 1`, actual is `retry: 2`
8. **"local" -> "eject" rename** -- `source: "local"` in test-data.md, multiple comments using "local" where "eject" is the install mode
9. **`STEP_TEXT` constant list stale** -- `DOMAIN_SHARED` renamed to `DOMAIN_META`, missing `DOMAINS`, `DOMAIN_MOBILE`, `BUILD_CATEGORY_COUNT`
10. **Project factory names stale** -- Used old `createMinimalProject()` style names instead of `ProjectBuilder.minimal()` methods
11. **`runCLI` importer count** -- Claimed 74 importers, actual is 1

## Fix Applied

All 6 affected files updated with verified references to actual code. Every file path, constant name, and function reference cross-checked against source.

## Proposed Standard

Standards docs should include a machine-readable "last audited" date in their frontmatter. The documentation map should track standards audit dates alongside reference doc dates, with a quarterly cadence recommendation for standards validation. Major framework migrations (like the POM migration) should include a checklist item to update all standards docs that reference the migrated layer.
