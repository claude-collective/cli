# D-53: Rename `agent.yaml` to `metadata.yaml`

**Status:** Pending
**Complexity:** Medium (many files, but mechanical rename)
**Risk:** Medium (breaking change for consumer projects with existing agent.yaml files)

## Implementation Overview

Mechanical rename across ~52 files. Rename `STANDARD_FILES.AGENT_YAML` to `STANDARD_FILES.AGENT_METADATA_YAML` (value: `"metadata.yaml"`). `git mv` all 18 actual `agent.yaml` files in `src/agents/`. Update hardcoded strings in `loader.ts`, error messages in `resolver.ts`, agent prompt instructions in `new/agent.tsx`, and all references in agent-summoner content files. Fix test files (helpers, fixtures, schema-validator tests, loader tests). Update documentation. No backward-compatibility period (pre-1.0). The JSON schema file `agent.schema.json` keeps its filename — only its description is updated.

---

## Goal

Rename the agent definition file from `agent.yaml` to `metadata.yaml` for consistency with skill metadata files. Both skills and agents will use `metadata.yaml` as their per-directory config file.

---

## Current State Analysis

### Constants

| Location | Reference | Line |
|----------|-----------|------|
| `src/cli/consts.ts` | `STANDARD_FILES.AGENT_YAML: "agent.yaml"` | :46 |
| `src/cli/consts.ts` | `SCHEMA_PATHS.agent` (URL contains `agent.schema.json`) | :74 |

**Naming collision risk:** `STANDARD_FILES.METADATA_YAML` already exists (value: `"metadata.yaml"`, line :42) and is used in 30+ files for **skill** metadata. The constant `AGENT_YAML` must be renamed to `AGENT_METADATA_YAML` (not `METADATA_YAML`), and its value changed from `"agent.yaml"` to `"metadata.yaml"`.

### Production Code (CLI repo)

| File | What references `agent.yaml` | Lines |
|------|------------------------------|-------|
| `src/cli/consts.ts` | `STANDARD_FILES.AGENT_YAML` constant definition | :46 |
| `src/cli/lib/loading/loader.ts` | `glob("**/agent.yaml", ...)` hardcoded strings (2x), warning messages (2x) | :33, :54, :72, :94 |
| `src/cli/lib/loading/source-loader.ts` | `glob(**/${STANDARD_FILES.AGENT_YAML}, ...)`, JSDoc comments (3x) | :235, :343, :412, :430 |
| `src/cli/lib/schema-validator.ts` | `STANDARD_FILES.AGENT_YAML` in VALIDATION_TARGETS pattern | :85 |
| `src/cli/lib/resolver.ts` | Error message: `"Check that src/agents/${agentName}/agent.yaml exists"` | :174 |
| `src/cli/lib/schemas.ts` | JSDoc comment on `agentYamlGenerationSchema` | :853 |
| `src/cli/commands/new/agent.tsx` | `buildAgentPrompt()` instructions mention "Create agent.yaml" | :125, :130 |
| `src/cli/types/agents.ts` | JSDoc comment: `"Agent configuration from agent.yaml"` | :84 |
| `src/cli/components/wizard/step-agents.tsx` | Comment: "Group custom agents by explicit domain (from agent.yaml)" | :127 |

### 18 Actual agent.yaml Files (to be git-renamed)

All in `src/agents/` -- each has a `$schema` comment pointing to `agent.schema.json`:

```
src/agents/developer/web-developer/agent.yaml
src/agents/developer/api-developer/agent.yaml
src/agents/developer/cli-developer/agent.yaml
src/agents/developer/web-architecture/agent.yaml
src/agents/meta/agent-summoner/agent.yaml
src/agents/meta/skill-summoner/agent.yaml
src/agents/meta/documentor/agent.yaml
src/agents/planning/web-pm/agent.yaml
src/agents/researcher/web-researcher/agent.yaml
src/agents/researcher/api-researcher/agent.yaml
src/agents/migration/cli-migrator/agent.yaml
src/agents/tester/web-tester/agent.yaml
src/agents/tester/cli-tester/agent.yaml
src/agents/reviewer/web-reviewer/agent.yaml
src/agents/reviewer/cli-reviewer/agent.yaml
src/agents/reviewer/api-reviewer/agent.yaml
src/agents/pattern/pattern-scout/agent.yaml
src/agents/pattern/web-pattern-critique/agent.yaml
```

### JSON Schema File

| File | What | Note |
|------|------|------|
| `src/schemas/agent.schema.json` | JSON schema file | Keep filename as `agent.schema.json` -- this is the schema *for* agents, not the filename being validated. The `$id` and `description` mention "agent.yaml" and need updating. |
| `scripts/generate-json-schemas.ts` | Generator entry description | :94 says "Schema for agent.yaml files" |

