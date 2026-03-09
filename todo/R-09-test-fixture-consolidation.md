# R-09: Consolidate Test Fixtures -- Canonical Skill Registry + Unified Content Generators

## Problem

The test suite has sprawling mock data that makes tests hard to maintain and understand:

- **39 unique skill IDs** across tests, but only 4 account for 91% of references (`web-framework-react`, `api-framework-hono`, `web-state-zustand`, `web-testing-vitest`). 19 skill IDs have zero references anywhere.
- **11 `TestSkill[]` arrays** in `mock-skills.ts` with massive overlap -- `web-framework-react` appears in 7 of 11 arrays. Each array redefines the same skill with slightly different descriptions or content strings.
- **SKILL.md content templates** duplicated in 4 places: `helpers.ts` (`createSkillContent`), `create-test-source.ts` (inline), `create-e2e-source.ts` (inline), `validate.test.ts` (inline).
- **Agent YAML templates** duplicated in 3 places: `helpers.ts` (`createAgentYamlContent`), `create-test-source.ts`, `create-e2e-source.ts`.
- **`export default ${JSON.stringify(...)}`** config pattern duplicated in 25+ call sites across test and e2e files, with no shared renderer.
- **Skill `metadata.yaml` generation** duplicated in 4 places with slightly different field sets.
- **10+ file-writer functions** with overlapping responsibility across `helpers.ts`, `create-test-source.ts`, `e2e/test-utils.ts`, `e2e/create-e2e-source.ts`.
- **15+ pre-built matrix constants** in `test-fixtures.ts` (`TEST_MATRICES`) and `mock-matrices.ts` that exist only because `createMockMatrix` requires a verbose `Record<string, ResolvedSkill>` argument where keys duplicate each skill's `.id`.
- Tests that need slight variations create entirely new skill constants instead of using overrides on canonical ones.

### Scale of Duplication

| Artifact | Unique Definitions | Actual Distinct Concepts |
|---|---|---|
| Skill IDs | 39 | ~12 needed |
| `TestSkill[]` arrays | 11 | ~3-4 needed (compose from registry) |
| SKILL.md templates | 4 copies | 1 renderer |
| Agent YAML templates | 3 copies | 1 renderer |
| `JSON.stringify` config patterns | 25+ sites | 1 renderer |
| File-writer functions | 10+ | ~4 composable primitives |
| Pre-built matrices | 15+ | Inline `createMockMatrix(...)` calls |

---

## Design Principles

1. **One source of truth**: Every test skill, content template, and file writer lives in exactly one place.
2. **Composition over proliferation**: A small set of canonical skills (~12) composed into collections via spreads replaces 11 overlapping arrays.
3. **Factories with overrides, not named variants**: Tests customize via `{ ...SKILLS.react, author: "@custom" }` instead of defining `CUSTOM_REACT_SKILL`.
4. **Content generators separated from file writers**: Rendering a string is a pure function; writing to disk is a side effect. Keep them apart.
5. **Matrix store simplifies matrix creation**: `createMockMatrix` accepts a spread of `ResolvedSkill` objects and auto-derives the record keys from `skill.id`.
6. **Registry skills vs one-off skills**: The canonical registry holds only the ~12 skills needed across the test suite. Tests needing deliberately broken, exotic, or error-case skills use `createMockSkill("web-test-broken")` inline — they do NOT get added to the registry. The registry is for shared, meaningful domain skills only.

---

## Research Findings

External fixture libraries (fishery 742K/wk, factory.ts 239K/wk, @anatine/zod-mock, @mswjs/data, test-data-bot) were evaluated. None are worth adopting:

| Library | Assessment |
|---|---|
| **fishery** (thoughtbot) | Best-in-class factory lib, but our `createMockSkill(id, overrides)` + spread already provides 90% of what it offers. Adds `lodash.mergewith` dependency for zero benefit on our flat data shapes. |
| **factory.ts** | Same conclusion — class-based API adds complexity without proportional benefit. |
| **@anatine/zod-mock** | Generates random data from Zod schemas. Catastrophic for our tests — we assert on specific skill IDs like `"web-framework-react"`, not random strings. |
| **@mswjs/data** | 13 dependencies (graphql, lodash, date-fns). Designed for API mocking, not file-system fixtures. |
| **test-data-bot** | Unmaintained, depends on old faker. |

