# R-09b: Centralize Remaining Test Data — Matrices, Agents, Stacks

## Context

R-09 successfully centralized **skills** and **content generators** (phases 1-5, ~88% complete after 47 iterations). But three data types were never addressed:

1. **Matrices** — 270 `createMockMatrix()` calls, ~70 are duplicates of 5-7 canonical shapes
2. **Agents** — Same 4 agents (`web-developer`, `api-developer`, `web-tester`, `web-reviewer`) defined 42+ times across 8+ files
3. **Stacks** — Stack patterns repeated inline in `stack-plugin-compiler.test.ts`

Additionally: a bug in `wizard-store.test.ts` passes the entire `SKILLS` object (not individual skills) to `createMockMatrix`.

**Goal:** Consolidate all remaining test data into `src/cli/lib/__tests__/mock-data/`, following the same pattern R-09 established for skills.

---

## Phase 1: Canonical Matrix Constants

**File:** `src/cli/lib/__tests__/mock-data/mock-matrices.ts`

Add these constants (keep existing relationship matrices):

```ts
// Base shapes — no category overrides
export const EMPTY_MATRIX = createMockMatrix();
export const SINGLE_REACT_MATRIX = createMockMatrix(SKILLS.react);
export const WEB_PAIR_MATRIX = createMockMatrix(SKILLS.react, SKILLS.zustand);
export const FULLSTACK_PAIR_MATRIX = createMockMatrix(SKILLS.react, SKILLS.hono);
export const WEB_TRIO_MATRIX = createMockMatrix(SKILLS.react, SKILLS.zustand, SKILLS.vitest);
export const FULLSTACK_TRIO_MATRIX = createMockMatrix(SKILLS.react, SKILLS.hono, SKILLS.vitest);
```

**Migration targets (by count):**

| Pattern | Current calls | Replace with |
|---------|--------------|--------------|
| `createMockMatrix()` | 36 | `EMPTY_MATRIX` |
| `createMockMatrix(SKILLS.react)` | 32 | `SINGLE_REACT_MATRIX` |
| `createMockMatrix(SKILLS.react, SKILLS.zustand)` | 9 | `WEB_PAIR_MATRIX` |
| `createMockMatrix(SKILLS.react, SKILLS.hono)` | 7 | `FULLSTACK_PAIR_MATRIX` |
| `createMockMatrix(SKILLS.react, SKILLS.zustand, SKILLS.vitest)` | 5 | `WEB_TRIO_MATRIX` |
| `createMockMatrix(SKILLS.react, SKILLS.hono, SKILLS.vitest)` | 4 | `FULLSTACK_TRIO_MATRIX` |

**~93 calls replaced with 6 constants.**

Calls that add `{ categories: ... }`, `{ relationships: ... }`, or `{ suggestedStacks: ... }` overrides stay inline — they're genuinely unique per test.

**Files to update:** `local-installer.test.ts` (14 empty), `matrix-store.test.ts` (12 single), `config-generator.test.ts` (19 mixed), `plugin-finder.test.ts` (12 single), `config-types-writer.test.ts` (27 mixed), and ~15 others.

---

## Phase 2: Canonical Agent Fixtures

**File:** `src/cli/lib/__tests__/mock-data/mock-agents.ts`

Current state: 7 exports, all `web-developer` variants with different skill arrays. Missing: canonical agent *definitions* (title, description, tools) that disk-writing tests can reuse.

**Add canonical agent definitions:**

```ts
// Agent metadata — reusable for both mock objects and disk-writing tests
export const AGENT_DEFS = {
  webDev: { name: "web-developer", title: "Frontend Developer", description: "A frontend developer agent", tools: ["Read", "Write", "Glob"] },
  apiDev: { name: "api-developer", title: "Backend Developer", description: "A backend developer agent", tools: ["Read", "Write", "Bash"] },
  webTester: { name: "web-tester", title: "Tester", description: "A testing agent", tools: ["Read", "Bash"] },
  webReviewer: { name: "web-reviewer", title: "Code Reviewer", description: "A code review agent", tools: ["Read", "Grep", "Glob"] },
};
```

**Migration targets:**
- `stack-plugin-compiler.test.ts`: 22 `createAgent()` calls that repeat the same title/description/tools — replace with `AGENT_DEFS.webDev` spread
- `agent-plugin-compiler.test.ts`: 3 inline agent definitions
- `compiler.test.ts`: 4 `createMockAgentConfig` calls with repeated metadata