### Test Files

| File | What references `agent.yaml` | Lines |
|------|------------------------------|-------|
| `src/cli/lib/__tests__/helpers.ts` | `writeTestAgent()` uses `STANDARD_FILES.AGENT_YAML` | :578 |
| `src/cli/lib/__tests__/helpers.test.ts` | Asserts `fileExists(\`${agentDir}/agent.yaml\`)` | :85 |
| `src/cli/lib/__tests__/commands/eject.test.ts` | Creates `agent.yaml` file in test setup | :241 |
| `src/cli/lib/__tests__/commands/new/agent.test.ts` | Asserts output contains `"agent.yaml"` (2x) | :26, :31 |
| `src/cli/lib/__tests__/user-journeys/install-compile.test.ts` | Creates `agent.yaml` in test agent setup | :68 |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | Writes `"agent.yaml"` string in fixture creation | :674 |
| `src/cli/lib/schema-validator.test.ts` | References `"agent.yaml"` in test descriptions and file creation (15+ lines) | :49-555 |
| `src/cli/lib/loading/loader.test.ts` | References `"agent.yaml"` in mock data and test descriptions (20+ lines) | :344-468 |
| `src/cli/lib/stacks/stack-plugin-compiler.test.ts` | Creates `"agent.yaml"` in test setup, JSDoc comment | :49, :64 |

### Agent Summoner (meta-agent content files)

These are markdown files that instruct the agent-summoner how to create new agents. They reference `agent.yaml` as the expected filename:

| File | Lines with `agent.yaml` |
|------|------------------------|
| `src/agents/meta/agent-summoner/critical-reminders.md` | :11 |
| `src/agents/meta/agent-summoner/critical-requirements.md` | :11 |
| `src/agents/meta/agent-summoner/output-format.md` | :13, :16 |
| `src/agents/meta/agent-summoner/examples.md` | :92, :95-96 |
| `src/agents/meta/agent-summoner/workflow.md` | :253, :429, :1255, :1268, :1452 |

### Documentation Files

| File | Approximate line count |
|------|----------------------|
| `docs/reference/architecture.md` | 2 lines |
| `docs/reference/data-models.md` | 2 lines (section header + schema ref) |
| `docs/standards/content/claude-architecture-bible.md` | 10+ lines |
| `docs/standards/content/agent-compliance-bible.md` | 8 lines |
| `docs/features/proposed/custom-extensibility-design.md` | 12+ lines |
| `.ai-docs/utilities.md` | 1 line (STANDARD_FILES table) |
| `.ai-docs/type-system.md` | 1 line (schema table) |
| `.ai-docs/features/compilation-pipeline.md` | 1 line |
| `changelogs/0.47.0.md` | 1 line |
| `changelogs/0.24.1.md` | 1 line |
| `changelogs/0.24.3.md` | 1 line |
| `todo/TODO-deferred.md` | 1 line (D-22 description) |
| `todo/TODO-completed.md` | 1 line (D-49 description) |

### Skills Repo (`/home/vince/dev/skills`)

**No references to `agent.yaml` found.** The skills repo has no `src/agents/` directory and no files referencing `agent.yaml`. This is a **CLI-repo-only change**.

---

## Naming Decisions

### Constant Rename

```
BEFORE: STANDARD_FILES.AGENT_YAML = "agent.yaml"
AFTER:  STANDARD_FILES.AGENT_METADATA_YAML = "metadata.yaml"
```

Rationale: Cannot use `METADATA_YAML` because it already exists for skill metadata. The new name `AGENT_METADATA_YAML` clearly indicates "the metadata.yaml file for agents" while avoiding the collision. The value becomes `"metadata.yaml"` (same as `STANDARD_FILES.METADATA_YAML`).

### Type/Schema Names

Keep existing names unchanged:
- `AgentYamlConfig` -- the type name describes what it parses, not the filename
- `agentYamlConfigSchema` -- same reasoning
- `agentYamlGenerationSchema` -- same reasoning
- `agent.schema.json` -- this is the JSON schema *for* agent definitions, not the file it validates

Update only descriptions/comments that mention "agent.yaml" as a filename.

### JSON Schema File

Keep `src/schemas/agent.schema.json` filename. Update only:
- `description` field: "Schema for agent metadata.yaml files defining Claude Code agents."
- `$id` stays the same

### $schema URL in renamed files

Each of the 18 renamed files has:
```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/agents-inc/cli/main/src/schemas/agent.schema.json
```
This URL remains valid because the schema JSON file is not being renamed.

---

## Fallback Period: NOT Needed

