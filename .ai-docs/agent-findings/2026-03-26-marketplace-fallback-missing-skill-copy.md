---
type: anti-pattern
severity: high
affected_files:
  - src/cli/commands/init.tsx
standards_docs:
  - .ai-docs/reference/commands.md
date: 2026-03-26
reporting_agent: cli-developer
category: architecture
domain: cli
root_cause: convention-undocumented
---

## What Was Wrong

When refactoring `init.tsx` to use operations (`copyLocalSkills`, `ensureMarketplace`, `installPluginSkills`, `writeProjectConfig`, `compileAgents`), the marketplace fallback path was incomplete.

The old code had `installIndividualPlugins` which called `this.installLocalMode()` when the marketplace was unavailable -- this ran the full local install pipeline (copy skills + write config + compile agents). The new code logged a warning ("Falling back to Local Mode...") but did NOT actually copy the skills locally. It just continued to write config and compile agents without skills on disk.

**Root cause**: The wizard's `createDefaultSkillConfig()` in `wizard-store.ts` sets `source: primarySource ?? DEFAULT_PUBLIC_SOURCE_NAME` (e.g., `"agents-inc"`) for all skills by default. This means `deriveInstallMode()` returns `"plugin"` for virtually all wizard flows. When the marketplace is then unavailable (no `.claude-plugin/marketplace.json` in the source), the code needs to fall back to local copy, but the refactored code failed to do so.

This caused 8+ E2E test files to fail with: `Expected skill "web-framework-react" to be copied locally at /tmp/ai-e2e-xxx/.claude/skills/web-framework-react/SKILL.md`

## Fix Applied

Added local skill copy fallback when marketplace resolution fails in `handleInstallation`:

- In "plugin" mode: copy ALL skills locally (none were copied in Step 1)
- In "mixed" mode: copy only plugin-intended skills locally (local-source skills were already copied in Step 1)
- Set `installMode = "local"` so downstream Steps 3-5 use the correct mode for compilation and output reporting

## Proposed Standard

When extracting multi-step operations into separate functions, document the fallback/recovery paths as first-class concerns, not just the happy path. Each operation module should document:

1. What happens when this step fails
2. Which other steps depend on this step's output
3. Whether fallback requires re-running a different step

Add to `CLAUDE.md` or `.ai-docs/standards/clean-code-standards.md`:

- ALWAYS preserve marketplace fallback behavior when refactoring install flows -- if marketplace is unavailable, skills MUST be copied locally as fallback
- NEVER assume `deriveInstallMode()` will return "local" for default wizard selections -- `createDefaultSkillConfig()` uses the marketplace source name by default