**Large project patterns surveyed:** webpack (11K fixture dirs), ESLint (238 fixture files per area), Prisma CLI (full fixture dirs), oclif (mini-CLI fixtures), Changesets (factory functions + overrides), pnpm (dedicated test-fixtures package).

**Universal pattern:** Disk-based fixtures for integration/E2E, programmatic factories for unit tests. Our codebase already follows this split. The duplication problem lives entirely in the programmatic factory side — which is what this refactor targets.

**Key insight from Changesets:** Their `getChangeset({ id: "custom" })` pattern is functionally identical to our `createMockSkill("web-framework-react", { author: "@custom" })`. No library improves on this for flat, domain-specific data.

---

## Implementation Phases

### Phase 0: Audit (de-risk)

Before touching any code, run concrete grep counts for every skill ID to quantify the exact blast radius:

```bash
for id in web-framework-react api-framework-hono web-state-zustand web-testing-vitest web-styling-scss-modules api-database-drizzle web-framework-vue meta-methodology-anti-over-engineering; do
  echo "$id: $(grep -r "$id" src/ e2e/ --include="*.ts" --include="*.tsx" -l | wc -l) files"
done
```

Also grep each of the 11 `TestSkill[]` array names to confirm import counts:

```bash
for arr in DEFAULT_TEST_SKILLS PIPELINE_TEST_SKILLS SWITCHABLE_SKILLS METHODOLOGY_TEST_SKILLS EXTRA_DOMAIN_TEST_SKILLS LOCAL_SKILL_VARIANTS RESOLUTION_PIPELINE_SKILLS DISCOURAGES_TEST_SKILLS REQUIRES_TEST_SKILLS CI_CD_SKILLS ALL_TEST_SKILLS; do
  echo "$arr: $(grep -r "$arr" src/ e2e/ --include="*.ts" --include="*.tsx" -l | wc -l) files"
done
```

This produces the exact migration manifest for Phase 1 and prevents surprises.

---

### Phase 1: Canonical Skill Registry (highest impact)

Replace `SKILL_FIXTURES` and `TEST_SKILLS` in `test-fixtures.ts`, the 30+ skills in `mock-skills.ts`, and the 11 `TestSkill[]` arrays with a single canonical registry of ~12 skills.

**The registry:**

```ts
// test-fixtures.ts
export const SKILLS = {
  react:           createMockSkill("web-framework-react"),
  vue:             createMockSkill("web-framework-vue"),
  zustand:         createMockSkill("web-state-zustand", { compatibleWith: ["web-framework-react"] }),
  pinia:           createMockSkill("web-state-pinia", { compatibleWith: ["web-framework-vue"] }),
  scss:            createMockSkill("web-styling-scss-modules"),
  vitest:          createMockSkill("web-testing-vitest"),
  hono:            createMockSkill("api-framework-hono"),
  drizzle:         createMockSkill("api-database-drizzle"),
  oclif:           createMockSkill("cli-framework-oclif"),
  antiOverEng:     createMockSkill("meta-methodology-anti-over-engineering"),
  investigation:   createMockSkill("meta-methodology-investigation-requirements"),
  docker:          createMockSkill("infra-tooling-docker"),
} satisfies Partial<Record<SkillSlug, ResolvedSkill>>;
```

**Derived collections** replace the 11 arrays:

```ts
export const WEB_SKILLS = [SKILLS.react, SKILLS.zustand, SKILLS.scss, SKILLS.vitest];
export const FULLSTACK_SKILLS = [...WEB_SKILLS, SKILLS.hono, SKILLS.drizzle];
export const METHODOLOGY_SKILLS = [SKILLS.antiOverEng, SKILLS.investigation];
```

**Tests needing variants** use overrides:

