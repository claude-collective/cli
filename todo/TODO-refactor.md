# Agents Inc. CLI - Refactoring Tasks

> Refactoring tasks from [TODO.md](./TODO.md) are tracked here separately.

| ID   | Task                                                                                                                                                                                                    | Status        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| R-09 | Consolidate test fixtures — canonical skill registry, unified content generators, simplified matrix creation (see [implementation plan](./R-09-test-fixture-consolidation.md))                          | Ready for Dev |
| R-01 | `loadStackById` should check default stacks internally — callers shouldn't need to know about both sources                                                                                              | Refactor      |
| R-03 | Simplify `config-generator.ts` — reduce nested loops, intermediate maps, and function complexity                                                                                                        | Refactor      |
| R-04 | Eliminate redundant central config — derive aliases from metadata, move perSkill relationships to group-based declarations                                                                              | Phase 1 Done  |
| R-06 | Slim down `ResolvedSkill` — separate resolved relationship data from skill identity/metadata to reduce type bloat                                                                                       | Refactor      |
| R-07 | Codegen `SkillSlug` union from metadata.yaml — auto-generate the type from skills source instead of manual maintenance                                                                                  | Refactor      |
| R-08 | Unify resolve\* functions in matrix-loader — single function for resolving relationships (conflicts, compatibility, setup, requirements) instead of 5 separate functions with duplicate iteration logic | Refactor      |
| R-11 | Eliminate `ProjectSourceConfig` / `saveProjectConfig` — all config writes should produce full `ProjectConfig` with import + satisfies                                                                   | Refactor      |
| R-12 | Delete the matrix object from consumer code — only exists inside the store as private state, all reads via store accessors                                                                              | Refactor      |

---

## R-04: Eliminate Redundant Central Config

**Related:** D-67 (skill metadata as single source of truth)
**Depends on:** Nothing (D-37 per-skill scope is complete; this task is orthogonal)

### Problem

`default-rules.ts` (973 lines) contains three sections:

1. **`aliases`** (~85 entries) — maps short names to canonical IDs. Pure duplication: every skill already declares both its `displayName` in `metadata.yaml` and its canonical ID in `SKILL.md` frontmatter. Maintained by hand and must be updated every time a skill is added.

2. **`perSkill`** (~50 entries, ~415 lines) — declares `compatibleWith`, `requiresSetup`, `providesSetupFor`, `conflictsWith`, and `requires` per skill, keyed by alias short names. These are all multi-skill relationships that reference other skills. They are the same kind of relationship as `conflicts`, `requires`, and `recommends` in the `relationships` section — they just happen to be keyed per-skill instead of declared as groups.

3. **`relationships`** (~445 lines) — `conflicts`, `discourages`, `recommends`, `requires`, `alternatives`. Already group-based and centrally managed. **All entries use canonical IDs** (e.g., `"web-framework-react"`, not `"react"`). This is the correct pattern.

### Design Principles

**All multi-skill relationships belong in `relationships` (central, group-based).** A relationship is multi-skill if it references other skill IDs. This includes `compatibleWith`, `requiresSetup`/`providesSetupFor`, and `conflictsWith` — all currently in `perSkill`.

**All single-skill properties belong in the skill's `metadata.yaml`.** A property is single-skill if it describes only that skill: `displayName`, `slug`, `category`, `domain`, `tags`, `description`, `usageGuidance`, `author`. Per-skill relationship fields (`compatibleWith`, `conflictsWith`, `requires`) are removed from `SkillMetadataConfig` — all relationships are centralized.

**Compatibility groups must be narrow and specific.** Each group is a tight cluster of skills that genuinely work together — not a broad "ecosystem" dump. A skill appears in multiple tight groups rather than one huge group. This prevents false compatibility (e.g., `react-query` and `swr` are both React libraries but conflict with each other — they must NOT be in the same compatibility group).

**Recommendations are separated from compatibility.** `recommends` is a flat list of opinionated picks — skills we actively suggest. `compatibleWith` is a technical fact about which skills work together. A skill only shows the recommended badge if it is BOTH recommended AND compatible with the user's current selections. This prevents both false recommendations (recommended but incompatible) and recommendation bloat (everything compatible getting a badge).

### Implementation Phases

**Phase 1 (structural):** Kill `aliases`, kill `perSkill`, add `compatibleWith` groups, `setupPairs`, and flat `recommends`. Redesign `recommends` from symmetric groups to flat opinionated picks gated by compatibility. All relationship rules use canonical IDs (which they already do). Get all tests passing.

**Phase 2 (mechanical):** Migrate all relationship rules from canonical IDs to slugs for readability. This is a large but purely mechanical find-and-replace. Done last, after Phase 1 is stable.

### Changes

#### 1. Add `slug` field to metadata.yaml, derive alias map from it

**New field: `slug`** in each skill's `metadata.yaml`:

```yaml
# skills/web/framework/react/metadata.yaml
category: web-framework
domain: web
author: "@vince"
displayName: React # Title-cased, for UI labels
slug: react # Kebab-case short key, for alias resolution and search
```

Three identifiers, three purposes:

| Field                           | Example               | Where         | Purpose                                                          |
| ------------------------------- | --------------------- | ------------- | ---------------------------------------------------------------- |
| `name` (SKILL.md frontmatter)   | `web-framework-react` | SKILL.md      | Canonical ID — types, configs, code                              |
| `displayName` (metadata.yaml)   | `React`               | metadata.yaml | UI labels — wizard display, search results                       |
| `slug` (metadata.yaml, **new**) | `react`               | metadata.yaml | Short key — alias resolution, search, Phase 2 relationship rules |

**Important:** `slug` is NOT derivable from `displayName`. They are independent values. Examples: `displayName: "Observability"` → `slug: axiom-pino-sentry`, `displayName: "Motion"` → `slug: framer-motion`, `displayName: "Apollo Client"` → `slug: graphql-apollo`. The slug values come directly from the current `aliases` keys in `default-rules.ts`.

The loader derives the alias map at load time:

```typescript
const slugToId: Record<string, SkillId> = {};
for (const skill of extractedSkills) {
  if (skill.slug) {
    slugToId[skill.slug] = skill.id;
  }
}
```

This replaces the hand-maintained ~85-entry `aliases` section.

**Slug uniqueness:** Slugs must be globally unique across all skills. The loader should error on duplicate slugs. Slugs must NOT match the `SkillId` pattern (domain-prefixed, 3+ segments) to prevent namespace collisions with canonical IDs.

**Dual aliases:** Some skills currently have two alias keys (e.g., `commander` and `cli-commander` both → `cli-framework-cli-commander`). Each skill gets one slug. Pick the more commonly used one. The other becomes dead.

**Skills with no current alias:** 4 skills (3 i18n + native-js) have no alias entry today. They get new slugs: `next-intl`, `react-intl`, `vue-i18n`, `native-js`.

**Orphan alias cleanup:** `api-testing` maps to `api-testing-api-testing` which doesn't exist. Remove it.

**Changes to `ExtractedSkillMetadata`:** Add `displayName: string` (title-cased, required) and `slug: SkillSlug` (kebab-case, required). Both are currently read from `metadata.yaml` but not carried on the type.

**`ResolvedSkill` gets both fields:** `displayName` (title-cased, for UI — "React") and `slug` (kebab-case, for alias resolution — "react"). This is NOT a rename — both fields coexist. `displayName` is the UI-facing label used throughout the wizard, search, and info commands. `slug` is for alias resolution and Phase 2 relationship rules.

