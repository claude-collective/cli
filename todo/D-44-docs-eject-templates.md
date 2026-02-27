# D-44: Update Documentation for `eject templates` Type

**Status:** Refined
**Depends on:** D-43 (completed in 0.46.0)
**Complexity:** Small (documentation-only changes across ~6 files)

## Implementation Overview

Documentation-only change across 4 files, 6 edits. Updates `README.md` eject examples (`--templates` flag to `eject templates` command), rewrites the eject section in `docs/reference/commands.md` with a proper 4-type table and output locations, updates the `.ai-docs/commands.md` summary line, and fixes 3 places in `todo/TODO-testing.md` where `templates` is incorrectly listed as an invalid eject type. The Notion page needs a separate manual update (documented in the plan).

## Context

D-43 (release 0.46.0) promoted `templates` from a `--templates` flag on `eject agent-partials` to a first-class eject type. The implementation is complete and tested. The current eject types are:

```
agent-partials | templates | skills | all
```

Source of truth: `src/cli/commands/eject.ts:34` defines `EJECT_TYPES`.

This task updates all documentation to reflect the change.

---

## Open Questions

1. **Notion page** -- The Notion page is external and cannot be updated by the CLI codebase. It requires manual updating by a human. The refinement doc notes exactly what to change.
2. **No CLI docs site** -- All documentation lives in markdown files in this repo. No external docs site to update.

---

## Current State Analysis

### Files with OUTDATED eject references

| File                         | Line(s) | What's Wrong                                                                          | Status          |
| ---------------------------- | ------- | ------------------------------------------------------------------------------------- | --------------- |
| `README.md`                  | 170     | Shows `eject agent-partials --templates` (old flag syntax)                            | OUTDATED        |
| `docs/reference/commands.md` | 94-111  | Missing `templates` type entirely; only lists `agent-partials`, `skills`, `all`       | OUTDATED        |
| `.ai-docs/commands.md`       | 28      | Summary says "Eject to local mode" -- vague, should mention templates                 | OUTDATED        |
| `todo/TODO-testing.md`       | 46      | Lists `templates` as an invalid eject type that should be rejected                    | OUTDATED        |
| `todo/TODO-testing.md`       | 491     | Manual test: `agentsinc eject templates` expected to error (it should succeed now)    | OUTDATED        |
| `todo/TODO-testing.md`       | 654     | Smoke test row 11: says `eject templates` should error exit                           | OUTDATED        |
| `CHANGELOG.md`               | 79-82   | Mentions `eject --templates` (historical, but the 0.46.0 entry already corrects this) | OK (historical) |

### Files with CORRECT eject references

| File                          | Notes                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `src/cli/commands/eject.ts`   | Source of truth. Correct: `EJECT_TYPES = ["agent-partials", "templates", "skills", "all"]` |
| `changelogs/0.46.0.md`        | Correctly documents D-43 change                                                            |
| `todo/TODO-completed.md:33`   | Correctly notes D-43 is done                                                               |
| `CHANGELOG.md` (0.46.0 entry) | Correctly mentions "Promote `eject templates` to first-class type"                         |
| `todo/TODO.md:315-325`        | D-44 task description is correct                                                           |

### Files that mention eject but DON'T need changes

| File                                                    | Why No Change Needed                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `changelogs/0.42.0.md`                                  | Historical record of when `--templates` flag was added; correct for that version  |
| `changelogs/0.44.0.md`                                  | Historical record; correct for that version                                       |
| `changelogs/0.45.0.md`                                  | References eject preserving templates; no flag syntax mentioned                   |
| `docs/research/e2e-audit-accuracy.md`                   | Research doc; mentions eject exists but no type details                           |
| `docs/research/e2e-testing-strategy.md`                 | Research doc; generic eject mention                                               |
| `.ai-docs/architecture-overview.md`                     | Just lists `eject.ts` in directory structure; correct                             |
| `.ai-docs/test-infrastructure.md`                       | Just lists `eject.test.ts` in test directory; correct                             |
| `docs/reference/architecture.md`                        | Lists eject in command table without types; correct                               |
| `todo/TODO-deferred.md` (D-12, D-13)                    | Deferred eject features; references `agent-partials` and `skills` types correctly |
| `docs/features/proposed/custom-extensibility-design.md` | No eject type references                                                          |