```ts
const localReact = { ...SKILLS.react, author: "@local-user" };
```

**Migration steps:**

1. Create the `SKILLS` registry in `test-fixtures.ts`.
2. Rewrite derived collections to replace the 11 `TestSkill[]` arrays.
3. Delete `SKILL_FIXTURES` and `getTestSkill()` (superseded by `SKILLS.*` + spread overrides).
4. Update all importers of `TEST_SKILLS` to use `SKILLS` directly.
5. Delete zero-reference skills entirely from `mock-skills.ts`.
6. Delete named arrays that are subsets of the registry (`METHODOLOGY_TEST_SKILLS`, `EXTRA_DOMAIN_TEST_SKILLS`, `LOCAL_SKILL_VARIANTS`, `SWITCHABLE_SKILLS`, `DEFAULT_TEST_SKILLS`).
7. Keep test-specific arrays that have genuinely unique semantics (e.g., `DISCOURAGES_TEST_SKILLS` with custom IDs for relationship testing, `CI_CD_SKILLS` for infra tests).
8. During migration, keep old exports (`TEST_SKILLS`, `getTestSkill`) with `/** @deprecated Use SKILLS.* instead */` JSDoc until all importers are updated. Remove them in Phase 5.

**Key files:**

| File | Change |
|---|---|
| `src/cli/lib/__tests__/test-fixtures.ts` | Rewrite: `SKILLS` registry, derived collections, delete `SKILL_FIXTURES`/`getTestSkill`/`TEST_MATRICES` |
| `src/cli/lib/__tests__/mock-data/mock-skills.ts` | Heavy reduction: delete redundant arrays and zero-reference skills |
| Every test file importing from these | Update imports |

---

### Phase 2: Unified Content Generators

> **Execution note:** Phase 2 is the lowest-risk, most mechanical change and can be done before or in parallel with Phase 1. The 25+ `renderConfigTs` call sites are a quick win that warms up the refactoring process.

Create `src/cli/lib/__tests__/content-generators.ts` with pure functions that return file content strings.

```ts
// Pure renderers -- no disk I/O
export function renderSkillMd(id: string, description?: string): string
export function renderMetadataYaml(id: string, overrides?: Partial<RawMetadata>): string
export function renderAgentYaml(name: string, overrides?: Partial<AgentMetadata>): string
export function renderConfigTs(config: Record<string, unknown>): string
export function renderCategoriesTs(categories: Record<string, unknown>): string
export function renderRulesTs(rules: Record<string, unknown>): string
```

Then update all callers:

- `helpers.ts`: `createSkillContent` and `createAgentYamlContent` become thin wrappers or are replaced by direct calls to `renderSkillMd`/`renderAgentYaml`.
- `create-test-source.ts`: inline templates replaced by render function calls.
- `create-e2e-source.ts`: inline templates replaced by render function calls.
- `validate.test.ts`: inline template replaced by `renderSkillMd` call.
- `e2e/test-utils.ts`: inline config template replaced by `renderConfigTs` call.

The `renderConfigTs` function consolidates the `export default ${JSON.stringify(...)};\n` pattern into a single place. All 25+ call sites import and use it.

**Key files:**

| File | Change |
|---|---|
| `src/cli/lib/__tests__/content-generators.ts` | NEW: pure content renderers |
| `src/cli/lib/__tests__/helpers.ts` | Replace `createSkillContent`/`createAgentYamlContent` with imports from content-generators |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | Use shared renderers |
| `e2e/helpers/test-utils.ts` | Use `renderConfigTs` |
| `e2e/helpers/create-e2e-source.ts` | Use shared renderers |
| `src/cli/lib/__tests__/commands/validate.test.ts` | Use `renderSkillMd`/`renderCategoriesTs`/`renderRulesTs` |

---

### Phase 3: Simplify `createMockMatrix` Signature

Change `createMockMatrix` to accept a spread of `ResolvedSkill` objects instead of a `Record<SkillId, ResolvedSkill>`:

**Before:**