**`SkillOption.displayName`:** Stays as a field. Gets populated with the actual title-cased `displayName` from metadata (e.g., "React"), not the kebab-case slug. Currently holds the slug value (misnamed) — R-04 fixes this so it holds the real display name.

**Rename `SkillDisplayName` type:** The current `SkillDisplayName` type is actually the alias/slug type (kebab-case like `"react"`), not the title-cased display name. Rename to `SkillSlug` throughout.

**`SkillSlug` is a union type:** All ~85 valid slugs enumerated as a union in `types/skills.ts`, similar to the existing `Category` union (~40 values). This gives compile-time type checking on relationship rules in `default-rules.ts` — any slug typo is caught by `tsc`. The union replaces the alias map as the CLI-side source of truth for valid slug values. When a new skill is added, one entry is added to the union.

```typescript
// types/skills.ts
export type SkillSlug =
  | "react"
  | "vue"
  | "angular"
  | "solidjs"
  | "nextjs-app-router"
  | "remix"
  | "nuxt"
  | "zustand"
  | "redux-toolkit"
  | "pinia";
// ... ~85 total
```

**Changes to `MergedSkillsMatrix`:** Rename `displayNameToId` → `slugToId` and `displayNames` → `idToSlug` to reflect what these maps actually contain. `slugToId` maps `"react"` → `"web-framework-react"` (lookup by short key). `idToSlug` maps `"web-framework-react"` → `"react"` (reverse lookup for display).

**`getLabel()` helper in `matrix-resolver.ts`:** Simplify to just return `displayName` — it's required on all skills, no fallback to `id` needed.

#### 2. Move `compatibleWith` to group-based `relationships.compatibleWith`

**Current** (per-skill, unidirectional):

```typescript
perSkill: {
  zustand: { compatibleWith: ["web-framework-react", "web-server-state-react-query", ...] },
  "react-query": { compatibleWith: ["web-framework-react", "web-state-zustand", ...] },
}
```

**New** (group-based, symmetric, narrow groups, canonical IDs in Phase 1):

```typescript
relationships: {
  compatibleWith: [
    // Zustand works with React-based frameworks
    {
      skills: ["web-state-zustand", "web-framework-react",
               "web-framework-nextjs-app-router", "web-framework-remix",
               "mobile-framework-react-native"],
      reason: "Zustand works with React-based frameworks",
    },
    // React Query works with React-based frameworks
    {
      skills: ["web-server-state-react-query", "web-framework-react",
               "web-framework-nextjs-app-router", "web-framework-remix",
               "mobile-framework-react-native"],
      reason: "React Query works with React-based frameworks",
    },
    // SWR works with React and Next.js
    {
      skills: ["web-data-fetching-swr", "web-framework-react",
               "web-framework-nextjs-app-router"],
      reason: "SWR works with React and Next.js",
    },
    // Zustand + React Query are complementary
    {
      skills: ["web-state-zustand", "web-server-state-react-query",
               "web-data-fetching-swr"],
      reason: "Client state + server state are complementary",
    },
    // Vue ecosystem
    {
      skills: ["web-framework-vue-composition-api", "web-framework-nuxt",
               "web-state-pinia", "web-forms-vee-validate",
               "web-testing-vue-test-utils"],
      reason: "Vue core ecosystem",
    },
    // Drizzle works with API frameworks
    {
      skills: ["api-database-drizzle", "api-framework-hono",
               "api-framework-express", "api-framework-fastify"],
      reason: "Drizzle works with Node API frameworks",
    },
    // ... more tight groups
  ],
}
```

**Key difference from first draft:** Groups are narrow and specific. NOT "React ecosystem" with 14 members. Instead, multiple small groups like "Zustand + React frameworks", "React Query + React frameworks", "Zustand + React Query" (complementary). This prevents false compatibility between skills that happen to be in the same ecosystem but conflict (e.g., `react-query` and `swr` are NEVER in the same group).

**Group design rule:** If two skills in a proposed group are in a `conflicts` or `discourages` group, they must NOT be in the same `compatibleWith` group. Split into separate groups instead.

**Resolution:** For each skill, the resolver collects all other skills that share a `compatibleWith` group with it. This produces `compatibleWith: SkillId[]` on `ResolvedSkill` (used for framework filtering). Compatibility does NOT feed `recommends` — recommendations are a separate concern (see section 4b).

**Framework filtering:** The build step filter (`build-step-logic.ts:88-102`) only applies to non-framework categories in the web domain (line 130-131). Frameworks are never filtered by their own `compatibleWith`. Frameworks getting populated arrays from groups is harmless.

**Estimated group count:** ~30-40 narrow groups (more groups than the 15-20 estimated for broad groups, but each is small and precise).

#### 3. Redesign `recommends` as flat opinionated picks

**Current** (directional rules — ~26 entries with `{when, suggest[], reason}`):

```typescript
relationships: {
  recommends: [
    { when: "web-framework-react", suggest: ["web-state-zustand", ...], reason: "..." },
    { when: "web-framework-vue-composition-api", suggest: ["web-state-pinia", ...], reason: "..." },
    // ~26 directional rules
  ],
}
```

**Problem:** The current format is directional (good), but `resolveRecommends()` in `matrix-loader.ts` conflates `perSkill.compatibleWith` entries into the same `ResolvedSkill.recommends` array. This means "compatible with" gets treated as "recommended by," causing false recommendations — e.g., Zustand's `compatibleWith: ["web-framework-react"]` makes React appear as "recommended" when Zustand is selected. Separating `compatibleWith` into its own relationship type (section 2) fixes the root cause. The `recommends` format itself is also simplified from directional rules to flat picks.

**New** (flat opinionated picks, canonical IDs in Phase 1):

```typescript
relationships: {
  recommends: [
    { skill: "web-state-zustand", reason: "Recommended client state management" },
    { skill: "web-server-state-react-query", reason: "Recommended server state" },
    { skill: "api-database-drizzle", reason: "Recommended ORM" },
    { skill: "web-testing-vitest", reason: "Recommended test runner" },
    { skill: "web-forms-react-hook-form", reason: "Recommended React form library" },
    { skill: "web-forms-vee-validate", reason: "Recommended Vue form library" },
    { skill: "web-state-pinia", reason: "Recommended Vue state management" },
    { skill: "api-framework-hono", reason: "Recommended API framework" },
    // ~15-20 entries total
  ],
}
```

**Badge logic:** A skill shows the recommended badge only when BOTH conditions are true:

1. The skill is in the `recommends` list (opinionated pick)
2. The skill is compatible with the user's current selections (via `compatibleWith` groups)

If no framework is selected yet, compatibility is unconstrained, so all recommended skills show badges. Once a framework is selected, only recommended skills that share a `compatibleWith` group with the selected framework show badges.

**Type change:**

```typescript
// Old: directional rule
type RecommendRule = { when: SkillId; suggest: SkillId[]; reason: string };

// New: flat pick
type Recommendation = { skill: SkillId; reason: string };
```

**Resolution change:** `ResolvedSkill.recommends` field is **removed**. Replaced by:

- `ResolvedSkill.isRecommended: boolean` — computed at resolution time from flat list membership
- `ResolvedSkill.recommendedReason?: string` — the reason from the flat list entry (e.g., "Recommended client state management"), set alongside `isRecommended` during resolution. Avoids a second lookup at render time.
- Badge display combines `isRecommended && isCompatibleWithSelections` at render time

