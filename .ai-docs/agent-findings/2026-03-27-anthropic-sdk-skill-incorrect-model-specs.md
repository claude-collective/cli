---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/ai-provider-anthropic-sdk/reference.md
  - /home/vince/dev/skills/src/skills/ai-provider-anthropic-sdk/examples/extended-thinking.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: testing
domain: shared
root_cause: enforcement-gap
---

## What Was Wrong

Three factual errors in the ai-provider-anthropic-sdk skill:

1. **Incorrect max output for claude-opus-4-5**: Listed as 32K in reference.md model table but the official Anthropic docs show 64K. The 32K limit applies to claude-opus-4-1, not opus-4-5.

2. **Fabricated dated model variant IDs**: reference.md listed `claude-sonnet-4-6-20250220` and `claude-opus-4-6-20260205` as example dated variants. Neither of these exists in the official docs -- they appear to be hallucinated by the original AI author.

3. **Broken markdown table in extended-thinking.md**: The effort parameter row contained pipe characters (`"max" | "high" | "medium" | "low"`) that broke the markdown table rendering by creating extra columns. The table header separator row had 4 extra column dividers as a result.

## Fix Applied

1. Changed `claude-opus-4-5` max output from `32K` to `64K` in reference.md
2. Replaced fabricated dated variants with real ones (`claude-sonnet-4-5-20250929`, `claude-opus-4-5-20251101`) and added a note to check the Models API for current IDs
3. Rewrote the effort parameter cell to list values with commas instead of pipes: `"max" (Opus 4.6 only), "high" (default), "medium", "low"`

## Proposed Standard

AI-authored skills with model specifications (IDs, context windows, output limits, dated variants) should be verified against the official vendor documentation during every audit pass. Context7 MCP can provide SDK-level verification but does not always have current model metadata -- the official model docs page should be the source of truth for these values.
