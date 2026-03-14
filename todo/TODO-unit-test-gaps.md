# Unit Test Gap Analysis — COMPLETED (2026-03-14)

> All 29 functions now have direct unit tests (211 new tests total).
> See [unit-test-tracker.md](./unit-test-tracker.md) for per-function details.
> Archived to [TODO-completed.md](./TODO-completed.md).

## Priority Legend

- **P1** — Pure, complex, widely called. ~~Should be tested immediately.~~ DONE
- **P2** — Pure, medium complexity or moderate usage. ~~High value tests.~~ DONE
- **P3** — Impure but contains extractable pure logic. ~~Refactor then test.~~ DONE

---

## P1: Pure Functions — High Complexity, No Tests

### 1. `output-validator.ts` — Internal validators (all pure, zero tests)

| Function                          | Lines              | Why test                                                                                                                |
| --------------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `checkXmlTagBalance(content)`     | :5-35 (30 lines)   | Complex regex + counting logic. Detects unclosed/extra XML tags while skipping backtick-quoted content. High branching. |
| `checkTemplateArtifacts(content)` | :37-51 (14 lines)  | Regex matching for unprocessed Liquid `{{ }}` / `{% %}` tags.                                                           |
| `checkRequiredPatterns(content)`  | :53-74 (21 lines)  | Multi-check validation (frontmatter, role section, line count threshold).                                               |
| `validateFrontmatter(content)`    | :76-106 (30 lines) | Parses frontmatter, validates required/optional fields, returns typed errors+warnings.                                  |

**Status:** `validateCompiledAgent` (the public orchestrator) IS tested, but none of the 4 internal validators it calls are tested directly. These are the functions with the actual logic.

**Action:** Export the 4 internal validators and add unit tests for each. No refactoring needed — they are already pure.

---

### 2. `matrix-resolver.ts` — Validation sub-functions (all pure, zero direct tests)

| Function                                                   | Lines               | Why test                                                          |
| ---------------------------------------------------------- | ------------------- | ----------------------------------------------------------------- |
| `validateConflicts(resolvedSelections)`                    | :288-310 (22 lines) | Pairwise conflict detection across skill selections. O(n^2) loop. |
| `validateRequirements(resolvedSelections, selectedSet)`    | :312-347 (35 lines) | AND/OR requirement checking — most complex requirement logic.     |
| `validateExclusivity(resolvedSelections)`                  | :349-375 (26 lines) | Category-level exclusivity enforcement using `groupBy`.           |
| `validateRecommendations(resolvedSelections, selectedSet)` | :377-413 (32 lines) | Recommendation warnings with compatibility filtering.             |

**Status:** `validateSelection` (the orchestrator) IS tested but these 4 sub-functions are only exercised indirectly through it. Edge cases in individual validators are hard to target through the orchestrator alone.

**Action:** Export the 4 validators and add focused unit tests. No refactoring needed — they read from immutable `matrix` state.

---

### 3. `source-loader.ts` — Pure transformation functions (zero tests)

