# T-08 Mock Data Centralization Progress

**Baseline:** 2561 tests passing, 104 test files
**Final:** 2561 tests passing, 104 test files, 0 type errors
**Commits:** `11271f9` (mock-data/ creation), `f8a8d22` (17 test files updated)
**Status: COMPLETE**

## Phase 1: Create mock-data/ folder with shared constants

| File                           | Status | Constants                                                                           | Agent      |
| ------------------------------ | ------ | ----------------------------------------------------------------------------------- | ---------- |
| `mock-data/mock-stacks.ts`     | Done   | 17 Stack objects + 7 TestStack arrays + `sa()` shorthand                            | cli-tester |
| `mock-data/mock-agents.ts`     | Done   | 9 exports (3 definitions, 6 agent config maps)                                      | cli-tester |
| `mock-data/mock-skills.ts`     | Done   | 13 exports (3 entries, 5 definitions, 5 extracted, 1 CONSUMER_MATRIX_SKILLS record) | cli-tester |
| `mock-data/mock-categories.ts` | Done   | 6 categories (5 with domain, 1 basic)                                               | cli-tester |
| `mock-data/mock-matrices.ts`   | Done   | 16 exports (10 matrix configs, 4 merged matrices, 2 compile configs)                | cli-tester |
| `mock-data/mock-sources.ts`    | Done   | 3 SkillSource objects                                                               | cli-tester |
| `mock-data/index.ts`           | Done   | Re-exports all                                                                      | cli-tester |

## Phase 2: Update test files to import from mock-data/

| Test File                                    | Status                   | What Changes                                                                                                                                                                              |
| -------------------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `resolver.test.ts`                           | Done                     | Import FULLSTACK_STACK, stacks, agents, skill defs, compile configs from mock-data/                                                                                                       |
| `config-generator.test.ts`                   | Done                     | All 10 remaining local stacks/matrices moved to mock-data/; imports from helpers.ts reduced to createMockSkillAssignment + TEST_MATRICES only                                             |
| `compiler.test.ts`                           | Done                     | Import skill entries, agent configs from mock-data/                                                                                                                                       |
| `stack-plugin-compiler.test.ts`              | Done (no changes)        | Local skills have specific path/description/usage overrides not in mock-data; stacks use local createStack() helper                                                                       |
| `matrix-loader.test.ts`                      | Done                     | Import extracted skills, matrices, categories from mock-data/                                                                                                                             |
| `matrix-health-check.test.ts`                | Done (no changes)        | All categories are intentionally broken error-path data -- stays local                                                                                                                    |
| `step-build.test.tsx`                        | Done                     | Import 5 categories from mock-data/, rename camelCase to SCREAMING_SNAKE_CASE                                                                                                             |
| `matrix-resolver.test.ts`                    | Done (no changes needed) | Uses createMockSkill/createMockMatrix factories for all 99 tests; each test creates unique relationship configurations (conflicts, requires, recommends) -- nothing shareable             |
| `skill-resolution.integration.test.ts`       | Done                     | Import 3 sources from mock-data/                                                                                                                                                          |
| `compilation-pipeline.test.ts`               | Done                     | Import COMPILATION_TEST_STACK from mock-data/, removed local TEST_STACK                                                                                                                   |
| `consumer-stacks-matrix.integration.test.ts` | Done                     | 7 TestStack arrays, 6 matrix configs, 1 skills record moved to mock-data/; zero local mock data remaining                                                                                 |
| `wizard-init-compile-pipeline.test.ts`       | Done (no changes needed) | Local PIPELINE_TEST_SKILLS has full SKILL.md content strings for createTestSource() integration testing; skill overlap with mock-data is in different shapes (TestSkill vs ResolvedSkill) |
| `stacks-loader.test.ts`                      | Done                     | Updated to use mock-data/ stacks                                                                                                                                                          |
| `stack-installer.test.ts`                    | Done                     | Updated to use mock-data/ stacks                                                                                                                                                          |
| `skill-copier.test.ts`                       | Done                     | Updated to use mock-data/ skills                                                                                                                                                          |
| `init-flow.integration.test.ts`              | Done                     | Updated to use mock-data/                                                                                                                                                                 |
| `source-switching.integration.test.ts`       | Done                     | Updated to use mock-data/                                                                                                                                                                 |

## Verification Checkpoints

- [x] All mock-data/ files created with correct exports (`npx tsc --noEmit` -- 0 errors)
- [x] All test files updated to import from mock-data/ (or documented as "no changes needed")
- [x] `npx tsc --noEmit` -- 0 errors (verified 2026-02-25)
- [x] `npm test` -- 2561 tests passing, 3 todo (verified 2026-02-25)
- [x] No inline `SkillsMatrixConfig` or `MergedSkillsMatrix` construction in test files
- [x] No task IDs in test describe blocks
- [x] Error-path data correctly kept local

## Audit Notes (2026-02-25)

**matrix-resolver.test.ts:** 99 tests, all using `createMockSkill`/`createMockMatrix` from helpers.ts. Every test creates unique skills with specific relationship configurations (conflicts, requires, recommends, discourages, alternatives, etc.). These are inherently test-specific -- centralizing them would create a combinatorial explosion of named constants with no reuse benefit. Correctly left as factory calls.

**wizard-init-compile-pipeline.test.ts:** 10 `TestSkill` objects with full SKILL.md frontmatter+content for `createTestSource()` integration tests. The skills (react, zustand, scss-modules, vitest, hono, drizzle, etc.) overlap with mock-data's `ResolvedSkill` objects by name, but the shapes are different (`TestSkill` with content strings vs `ResolvedSkill` with relationship metadata). Integration test content stays local per CLAUDE.md convention.

**Remaining local test data (intentional):**

- `compiler.test.ts`: 3 error-path agent configs (nonexistent path, missing skill, liquid injection)
- `stacks-loader.test.ts`: 4 invalid `StackAgentConfig` casts for validation error testing
- `matrix-health-check.test.ts`: 14 intentionally broken matrices for health-check scenario testing
- `stack-plugin-compiler.test.ts`: Local `createStack()` helper with path/description/usage overrides

## Notes

- Error-path data (invalid matrices, missing skills, injection tests) stays LOCAL
- Integration content with specific SKILL.md markers stays LOCAL
- Component rendering data with displayName stays LOCAL
- Health-check 14 matrices stay LOCAL (each tests a specific scenario)
- `sa()` helper already added to helpers.ts as `createMockSkillAssignment` by stacks agent
