# Zod Schema Removal Audit (D-71)

**Date:** 2026-03-06
**Scope:** `src/cli/lib/schemas.ts` (50+ exported schemas)

## Summary

Config files are now TypeScript (`satisfies ProjectConfig`), but Zod is still needed at runtime for:

- Lenient parsing (`.passthrough()`, optional fields, forward compatibility)
- Custom value registration (`extendSchemasWithCustomValues()` must run before parse)
- External data (YAML, JSON, marketplace responses)

**1 schema is completely unused.** ~14 internal building-block schemas could be consolidated (inlined into parents). All enum, extensible, and loader schemas must stay.

---

## Verdict Table

### REMOVE (unused)

| Schema                                | Lines   | Reason                                                                                                                 |
| ------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------- |
| `projectSourceConfigValidationSchema` | 792-814 | Zero production imports. Only in schemas.test.ts. Strict variant for IDE schema generation that was never implemented. |

### KEEP (production loaders — parse external data)

| Schema                         | Used By                                                   |
| ------------------------------ | --------------------------------------------------------- |
| `projectConfigLoaderSchema`    | project-config.ts                                         |
| `projectSourceConfigSchema`    | config.ts                                                 |
| `skillFrontmatterLoaderSchema` | loader.ts                                                 |
| `skillMetadataLoaderSchema`    | skill-plugin-compiler.ts                                  |
| `agentYamlConfigSchema`        | loader.ts                                                 |
| `stacksConfigSchema`           | stacks-loader.ts                                          |
| `localRawMetadataSchema`       | local-skill-loader.ts                                     |
| `localSkillMetadataSchema`     | skill-metadata.ts                                         |
| `importedSkillMetadataSchema`  | import/skill.ts                                           |
| `marketplaceSchema`            | source-fetcher.ts                                         |
| `pluginManifestSchema`         | marketplace-generator.ts, plugin-finder.ts, versioning.ts |
| `settingsFileSchema`           | settings loader                                           |
| `boundSkillSchema`             | projectSourceConfigSchema                                 |

### KEEP (validation schemas — `cc validate`, compilation)

| Schema                             | Used By                                             |
| ---------------------------------- | --------------------------------------------------- |
| `metadataValidationSchema`         | source-validator.ts, schema-validator.ts            |
| `stackConfigValidationSchema`      | schema-validator.ts                                 |
| `skillFrontmatterValidationSchema` | plugin-validator.ts, schema-validator.ts            |
| `agentFrontmatterValidationSchema` | agent-plugin-compiler.ts, plugin-validator.ts       |
| `agentYamlGenerationSchema`        | schema-validator.ts                                 |
| `pluginManifestValidationSchema`   | plugin-validator.ts (note: locally redefined there) |

### KEEP (enum + extensible — foundational)

All enum schemas (`domainSchema`, `categorySchema`, `agentNameSchema`, `modelNameSchema`, `permissionModeSchema`, `skillDisplayNameSchema`, `skillIdSchema`, `skillSourceTypeSchema`) and extensible schemas (`extensibleDomainSchema`, `extensibleSkillIdSchema`, `extensibleCategorySchema`, `extensibleAgentNameSchema`, `categoryPathSchema`) are building blocks used throughout the system.

### KEEP (hooks)

`agentHookActionSchema`, `agentHookDefinitionSchema`, `hooksRecordSchema`, `strictHooksRecordSchema`, `strictAgentHookDefinitionSchema` — required by plugin manifest and agent validation.

### KEEP (utilities)

`extendSchemasWithCustomValues()`, `resetSchemaExtensions()`, `isValidSkillId()`, `formatZodErrors()`, `validateNestingDepth()`, `warnUnknownFields()`.

### CONSOLIDATABLE (internal building blocks — only used by parent schemas)

These are exported but never imported directly in production. They could be inlined into their parent schemas to reduce API surface.

| Schema                          | Parent                          | Risk                          |
| ------------------------------- | ------------------------------- | ----------------------------- |
| `conflictRuleSchema`            | `relationshipDefinitionsSchema` | Low                           |
| `discourageRuleSchema`          | `relationshipDefinitionsSchema` | Low                           |
| `recommendRuleSchema`           | `relationshipDefinitionsSchema` | Low                           |
| `requireRuleSchema`             | `relationshipDefinitionsSchema` | Low                           |
| `alternativeGroupSchema`        | `relationshipDefinitionsSchema` | Low                           |
| `relationshipDefinitionsSchema` | `skillRulesFileSchema`          | Low                           |
| `perSkillRulesSchema`           | `skillRulesFileSchema`          | Low                           |
| `categoryDefinitionSchema`      | `skillCategoriesFileSchema`     | Low                           |
| `stackSchema`                   | `stacksConfigSchema`            | Low                           |
| `marketplaceRemoteSourceSchema` | `marketplacePluginSchema`       | Low                           |
| `marketplacePluginSchema`       | `marketplaceSchema`             | Low                           |
| `marketplaceOwnerSchema`        | `marketplaceSchema`             | Low                           |
| `marketplaceMetadataSchema`     | `marketplaceSchema`             | Low                           |
| `permissionConfigSchema`        | `settingsFileSchema`            | Low                           |
| `brandingConfigSchema`          | `projectSourceConfigSchema`     | Low                           |
| `pluginAuthorSchema`            | `pluginManifestSchema`          | Keep (used in validation too) |

---

## Why `projectConfigLoaderSchema` Is NOT Redundant

Config files use `satisfies ProjectConfig` (compile-time), then are parsed with `projectConfigLoaderSchema.safeParse()` (runtime). The Zod parse is still needed because:

1. `.passthrough()` allows forward compatibility with new fields
2. Custom categories/domains must be registered via `extendSchemasWithCustomValues()` before validation
3. Configs may be partial during loading (merged later)
4. The loaded file is `import()`ed at runtime — TypeScript doesn't validate at runtime

---

## Implementation Plan

**Phase 1 (immediate, zero risk):** Remove `projectSourceConfigValidationSchema` + its test.

**Phase 2 (low risk):** Inline the 14 consolidatable schemas into their parents. One at a time, test after each. ~100 lines removed, ~15 fewer exports.

**Phase 3 (future):** Consider unifying parallel loader/validation schema pairs (e.g., `skillMetadataLoaderSchema` vs `metadataValidationSchema`).
