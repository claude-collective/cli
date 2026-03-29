# D-138 Audit: Invalid Casts in `src/cli/commands/new/marketplace.ts`

**Date:** 2026-03-29
**Investigator:** cli-tester

## Summary

Two `as` casts in `marketplace.ts` force dummy scaffold values into generated union types where those values do not belong. Both casts exist because `generateConfigSource()` requires a `ProjectConfig`, whose fields are typed with narrow generated unions (`SkillId`, `Category`), but the marketplace scaffold generates placeholder "dummy" values that are not members of those unions.

---

## Cast Site 1: `skillName as SkillId` (lines 248 and 255)

### Exact Code (with context)

```typescript
// marketplace.ts:214
const skillName = "dummy-skill";

// marketplace.ts:245-258
// Boundary cast: custom marketplace dummy skill/category not in standard unions
const configContent = generateConfigSource({
  name: marketplaceName,
  skills: [{ id: skillName as SkillId, scope: "project", source: "eject" }],
  agents: [],
  source: ".",
  marketplace: marketplaceName,
  stack: {
    "web-developer": {
      // Boundary cast: dummy-category is not in the generated Category union
      [LOCAL_DEFAULTS.CATEGORY as Category]: [{ id: skillName as SkillId }],
    },
  },
});
```

### Type Definition

```typescript
// src/cli/types/generated/source-types.ts:165
export type SkillId = (typeof SKILL_MAP)[SkillSlug];
// Resolves to a union of ~156 literal strings like:
//   "web-framework-react" | "api-framework-hono" | "web-styling-tailwind" | ...
```

`"dummy-skill"` is NOT in the `SkillId` union. It also does not match the `SkillId` structural pattern (`${domain}-${category}-${slug}`, 3+ hyphenated segments). It is a hardcoded placeholder value that will appear in the scaffolded `config.ts` for the new marketplace project.

### Analysis: Legitimate boundary cast

This IS a legitimate parse boundary scenario, despite not being traditional "user input". The value `"dummy-skill"` is a **scaffold placeholder** -- it will be written to a generated `.claude-src/config.ts` file that the marketplace owner will later edit. It never enters the CLI's own runtime type system as a real skill; it's serialized to JSON/TypeScript source immediately via `generateConfigSource()`.

The `generateConfigSource()` function accepts `ProjectConfig` which requires `SkillId` for skill IDs. However, the function's actual behavior is purely string serialization -- it calls `JSON.stringify()` on the values. The type system is stricter than the runtime requirement here.

**Verdict:** This is a **boundary cast at a code-generation boundary**. The cast comment already exists (`// Boundary cast: custom marketplace dummy skill/category not in standard unions`). The existing comments adequately explain the rationale.

### Proposed Fix

The casts are acceptable as-is, but they could be improved in two ways:

**Option A (minimal -- keep casts, improve comments):** Already done. The existing comments are clear. No change needed.

**Option B (type-safe -- widen `generateConfigSource` input):** Create a `GeneratedProjectConfig` type that uses `string` for `id` fields, so scaffold code doesn't need casts. This would be over-engineering for a single call site and would require widening the types in `ProjectConfig` or creating a parallel type.

**Recommendation:** Keep the casts. They are at a code-generation boundary, not a runtime boundary. The generated config.ts is for a different project (the marketplace), not this CLI. The comments explain why.

---

## Cast Site 2: `LOCAL_DEFAULTS.CATEGORY as Category` (line 255)

### Exact Code

```typescript
[LOCAL_DEFAULTS.CATEGORY as Category]: [{ id: skillName as SkillId }],
```

### Type Definition

```typescript
// src/cli/types/generated/source-types.ts:540
export type Category = (typeof CATEGORIES)[number];
// Resolves to a union of ~49 literal strings like:
//   "web-framework" | "api-database" | "web-styling" | ...
```

### Value of `LOCAL_DEFAULTS.CATEGORY`

```typescript
// src/cli/lib/metadata-keys.ts:30
export const LOCAL_DEFAULTS = {
  CATEGORY: "dummy-category" as CategoryPath,
  // ...
} as const;
```

Where `CategoryPath = Category | "local"`.

So the chain is:

