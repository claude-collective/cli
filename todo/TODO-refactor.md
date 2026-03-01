# Agents Inc. CLI - Refactoring Tasks

> Refactoring tasks from [TODO.md](./TODO.md) are tracked here separately.

| ID   | Task                                                                                                                                  | Status   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| R-01 | `loadStackById` should check default stacks internally — callers shouldn't need to know about both sources                            | Refactor |
| R-02 | Flatten nested for-loops in `default-stacks.test.ts` — parameterize per (stack, agent, category) instead of nesting inside `it.each`  | Refactor |
| R-03 | Simplify `config-generator.ts` — reduce nested loops, intermediate maps, and function complexity                                      | Refactor |
| R-04 | Replace config files with global skill store — derive categories from metadata, move relationships to typed store, drop file-first pattern | Refactor |

---

## R-04: Replace config files with global skill store

**Related:** D-67 (skill metadata as single source of truth)

### Problem

Skill properties are scattered across three places: `metadata.yaml` per-skill, `skill-categories.ts` centrally, and `skill-rules.ts` centrally. These get merged at load time into a massive `MergedSkillsMatrix`. This means intrinsic skill properties (display name, category, domain) are duplicated between the skill's own metadata and hand-maintained central config files.

The "config file" pattern is misleading — `default-rules.ts` is already a hardcoded TypeScript constant compiled into the CLI, not something loaded from disk. The only reason files exist is for custom marketplace overrides, which is rare.

### Design

**Populate a global store at load time from skill metadata. Central files go away for the default path.**

What moves into each skill's `metadata.yaml` (single source of truth):
- `displayName` (make required — currently optional)
- `category`, `domain` (already there)
- `compatibleWith`, `requiresSetup`, `providesSetupFor` (currently in `perSkill` section of `skill-rules.ts`)

What becomes a typed constant in the CLI (not a file):
- Inter-skill relationships: `conflicts`, `recommends`, `requires`, `discourages`, `alternatives`
- These are bidirectional/multi-skill concerns that no single skill can declare alone

What goes away entirely:
- `skill-categories.ts` — category groupings derived from scanning skill metadata at load time
- `aliases` section of `skill-rules.ts` — derived from `displayName` in metadata
- `perSkill` section of `skill-rules.ts` — moved into individual skill metadata

Override mechanism for custom sources:
- Optional `relationships.ts` (or key in source config) for custom marketplaces that need different inter-skill rules
- This is an escape hatch, not the primary path

### Files affected

| File | Change |
|------|--------|
| `src/cli/lib/configuration/default-rules.ts` | Keep only `relationships` + `version`, remove `aliases` and `perSkill` |
| `src/cli/lib/matrix/matrix-loader.ts` | Build `displayNameToId`/`displayNames` from extracted skill metadata, not aliases map |
| `src/cli/types/matrix.ts` | Remove `aliases` from `SkillRulesConfig`, add `perSkill` fields to `ExtractedSkillMetadata` |
| `src/cli/lib/matrix/matrix-resolver.ts` | `resolveAlias()` uses metadata-derived map (no behavior change) |
| `src/cli/lib/loading/loader.ts` | `extractAllSkills()` extracts new per-skill rule fields from metadata |
| `src/cli/lib/schemas.ts` | Make `displayName` required in metadata schema, add per-skill rule fields |
| Skills repo: individual `metadata.yaml` files | Add `displayName` (required), move `perSkill` rules from central config |
| Skills repo: `config/skill-categories.ts` | Remove (categories derived from metadata) |
| Skills repo: `config/skill-rules.ts` | Reduce to relationships only, or remove if relationships move to CLI default |
