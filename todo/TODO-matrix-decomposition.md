# Matrix Decomposition — Phased Implementation Plan

**Design doc:** [docs/features/proposed/matrix-decomposition-design.md](../docs/features/proposed/matrix-decomposition-design.md)
**Goal:** Split `skills-matrix.yaml` into `skill-categories.yaml` + `skill-rules.yaml`, move aliases and per-skill relationship fields out of metadata into `skill-rules.yaml`.

**Open item:** `ProjectSourceConfig.matrixFile` (in `config.ts`) defaults to `SKILLS_MATRIX_PATH`. After decomposition, this needs to be split into `categoriesFile` + `rulesFile`, or removed. Address in Phase 4.

---

## Phase 1: Create `skill-categories.yaml` and loader

**What:** Extract the `categories` section from `config/skills-matrix.yaml` into a standalone `config/skill-categories.yaml` file with its own loader and schema.

**Steps:**

1. Create `config/skill-categories.yaml` — copy the 38 category definitions verbatim from `skills-matrix.yaml`. Add `version: "1.0.0"` top-level field.
2. Add `SKILL_CATEGORIES_YAML_PATH = "config/skill-categories.yaml"` to `consts.ts` (`STANDARD_FILES`).
3. Add `skillCategoriesFileSchema` to `schemas.ts` — top-level object with `version` and `categories` map using existing `categoryDefinitionSchema`.
4. Add `loadSkillCategories(path)` function to `matrix-loader.ts` — loads and validates `skill-categories.yaml`.
5. Update `loadAndMergeFromBasePath()` in `source-loader.ts`:
   - Try loading `skill-categories.yaml` first (CLI + source).
   - Fall back to reading categories from `skills-matrix.yaml` if `skill-categories.yaml` doesn't exist.
   - Merge: source categories win on same key (unchanged behavior).
6. Tests: unit tests for `loadSkillCategories()`, integration test for fallback behavior.

**Verification:** All existing tests pass. Wizard renders identically.

---

## Phase 2: Create `skill-rules.yaml` with aggregate rules and aliases

**What:** Extract the `relationships` section and `skillAliases` section from `skills-matrix.yaml` into `config/skill-rules.yaml`. All relationship rules use aliases for readability. Add strict enums to the schema.

**Constraint:** Aliases are internal to the loading/merge layer. No alias values are exposed to consumers. Outside the matrix loading code, `cliName` (later `displayName`) from skill metadata is the user-facing display name everywhere (UI, commands, search). The `displayNameToId` map on `MergedSkillsMatrix` is used only for resolving user input (e.g., in the `info` command) to canonical IDs.

**Steps:**

1. Create `config/skill-rules.yaml` with the `relationships` section from `skills-matrix.yaml`. Keep aliases (e.g., `react`) in all rules for readability. Add `version: "1.0.0"`. Add an `aliases` section (moved from `skillAliases` in `skills-matrix.yaml`) mapping short names to canonical IDs (e.g., `react: web-framework-react`).
2. Add `SKILL_RULES_YAML_PATH = "config/skill-rules.yaml"` to `consts.ts`.
3. Add `skillRulesFileSchema` to `schemas.ts` — with strict enums for both skill IDs and aliases. All relationship rules reference aliases only; aliases are validated against the skill ID enum.
4. Add `loadSkillRules(path)` function to `matrix-loader.ts`.
5. Update `loadAndMergeFromBasePath()` in `source-loader.ts`:
   - Try loading `skill-rules.yaml` first (CLI + source).
   - Fall back to reading relationships from `skills-matrix.yaml` if `skill-rules.yaml` doesn't exist.
   - Merge: aggregate rules concatenated, same as today.
6. At load time, resolve all aliases in rules to canonical IDs before merging into `MergedSkillsMatrix`. Build `displayNameToId` from the `aliases` section.
7. Remove `skillAliases` from `skills-matrix.yaml` (now lives in `skill-rules.yaml` as `aliases`).
8. Tests: unit tests for `loadSkillRules()`, alias resolution, schema validation of strict enums.

**Verification:** All existing tests pass. Skill conflicts/recommends/etc. behave identically.

---

