---
type: anti-pattern
severity: medium
affected_files:
  - src/cli/lib/configuration/config-loader.ts
standards_docs:
  - .ai-docs/reference/features/configuration.md
date: 2026-03-29
reporting_agent: cli-tester
category: architecture
domain: cli
root_cause: enforcement-gap
---

## What Was Wrong

`loadConfig` in `config-loader.ts` did not check whether the jiti-imported module had a default export. When importing an empty file (zero bytes) or whitespace-only file, jiti returns an empty object `{}` rather than `null` or `undefined`. The function passed this through as a valid config, silently returning `{}` cast to `T`.

This meant callers that checked `if (!result)` would treat an empty config file as valid data with an empty object, rather than recognizing it as a missing/invalid config.

## Fix Applied

Added a guard after the jiti import that checks if `raw` is null/undefined or an empty object (zero own keys). In that case, `loadConfig` now returns `null` -- the same behavior as when the file does not exist. This aligns with all existing callers that already handle `null` returns gracefully.

All 2212 unit tests continue to pass after the fix, confirming no callers relied on receiving an empty object from an empty file.

## Proposed Standard

Add to `.ai-docs/reference/features/configuration.md` under the config loading section:

> **Empty file handling:** `loadConfig` returns `null` for files that exist but have no default export (empty files, whitespace-only files, files with only side effects). This matches the "file not found" return value. Callers should not distinguish between missing files and empty files -- both mean "no config provided."