---

## Changes Needed

### 1. `README.md` -- Lines 163-174 (Customization section)

**Current (OUTDATED):**

````markdown
**Eject** for deeper control:

```bash
# Eject agent partials (intro, workflow, critical requirements, etc.)
npx @agents-inc/cli eject agent-partials

# Eject the Liquid templates that control how agents are compiled
npx @agents-inc/cli eject agent-partials --templates

# Eject skills for local editing
npx @agents-inc/cli eject skills
```
````

````

**Replace with:**
```markdown
**Eject** for deeper control:

```bash
# Eject agent partials (intro, workflow, critical requirements, etc.)
npx @agents-inc/cli eject agent-partials

# Eject the Liquid templates that control how agents are compiled
npx @agents-inc/cli eject templates

# Eject skills for local editing
npx @agents-inc/cli eject skills

# Eject everything
npx @agents-inc/cli eject all
````

````

**Notes:** Changed `eject agent-partials --templates` to `eject templates`. Added `eject all` example since it is a valid type. Updated the comment on the templates line (kept the same description).

### 2. `docs/reference/commands.md` -- Lines 94-111 (Eject section)

**Current (OUTDATED):**
```markdown
## `agentsinc eject`

Export bundled content for customization.

```bash
agentsinc eject agent-partials         # Export agent partial templates
agentsinc eject skills                 # Export skills from plugin
agentsinc eject all                    # Export everything
agentsinc eject agent-partials -o ./custom  # Custom output dir
agentsinc eject agent-partials -f           # Force overwrite
````

**Output locations:**

- `agent-partials` -> `.claude/agents/_partials/`
- `skills` -> `.claude/skills/`

````

**Replace with:**
```markdown
## `agentsinc eject`

Export bundled content for customization.

```bash
agentsinc eject agent-partials         # Export agent partials (intro, workflow, etc.)
agentsinc eject templates              # Export Liquid templates for agent compilation
agentsinc eject skills                 # Export skills from source
agentsinc eject all                    # Export everything
agentsinc eject skills -o ./custom     # Custom output dir
agentsinc eject all -f                 # Force overwrite
````

**Eject types:**

| Type             | What it ejects                                     | Output location                  |
| ---------------- | -------------------------------------------------- | -------------------------------- |
| `agent-partials` | Agent intro, workflow, critical requirements, etc. | `.claude-src/agents/`            |
| `templates`      | Liquid templates that control agent compilation    | `.claude-src/agents/_templates/` |
| `skills`         | All skills from configured source                  | `.claude/skills/`                |
| `all`            | Agent partials + templates + skills                | All of the above                 |

```

**Notes:** Added `templates` to examples. Added a proper type table showing all 4 types with output locations. Fixed output path for agent-partials (was `.claude/agents/_partials/`, should be `.claude-src/agents/`).

### 3. `.ai-docs/commands.md` -- Line 28

**Current:**
```

| `eject` | `src/cli/commands/eject.ts` | ts | Eject to local mode |

```

**Replace with:**
```

| `eject` | `src/cli/commands/eject.ts` | ts | Eject skills, agent partials, or templates |

```

**Notes:** Summary now mentions all three eject categories. Matches the command's own `static summary` in `eject.ts:38`.

### 4. `todo/TODO-testing.md` -- Line 46 (coverage matrix)

**Current (OUTDATED):**
```

| | `agentsinc eject` — invalid types | `templates`, `agents`, `config`, no arg, unknown value all rejected with error exit | ✅ | | | |

