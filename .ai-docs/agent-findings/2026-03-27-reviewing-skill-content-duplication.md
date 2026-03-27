---
type: anti-pattern
severity: low
affected_files:
  - /home/vince/dev/skills/src/skills/meta-reviewing-reviewing/SKILL.md
  - /home/vince/dev/skills/src/skills/meta-reviewing-reviewing/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: dry
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

The `meta-reviewing-reviewing` skill had 4 "Why" rationale sentences duplicated verbatim between SKILL.md Pattern 4 ("Feedback Principles") and examples/core.md ("Feedback Examples"). Each feedback principle (Be Specific, Explain Why, Suggest Solutions, Acknowledge Good Work) had the exact same explanatory sentence in both files.

Per the atomicity bible: "No content duplicated between SKILL.md and example files (SKILL.md has brief snippets + links)."

## Fix Applied

Shortened the feedback principle descriptions in SKILL.md to brief one-sentence summaries, removing the duplicated rationale sentences. The detailed "Why" explanations with examples remain in their canonical location: examples/core.md. Updated the link text to say "For detailed examples of each principle with rationale" to make it clear that core.md owns the full explanations.

## Proposed Standard

No new rule needed -- the existing atomicity bible rule about no content duplication between SKILL.md and example files already covers this. The issue was simply that the original AI-generated content duplicated sentences across files. This is a common pattern to watch for during quality audits.
