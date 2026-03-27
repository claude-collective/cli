---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/ai-provider-mistral-sdk/SKILL.md
  - skills/src/skills/ai-provider-mistral-sdk/metadata.yaml
  - skills/src/skills/ai-provider-mistral-sdk/examples/embeddings-vision.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: shared
root_cause: convention-undocumented
---

## What Was Wrong

AI provider skills referenced deprecated model names (e.g., "Pixtral") in titles, descriptions, and usage guidance. These model names were current at skill creation time but have since been deprecated and replaced by newer model lines. The pattern titles and descriptions gave the impression that a specific deprecated model was required for a capability (vision) that is now broadly available across most current models.

This is a general risk for AI provider skills: model names and capabilities change faster than other technology domains, making stale model references a recurring maintenance concern.

## Fix Applied

Replaced all user-facing "Pixtral" references with generic capability-based language ("vision-capable models") while preserving "pixtral" in auto-detection keywords (since users may still search for it). Updated SKILL.md (4 locations), metadata.yaml (1 location), and examples/embeddings-vision.md (1 location).

## Proposed Standard

Add a rule to `skill-atomicity-primer.md` under "Learnings from Iteration":

- **Deprecated model names in AI provider skills**: When auditing AI provider skills, verify all model names and IDs against current official documentation. Model capabilities (vision, reasoning, code) should be described by capability name, not by a specific model line that may be deprecated. Keep deprecated model names only in auto-detection keywords for discoverability.