The resolver sets `isRecommended` and `recommendedReason` by checking flat list membership. The wizard's `isRecommended()` function in `matrix-resolver.ts` changes from "check if any selected skill has this in its recommends array" to "check `skill.isRecommended && skill shares a compatibleWith group with any selected skill`."

**Skills with empty `compatibleWith`:** If a skill has `compatibleWith: []` (no compatibility groups), it's compatible with everything. A recommended skill with no groups always shows the badge — this is correct for domain-agnostic skills. Compatibility groups should reflect actual technical relationships, not be prerequisites for recommendations.

**Consumers that change:**

- `matrix-resolver.ts:isRecommended()` — new logic: `skill.isRecommended && isCompatibleWithSelections`
- `matrix-resolver.ts:getRecommendReason()` — returns `skill.recommendedReason` directly (no lookup needed)
- `matrix-resolver.ts:validateRecommendations()` — new logic: iterate the flat `recommends` list. For each recommended skill that is NOT selected but IS compatible with current selections, produce a `missing_recommendation` warning.
- `commands/info.ts` — display `isRecommended` status and `recommendedReason` instead of iterating `recommends` array
- `source-loader.ts` — no longer merges `recommends` arrays for local skill overrides

**Benefits:**

- `recommends` shrinks from ~26 directional rules to ~15-20 flat entries
- Root cause fixed — `compatibleWith` no longer conflated into `recommends`
- No false recommendations — Zustand doesn't get a badge when Vue is selected
- Clear separation — opinions (recommends) vs technical facts (compatibleWith)
- Easy to maintain — adding a recommended skill is one line

#### 4a. Move `requiresSetup`/`providesSetupFor` to `relationships.setupPairs`

**Current** (per-skill, bidirectional declared separately):

```typescript
perSkill: {
  posthog: { requiresSetup: ["api-analytics-setup-posthog"] },
  "posthog-setup": { providesSetupFor: ["api-analytics-posthog-analytics", "api-flags-posthog-flags"] },
}
```

**New** (single declaration, canonical IDs in Phase 1):

```typescript
relationships: {
  setupPairs: [
    {
      setup: "api-analytics-setup-posthog",
      configures: ["api-analytics-posthog-analytics", "api-flags-posthog-flags"],
      reason: "PostHog analytics setup",
    },
    {
      setup: "api-email-setup-resend",
      configures: ["api-email-resend-react-email"],
      reason: "Resend email setup",
    },
    {
      setup: "api-observability-setup-axiom-pino-sentry",
      configures: ["api-observability-axiom-pino-sentry"],
      reason: "Observability setup",
    },
  ],
}
```

**Resolution:** For each setup pair, the resolver derives:

- For each skill in `configures`: `requiresSetup` includes the `setup` skill
- For the `setup` skill: `providesSetupFor` includes all `configures` skills

#### 4b. Absorb remaining `perSkill` entries into existing relationship types

**`conflictsWith` (3 entries):**

| Entry                                                                       | Already in `relationships.conflicts`?                            | Action                |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------- | --------------------- |
| `oclif: { conflictsWith: ["cli-framework-cli-commander"] }`                 | YES — line 186-188 covers CLI frameworks                         | Remove (redundant)    |
| `tailwind: { conflictsWith: ["web-styling-scss-modules"] }`                 | NO — only in alternatives, not conflicts                         | Add new conflict rule |
| `mobx: { conflictsWith: ["web-state-zustand", "web-state-redux-toolkit"] }` | NO — only in discourages (soft), perSkill declares hard conflict | Add new conflict rule |

**`requires` (4 entries):**

| Entry                                                                        | Already in `relationships.requires`?                                                                               | Action                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| `"better-auth": { requires: ["api-database-drizzle"] }`                      | YES — line 456-460 (needsAny: Drizzle OR Prisma). perSkill is more restrictive (Drizzle only) and likely outdated. | Remove (redundant, perSkill version is wrong) |
| `"framer-motion": { requires: ["web-framework-react"] }`                     | NO                                                                                                                 | Add new require rule                          |
| `"nextjs-server-actions": { requires: ["web-framework-nextjs-app-router"] }` | NO                                                                                                                 | Add new require rule                          |
| `"cli-reviewing": { requires: ["cli-framework-cli-commander"] }`             | NO                                                                                                                 | Add new require rule                          |

After this, `perSkill` is empty and removed.

#### 5. Phase 2: Migrate relationship rules from canonical IDs to slugs

After Phase 1 is complete and all tests pass, mechanically replace all canonical IDs in the `relationships` section with their corresponding slugs:

```typescript
// Phase 1 (canonical IDs — current format, typed as SkillId[])
conflicts: [
  { skills: ["web-framework-react", "web-framework-vue-composition-api", ...], reason: "..." },
]

// Phase 2 (slugs — readable, typed as SkillSlug[])
conflicts: [
  { skills: ["react", "vue", "angular", "solidjs", "nextjs-app-router", "remix", "nuxt"], reason: "..." },
]
```

This is a large (~80 rules, hundreds of ID references) but purely mechanical change. The resolver maps slugs to canonical IDs via the `slugToId` map before processing any relationship logic. All behavior stays identical.

**Type change:** All relationship rule types (`ConflictRule`, `CompatibilityGroup`, `SetupPair`, `Recommendation`, `RequireRule`, etc.) change their skill reference arrays from `SkillId` to `SkillSlug`. Since `SkillSlug` is a union type, all slug values in `default-rules.ts` are type-checked at compile time — any typo is caught by `tsc`. The resolver maps `SkillSlug → SkillId` via the `slugToId` map before processing.

**No backwards compatibility concerns.** Pre-1.0 — source repos must update their `skill-rules.ts` files to use slugs. `slug` is required on all metadata.yaml files.

**All relationship types migrate:** `conflicts`, `discourages`, `recommends`, `requires`, `alternatives`, `compatibleWith`, `setupPairs`. After Phase 2, `default-rules.ts` is fully human-readable and fully type-checked.

#### 6. Result

**Before** (973 lines):

```typescript
export const defaultRules: SkillRulesConfig = {
  version: "1.0.0",
  aliases: { ... },           // ~85 entries — REMOVED
  relationships: { ... },     // ~445 lines — STAYS, gains compatibleWith + setupPairs, recommends redesigned
  perSkill: { ... },          // 415 lines — REMOVED
};
```

**After Phase 1** (~450-550 lines, canonical IDs):

```typescript
export const defaultRules: SkillRulesConfig = {
  version: "2.0.0",
  relationships: {
    conflicts: [...],         // ~14 rules (absorbed 2 from perSkill)
    discourages: [...],       // 6 rules
    recommends: [...],        // ~15-20 flat picks (down from ~25 symmetric groups)
    requires: [...],          // ~21 rules (absorbed 3 from perSkill)
    alternatives: [...],      // 19 groups
    compatibleWith: [...],    // ~30-40 narrow groups (NEW)
    setupPairs: [...],        // 3 pairs (NEW)
  },
};
```

**After Phase 2** (~350-450 lines, slugs — more compact):
Same structure but all canonical IDs replaced with slugs. More readable, fewer characters.

### Type Changes

