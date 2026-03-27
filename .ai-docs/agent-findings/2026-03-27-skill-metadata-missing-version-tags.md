---
type: convention-drift
severity: low
affected_files:
  - /home/vince/dev/skills/src/skills/ai-orchestration-llamaindex/metadata.yaml
  - /home/vince/dev/skills/src/skills/ai-orchestration-vercel-ai-sdk/metadata.yaml
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: shared
root_cause: enforcement-gap
---

## What Was Wrong

Multiple skill `metadata.yaml` files in the ai-orchestration category are missing the `version` (integer) and `tags` (kebab-case array) fields, which are required per the skill-atomicity-bible Quality Gate Checklist. The `ai-orchestration-langchain` skill was fixed during this audit, but `ai-orchestration-llamaindex` and `ai-orchestration-vercel-ai-sdk` still lack both fields.

## Fix Applied

Fixed `ai-orchestration-langchain/metadata.yaml` and `ai-orchestration-llamaindex/metadata.yaml` by adding `version: 1` and a `tags` array. `ai-orchestration-vercel-ai-sdk` still needs the fix.

## Proposed Standard

The `bun cc:validate` schema should enforce `version` and `tags` as required fields in metadata.yaml, causing validation to fail when they are missing. This would catch the issue during development rather than requiring manual audits.
