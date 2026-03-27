---
type: anti-pattern
severity: high
affected_files:
  - skills/web-files-file-upload-patterns/examples/core.md
  - skills/web-files-file-upload-patterns/examples/accessibility.md
  - skills/web-files-file-upload-patterns/examples/progress.md
  - skills/web-files-file-upload-patterns/examples/preview.md
  - skills/web-files-file-upload-patterns/SKILL.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: enforcement-gap
---

## What Was Wrong

The `web-files-file-upload-patterns` skill had pervasive SCSS Module coupling across all example files:

- **9 `import styles from '*.module.scss'` statements** across 4 example files (core.md, accessibility.md, progress.md, preview.md)
- **60+ `className={styles.xxx}` references** throughout JSX code
- **6 full SCSS blocks** (100+ lines each) providing complete styling implementations
- **1 "SCSS Utilities for Accessibility" section** in accessibility.md prescribing SCSS specifically
- **1 reference in SKILL.md** ("See examples/core.md for full implementation with SCSS")

This is a Category 1 (Import Coupling) + Category 6 (Library Reference) violation per the atomicity bible. The skill was tightly coupled to SCSS Modules, making it unusable for teams using Tailwind, CSS-in-JS, or plain CSS.

## Fix Applied

- Removed all 9 `import styles from` statements, replaced with `// Apply your styling solution via className prop`
- Converted all `className={styles.xxx}` to plain `className="xxx"` strings
- Converted `className={styles.hiddenInput}` to `hidden` attribute
- Removed all 6 SCSS blocks, replacing with notes about using data attributes for styling
- Converted SCSS-specific accessibility utilities to plain CSS
- Removed "with SCSS" reference from SKILL.md

Components now use `data-*` attributes (data-state, data-status, data-disabled) for state-based styling, which works with any styling approach.

## Proposed Standard

Add to the skill-atomicity-bible.md under "Keywords to Watch > Styling Domain":

```
import styles from (CSS module import pattern - always a violation in non-styling skills)
styles. (CSS module object access - always a violation in non-styling skills)
```

Add to "Quality Gate Checklist > Import Purity":

- [ ] No `import styles from '*.module.scss'` in non-styling skills
- [ ] No `styles.xxx` CSS module object access in non-styling skills
- [ ] SCSS/CSS blocks in examples use generic class names, not module syntax