| Type                       | Change                                                                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SkillRulesConfig`         | Remove `aliases` and `perSkill` fields.                                                                                                                                                                                                                                                                             |
| `RelationshipDefinitions`  | Add `compatibleWith?: CompatibilityGroup[]` and `setupPairs?: SetupPair[]`. Change `recommends` from `RecommendRule[]` to `Recommendation[]`.                                                                                                                                                                       |
| `CompatibilityGroup` (new) | `{ skills: SkillId[]; reason: string }` in Phase 1, `{ skills: SkillSlug[]; reason: string }` in Phase 2. Same shape as `ConflictRule`.                                                                                                                                                                             |
| `SetupPair` (new)          | `{ setup: SkillId; configures: SkillId[]; reason: string }` in Phase 1, changes to `SkillSlug` in Phase 2.                                                                                                                                                                                                          |
| `Recommendation` (new)     | `{ skill: SkillId; reason: string }` in Phase 1, `{ skill: SkillSlug; reason: string }` in Phase 2. Flat opinionated pick. Replaces directional `RecommendRule`.                                                                                                                                                    |
| `RecommendRule`            | Remove entirely (replaced by `Recommendation`).                                                                                                                                                                                                                                                                     |
| `SkillSlug` (new)          | Union type of ~85 valid slug values in `types/skills.ts`. Provides compile-time type checking for relationship rules. Replaces `SkillDisplayName`.                                                                                                                                                                  |
| `PerSkillRules`            | Remove entirely.                                                                                                                                                                                                                                                                                                    |
| `SkillMetadataConfig`      | Remove `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` fields — all relationships are centralized.                                                                                                                                                                               |
| `ExtractedSkillMetadata`   | Add `displayName: string` (title-cased, required) and `slug: SkillSlug` (kebab-case, required).                                                                                                                                                                                                                     |
| `ResolvedSkill`            | Add `slug: SkillSlug`. Keep `displayName` (now carries the title-cased value from metadata, not the slug). Add `isRecommended: boolean` and `recommendedReason?: string` (both computed at resolution time from centralized `relationships.recommends` — NOT metadata). Remove `recommends: SkillRelation[]` field. |
| `SkillOption`              | Keep `displayName` field (now carries title-cased value). Add `slug: SkillSlug` if needed for lookups.                                                                                                                                                                                                              |
| `SkillDisplayName` type    | Rename to `SkillSlug` (it was always the slug, not the display name).                                                                                                                                                                                                                                               |
| `MergedSkillsMatrix`       | Rename `displayNameToId` → `slugToId`, `displayNames` → `idToSlug`.                                                                                                                                                                                                                                                 |

### File Changes

#### Production code

| File                                               | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli/lib/configuration/default-rules.ts`       | Phase 1: Remove `aliases` and `perSkill`. Add `compatibleWith` groups, `setupPairs`, and flat `recommends` to `relationships`. Absorb perSkill `conflictsWith` (2 new rules) and `requires` (3 new rules). Phase 2: Replace all canonical IDs with slugs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `src/cli/types/matrix.ts`                          | Remove `PerSkillRules`, `RecommendRule`. Remove `aliases` and `perSkill` from `SkillRulesConfig`. Add `CompatibilityGroup`, `SetupPair`, `Recommendation`. Change `recommends` type on `RelationshipDefinitions`. Add `compatibleWith` and `setupPairs` to `RelationshipDefinitions`. Add `slug` to `ExtractedSkillMetadata` and `ResolvedSkill`. Add `isRecommended` to `ResolvedSkill`, remove `recommends` field. Fix `displayName` on `ResolvedSkill` and `SkillOption` to carry the title-cased value. Rename `displayNameToId`/`displayNames` on `MergedSkillsMatrix`.                                                                                                                                                                                                                                                                                                                                 |
| `src/cli/types/skills.ts`                          | Add `SkillSlug` type. Rename `SkillDisplayName` → `SkillSlug` (update all references repo-wide). Remove `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` from `SkillMetadataConfig`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `src/cli/lib/matrix/matrix-loader.ts`              | `extractAllSkills()`: carry both `displayName` (title-cased) and `slug` (kebab-case) through. Build `slugToId` map from metadata with duplicate-slug validation. `mergeMatrixWithSkills()`: remove `aliases` and `perSkillRules` params. `buildResolvedSkill()`: remove all `perSkill` parameter usage, set `isRecommended`/`recommendedReason` from flat list, derive `compatibleWith` from groups, derive `requiresSetup`/`providesSetupFor` from `setupPairs`. Remove `resolveRecommends()` (conflated compatibleWith+recommends), add `resolveCompatibilityGroups()`, `resolveSetupPairs()`. Simplify `resolveConflicts()`/`resolveRequirements()` signatures — remove `metadataConflicts`/`metadataRequires` first params (now always `[]`). `rawMetadataSchema` (lines 48-57): add `slug` field. `loadSkillRules()`: update for new schema. `loadAndMergeSkillsMatrix()`: stop passing removed params. |
| `src/cli/lib/schemas.ts`                           | Update `skillRulesFileSchema` — remove `aliases` and `per-skill`. Add `compatibleWith`, `setupPairs`, and updated `recommends` to `relationshipDefinitionsSchema` (optional, `[]` defaults). Add `slug` to `rawMetadataSchema` (required). Update or rename `skillDisplayNameSchema` → `skillSlugSchema`. Update `localRawMetadataSchema` if it exists.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `src/cli/lib/matrix/matrix-resolver.ts`            | `resolveAlias()`: use `slugToId` map. `getLabel()`: simplify to just return `displayName` (required, no fallback). `isRecommended()`: rewrite — check `skill.isRecommended && isCompatibleWithSelections`. `getRecommendReason()`: return `skill.recommendedReason` directly (no lookup needed). `validateRecommendations()`: new logic — iterate flat `recommends` list, for each recommended skill not selected but compatible with current selections, produce `missing_recommendation` warning. `getAvailableSkills()`: update to use new `isRecommended` logic.                                                                                                                                                                                                                                                                                                                                         |
| `src/cli/lib/loading/source-loader.ts`             | Remove `aliases` and `perSkillRules` variables and merge logic (lines 204-205, 250-253). Add `compatibleWith`, `setupPairs`, and `recommends` to relationship array concatenation with `?? []` guards. Update `mergeMatrixWithSkills()` call (lines 267-273). Update `mergeLocalSkillsIntoMatrix()` (lines 610-636) — manual `ResolvedSkill` construction needs: set `slug` from `idToSlug` map or local metadata, set `displayName` to title-cased value from metadata, set `isRecommended`/`recommendedReason` from flat list lookup, remove `recommends` field.                                                                                                                                                                                                                                                                                                                                           |
| `src/cli/lib/source-validator.ts`                  | Update fallback `SkillRulesConfig` construction — remove `aliases` and `perSkill`. Change displayName-vs-directory check (~line 167) to use `slug` instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/cli/config-exports.ts`                        | `SkillRulesConfig` shape changes. Breaking (pre-1.0).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/cli/lib/loading/multi-source-loader.ts`       | Update if it passes aliases through.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| `src/cli/commands/new/skill.ts`                    | `generateSkillRulesTs()`: stop generating `aliases` section. `generateMetadataYaml()`: add `slug` field. `updateConfigFiles()`: stop updating `aliases` in existing `skill-rules.ts` files.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `src/cli/lib/wizard/build-step-logic.ts`           | `computeOptionState()`: update to use `isRecommended && isCompatibleWithSelections` instead of checking `skill.recommended`. `getSkillDisplayLabel()`: uses `displayName` (now title-cased, correct).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `src/schemas/metadata.schema.json`                 | Add `slug` (required). Remove `requires`, `compatibleWith`, `conflictsWith`, `requiresSetup`, `providesSetupFor` — all relationships centralized. Must be updated FIRST (has `additionalProperties: false`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/cli/commands/info.ts`                         | Update `.displayName` references (3) to use title-cased value. Update `displayNameToId` → `slugToId`. Display `isRecommended` / `recommendedReason` instead of iterating removed `recommends` array. Change "Alias:" label to use `slug` (currently shows `displayName` which will be title-cased after R-04).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `src/cli/commands/init.tsx`                        | Update `skill?.displayName` reference (1) — now title-cased.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/cli/commands/search.tsx`                      | Update `skill.displayName` references (3) — now title-cased. Fix sort key (line 275) to use `.toLowerCase()` or `slug` to avoid ASCII case-sensitivity sort order change. Update synthetic `SourcedSkill` construction (lines 71-91) — add `slug`, `isRecommended`, remove `recommends`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `src/cli/commands/edit.tsx`                        | Update `skill?.displayName` references (2) — now title-cased.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `src/cli/components/skill-search/skill-search.tsx` | Update `skill.displayName` references (2) — now title-cased.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `src/cli/lib/plugins/plugin-finder.ts`             | Update `.displayName` references (2). Currently builds `aliasToId` from `skill.displayName.toLowerCase()` — change to use `slug`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `src/cli/lib/skills/skill-plugin-compiler.ts`      | Currently reads `metadata.requires` (line 93) to generate "Requires" section in plugin README. Must derive requirements from centralized `relationships.requires` instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `src/cli/lib/skills/local-skill-loader.ts`         | Update `metadata.displayName` reference — add `slug` handling.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

#### Test code

| File                                                                           | Change                                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/lib/__tests__/helpers.ts`                                             | Update `MockMatrixConfig` — remove `aliases`. Update `mergeMatrixWithSkills()` call sites. Update factory defaults: remove `recommends: []`, add `isRecommended: false`, add `slug`.                                               |
| `src/cli/lib/__tests__/mock-data/mock-matrices.ts`                             | Update `SkillRulesConfig` / `PerSkillRules` usage. Update mock skills with `recommends` arrays → `isRecommended: boolean`.                                                                                                         |
| `src/cli/lib/configuration/__tests__/default-rules.test.ts`                    | Rewrite — remove alias/perSkill assertions, add compatibleWith/setupPairs/recommends assertions.                                                                                                                                   |
| `src/cli/lib/matrix/matrix-loader.test.ts`                                     | Rewrite `loadSkillRules`, `mergeMatrixWithSkills`, `resolveRecommends` tests.                                                                                                                                                      |
| `src/cli/lib/matrix/matrix-resolver.test.ts`                                   | Rewrite `isRecommended()` tests (13+ refs). Update `getRecommendReason()`, `validateRecommendations()` tests. Update `getAvailableSkills()` tests. Update mock skills constructing `recommends: [...]` → `isRecommended: boolean`. |
| `src/cli/lib/matrix/matrix-health-check.test.ts`                               | Update mock skill data — `recommends` field removed.                                                                                                                                                                               |
| `src/cli/lib/matrix/skill-resolution.integration.test.ts`                      | Update direct `recommends` assignments. Update `displayNameToId` references.                                                                                                                                                       |
| `src/cli/lib/__tests__/integration/consumer-stacks-matrix.integration.test.ts` | Update `recommends` assertions. Update `displayName` assertions.                                                                                                                                                                   |
| `src/cli/components/wizard/category-grid.test.tsx`                             | Update `state: "recommended"` test cases if badge logic changes.                                                                                                                                                                   |
| `fixtures/create-test-source.ts`                                               | Update metadata.yaml generation to include `slug` field.                                                                                                                                                                           |

### Skills Repo Changes

Every `metadata.yaml` gets a new required `slug` field. Values come directly from the current `aliases` keys in `default-rules.ts`:

```yaml
# Before
category: web-framework
domain: web
displayName: React

# After
category: web-framework
domain: web
displayName: React
slug: react
```

4 skills without current aliases get new slugs: `next-intl`, `react-intl`, `vue-i18n`, `native-js`.

**Deployment order:**

1. CLI updates `metadata.schema.json` to allow `slug` field (without this, `additionalProperties: false` rejects the new field)
2. Skills repo adds `slug` to all `metadata.yaml` files
3. CLI deploys Phase 1 (reads `slug`, removes `aliases`/`perSkill`, redesigns `recommends`)
4. CLI deploys Phase 2 (migrates relationship rules to slugs)

### What Does NOT Change

- **`MergedSkillsMatrix`** — same shape (field names change but semantics identical)
- **Framework filtering** (`build-step-logic.ts`) — same logic, same results (uses `compatibleWith` array, unchanged)
- **Compilation pipeline** — reads resolved skills, unchanged
- **Installation pipeline** — reads `SkillConfig[]`, unchanged
- **Categories** — still defined centrally
- **`skill-categories.ts`** in source repos — unchanged

### What DOES Change (behavioral)

- **Recommendation badges** — fewer skills show badges. Previously: directional rules plus `compatibleWith` conflated into `recommends`. Now: only skills in the flat `recommends` list that are also compatible with current selections. This is intentional — recommendations become more meaningful and compatibility is no longer confused with endorsement.
- **`ResolvedSkill`** — `displayName` now carries the title-cased value from metadata (e.g., "React") instead of the kebab-case slug. New `slug: SkillSlug` field for the kebab-case key. New `isRecommended: boolean` field. `recommends: SkillRelation[]` field removed entirely.
- **`SkillMetadataConfig`** — `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor` fields all removed. All relationships are centralized in `default-rules.ts`.
- **`skill-plugin-compiler.ts`** — no longer reads `metadata.requires` directly. Must look up requirements from centralized `relationships.requires` rules.
- **`plugin-finder.ts`** — alias lookup changes from `skill.displayName.toLowerCase()` to `skill.slug`.

### Resolved Questions

#### Q1: Should `compatibleWith` groups feed `recommends`? — NO

Compatibility and recommendation are separate concerns. `compatibleWith` is a technical fact (these skills work together). `recommends` is an opinionated pick (we actively suggest this skill). The badge shows only when both are true: the skill is recommended AND compatible with current selections. This prevents recommendation bloat where every compatible skill gets a badge.

#### Q2: How to handle skills in multiple compatibility groups? — UNION

A skill's `compatibleWith` is the union of all co-members across all groups (minus itself).

#### Q3: Should we validate group consistency with conflicts? — YES, WARN + PREVENT

If two skills are in the same `compatibleWith` group AND the same `conflicts` group, that's a data error. Warn at load time. **Group design rule:** never put conflicting skills in the same compatibility group — split into separate groups.

#### Q4: Ordering — before or after D-38? — INDEPENDENT

R-04 changes where data comes from. D-38 changes what it means. No conflict.

#### Q5: New `RelationshipDefinitions` fields optional? — YES

`compatibleWith` and `setupPairs` are optional with `?? []` defaults so source repos can omit them.

#### Q6: `config-exports.ts` break? — ACKNOWLEDGED

Pre-1.0, no shim needed.

#### Q7: Do relationship rules use slugs or canonical IDs? — PHASED

Phase 1: canonical IDs (consistent with current format, no ambiguity). Phase 2: slugs (readable, done last as mechanical migration after Phase 1 is stable).

#### Q8: What about `SkillDisplayName` misnomer? — RENAME TO `SkillSlug`

`SkillDisplayName` was always the slug type (kebab-case like `"react"`), not the title-cased display name. R-04 renames it to `SkillSlug` and updates all references.

#### Q9: Where does `isRecommended` live? — COMPUTED ON `ResolvedSkill`, NOT METADATA

`isRecommended` is a computed property set at resolution time by the resolver, derived from the centralized `relationships.recommends` flat list. It is NOT a metadata field and does NOT appear in `metadata.yaml` or `SkillMetadataConfig`. Same pattern as `compatibleWith`, `conflictsWith`, `requires` — all computed from centralized rules onto `ResolvedSkill`.

#### Q10: Where does `requires` come from for plugin compilation? — CENTRALIZED RULES

`skill-plugin-compiler.ts` currently reads `metadata.requires` to generate a "Requires" section in plugin READMEs. After R-04, it derives requirements from `relationships.requires` rules (the resolver already computes `ResolvedSkill.requires`). The compiler uses the resolved skill data instead of raw metadata.

#### Q11: Does `ResolvedSkill` keep both `displayName` and `slug`? — YES

`displayName` carries the title-cased value from metadata.yaml (e.g., "React") — used for UI display. `slug` carries the kebab-case short key (e.g., "react") — used for alias resolution and Phase 2 relationship rules. Both are required on every skill. Neither is a rename of the other.

#### Q12: Is `slug` required or optional on metadata? — REQUIRED

No backwards compatibility concerns. Pre-1.0. All skills (including third-party source repos) must have `slug` in metadata.yaml. The loader errors on missing slugs.

#### Q13: What type do relationship arrays use in Phase 2? — `SkillSlug`

Relationship rule types change from `SkillId` to `SkillSlug`. Since `SkillSlug` is a union type (~85 values), all slug values in `default-rules.ts` are type-checked at compile time. The resolver maps `SkillSlug → SkillId` via the `slugToId` map. No type widening — clean type change.

#### Q14: Do source repo format changes need backwards compatibility? — NO

Pre-1.0. Source repos must update their `skill-rules.ts` files to match the new `SkillRulesConfig` shape (no `aliases`, no `perSkill`, new `recommends` format). No shims or migration code.

### Implementation Order

Steps 1-5 are effectively atomic for compilation but can be committed separately for review. Step 6 is the bulk test update work.

| Step        | What                                                             | Key Files                                                                                                                                                                                                | Status                                                                                 |
| ----------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| **0**       | Pre-work: allow `slug` in JSON schema (optional, additive)       | `metadata.schema.json`                                                                                                                                                                                   | ✅ Done                                                                                |
| **1**       | Type foundation (atomic with 2-5 for compilation)                | `types/skills.ts`, `types/matrix.ts`                                                                                                                                                                     | ✅ Done                                                                                |
| **2**       | Zod schema updates                                               | `schemas.ts`, `matrix-loader.ts` rawMetadataSchema                                                                                                                                                       | ✅ Done                                                                                |
| **3**       | Core pipeline: loaders + resolver                                | `matrix-loader.ts`, `matrix-resolver.ts`, `source-loader.ts`, `multi-source-loader.ts`, `source-validator.ts`                                                                                            | ✅ Done                                                                                |
| **4**       | Consumer commands + components                                   | `info.ts`, `search.tsx`, `edit.tsx`, `init.tsx`, `new/skill.ts`, `plugin-finder.ts`, `skill-plugin-compiler.ts`, `local-skill-loader.ts`, `build-step-logic.ts`, `skill-search.tsx`, `config-exports.ts` | ✅ Done                                                                                |
| **5**       | Rule data: rewrite `default-rules.ts`                            | `default-rules.ts` — remove aliases/perSkill, flat recommends                                                                                                                                            | ✅ Done                                                                                |
| **6**       | Test updates (bulk)                                              | `helpers.ts`, `mock-matrices.ts`, all test files listed above                                                                                                                                            | ✅ Done                                                                                |
| **7**       | Schema finalization: `slug` required, remove relationship fields | `metadata.schema.json`                                                                                                                                                                                   | Deferred (Step 0 made slug optional; finalization happens when skills repo adds slugs) |
| **Phase 2** | Canonical IDs → slugs in rules (separate PR)                     | `default-rules.ts`, `matrix-loader.ts` slug resolution                                                                                                                                                   | Not started                                                                            |

### E2E Tests

Add end-to-end tests covering the key user journeys affected by R-04. These go in `e2e/interactive/` using the existing `TerminalSession` infrastructure.

| Journey                            | Test                                                                                                                      | Verifies                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Init → pick React → Zustand badge  | Select React framework, navigate to client-state category, verify Zustand shows `(recommended)` badge                     | `isRecommended && isCompatibleWithSelections` logic works end-to-end          |
| Init → pick Vue → no Zustand badge | Select Vue framework, navigate to client-state category, verify Zustand does NOT show `(recommended)` and is filtered out | Incompatible recommended skills are correctly hidden                          |
| Init → pick Vue → Pinia badge      | Select Vue framework, navigate to client-state category, verify Pinia shows `(recommended)` badge                         | Vue-specific recommendations work                                             |
| Info command → slug lookup         | Run `cc info zustand`, verify output shows title-cased "Zustand", recommended status, and resolved relationships          | `slugToId` lookup and `isRecommended` display work                            |
| New skill → slug generation        | Run `cc new skill my-tool`, verify generated `metadata.yaml` includes `slug: my-tool` and no `aliases` section in rules   | Slug generation replaces alias generation                                     |
| Setup pair resolution              | Select PostHog Analytics, verify setup skill is surfaced/suggested                                                        | `setupPairs` → `requiresSetup`/`providesSetupFor` resolution works end-to-end |

Non-interactive E2E tests (using `runCLI()` helper):

- `cc info <slug>` resolves correctly for multiple skills
- `cc info <canonical-id>` still works (direct ID lookup)
- `cc list` shows title-cased display names

---

## R-05: Centralize Wizard Hotkeys and Labels

**Priority:** Low
**Status:** Refactor

### Problem

Wizard hotkey letters (S, A, H, G, etc.) and their display labels (`[P]`, `[G]`, `[S]`) are scattered across multiple files as inline string literals. If a hotkey changes or a new one is added, you have to find every reference manually.

**Current locations:**

- `wizard.tsx` — `key === "s"` handlers, `key === "a"`, `key === "h"` etc.
- `wizard-layout.tsx` — footer hotkey labels like `[S] Scope`, `[H] Help`, `[A] Accept`
- `step-agents.tsx` — `[P]`/`[G]` scope badges
- `step-build.tsx` — `[P]`/`[G]` scope badges (via SkillTag)
- `step-confirm.tsx` — scope labels in summary
- `wizard-store.ts` — references to scope values

### Proposed solution

Create a `WIZARD_HOTKEYS` constant (or similar) in `consts.ts` or a dedicated `wizard-keys.ts`:

```typescript
export const WIZARD_HOTKEYS = {
  SCOPE_TOGGLE: { key: "s", label: "[S] Scope" },
  ACCEPT: { key: "a", label: "[A] Accept" },
  HELP: { key: "h", label: "[H] Help" },
  SETTINGS: { key: "g", label: "[G] Settings" },
  // ...
} as const;

export const SCOPE_BADGES = {
  project: "[P]",
  global: "[G]",
} as const;
```

Then all key handlers use `WIZARD_HOTKEYS.SCOPE_TOGGLE.key` and all labels use `WIZARD_HOTKEYS.SCOPE_TOGGLE.label` or `SCOPE_BADGES[scope]`.

### Scope

- Mechanical refactor — no behavior change
- Grep for all `key === "` patterns in wizard components
- Grep for all `[P]`, `[G]`, `[S]`, `[A]`, `[H]` string literals
- Replace with constant references

---

## R-06: Slim Down `ResolvedSkill`

**Priority:** Low
**Status:** Refactor
**Depends on:** R-04

### Problem

`ResolvedSkill` is a bloated type that mixes skill identity/metadata with resolved relationship data. Every skill carries its own copies of `compatibleWith`, `conflictsWith`, `requires`, `recommends`, `requiresSetup`, `providesSetupFor`, `discourages`, `alternatives` — arrays of skill IDs that are computed from centralized relationship rules and then duplicated onto every individual skill object.

After R-04 adds `isRecommended`, `slug`, and keeps `displayName`, the type grows further. The relationship arrays are not intrinsic to the skill — they're computed views of centralized data that happen to be denormalized onto each skill for convenience.

### Proposed solution

Separate `ResolvedSkill` into two concerns:

1. **Skill identity** — intrinsic properties: `id`, `displayName`, `slug`, `category`, `domain`, `tags`, `description`, `author`, `isRecommended`, `source`, `installed`, etc.
2. **Resolved relationships** — computed from centralized rules, stored separately (e.g., on the matrix or in a parallel lookup): `compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`, `discourages`, `alternatives`.

Consumers that need relationship data would look it up from the relationship index rather than reading it off the skill object. The wizard resolver already computes these from centralized rules — the question is whether to store them per-skill or in a separate structure.

### Investigation needed

- Audit all consumers of `ResolvedSkill` relationship fields — how many actually need them on the skill object vs could use a lookup?
- Determine the right shape for the separated relationship data (parallel map? method on a resolver class? computed on demand?)
- Evaluate whether this is worth the churn or if the denormalized model is acceptable long-term

---

## R-07: Codegen `SkillSlug` Union from Metadata

**Priority:** Low
**Status:** Refactor
**Depends on:** R-04

### Problem

R-04 introduces `SkillSlug` as a manually maintained union type (~85 values). When a new skill is added to the skills repo, a developer must also add its slug to the union in the CLI repo. This is the same kind of manual sync that `aliases` required — just smaller (one union entry vs a map entry).

### Proposed solution

A codegen script that reads all `metadata.yaml` files from the skills source, extracts `slug` values, and generates the `SkillSlug` union type automatically.

```bash
# Run after adding/removing skills
cc generate-types
# or as a build step
```

Generates `src/cli/types/generated/skill-slugs.ts`:

```typescript
// AUTO-GENERATED from metadata.yaml files — do not edit manually
export type SkillSlug = "react" | "vue" | "angular";
// ...
```

The generated file is committed to the repo. Re-run when skills change.

### Implementation notes

- Reuse `extractAllSkills()` or a lighter metadata reader
- Output file is `.gitignored` or committed (decide based on CI needs)
- Could be an oclif command (`cc generate-types`) or a standalone script
- Validate that generated slugs match the uniqueness rules (no duplicates, no `SkillId` pattern collisions)

---

## R-08: Unify Relationship Resolution Functions

**Priority:** Medium
**Status:** Refactor
**Depends on:** R-04

### Problem

`matrix-loader.ts` has 5 separate resolve functions with duplicate iteration logic:

- `resolveConflicts()` — iterates conflict groups, checks membership, collects other members
- `resolveDiscourages()` — identical pattern to conflicts
- `resolveCompatibilityGroups()` — identical pattern (iterates groups, checks membership, collects others)
- `resolveSetupPairs()` — iterates pairs, checks if skill is setup or configured
- `resolveRequirements()` — iterates rules, checks if skill matches, collects needs

All follow the same pattern: iterate a list of rules/groups, check if the current skill is a member, extract related skill IDs. The differences are: (a) the shape of the rule object, (b) whether the relationship is symmetric or directional, and (c) what fields to return.

### Proposed solution

A single `resolveRelationships(skillId, relationships, resolve)` function that returns all relationship data for a skill in one pass:

```typescript
type ResolvedRelationships = {
  conflictsWith: SkillRelation[];
  discourages: SkillRelation[];
  compatibleWith: SkillId[];
  requiresSetup: SkillId[];
  providesSetupFor: SkillId[];
  requires: SkillRequirement[];
  alternatives: SkillAlternative[];
};

function resolveRelationships(
  skillId: SkillId,
  relationships: RelationshipDefinitions,
  resolve: ResolveId,
): ResolvedRelationships;
```

### Benefits

- Single iteration point for all relationship types
- Easier to add new relationship types (just add a field + handler)
- Reduces function count from 5+ to 1
- `buildResolvedSkill()` becomes a simple spread of the result

---

## R-10: Replace Direct `matrix.skills[id]` Lookups with Matrix Store

**Priority:** Low
**Status:** Refactor
**Depends on:** Matrix store (done — `src/cli/stores/matrix-store.ts`)

### Problem

Many functions accept a `matrix` parameter or call `getMatrix()` just to do `matrix.skills[skillId]` and extract a single field (`displayName`, `description`, `category`, `slug`, `local`, `compatibleWith`, `availableSources`). Some functions exist solely to wrap this pattern. Now that the matrix store provides `getSkill(id)` and `getMatrix()`, these can be simplified.

### Instances to address

**1. `getLabel()` in `matrix-resolver.ts:15-20`** — Private helper called 12+ times for `displayName || id` in error/warning messages. High-frequency pattern.

**Proposed store method:** `getDisplayName(id: SkillId): string` — returns `displayName` or falls back to `id`. Add to matrix-store.ts. Replaces all `getLabel(matrix.skills[id], id)` calls.

**2. `buildLocalSkillsMap()` in `local-installer.ts:130-148`** — Extracts `matrix.skills[skillId].description` to build compilation input. Replace with `getSkill(skillId)?.description`.

**3. `generateProjectConfigFromSkills()` in `config-generator.ts:64-82`** — Extracts `matrix.skills[skillId].category`. Replace with `getSkill(skillId)?.category`.

**4. `getPluginSkillIds()` in `plugin-finder.ts:73-91`** — Iterates all skills to build a slug-to-ID map. The store already has `matrix.slugMap` — use `getMatrix().slugMap.slugToId` directly.

**5. `isCompatibleWithSelectedFrameworks()` in `build-step-logic.ts:87-101`** — Extracts `matrix.skills[skillId].compatibleWith`. Replace with `getSkill(skillId)?.compatibleWith`.

**6. `buildCategoriesForDomain()` in `build-step-logic.ts:137-146`** — Extracts `matrix.skills[skill.id]?.local`. Replace with `getSkill(skill.id)?.local`.

**7. `setAllSourcesPlugin()` / `buildSourceRows()` in `wizard-store.ts:942-1010`** — Multiple `matrix.skills[id]?.availableSources` lookups. Replace with `getSkill(id)?.availableSources`.

**8. Eject command in `eject.ts:327-330`** — Filters `matrix.skills[skillId]?.local`. Replace with `getSkill(skillId)?.local`.

### Proposed store methods

If `getSkill(id)?.field` appears frequently enough, add convenience methods to `matrix-store.ts`:

```typescript
// High-frequency: used 12+ times in matrix-resolver.ts alone
getDisplayName: (id: SkillId) => string;
// Returns displayName or falls back to id. Replaces getLabel().
```

All other fields (`description`, `category`, `slug`, `local`, `compatibleWith`, `availableSources`) appear 1-3 times each — `getSkill(id)?.field` is sufficient, no dedicated method needed.

### Approach

1. Add `getDisplayName()` to matrix-store.ts
2. Replace `getLabel()` calls in matrix-resolver.ts with `getDisplayName()`
3. Replace remaining `matrix.skills[id]` one-field lookups with `getSkill(id)?.field`
4. Remove functions that exist solely to wrap the lookup pattern
5. Remove `matrix` parameters from functions that only used them for single-field lookups

---

## R-11: Eliminate `ProjectSourceConfig` / `saveProjectConfig`

**Priority:** Medium
**Status:** Refactor

### Problem

Two config formats coexist:

1. **`ProjectConfig`** (full) — `{name, skills, agents, source, marketplace, ...}`, written by `generateConfigSource()` with `import type { ProjectConfig }` + `satisfies ProjectConfig`
2. **`ProjectSourceConfig`** (legacy) — `{source, marketplace, branding, ...}`, written by `saveProjectConfig()` as bare `export default {...};\n`

After `init` writes a proper `ProjectConfig`, any subsequent `addSource`/`removeSource`/`saveSourceToProjectConfig` call **overwrites** the file with a bare `ProjectSourceConfig`, losing `skills`, `agents`, `name`, and the type annotation.

### Production callers of `saveProjectConfig`

| File                   | Function                      | What it does                        |
| ---------------------- | ----------------------------- | ----------------------------------- |
| `source-manager.ts:38` | `addSource()`                 | Adds a source entry, writes back    |
| `source-manager.ts:61` | `removeSource()`              | Removes a source entry, writes back |
| `config-saver.ts:5`    | `saveSourceToProjectConfig()` | Updates the source URL              |

All three do read-modify-write on a `ProjectSourceConfig`. They should instead load the full `ProjectConfig`, mutate the relevant field, and write back via `generateConfigSource`.

### Fix

1. Change `source-manager.ts` and `config-saver.ts` to load `ProjectConfig` (not `ProjectSourceConfig`), mutate, and write via `generateConfigSource` + `writeFile`
2. Remove `saveProjectConfig()` from `config.ts`
3. Remove `ProjectSourceConfig` type if no other consumers remain (check `loadProjectSourceConfig` — it may need to become a `ProjectConfig` loader, or the load side can remain lenient since it's a parse boundary)
4. Update tests that call `saveProjectConfig` to use the new path

---

## R-12: Delete the Matrix Object from Consumer Code

**Priority:** Medium
**Related:** D-89 (getSkill in buildSourceRows), the getDiscourageReason crash fix

### Problem

The `MergedSkillsMatrix` object is a god object. Consumer code grabs it via `getMatrix()` and reaches into `.skills[id]`, `.categories[id]`, `.slugMap`, `.suggestedStacks`, `.agentDefinedDomains`, etc. This makes the matrix shape a public API that everything couples to.

The matrix should **only exist inside the store**. It is an internal implementation detail — the store's private state. Nothing outside `matrix-store.ts` should ever hold, pass, destructure, or reference a `MergedSkillsMatrix`.

### What "delete the matrix object" means

1. **Remove `getMatrix()` export** — no consumer can obtain the raw object
2. **Remove `MergedSkillsMatrix` from all function signatures** — no function accepts or returns it
3. **Remove all `const matrix = getMatrix()` / `const { skills, categories } = getMatrix()` patterns** — replace with individual store accessor calls
4. **Remove `useMatrixStore((s) => s.matrix!)` selectors in React components** — replace with specific selectors like `useMatrixStore((s) => s.getAllCategories())`
5. **Remove `useMatrixStore.getState().matrix` direct reads** — replace with store accessors

The `matrix` field stays as internal state inside the store's `MatrixState` type, but it's never exposed.

### Store API additions needed

Based on actual consumer usage (21 production files):

**Individual lookups:**

- `findCategory(id: Category): CategoryDefinition | undefined`
- `getCategory(id: Category): CategoryDefinition` (throws)

**Collection accessors:**

- `getAllSkills(): Partial<Record<SkillId, ResolvedSkill>>`
- `getAllCategories(): CategoryMap`
- `getSlugMap(): SkillSlugMap`
- `getSuggestedStacks(): ResolvedStack[]`
- `getAgentDefinedDomains(): Partial<Record<AgentName, Domain>> | undefined`
- `getSkillCount(): number`
- `getVersion(): string`

**Convenience:**

- `findStack(id: string): ResolvedStack | undefined`
- `getSlugForId(id: SkillId): SkillSlug | undefined`
- `getIdForSlug(slug: SkillSlug): SkillId | undefined`

### Consumer migration map (21 files)

**Heavy users (need multiple accessors):**

- `matrix-resolver.ts` — 13 `getMatrix()` calls accessing `.skills`, `.categories`, `.slugMap`. Replace each with the specific accessor.
- `wizard-store.ts` — destructures `{ skills, categories }`. Replace with `getAllSkills()`, `getAllCategories()`.
- `build-step-logic.ts` — accesses `.categories`, `.skills`. Replace with `getCategory()`, `getSkill()`.

**Stack lookups:**

- `wizard.tsx` — `getMatrix().suggestedStacks.find(...)`. Replace with `findStack(id)`.
- `utils.ts` — same pattern. Replace with `findStack(id)` and `getAllCategories()`.

**Skill count / list:**

- `edit.tsx` — `Object.keys(getMatrix().skills).length`. Replace with `getSkillCount()`.
- `info.ts` — `getMatrix().skills` for fuzzy search. Replace with `getAllSkills()`.
- `eject.ts` — iterates skills. Replace with `getAllSkills()`.
- `update.tsx` — accesses matrix. Replace with specific accessors.

**Category lookups:**

- `use-build-step-props.ts` — `getMatrix().categories[id]`. Replace with `getCategory(id)`.
- `config-generator.ts` — accesses categories. Replace with `getAllCategories()`.

**Slug lookups:**

- `use-source-grid-search-modal.ts` — `getMatrix().slugMap.idToSlug[id]`. Replace with `getSlugForId(id)`.
- `plugin-finder.ts` — slug resolution. Replace with `getIdForSlug()`.

**React component selectors (use `s.matrix!` pattern):**

- `domain-selection.tsx` — `useMatrixStore((s) => s.getMatrix())`. Replace with specific selectors.
- `stack-selection.tsx` — `useMatrixStore((s) => s.matrix!)`. Replace with `useMatrixStore((s) => s.getSuggestedStacks())` etc.
- `step-agents.tsx` — `useMatrixStore((s) => s.matrix!)`. Replace with specific selectors.

**Nullable checks (doctor, validator):**

- `doctor.ts` — `useMatrixStore.getState().matrix` (null check). Replace with `isInitialized()` accessor.
- `source-validator.ts` — same. Replace with `isInitialized()`.

### Files that keep raw matrix access (pre-store construction)

These files build the matrix before it's put into the store — they write to the object, not read from the store:

- `source-loader.ts` — constructs and mutates `result.matrix`, then calls `setMatrix()`
- `multi-source-loader.ts` — merges matrices during construction
- `matrix-loader.ts`, `matrix-health-check.ts` — build/validate the matrix object
- `config-types-writer.ts` — reads `sourceResult.matrix` before store is set
- `local-installer.ts` — passes `sourceResult.matrix` to writers before store is set

The `SourceLoadResult.matrix` field is fine — it's the construction pipeline. The rule is: after `setMatrix()` is called, no code should touch the raw object again.

### Rules After Completion

- `getMatrix()` does not exist as a public export
- `MergedSkillsMatrix` does not appear in any consumer function signature (only in store internals and the source-loader construction pipeline)
- No consumer code holds, passes, or destructures a `MergedSkillsMatrix` reference
- All reads go through named store accessors
- React components use specific selectors, not `s.matrix!`
- The `matrix` field is internal to `MatrixState` — consumers never see it