**Rationale:** This project is pre-1.0. Per CLAUDE.md: "NEVER add backward-compatibility shims, migration code, or legacy fallbacks. The project is pre-1.0 -- backward compatibility is not a concern. Remove old code cleanly instead of maintaining two paths."

Consumer projects that have ejected agent definitions (via `agentsinc eject agent-partials`) will need to manually rename their `agent.yaml` files to `metadata.yaml`. This can be documented in the changelog.

---

## Ordering: CLI Repo Only

The skills repo has zero references to `agent.yaml`. No cross-repo coordination is needed. All changes are within the CLI repo.

---

## Step-by-Step Implementation Plan

### Phase 1: Constants and Core Code

**Step 1: Rename the constant in `consts.ts`**
- `src/cli/consts.ts:46` -- Change `AGENT_YAML: "agent.yaml"` to `AGENT_METADATA_YAML: "metadata.yaml"`

**Step 2: Update all `STANDARD_FILES.AGENT_YAML` references**
- `src/cli/lib/schema-validator.ts:85` -- Change to `STANDARD_FILES.AGENT_METADATA_YAML`
- `src/cli/lib/loading/source-loader.ts:430` -- Change to `STANDARD_FILES.AGENT_METADATA_YAML`
- `src/cli/lib/__tests__/helpers.ts:578` -- Change to `STANDARD_FILES.AGENT_METADATA_YAML`

**Step 3: Fix hardcoded `"agent.yaml"` strings in loader.ts**
- `src/cli/lib/loading/loader.ts:33` -- Change `glob("**/agent.yaml", ...)` to use `STANDARD_FILES.AGENT_METADATA_YAML`
- `src/cli/lib/loading/loader.ts:54` -- Update warning message from "agent.yaml" to "metadata.yaml"
- `src/cli/lib/loading/loader.ts:72` -- Change `glob("**/agent.yaml", ...)` to use `STANDARD_FILES.AGENT_METADATA_YAML`
- `src/cli/lib/loading/loader.ts:94` -- Update warning message

**Step 4: Update error/log messages**
- `src/cli/lib/resolver.ts:174` -- Update error message to say `metadata.yaml` instead of `agent.yaml`

**Step 5: Update command code**
- `src/cli/commands/new/agent.tsx:125` -- Change "Create agent.yaml" to "Create metadata.yaml" in `buildAgentPrompt()`
- `src/cli/commands/new/agent.tsx:130` -- Change "agent.yaml configuration" to "metadata.yaml configuration"

**Step 6: Update JSDoc/comments in production code**
- `src/cli/types/agents.ts:84` -- Update JSDoc
- `src/cli/lib/schemas.ts:853` -- Update JSDoc
- `src/cli/components/wizard/step-agents.tsx:127` -- Update comment
- `src/cli/lib/loading/source-loader.ts:235,343,412` -- Update comments

### Phase 2: Rename 18 Actual Files (git mv)

```bash
for dir in src/agents/*/*; do
  if [ -f "$dir/agent.yaml" ]; then
    git mv "$dir/agent.yaml" "$dir/metadata.yaml"
  fi
done
```

The `$schema` URL in each file points to `agent.schema.json` (the JSON schema file, which is NOT being renamed), so no content changes needed in the renamed files.

### Phase 3: JSON Schema Updates

- `src/schemas/agent.schema.json:5` -- Update description to mention "metadata.yaml"
- `scripts/generate-json-schemas.ts:94` -- Update description string

### Phase 4: Test File Updates

**Step 1: Test helpers and fixtures**
- `src/cli/lib/__tests__/helpers.test.ts:85` -- Change assertion to `"metadata.yaml"`
- `src/cli/lib/__tests__/commands/eject.test.ts:241` -- Change `"agent.yaml"` to `"metadata.yaml"`
- `src/cli/lib/__tests__/commands/new/agent.test.ts:26,31` -- Change assertions to `"metadata.yaml"`
- `src/cli/lib/__tests__/user-journeys/install-compile.test.ts:68` -- Change to `"metadata.yaml"`
- `src/cli/lib/__tests__/fixtures/create-test-source.ts:674` -- Change to `"metadata.yaml"`

**Step 2: Schema validator tests**
- `src/cli/lib/schema-validator.test.ts` -- Update all `"agent.yaml"` references (~15 locations across lines :49-555)

**Step 3: Loader tests**
- `src/cli/lib/loading/loader.test.ts` -- Update all `"agent.yaml"` references (~20 locations across lines :344-468)

**Step 4: Stack plugin compiler tests**
- `src/cli/lib/stacks/stack-plugin-compiler.test.ts:49,64` -- Update comment and file path