```ts
createMockMatrix({
  "web-framework-react": SKILLS.react,
  "api-framework-hono": SKILLS.hono,
})
```

**After:**

```ts
createMockMatrix(SKILLS.react, SKILLS.hono)
```

Naturally supports array spreads for derived collections:

```ts
createMockMatrix(...WEB_SKILLS)
createMockMatrix(...FULLSTACK_SKILLS, SKILLS.docker)
```

The function derives record keys from each skill's `.id` property. The old record-based overrides parameter moves to an optional trailing options object (detected by checking if the last arg lacks an `id` property).

This eliminates the need for most pre-built matrix constants in `TEST_MATRICES` and `mock-matrices.ts`. Delete them and inline the calls:

```ts
// Before: import { TEST_MATRICES } from "../test-fixtures";
// const matrix = TEST_MATRICES.reactAndHono;

// After: inline at call site
const matrix = createMockMatrix(SKILLS.react, SKILLS.hono);
```

**Key files:**

| File | Change |
|---|---|
| `src/cli/lib/__tests__/helpers.ts` | Update `createMockMatrix` signature |
| `src/cli/lib/__tests__/test-fixtures.ts` | Delete `TEST_MATRICES` |
| `src/cli/lib/__tests__/mock-data/mock-matrices.ts` | Heavy reduction: delete pre-built matrices that were just record wrappers |
| Every test file using `createMockMatrix` or pre-built matrices | Update calls to new spread syntax |

---

### Phase 4: Consolidate File Writers

Reduce 10+ file-writing functions to composable primitives:

```ts
// Low-level (content-generators.ts handles rendering, these handle disk I/O)
writeSkillFiles(dir, skillId, options?)    // writes SKILL.md + metadata.yaml
writeAgentFiles(dir, name, options?)       // writes metadata.yaml
writeConfigFile(dir, config)               // writes config.ts

// High-level (creates full project structures)
writeTestProject(dir, { skills, agents?, config?, stacks? })
```

`createTestSource` becomes a thin wrapper over `writeTestProject` with specific defaults. `createE2ESource` similarly composes from the same primitives.

The split:
- **Content generators** (Phase 2) produce strings -- pure, testable, no I/O.
- **File writers** (this phase) call content generators and write to disk -- side effects only.

**Caution:** `createTestSource()` (integration tests) and `createE2ESource()` (E2E tests) have genuinely different needs — E2E sources need real disk content that survives oclif command execution. Share the low-level content generators (`renderSkillMd`, `renderMetadataYaml`) but keep separate orchestration functions. Do not force both into a single `writeTestProject` — that creates a leaky abstraction. The pattern from large projects (webpack, Prisma, oclif) confirms this: shared utilities for content generation, separate orchestrators per test boundary.

**Key files:**

| File | Change |
|---|---|
| `src/cli/lib/__tests__/helpers.ts` | Consolidate `writeTestSkill`, `writeSourceSkill`, `writeTestAgent` into composable primitives |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | Use shared writers |
| `e2e/helpers/test-utils.ts` | Use shared writers |
| `e2e/helpers/create-e2e-source.ts` | Use shared writers |

---

### Phase 5: Cleanup Dead Fixtures

Delete all zero-reference skills, unused arrays, and orphaned constants:

- 19 zero-reference skill IDs (verify with grep before deleting).
- `METHODOLOGY_TEST_SKILLS` array (6 skills, 0 references each after Phase 1).
- `SWITCHABLE_SKILLS`, `RESOLUTION_PIPELINE_SKILLS`, `LOCAL_SKILL_VARIANTS` if superseded by composition.
- Unused pre-built matrices from `TEST_MATRICES` and `mock-matrices.ts`.
- Any remaining `mock-data/` constants with 0 imports.
- `SKILL_FIXTURES`, `getTestSkill`, `TestSkillName` type (superseded by `SKILLS` registry in Phase 1).

**Method:** Run `grep -r "CONSTANT_NAME" src/ e2e/` for each constant. If 0 results outside its definition, delete it.

---

## Execution Notes