## Phase 3: Migrate per-skill relationship fields to `skill-rules.yaml`

**What:** Move `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` from individual skill `metadata.yaml` files into the `per-skill` section of `skill-rules.yaml`. Skill metadata becomes pure identity.

**Steps:**

1. Scan all skill `metadata.yaml` files (across all sources) and extract relationship fields.
2. Add a `per-skill` section to `config/skill-rules.yaml` keyed by alias, containing all extracted relationships. Use aliases throughout the YAML (validated against the alias enum).
3. Remove `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` from all skill `metadata.yaml` files (~90 files in skills repo).
4. Remove these fields from `rawMetadataSchema` and `localRawMetadataSchema` in `schemas.ts`.
5. Update `extractAllSkills()` — no longer extracts relationship fields from metadata.
6. Update `local-skill-loader.ts` / `discoverLocalSkills()` — it also extracts all 5 relationship fields from local skill metadata and needs the same removal.
7. Update `mergeMatrixWithSkills()` — populate per-skill relationships on `ResolvedSkill` from the `per-skill` section of loaded skill rules.
8. Add `perSkillRulesSchema` to `schemas.ts`.
9. Add `PerSkillRules` type to `types/matrix.ts`.
10. Tests: verify per-skill rules load correctly, verify skills without rules still compile.

**Cross-repo:** This phase modifies the skills repo (`/home/vince/dev/skills`) to remove fields from metadata files. Skills repo changes come FIRST, then CLI repo changes.

**Note:** After this phase, local skills (in `.claude/skills/`) cannot declare relationship fields in their `metadata.yaml`. If a local skill needs relationship rules, they go in the source's `skill-rules.yaml`.

**Verification:** All tests pass. Wizard conflict/recommendation behavior unchanged.

---

## Phase 4: Delete `skills-matrix.yaml`

**What:** Remove the original monolithic file now that all data lives in `skill-categories.yaml` and `skill-rules.yaml`.

**Steps:**

1. Delete `config/skills-matrix.yaml`.
2. Remove `SKILLS_MATRIX_PATH` and `STANDARD_FILES.SKILLS_MATRIX_YAML` from `consts.ts`.
3. Remove `skillsMatrixConfigSchema` from `schemas.ts`.
4. Remove fallback loading logic from `source-loader.ts` (the `skills-matrix.yaml` fallback paths added in Phases 1-2).
5. Remove or refactor `loadSkillsMatrix()` — fully replaced by `loadSkillCategories()` + `loadSkillRules()`.
6. Split `SkillsMatrixConfig` type into `CategoriesConfig` + `SkillRulesConfig` (or remove entirely).
7. Delete `src/schemas/skills-matrix.schema.json`.
8. Update `ProjectSourceConfig.matrixFile` in `config.ts` — split into `categoriesFile` + `rulesFile`, or remove entirely (it defaults to `SKILLS_MATRIX_PATH` which no longer exists).
9. Tests: remove/update tests that reference `skills-matrix.yaml` directly.

**Verification:** All tests pass. No references to `skills-matrix.yaml` remain in codebase.

---

## Phase 5: Auto-synthesis for unknown categories (safety net)

**What:** When a custom/marketplace skill references a category not defined in any `skill-categories.yaml`, auto-synthesize a `CategoryDefinition` so the skill still appears in the wizard. This is a **fallback** for skills whose category isn't covered by any config file — the preferred path is for skill authors to maintain proper `skill-categories.yaml` entries (see Phase 6), which give correct display names, ordering, and domain assignment. Auto-synthesis gives a functional but suboptimal experience (generic display name, placed at end of list with `order: 999`).

**Steps:**

1. Add `synthesizeCategory(categoryPath, skillDomain?)` utility to `matrix-loader.ts`.
   - Derive domain from skill's `domain` field (D-49) or category prefix.
   - Defaults: `exclusive: true`, `required: false`, `order: 999` (placed after all required categories), `custom: true`.
2. Add post-merge step in `mergeMatrixWithSkills()` — scan all resolved skills, synthesize missing categories.
3. Update `matrix-health-check.ts` — `skill-unknown-category` becomes informational when auto-synthesis is active.
4. Log `verbose()` for each synthesized category.
5. Tests: verify custom marketplace skills with novel categories appear in wizard.