| Function                                          | Lines                 | Why test                                                                                                          |
| ------------------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `convertStackToResolvedStack(stack)`              | :295-336 (42 lines)   | Complex nested transformation: iterates agents, resolves skills, deduplicates, builds category-to-skill mappings. |
| `extractSourceName(source)`                       | :343-351 (8 lines)    | Regex-based protocol stripping + path extraction. Multiple formats to handle (github:, gh:, https://).            |
| `mergeLocalSkillsIntoMatrix(matrix, localResult)` | :383-440+ (~60 lines) | Deep merge of local skills into matrix with inheritance logic (category, slug, displayName from existing).        |

**Action:** `convertStackToResolvedStack` and `extractSourceName` are pure — export and test directly. `mergeLocalSkillsIntoMatrix` reads from module-level `currentMatrix` — extract the merge logic into a pure function that takes the matrix as a parameter.

---

### 4. `source-fetcher.ts` — `getGigetCacheDir(source)` (pure, zero tests)

| Function                   | Lines               | Why test                                                                                                                                                                         |
| -------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getGigetCacheDir(source)` | :107-134 (27 lines) | Replicates giget's internal cache path logic with regex parsing of git URIs, protocol detection, path sanitization. Multiple edge cases (http vs github prefix, XDG_CACHE_HOME). |

**Status:** `sanitizeSourceForCache` IS tested. `getGigetCacheDir` is NOT — despite being more complex.

**Action:** Export and test directly. Already pure.

---

## P2: Pure Functions — Medium Complexity, No Tests

### 5. `wizard/utils.ts` — All 4 functions (pure, zero tests)

| Function                       | Lines             | Why test                                                                                     |
| ------------------------------ | ----------------- | -------------------------------------------------------------------------------------------- |
| `getDomainDisplayName(domain)` | :8-20 (12 lines)  | Lookup table + fallback formatting. Used in wizard display.                                  |
| `getStackName(stackId)`        | :22-25 (3 lines)  | Null-safe lookup via `findStack`.                                                            |
| `orderDomains(domains)`        | :28-32 (4 lines)  | Custom sort: custom domains alphabetically first, then built-in per `BUILT_IN_DOMAIN_ORDER`. |
| `getDomainsFromStack(stack)`   | :35-46 (11 lines) | Extracts unique domains from stack agent-to-skill mappings via category lookups.             |

**Action:** All pure. `getDomainsFromStack` reads from module-level `matrix` — to make testable, pass `matrix.categories` as a parameter. The others are immediately testable.

---

### 6. `compiler.ts` — `buildAgentTemplateContext` (pure, zero tests)

| Function                                  | Lines               | Why test                                                                                                           |
| ----------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `buildAgentTemplateContext(agent, files)` | :167-188 (21 lines) | Constructs the Liquid template context object from agent config + file contents. Pure object construction, no I/O. |

**Action:** Already pure and exported. Test directly.

---

### 7. `schemas.ts` — `formatZodErrors(issues)` (pure, zero tests)

| Function                  | Lines              | Why test                                                                                      |
| ------------------------- | ------------------ | --------------------------------------------------------------------------------------------- |
| `formatZodErrors(issues)` | :156-164 (8 lines) | Formats Zod validation issues into user-friendly error strings. Used at every parse boundary. |

**Status:** `validateNestingDepth` and `warnUnknownFields` ARE tested. `formatZodErrors` is NOT — despite being used by 10+ files.

**Action:** Already pure and exported. Test directly.

---

### 8. `local-installer.ts` — Pure internal functions (zero tests)

| Function                                 | Lines               | Why test                                                                                             |
| ---------------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| `resolveInstallPaths(projectDir, scope)` | :99-111 (12 lines)  | Computes install paths for project vs global scope.                                                  |
| `buildLocalSkillsMap(copiedSkills)`      | :136-153 (17 lines) | Transforms copied skills into ID-indexed map. Reads from `matrix.skills`.                            |
| `buildCompileAgents(config, agents)`     | :308-333 (25 lines) | Builds compile-time agent config with cross-scope safety net (global agents only see global skills). |
| `buildAgentScopeMap(config)`             | :335-341 (6 lines)  | Simple Map construction from config agents.                                                          |

**Action:** `resolveInstallPaths` and `buildAgentScopeMap` are already pure. `buildLocalSkillsMap` reads module-level `matrix` — pass it as parameter. `buildCompileAgents` is pure (takes config + agents as args) — export and test.

---

### 9. `versioning.ts` — Internal helpers (pure, zero tests)

| Function                     | Lines          | Why test                                          |
| ---------------------------- | -------------- | ------------------------------------------------- |
| `parseMajorVersion(version)` | :64 (1 line)   | Parses major version from semver string.          |
| `bumpMajorVersion(version)`  | :69 (~5 lines) | Increments major version while preserving format. |

**Status:** `computeStringHash` and `getCurrentDate` ARE tested. These internal helpers are NOT.

**Action:** Export and test. Already pure.

---

### 10. `hotkeys.ts` — `isHotkey(input, hotkey)` (pure, zero unit tests)

| Function                  | Lines            | Why test                                               |
| ------------------------- | ---------------- | ------------------------------------------------------ |
| `isHotkey(input, hotkey)` | :62-64 (2 lines) | Case-insensitive hotkey matching. Only tested via e2e. |

**Action:** Already pure and exported. Trivial to test.

---

## P3: Impure Functions — Need Refactoring to Extract Pure Logic

### 11. `config-merger.ts` — `mergeWithExistingConfig` (impure, complex merge logic)

| Function                                      | Lines             | Why test                                                                                                                                                                           |
| --------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mergeWithExistingConfig(newConfig, context)` | :20-96 (76 lines) | Complex merge: identity fields (name, description) use existing; agents are unioned by name; skills merged by ID (new overrides existing, keeps rest); stack deep-merged by agent. |

**Refactor:** Extract a pure `mergeConfigs(newConfig, existingConfig): ProjectConfig` that takes both configs as arguments. The I/O (`loadProjectConfig`, `loadProjectSourceConfig`) stays in the outer function. This separates the 40+ lines of pure merge logic from the I/O wrapper.

---

### 12. `source-validator.ts` — `validateSource` (impure, 171 lines, zero unit tests)

The validation logic is complex (3 phases: file structure, metadata schema, cross-reference) but deeply entangled with file I/O.

**Refactor:** Extract pure validators:

- `validateMetadataConventions(rawMetadata, relPath)` — snake_case check, displayName/dir match, category pattern check
- `validateSkillFilePairs(skillMdDirs, metadataDirs)` — set difference for missing files
- `isSnakeCase(key)` — already pure, just not exported or tested

---

### 13. `local-installer.ts` — `setConfigMetadata` (mutates in place)

| Function                                                             | Lines               | Why test                                                                          |
| -------------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------- |
| `setConfigMetadata(config, wizardResult, sourceResult, sourceFlag?)` | :254-279 (25 lines) | Conditionally sets domains, selectedAgents, source, marketplace on config object. |

**Refactor:** Return a new config object instead of mutating. Then test as a pure transformation.

---

## Summary Table

| #   | Function                                                      | File                | Purity             | Priority | Action                          |
| --- | ------------------------------------------------------------- | ------------------- | ------------------ | -------- | ------------------------------- |
| 1   | `checkXmlTagBalance`                                          | output-validator.ts | Pure               | P1       | Export + test                   |
| 2   | `checkTemplateArtifacts`                                      | output-validator.ts | Pure               | P1       | Export + test                   |
| 3   | `checkRequiredPatterns`                                       | output-validator.ts | Pure               | P1       | Export + test                   |
| 4   | `validateFrontmatter`                                         | output-validator.ts | Pure               | P1       | Export + test                   |
| 5   | `validateConflicts`                                           | matrix-resolver.ts  | Pure               | P1       | Export + test                   |
| 6   | `validateRequirements`                                        | matrix-resolver.ts  | Pure               | P1       | Export + test                   |
| 7   | `validateExclusivity`                                         | matrix-resolver.ts  | Pure               | P1       | Export + test                   |
| 8   | `validateRecommendations`                                     | matrix-resolver.ts  | Pure               | P1       | Export + test                   |
| 9   | `convertStackToResolvedStack`                                 | source-loader.ts    | Pure               | P1       | Export + test                   |
| 10  | `extractSourceName`                                           | source-loader.ts    | Pure               | P1       | Export + test                   |
| 11  | `mergeLocalSkillsIntoMatrix`                                  | source-loader.ts    | Reads module state | P1       | Pass matrix as param + test     |
| 12  | `getGigetCacheDir`                                            | source-fetcher.ts   | Pure               | P1       | Export + test                   |
| 13  | `getDomainDisplayName`                                        | wizard/utils.ts     | Pure               | P2       | Test directly                   |
| 14  | `orderDomains`                                                | wizard/utils.ts     | Pure               | P2       | Test directly                   |
| 15  | `getDomainsFromStack`                                         | wizard/utils.ts     | Reads module state | P2       | Pass categories as param + test |
| 16  | `buildAgentTemplateContext`                                   | compiler.ts         | Pure               | P2       | Test directly                   |
| 17  | `formatZodErrors`                                             | schemas.ts          | Pure               | P2       | Test directly                   |
| 18  | `resolveInstallPaths`                                         | local-installer.ts  | Pure               | P2       | Export + test                   |
| 19  | `buildCompileAgents`                                          | local-installer.ts  | Pure               | P2       | Export + test                   |
| 20  | `buildLocalSkillsMap`                                         | local-installer.ts  | Reads module state | P2       | Pass matrix as param + test     |
| 21  | `buildAgentScopeMap`                                          | local-installer.ts  | Pure               | P2       | Export + test                   |
| 22  | `parseMajorVersion`                                           | versioning.ts       | Pure               | P2       | Export + test                   |
| 23  | `bumpMajorVersion`                                            | versioning.ts       | Pure               | P2       | Export + test                   |
| 24  | `isHotkey`                                                    | hotkeys.ts          | Pure               | P2       | Test directly                   |
| 25  | `mergeConfigs` (extract from `mergeWithExistingConfig`)       | config-merger.ts    | Needs extraction   | P3       | Refactor + test                 |
| 26  | `validateMetadataConventions` (extract from `validateSource`) | source-validator.ts | Needs extraction   | P3       | Refactor + test                 |
| 27  | `validateSkillFilePairs` (extract from `validateSource`)      | source-validator.ts | Needs extraction   | P3       | Refactor + test                 |
| 28  | `isSnakeCase`                                                 | source-validator.ts | Pure               | P3       | Export + test                   |
| 29  | `setConfigMetadata` (make pure)                               | local-installer.ts  | Mutates            | P3       | Return new object + test        |

**Total: 29 functions across 11 files**

- P1 (test now): 12 functions
- P2 (test soon): 12 functions
- P3 (refactor then test): 5 functions