- Each phase is independently shippable -- tests must pass after each phase.
- Phase 1 is the highest-impact change and should be done first.
- Phase 2 can be done in parallel with Phase 1 (no dependency).
- Phase 3 has the widest blast radius (touches every test using `createMockMatrix`) but is purely mechanical.
- Phase 4 crosses the unit/e2e boundary -- content generators must work for both.
- Phase 5 is a cleanup sweep that can happen after any or all previous phases.
- Run `npm test` after each phase to verify. Current test count: 2309+.
- **Type boundary:** The canonical `SKILLS` registry uses `ResolvedSkill` (correct for unit tests and matrix creation). Phase 4's disk writers consume `TestSkill` inputs (which include `content`, `skipMetadata`, filesystem layout fields). These are separate types serving separate purposes — do not merge them. Content generators (Phase 2) bridge the gap by rendering `TestSkill` data into file content strings.

---

## Key Files

| File | Role | Phase |
|---|---|---|
| `src/cli/lib/__tests__/test-fixtures.ts` | Canonical skill registry, derived collections | 1, 3 |
| `src/cli/lib/__tests__/mock-data/mock-skills.ts` | Skill array consolidation, dead code removal | 1, 5 |
| `src/cli/lib/__tests__/content-generators.ts` | NEW: pure content renderers | 2 |
| `src/cli/lib/__tests__/helpers.ts` | Factory updates, file writer consolidation | 2, 3, 4 |
| `src/cli/lib/__tests__/mock-data/mock-matrices.ts` | Matrix constant reduction | 3, 5 |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts` | Use shared writers and renderers | 2, 4 |
| `e2e/helpers/test-utils.ts` | Use shared writers and renderers | 2, 4 |
| `e2e/helpers/create-e2e-source.ts` | Use shared writers and renderers | 2, 4 |
| `src/cli/lib/__tests__/commands/validate.test.ts` | Use shared renderers | 2 |

---

## Anti-Patterns to Avoid

1. **Random data generation for domain-specific data.** Libraries like faker, zod-fixture, and @anatine/zod-mock generate random strings. Our tests assert on specific skill IDs (`"web-framework-react"`), category paths (`"web-framework"`), and domain membership. Random generation destroys test readability and makes assertions impossible.

2. **Overly abstract factory hierarchies.** fishery supports traits, transient params, associations, afterBuild hooks, and class inheritance. This power comes at the cost of test readability — data creation logic gets distributed across factory definitions and override chains. Our `createMockSkill(id, overrides)` + spread is clear and immediate.

3. **Global mutable test state.** Builder classes with `addSkill()` / `updateMatrix()` methods create mutable state that leaks between tests. Each test should start from the `SKILLS` registry + spread overrides — deterministic and isolated.

4. **Premature DRY in test data.** Not every duplication is bad. Two tests both calling `createMockSkill("web-framework-react")` with different overrides is fine — it makes each test self-documenting. The problem we're solving is the 39 unique skill IDs and 11 overlapping arrays, not individual `createMockSkill()` calls in test bodies.

5. **Disk fixtures for compositional data.** webpack's 11K fixture directories work because each test scenario is self-contained and immutable. Our data is compositional (combine skills into matrices, matrices into wizard results). Fixture directories would require maintaining hundreds of nearly-identical YAML/JSON files. Programmatic generation is correct for our case.

---

## Verification

After all phases:

- [ ] Test count is unchanged (no tests deleted, only refactored)
- [ ] All 2309+ tests pass
- [ ] Zero type errors (`tsc --noEmit`)
- [ ] `mock-skills.ts` is under 200 lines (from ~890 currently)
- [ ] `test-fixtures.ts` has a single `SKILLS` registry (no `SKILL_FIXTURES` or `TEST_SKILLS`)
- [ ] `createMockMatrix` accepts spread syntax
- [ ] `export default ${JSON.stringify(...)}` appears in 1 place (the renderer), not 25+
- [ ] SKILL.md content template appears in 1 place (the renderer), not 4
- [ ] No zero-reference skill IDs remain in mock data files
