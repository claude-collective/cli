---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/shared-tooling-typescript-config/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

The `examples/core.md` file in `shared-tooling-typescript-config` had disordered pattern numbering: Pattern 1, then Pattern 5 (skipping 2-4), then back to Pattern 2, followed by Pattern 3, 4, 6, 7, 7b, 7c, 8, 9. Sub-numbering (7b, 7c) was also used instead of sequential numbers. This made it difficult to reference patterns and violated the atomicity bible's rule: "Core patterns: Sequential numbering (Pattern 1, 2, 3...)".

The root cause appears to be incremental additions to the file without renumbering -- new patterns (Specialized Configs, rewriteRelativeImportExtensions, module node18/node20) were inserted with ad-hoc numbers to avoid renumbering existing patterns.

## Fix Applied

Renumbered all patterns sequentially from Pattern 1 through Pattern 11. Eliminated sub-numbering (7b, 7c became 8, 9). Reordered logically: base config, specialized configs, then feature-specific patterns in chronological order by TS version.

## Proposed Standard

Add to `skill-atomicity-bible.md` Section 8 (Skill File Extraction) under "Pattern Numbering":

> When adding new patterns to `core.md`, renumber ALL patterns sequentially. Never use sub-numbering (7a, 7b) or skip numbers. Since SKILL.md links to core.md by description (not pattern number), renumbering does not break cross-references.
