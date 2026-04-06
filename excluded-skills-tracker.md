# Excluded Skills Implementation Tracker

Status of each phase from [docs/excluded-skills-design.md](./docs/excluded-skills-design.md).

## Phase 1: Type + schema — DONE

All items complete. `excluded?: boolean` on `SkillConfig`, `AgentScopeConfig`, Zod schema, generated config-types.

## Phase 2: Config generation + compilation — 1 REMAINING

| Item                                                        | Status       | Notes                                                                                                |
| ----------------------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| `splitConfigByScope` routes excluded to project partition   | Done         |                                                                                                      |
| `mergeGlobalConfigs` filters excluded before merging        | Done         |                                                                                                      |
| `generateConfigSource` comment grouping for excluded        | Done         |                                                                                                      |
| `buildCompileAgents` excluded filtering                     | Done         |                                                                                                      |
| `compile-agents.ts` scope filter skips excluded             | Done         |                                                                                                      |
| `agent-recompiler.ts` `filterExcludedEntries()`             | Done         |                                                                                                      |
| `mergeConfigs` compound key                                 | Done         | 0.108.0                                                                                              |
| `buildEjectConfig` `unique()` dedup                         | Done         |                                                                                                      |
| **Consolidate `buildCompileConfig` → `buildCompileAgents`** | **NOT DONE** | `buildCompileConfig` still exists in `agent-recompiler.ts:95`, lacks D7 cross-scope safety filtering |

## Phase 3: Wizard store + locked removal — DONE

| Item                                       | Status | Notes                                                                    |
| ------------------------------------------ | ------ | ------------------------------------------------------------------------ |
| Remove `lockedSkillIds`/`lockedAgentNames` | Done   | 0 occurrences in src                                                     |
| `toggleTechnology` excluded behavior       | Done   | `removeSkillsForDeselection`                                             |
| `toggleAgent` excluded behavior            | Done   | `applyAgentToggle`                                                       |
| Exclusive category auto-deselection        | Done   |                                                                          |
| `findIncompatibleWebSkills` skip excluded  | Done   |                                                                          |
| `preselectAgentsFromDomains` merge         | Done   | preserves excluded entries                                               |
| `populateFromSkillIds`                     | Done   | preserves `excludedConfigs`                                              |
| `handleComplete` append excluded           | Done   | flows through store                                                      |
| Scope toggle guard for eject conflicts     | Done   | 0.108.0 — P→G blocked with toast; G→P allowed (creates independent copy) |

## Phase 4: Command + edit updates — DONE (1 FRAGILE)

| Item                          | Status  | Notes                                                                                                            |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| Edit: filter excluded early   | Done    | `edit.tsx:108-112`                                                                                               |
| Edit: dual entry handling     | Done    | pre-filtered inputs                                                                                              |
| Init: filter excluded         | Done    | `init.tsx:298, 530`                                                                                              |
| Doctor: `checkSkillsResolved` | Done    | `doctor.ts:87-93`                                                                                                |
| Doctor: `checkAgentsCompiled` | Done    | receives `filteredConfig`                                                                                        |
| Doctor: `checkNoOrphans`      | Fragile | receives raw `config` at line 437, not `filteredConfig` — works only because orphan check looks at files on disk |
| List: filter excluded         | Done    | `list.tsx:94-95`                                                                                                 |
| Uninstall: filter excluded    | Done    | `uninstall.tsx:382-383`                                                                                          |

## Phase 5: Tests — 2 REMAINING

| Item                                           | Status       | Notes                                             |
| ---------------------------------------------- | ------------ | ------------------------------------------------- |
| E2E scope toggle tests                         | Done         | 0.108.0                                           |
| **Unit tests for `mergeConfigs` compound key** | **NOT DONE** | No coverage for the agent compound key fix        |
| Unit tests for excluded toggle in wizard       | Partial      |                                                   |
| **E2E exclusion lifecycle**                    | **NOT DONE** | No test for init-with-exclusions → edit → re-edit |

## Summary

3 outstanding items:

1. **`buildCompileConfig` consolidation** (Phase 2) — separate function in `agent-recompiler.ts` without D7 cross-scope safety
2. **Unit tests for compound key merge** (Phase 5) — no test coverage for `mergeConfigs` agent fix
3. **E2E exclusion lifecycle test** (Phase 5) — no end-to-end test for init-with-exclusions → edit → re-edit
