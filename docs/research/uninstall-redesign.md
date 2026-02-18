# Uninstall Redesign: Config-Based Precision Deletion

## Summary

Replace the current `generatedByAgentsInc` boolean approach with config-based removal. The `.claude-src/config.yaml` is the source of truth — if it exists with a source, the CLI installed things. Match installed skills and agents against config to determine what to remove.

## Current State (to be replaced)

- Skills: `generatedByAgentsInc: boolean` in `metadata.yaml` — remove if true
- Agents: `.claude/agents/` is **nuked entirely** — no per-agent tracking
- Flags: `--plugin` and `--local` control what gets removed
- `.claude-src/`: always removed during local uninstall

## New Approach

### Removal logic

- **Skills**: if `config.yaml` exists with a `source` → all skills in `.claude/skills/` that were installed from that source should be removed. User-created skills (not from any source) are preserved.
- **Agents**: match `.claude/agents/*.md` frontmatter `name` against agents defined in config.yaml. If the name matches a configured/compiled agent → remove. User-authored agents are preserved.
- **Plugins**: always removed (same as now, no flag needed).
- **`.claude-src/`**: only removed with `--all` flag. Preserved by default.

### Flag changes

- **Remove**: `--plugin`, `--local` (no more distinction)
- **Add**: `--all` (also removes `.claude-src/`)
- **Keep**: `--yes`, `--dry-run`

### `forked_from` field

Keep `forked_from` in skill `metadata.yaml` as provenance tracking (skill_id, content_hash, date). Consider renaming to `installedFrom`. This is NOT used for the uninstall decision — config.yaml is.

### `generatedByAgentsInc`

Remove entirely. No backward compatibility concern (pre-1.0 project).

## New Uninstall Flow

```
agentsinc uninstall [--yes] [--all] [--dry-run]

1. Read .claude-src/config.yaml → get source, marketplace, agents list
2. Scan .claude/skills/* — match against source-provided skills → remove matches
3. Scan .claude/agents/*.md — match frontmatter name against config agents → remove matches
4. Remove plugins from .claude/plugins/ (always)
5. If --all: remove .claude-src/
6. If .claude/ is empty after cleanup: remove it
```

## Files to Change

| File | Change |
|------|--------|
| `src/cli/commands/uninstall.tsx` | Rewrite: new flags, config-based removal logic |
| `src/cli/lib/skills/skill-metadata.ts` | Remove `generatedByAgentsInc` from type and `injectForkedFromMetadata()` |
| `src/cli/lib/schemas.ts` | Remove `generatedByAgentsInc` from `localSkillMetadataSchema` |
| `src/cli/lib/__tests__/commands/uninstall.test.ts` | Rewrite tests for new behavior |
| `src/cli/lib/skills/skill-copier.test.ts` | Remove `generatedByAgentsInc` assertions |

## Future Enhancement (Deferred: D-26)

Allow `--source` flag to uninstall skills from a specific marketplace only:

```bash
agentsinc uninstall --source github:acme-corp/skills
```
