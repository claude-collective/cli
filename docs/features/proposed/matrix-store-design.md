# Matrix Store Design

## Problem

The `MergedSkillsMatrix` is loaded once per CLI command via `loadSkillsMatrixFromSource()`, then passed around as a parameter through many layers. Functions that only need a single skill's metadata receive the full matrix or partial fragments. There is no central place to look up a `ResolvedSkill` by ID or slug without threading the matrix through every call chain.

In tests, skill data is maintained as manual constants (`TestSkill[]` arrays) with hand-specified `slug`, `category`, `domain`, etc. Test helpers like `writeTestSkill` use fragile `parseSkillId` string splitting to derive these fields. A store would let tests populate once and derive everything from the store.

## Solution

Create a Zustand store (`useMatrixStore`) that holds the loaded `MergedSkillsMatrix` as a singleton, matching the existing `useWizardStore` pattern. Populated after matrix loading in production, populated from `createMockMatrix()` in tests, queryable from anywhere.

## Store Definition

**File:** `src/cli/stores/matrix-store.ts`

```typescript
import { create } from "zustand";
import type { MergedSkillsMatrix, ResolvedSkill, SkillId, SkillSlug } from "../types/index.js";

type MatrixState = {
  matrix: MergedSkillsMatrix | null;

  setMatrix: (matrix: MergedSkillsMatrix) => void;
  reset: () => void;

  getMatrix: () => MergedSkillsMatrix;
  getSkill: (idOrSlug: SkillId | SkillSlug) => ResolvedSkill | undefined;
};

export const useMatrixStore = create<MatrixState>((set, get) => ({
  matrix: null,

  setMatrix: (matrix) => set({ matrix }),
  reset: () => set({ matrix: null }),

  getMatrix: () => {
    const { matrix } = get();
    if (!matrix) {
      throw new Error(
        "Matrix store not initialized — call setMatrix() after loading the matrix",
      );
    }
    return matrix;
  },

  getSkill: (idOrSlug) => {
    const { matrix } = get();
    if (!matrix) return undefined;
    // Try as SkillId first (direct lookup), then as SkillSlug (via slugMap)
    const direct = matrix.skills[idOrSlug as SkillId];
    if (direct) return direct;
    const id = matrix.slugMap.slugToId[idOrSlug as SkillSlug];
    return id ? matrix.skills[id] : undefined;
  },
}));
```

**Location rationale:** `src/cli/stores/` — alongside `wizard-store.ts`, the only other Zustand store. NOT in `lib/matrix/` which holds pure loading/resolution logic with no state.

## Population Point

Single population point — `loadSkillsMatrixFromSource()` in `src/cli/lib/loading/source-loader.ts`. Populate after `checkMatrixHealth()`:

```typescript
import { useMatrixStore } from "../../stores/matrix-store.js";

checkMatrixHealth(result.matrix);
useMatrixStore.getState().setMatrix(result.matrix);

return result;
```

All commands go through this function, including `validate`. The `validate` command currently calls `mergeMatrixWithSkills()` directly in `source-validator.ts` (Phase 3 cross-reference validation), duplicating the loading logic. This should be refactored to call `loadSkillsMatrixFromSource()` instead — validate should exercise the same code path it's validating, not a parallel reimplementation.

**Note:** `loadAndMergeSkillsMatrix` in `matrix-loader.ts` also calls `mergeMatrixWithSkills` but has zero production callers — dead code, no store population needed.

## Consumer Pattern

Outside React components, access via `getState()`:

```typescript
import { useMatrixStore } from "../stores/matrix-store.js";

const skill = useMatrixStore.getState().getSkill("web-framework-react"); // by ID
const skill = useMatrixStore.getState().getSkill("react");              // by slug
const matrix = useMatrixStore.getState().getMatrix();                   // throws if not populated
```

Inside React components:

```typescript
const skill = useMatrixStore((s) => s.matrix?.skills[skillId]);
```

## Test Usage

Tests populate the store in `beforeEach` with `reset` + `setMatrix`:

```typescript
import { useMatrixStore } from "../../stores/matrix-store.js";

beforeEach(() => {
  useMatrixStore.getState().reset();
  useMatrixStore.getState().setMatrix(createMockMatrix({ skills: DEFAULT_TEST_SKILLS }));
});
```

This enables test helpers like `writeTestSkill` to derive `slug`, `category`, `domain` from the store instead of `parseSkillId` string splitting. `parseSkillId` is removed entirely — if the store isn't populated, the test fails immediately, surfacing the missing `beforeEach` setup:

```typescript
// In writeTestSkill:
const known = useMatrixStore.getState().getSkill(skillId);
const slug = options?.slug ?? known?.slug;
const category = options?.category ?? known?.category;
```

Any test file that calls `writeTestSkill` must populate the store first. This is enforced by convention, not fallbacks.

## Files to Modify

| File | Change |
|------|--------|
| `src/cli/stores/matrix-store.ts` | **New** — Zustand store |
| `src/cli/lib/loading/source-loader.ts` | Import store, call `setMatrix()` after health check |
| `src/cli/lib/source-validator.ts` | Refactor Phase 3 to use `loadSkillsMatrixFromSource()` instead of calling `mergeMatrixWithSkills()` directly |

## Future Use

Once the store exists, two deferred review fixes become unblocked:

1. **Remove `parseSkillId`** in `__tests__/helpers.ts` — `writeTestSkill` derives slug/category/domain from store; `parseSkillId` is deleted entirely
2. **Simplify `writeLocalSkillOnDisk`/`writeRemoteSkillOnDisk`** in `skill-copier.test.ts` — remove optional slug/category params, derive from store

## Verification

- `npx tsc --noEmit` — zero type errors
- `npx vitest run src/cli/stores/` — store tests pass
- `npx vitest run src/cli/lib/loading/source-loader.test.ts` — source loader tests pass
- `npx vitest run src/cli/lib/matrix/` — matrix tests pass