---

## Phase 3: Canonical Stack Fixtures

**File:** `src/cli/lib/__tests__/mock-data/mock-stacks.ts`

Current state: 14 stack constants exist but are for compilation testing. Missing: simple stack shapes for `stack-plugin-compiler.test.ts`.

**Add canonical stack shapes:**

```ts
// Stack templates — spread with a unique id per test:
//   { id: "my-test-stack", ...SINGLE_AGENT_STACK_TEMPLATE }

export const SINGLE_AGENT_STACK_TEMPLATE: Omit<Stack, "id"> = {
  name: "Test Stack",
  description: "A test stack",
  agents: { "web-developer": {} } as Stack["agents"],
};

export const MULTI_AGENT_STACK_TEMPLATE: Omit<Stack, "id"> = {
  name: "Full Stack",
  description: "A multi-agent stack",
  agents: { "web-developer": {}, "api-developer": {}, "web-tester": {} } as Stack["agents"],
};
```

Tests use: `{ id: uniqueStackId(), ...SINGLE_AGENT_STACK_TEMPLATE }`

---

## Phase 4: Fix Bugs and Old Syntax

### Bug: wizard-store.test.ts passes entire SKILLS object

Lines 22, 243, 312, 632, 688, 873, 902, 927, 954, 986, 1025 all do:
```ts
createMockMatrix(SKILLS, { categories: TEST_CATEGORIES })
```

This passes the **entire SKILLS registry object** as a single argument. It works by accident (detected as record syntax) but is semantically wrong. Should be:
```ts
createMockMatrix(...Object.values(SKILLS), { categories: TEST_CATEGORIES })
```
Or use a specific subset of skills appropriate for each test.

### Old record syntax remnants

`build-step-logic.test.ts` line 89 still uses:
```ts
createMockMatrix({ "web-framework-react": SKILLS.react, ... })
```

Convert to spread syntax. Also check for any other remaining old-syntax calls.

---

## Phase 5: Cleanup mock-data/index.ts

The barrel file was deleted but verify no stale imports remain. Ensure all mock-data imports are direct:
```ts
import { EMPTY_MATRIX } from "../mock-data/mock-matrices";
import { AGENT_DEFS } from "../mock-data/mock-agents";
```

---

## Execution Order

1. **Phase 1** (matrices) — highest impact, 93 calls replaced
2. **Phase 4** (bugs) — can run in parallel with Phase 1
3. **Phase 2** (agents) — moderate impact, 29 definitions consolidated
4. **Phase 3** (stacks) — lower impact, scoped to stack-plugin-compiler.test.ts
5. **Phase 5** (cleanup) — final sweep

Each phase is independently shippable. Tests must pass after each.

---

## Key Files

| File | Change | Phase |
|------|--------|-------|
| `src/cli/lib/__tests__/mock-data/mock-matrices.ts` | Add 6 canonical constants | 1 |
| `src/cli/lib/__tests__/mock-data/mock-agents.ts` | Add AGENT_DEFS registry | 2 |
| `src/cli/lib/__tests__/mock-data/mock-stacks.ts` | Add stack templates | 3 |
| `src/cli/stores/wizard-store.test.ts` | Fix SKILLS object bug (11 calls) | 4 |
| `src/cli/lib/wizard/build-step-logic.test.ts` | Fix old record syntax | 4 |
| ~40 test files importing createMockMatrix | Replace inline calls with constants | 1 |
| `src/cli/lib/stacks/stack-plugin-compiler.test.ts` | Use AGENT_DEFS + stack templates | 2, 3 |

---

## Verification

- [ ] All tests pass (3312+)
- [ ] Zero type errors (`tsc --noEmit`)
- [ ] No `createMockMatrix()` (no-arg) outside mock-matrices.ts — use `EMPTY_MATRIX`
- [ ] No `createMockMatrix(SKILLS.react)` (single-arg) outside mock-matrices.ts — use `SINGLE_REACT_MATRIX`
- [ ] wizard-store.test.ts no longer passes entire SKILLS object
- [ ] No old record syntax `createMockMatrix({` in test files (except empty `{}` for overrides-only)
- [ ] `AGENT_DEFS` used in stack-plugin-compiler.test.ts instead of repeated inline definitions
- [ ] mock-data/ is the single source of truth for all reusable test data