1. `"dummy-category"` cast to `CategoryPath` in `metadata-keys.ts` (already questionable -- `"dummy-category"` is neither a valid `Category` nor `"local"`)
2. Then `LOCAL_DEFAULTS.CATEGORY as Category` in `marketplace.ts` narrows `CategoryPath` to `Category` (still invalid -- `"dummy-category"` is not in the `Category` union)

### Analysis: Double-questionable cast, but same boundary context

`"dummy-category"` is not in the `Category` union. It is not in `CategoryPath` either (since `CategoryPath = Category | "local"`, and `"dummy-category"` is neither). The cast chain is:

```
"dummy-category" -> as CategoryPath (metadata-keys.ts:30) -> as Category (marketplace.ts:255)
```

Both casts are technically invalid -- the runtime value does not belong to either type. However, the context is the same as Cast Site 1: this value is being serialized into a scaffold `config.ts` file for a new marketplace project. It never enters this CLI's runtime type system.

### Root issue: `LOCAL_DEFAULTS.CATEGORY` itself

The root problem is in `metadata-keys.ts:30` where `"dummy-category"` is cast to `CategoryPath`. This constant is used in two places:

1. `marketplace.ts` -- scaffold code generation (this audit)
2. `new:skill` command -- generating a default category for new skills

In both cases, the value is a **placeholder for user-created content**, not a real category. It exists outside the generated union by design -- custom marketplace categories are not in the CLI's generated type system.

### Proposed Fix

**Option A (minimal -- status quo with better comments):** The existing inline comments already explain the situation. The upstream cast in `metadata-keys.ts` could use a comment too:

```typescript
export const LOCAL_DEFAULTS = {
  // Boundary cast: placeholder for custom marketplace categories, not in generated Category union
  CATEGORY: "dummy-category" as CategoryPath,
```

**Option B (type-correct -- use `string` for scaffold data):** Since `generateConfigSource()` uses `JSON.stringify()` internally, the scaffold call site could bypass the typed `ProjectConfig` and use `Record<string, unknown>` directly. But this would lose type-checking on all other fields (name, agents, source, marketplace), which is worse.

**Option C (type-correct -- add `"dummy-category"` to the union):** This is wrong. Dummy categories should NOT be in the generated union.

**Recommendation:** Keep the casts. Add a comment to `LOCAL_DEFAULTS.CATEGORY` in `metadata-keys.ts` if one doesn't already exist. The existing comments in `marketplace.ts` are adequate.

---

## Conclusion

| Cast Site                                       | Value              | Target Type                  | In Union? | Legitimate?                     | Action               |
| ----------------------------------------------- | ------------------ | ---------------------------- | --------- | ------------------------------- | -------------------- |
| Line 248: `skillName as SkillId`                | `"dummy-skill"`    | `SkillId` (156-member union) | No        | Yes -- code-generation boundary | Keep, comments exist |
| Line 255: `skillName as SkillId`                | `"dummy-skill"`    | `SkillId` (156-member union) | No        | Yes -- code-generation boundary | Keep, comments exist |
| Line 255: `LOCAL_DEFAULTS.CATEGORY as Category` | `"dummy-category"` | `Category` (49-member union) | No        | Yes -- code-generation boundary | Keep, comments exist |

**These casts are boundary casts at a code-generation boundary.** The dummy values are written to a scaffolded `config.ts` file for a new marketplace project. They never enter this CLI's runtime type system. The CLAUDE.md rule "Only cast at parse boundaries" applies here -- code generation that produces TypeScript source is analogous to a parse boundary (data crosses a trust/type boundary).

**Does `LOCAL_DEFAULTS.CATEGORY` belong in the `Category` union?** No. `"dummy-category"` is a scaffold placeholder. Adding it would pollute the generated union with non-real categories. The cast is the correct approach for this use case.

**Upstream improvement opportunity:** The cast in `metadata-keys.ts:30` (`"dummy-category" as CategoryPath`) is technically the most problematic, since `"dummy-category"` is not actually in `CategoryPath` either. A more honest type would be `string` with a comment. However, changing it would require updating all consumers, and the downstream consumers (marketplace.ts, new:skill) already know they're dealing with scaffold placeholders. The cost/benefit does not justify the change.