```

**Replace with:**
```

| | `agentsinc eject` — invalid types | `agents`, `config`, no arg, unknown value all rejected with error exit | ✅ | | | |
| | `agentsinc eject templates` | Copies Liquid templates to `.claude-src/agents/_templates/` | ✅ | | | |

````

**Notes:** Removed `templates` from the invalid types list. Added a new row for `eject templates` as a valid command.

### 5. `todo/TODO-testing.md` -- Lines 488-496 (manual test section)

**Current (OUTDATED):**
```markdown
### 8. Eject — Invalid Types Rejected

```bash
agentsinc eject templates    # Expected: error exit (invalid type)
agentsinc eject agents       # Expected: error exit (invalid type)
agentsinc eject config       # Expected: error exit (invalid type)
agentsinc eject              # Expected: error exit (type required)
agentsinc eject bad-value    # Expected: error exit (unknown type)
````

````

**Replace with:**
```markdown
### 8. Eject — Invalid Types Rejected

```bash
agentsinc eject agents       # Expected: error exit (invalid type)
agentsinc eject config       # Expected: error exit (invalid type)
agentsinc eject              # Expected: error exit (type required)
agentsinc eject bad-value    # Expected: error exit (unknown type)
````

### 8b. Eject Templates

```bash
agentsinc eject templates    # Expected: copies templates to .claude-src/agents/_templates/
```

```

**Notes:** Moved `eject templates` from the "rejected" section to its own valid test case.

### 6. `todo/TODO-testing.md` -- Line 654 (smoke test table row 11)

**Current (OUTDATED):**
```

| 11 | `eject templates` | Error exit (invalid type) |

```

**Replace with:**
```

| 11 | `eject templates` | Templates copied to `.claude-src/agents/_templates/` |

```

**Notes:** `eject templates` is now a valid command, not an error case.

---

## Eject Types Reference

For any documentation that needs the complete list, the canonical eject types are:

| Type | Description | Source |
| --- | --- | --- |
| `agent-partials` | Agent intro, workflow, critical requirements, examples, etc. | Bundled in CLI |
| `templates` | Liquid templates that control how agents are compiled | Bundled in CLI |
| `skills` | All skills from configured source (public marketplace by default) | Configured source |
| `all` | Ejects agent-partials + templates + skills | Both |

Key flags: `--force` / `-f`, `--output` / `-o`, `--refresh`, `--source` / `-s`, `--dry-run`

---

## Step-by-Step Implementation Plan

1. **`README.md`** -- Update the eject code block in the Customization section (lines 163-174)
2. **`docs/reference/commands.md`** -- Rewrite the eject section (lines 94-111) with all 4 types and a table
3. **`.ai-docs/commands.md`** -- Update eject summary text on line 28
4. **`todo/TODO-testing.md`** -- Three separate edits:
   - Line 46: Fix coverage matrix row (remove `templates` from invalid types, add new row)
   - Lines 488-496: Fix manual test section (move `templates` from rejected to valid)
   - Line 654: Fix smoke test row 11 (change expected result)

---

## Notion Page Note

The Notion page is external to this repo and must be updated manually. Changes needed:

- Update the eject command documentation to list **4 types**: `agent-partials`, `templates`, `skills`, `all`
- Remove any reference to `--templates` or `-t` flag
- Show `agentsinc eject templates` as the correct syntax for ejecting Liquid templates
- Update any eject type table or list to include `templates` as its own row

---

## Files Changed Summary

| File | Type of Change |
| --- | --- |
| `README.md` | Fix eject example: `--templates` flag to `eject templates` command |
| `docs/reference/commands.md` | Add `templates` type to eject section with output location table |
| `.ai-docs/commands.md` | Update eject command summary text |
| `todo/TODO-testing.md` | Fix 3 places where `templates` is listed as invalid eject type |

**Total: 4 files, 6 edits. All documentation-only.**
```
