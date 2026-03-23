---
type: convention-drift
severity: high
affected_files:
  - src/agents/meta/skill-summoner/output-format.md
  - src/agents/meta/skill-summoner/workflow.md
  - src/agents/meta/skill-summoner/examples.md
  - src/agents/meta/skill-summoner/critical-reminders.md
  - src/agents/meta/skill-summoner/intro.md
standards_docs:
  - src/schemas/metadata.schema.json
date: 2026-03-23
reporting_agent: cli-developer
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

The skill-summoner agent's templates and examples used a stale metadata.yaml format:

- snake_case fields (`cli_name`, `cli_description`, `usage_guidance`) instead of camelCase (`displayName`, `cliDescription`, `usageGuidance`)
- Included deprecated fields: `version`, `tags`, `requires`, `compatible_with`, `conflicts_with`
- Missing required fields: `slug`, `domain`
- Relationship fields (`requires`, `compatible_with`, `conflicts_with`) moved to `skill-rules.ts` but templates still referenced them

This caused any skill created by the skill-summoner agent to have an invalid metadata.yaml that would fail schema validation.

## Fix Applied

Updated all five skill-summoner files:

1. `output-format.md` - Fixed metadata.yaml template to use current camelCase fields, removed deprecated fields, updated validation checklist
2. `workflow.md` - Fixed metadata description line, added agent output location section
3. `examples.md` - Fixed example metadata.yaml, added metadata fields row to Common Mistakes table
4. `critical-reminders.md` - Listed required fields explicitly in verification protocol
5. `intro.md` - Added metadata format summary and agent creation guidance

## Proposed Standard

When the metadata schema changes (`src/schemas/metadata.schema.json`), the skill-summoner agent templates should be updated in the same commit. Add a checklist item to the metadata schema update process: "Update skill-summoner agent templates to match new schema."