**Verification:** All tests pass. Custom marketplace skills with unknown categories are visible.

---

## Phase 6: Command integration — `new skill` updates config files

**What:** Update the `new skill` command to create/update `skill-categories.yaml` and `skill-rules.yaml` when scaffolding a new skill. Since `new marketplace` delegates to `new skill`, marketplace scaffolding gets this for free.

**Steps:**

1. When `new skill` runs, check if `config/skill-categories.yaml` exists in the target directory.
   - If missing, create it with `version: "1.0.0"` and the new skill's category entry.
   - If present, check if the skill's category already exists. If not, append the category entry.
2. When `new skill` runs, check if `config/skill-rules.yaml` exists in the target directory.
   - If missing, create it with `version: "1.0.0"` and an `aliases` section containing the new skill's alias.
   - If present, check if an alias for the new skill already exists. If not, append it.
3. Update `new marketplace` — no direct changes needed since it delegates to `new skill`, but verify the scaffolded marketplace has both config files after creation.
4. Tests: verify `new skill` creates/updates both config files, verify `new marketplace` produces a complete scaffold with both files.

**Note:** Keeping these files in sync is preferred but not required — auto-synthesis (Phase 5) handles the gap when files are missing or incomplete. Proper config files give the best CLI experience (correct display names, ordering, domain assignment).

**Verification:** All tests pass. `new skill` and `new marketplace` produce scaffolds with `skill-categories.yaml` and `skill-rules.yaml`.

---

## Phase 7: Deprecate `categoryExclusive` on skill metadata

**What:** Remove `categoryExclusive` from skill metadata. It's a category-level property (`exclusive` in `skill-categories.yaml`), not a skill property.

**Steps:**

1. Audit all skills — verify `categoryExclusive` matches `exclusive` in `skill-categories.yaml` for every skill.
2. Remove `categoryExclusive` from all skill `metadata.yaml` files (~90 files in skills repo).
3. Remove `categoryExclusive` from `rawMetadataSchema`, `localRawMetadataSchema`, `ExtractedSkillMetadata`, `ResolvedSkill`.
4. Update `matrix-resolver.ts` and wizard logic that reads `skill.categoryExclusive` to read `category.exclusive` from merged categories instead.
5. Update `ValidationError` type if it references `categoryExclusive`.
6. Tests: verify exclusive/non-exclusive behavior unchanged.

**Cross-repo:** This phase modifies the skills repo. Skills repo changes come FIRST, then CLI repo changes.

**Verification:** All tests pass. Wizard radio/checkbox behavior unchanged.

---

## Phase 8: Rename `cliName` to `displayName` (deferred)

**What:** Pure rename across all skill metadata files. Deferred until all structural changes are stable.

**Steps:**

1. Rename `cliName` to `displayName` in all skill `metadata.yaml` files (~90 files in skills repo).
2. Update `rawMetadataSchema` and `localRawMetadataSchema` in `schemas.ts`.
3. Update `METADATA_KEYS.CLI_NAME` → `METADATA_KEYS.DISPLAY_NAME` in `metadata-keys.ts`.
4. Update all code referencing `cliName` to use `displayName`.
5. Update `metadata.schema.json`.
6. Tests: verify display names render correctly.

**Cross-repo:** This phase modifies the skills repo. Skills repo changes come FIRST, then CLI repo changes.

**Verification:** All tests pass. No references to `cliName` remain.

---

## Dependencies

```
Phase 1 (skill-categories.yaml)
  └─> Phase 2 (skill-rules.yaml + aliases)
        └─> Phase 3 (per-skill rules migration)
              └─> Phase 4 (delete skills-matrix.yaml)
                    └─> Phase 5 (auto-synthesis)
                          └─> Phase 6 (command integration: new skill + new marketplace)
                                └─> Phase 7 (deprecate categoryExclusive)
                                      └─> Phase 8 (rename cliName → displayName)
```

Phases are sequential. Phase 4 requires both Phase 2 (aliases moved) and Phase 3 (per-skill rules moved) to be complete.
