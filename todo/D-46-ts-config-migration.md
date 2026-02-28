# D-46: Custom Extensibility via Generated Config Types

**Research:** [docs/research/ts-config-types-resolution.md](../docs/research/ts-config-types-resolution.md)

No backward compatibility -- this is pre-1.0.

---

## Status

| Phase        | Description                                                                                                      | Status |
| ------------ | ---------------------------------------------------------------------------------------------------------------- | ------ |
| Phase 1      | Foundation -- TS modules replace YAML (default-categories.ts, default-rules.ts, default-stacks.ts)               | Done   |
| Phase 2      | Config loading/writing migration -- jiti-based ts-config-loader, ts-config-writer, all commands migrated         | Done   |
| Custom types | Generated `config-types.ts` with string unions + `satisfies ProjectConfig` (zero-dependency editor autocomplete) | Done   |

---

## What Was Built

- **`ts-config-writer.ts`** -- writes `config.ts` with `satisfies ProjectConfig` and `import type` from generated types
- **`ts-config-loader.ts`** -- jiti-based loader that imports TS config modules at runtime
- **`ts-config-types-writer.ts`** -- generates `config-types.ts` containing string unions (SkillId, AgentName, Domain, Subcategory, InstallMode) and a `ProjectConfig` type that uses them
- **`config-exports.ts`** / **`define-config.ts`** -- public API surface for config authoring
- **`default-categories.ts`**, **`default-rules.ts`**, **`default-stacks.ts`** -- TS module replacements for the old YAML config files

The generated `config-types.ts` provides full editor autocomplete and type checking with zero dependencies (no `npm install` needed). The CLI generates it alongside `config.ts` during `init` and `edit`.

---

## Remaining Work -- Custom Entities in Generated Types

The generated `config-types.ts` currently only includes marketplace entities. It needs to also discover and include custom entities so users get autocomplete for their own skills, agents, and categories.

### What needs to change

1. **`generateConfigTypesSource` must receive custom entities** -- custom skills (from `.claude/skills/` with `custom: true` in metadata), custom agents, and custom categories should be included in the generated unions alongside marketplace data.

2. **Discovery is filesystem-based** -- no `customSkills`/`customAgents` config fields needed. The CLI already knows custom entities exist from the filesystem at generation time.

3. **Regeneration triggers** -- every command that creates/removes entities should regenerate `config-types.ts`:
   - `init` / `edit` -- full regeneration (already happens)
   - `new skill` -- regenerate after creating a skill
   - `new agent` -- regenerate after creating an agent (if applicable)

### Example output

```typescript
// config-types.ts (generated)
export type SkillId =
  // Marketplace
  | "web-framework-react"
  | "web-styling-scss-modules"
  // Custom (from .claude/skills/)
  | "acme-deploy-pipeline"
  | "acme-audit-runner";
```

### Key files

- `src/cli/lib/configuration/ts-config-types-writer.ts` -- generation logic to extend
- `src/cli/commands/new/skill.ts` -- add regeneration call after skill creation
- `src/cli/commands/new/agent.ts` -- add regeneration call after agent creation (if exists)