### Phase 5: Agent Summoner Content Updates

These files instruct the AI how to create agents -- the filename must be correct:

- `src/agents/meta/agent-summoner/critical-reminders.md` -- Replace `agent.yaml` with `metadata.yaml`
- `src/agents/meta/agent-summoner/critical-requirements.md` -- Replace `agent.yaml` with `metadata.yaml`
- `src/agents/meta/agent-summoner/output-format.md` -- Replace `agent.yaml` with `metadata.yaml`
- `src/agents/meta/agent-summoner/examples.md` -- Replace `agent.yaml` with `metadata.yaml`
- `src/agents/meta/agent-summoner/workflow.md` -- Replace `agent.yaml` with `metadata.yaml`

### Phase 6: Documentation Updates

- `docs/reference/architecture.md` -- Replace `agent.yaml` with `metadata.yaml`
- `docs/reference/data-models.md` -- Replace section title and references
- `docs/standards/content/claude-architecture-bible.md` -- Replace all references
- `docs/standards/content/agent-compliance-bible.md` -- Replace all references
- `docs/features/proposed/custom-extensibility-design.md` -- Replace all references
- `.ai-docs/utilities.md` -- Update STANDARD_FILES table
- `.ai-docs/type-system.md` -- Update schema table
- `.ai-docs/features/compilation-pipeline.md` -- Replace reference
- `todo/TODO-deferred.md` -- Update D-22 description
- `todo/TODO-completed.md` -- Update D-49 description

Changelogs (`changelogs/0.24.1.md`, `0.24.3.md`, `0.47.0.md`) should **NOT** be updated -- they describe historical changes and should remain accurate to what happened at that time.

### Phase 7: Changelog Entry

Add a new changelog entry documenting:
- All `agent.yaml` files renamed to `metadata.yaml` for consistency with skill metadata files
- Consumer projects with ejected agents need to rename `agent.yaml` to `metadata.yaml`
- The `STANDARD_FILES.AGENT_YAML` constant renamed to `STANDARD_FILES.AGENT_METADATA_YAML`

---

## Test Plan

1. **Run full test suite:** `npm test` (2309+ tests) -- all must pass
2. **Type check:** `tsc --noEmit` -- zero errors
3. **Validate schemas:** `agentsinc validate` from the CLI repo root -- all agent definitions should validate
4. **Manual verify:** Check that `agentsinc compile` works correctly with the renamed files
5. **Grep audit:** After all changes, run `grep -r "agent\.yaml" src/` and confirm:
   - Zero matches in production code and test code
   - Only matches in changelogs (historical, intentionally kept)
   - Only matches in the `$schema` URL (which references `agent.schema.json`, not the filename)

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Consumer projects with ejected agents break | Medium | Document in changelog. Pre-1.0: no backward compat. |
| Missed reference causes runtime error | Medium | Grep audit after implementation. Full test suite catches most issues. |
| `STANDARD_FILES.METADATA_YAML` vs `STANDARD_FILES.AGENT_METADATA_YAML` confusion | Low | The constant names are different; the values are the same. This is intentional -- both agents and skills use `metadata.yaml` as their metadata filename, but in different directories. |
| `git mv` loses file history | Low | `git mv` preserves rename tracking. Review the diff to confirm. |
| Schema URL breaks | None | `agent.schema.json` filename is NOT being renamed. URLs remain valid. |
| Skills repo breaks | None | Skills repo has zero references to `agent.yaml`. |

---

## Files Changed Summary

**CLI repo only. No skills repo changes needed.**

| Category | File Count | Description |
|----------|-----------|-------------|
| Constants/core | 6 files | consts.ts, loader.ts, source-loader.ts, resolver.ts, schemas.ts, schema-validator.ts |
| Commands | 1 file | new/agent.tsx |
| Types/comments | 2 files | agents.ts, step-agents.tsx |
| Renamed YAML files | 18 files | All `agent.yaml` -> `metadata.yaml` in `src/agents/` |
| JSON schema | 1 file | agent.schema.json (description only) |
| Schema generator | 1 file | generate-json-schemas.ts |
| Test files | 7 files | helpers, helpers.test, eject.test, new/agent.test, install-compile.test, create-test-source, schema-validator.test, loader.test, stack-plugin-compiler.test |
| Agent summoner content | 5 files | critical-reminders, critical-requirements, output-format, examples, workflow |
| Documentation | 8 files | architecture, data-models, claude-architecture-bible, agent-compliance-bible, custom-extensibility, .ai-docs (3 files) |
| Task tracking | 2 files | TODO-deferred, TODO-completed |
| Changelog | 1 file | New entry |
| **Total** | **~52 files** | |
