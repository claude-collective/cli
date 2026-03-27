---
type: convention-drift
severity: low
affected_files:
  - skills/src/skills/web-accessibility-web-accessibility/examples/color.md
  - skills/src/skills/web-accessibility-web-accessibility/examples/focus.md
  - skills/src/skills/web-accessibility-web-accessibility/examples/touch-targets.md
  - skills/src/skills/web-accessibility-web-accessibility/examples/screen-reader.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

Multiple skill example files used ` ```scss ` as the code fence language tag for blocks containing plain CSS (no SCSS-specific syntax like nesting, `//` comments, or variables with `$`). This creates a false impression of SCSS coupling and triggers false positives when grepping for atomicity violations. The content inside was standard CSS using CSS custom properties (`var(--*)`) and standard selectors.

Additionally, SCSS-style single-line comments (`// comment`) were used inside these blocks instead of CSS-standard `/* comment */` syntax, making the examples invalid CSS.

## Fix Applied

Changed all ` ```scss ` fences to ` ```css ` in the affected files. Converted SCSS-style comments (`//`) to CSS-standard comments (`/* */`). Converted SCSS nesting syntax (`&:focus-visible`) to flat CSS selectors (`.button:focus-visible`).

## Proposed Standard

Add to skill-atomicity-bible.md in the "Keywords to Watch" or "Quality Gate Checklist" section:

> **Code fence language tags must match actual content.** Use ` ```css ` for plain CSS, ` ```scss ` only for actual SCSS with nesting/variables. SCSS fences on CSS-only content create false atomicity violation signals and imply SCSS coupling.
