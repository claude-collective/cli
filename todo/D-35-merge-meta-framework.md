# D-35: Pre-D-31 Cleanup — Merge meta-framework + Remove web-extras

## Goal

Two cleanup tasks combined into one PR, both prerequisite to D-31 (category prefixing):

1. **Merge `meta-framework` into `framework`** — removes a subcategory that causes confusion and has no special code handling
2. **Remove `web-extras` as a domain** — it's not a real domain, just a wizard UI grouping to split web categories across two steps. Now that scrolling is supported, it's unnecessary.

---

## Part 1: Merge meta-framework into framework

### Why

1. **No code treats them differently.** The only framework-specific logic uses `"framework"` — `meta-framework` is treated as any other subcategory.
2. **Skill IDs already use `web-framework-*`** for both (React AND Next.js). No `web-meta-framework-*` prefix exists.
3. **The nuxt-stack in stacks.yaml has them inverted** — Nuxt under `framework`, Vue under `meta-framework` — proving the distinction is confusing.
4. **Meta-frameworks ARE their base frameworks** — Next.js IS React, Nuxt IS Vue. They should be in the same exclusive group.
5. **Conflict rules already handle mutual exclusion** between alternative meta-frameworks.
6. **The remix-stack avoids meta-framework entirely** — uses `base-framework` (a stacks-only key) instead.
7. **D-31 would have to rename it to `web-meta-framework`** — merging eliminates that migration target.

### Changes

#### 1a. Type system (`src/cli/types/matrix.ts`)

Remove `"meta-framework"` from the `Subcategory` union type (line 10).

#### 1b. Schemas (`src/cli/lib/schemas.ts`)

Remove `"meta-framework"` from `SUBCATEGORY_VALUES` (line 62).

#### 1c. Skills matrix (`config/skills-matrix.yaml`)

**Remove the `meta-framework` category entry** (lines ~29-36).

**Update the `framework` category description** to reflect it now includes meta-frameworks:

- `description: "UI framework (React, Vue, Angular, SolidJS, Next.js, Remix, Nuxt)"`
- Keep `exclusive: true` — user picks ONE framework (base or meta)
- Keep `required: true`

**`nextjs-server-actions`** is the only special case: it keeps `categoryExclusive: false` (already has it in metadata.yaml) because it's an add-on to `nextjs-app-router`, not a standalone framework choice. All other meta-framework skills (nextjs-app-router, remix, nuxt) are normal exclusive entries — no `categoryExclusive: false` needed.

**Remove the meta-framework → base-framework requires rules:**

- ~~`nextjs-app-router` requires `[react]`~~ — REMOVE (Next.js IS React)
- ~~`remix` requires `[react]`~~ — REMOVE (Remix IS React)
- Do NOT add `nuxt` requires `[vue]` — Nuxt IS Vue

**Update downstream requires rules** — skills that need a React/Vue framework must now accept meta-frameworks too:

| Skill                 | Current `needs`       | New `needs`                                           | `needsAny`     |
| --------------------- | --------------------- | ----------------------------------------------------- | -------------- |
| zustand               | [react, react-native] | [react, nextjs-app-router, remix, react-native]       | true (already) |
| redux-toolkit         | [react, react-native] | [react, nextjs-app-router, remix, react-native]       | true (already) |
| mobx                  | [react]               | [react, nextjs-app-router, remix]                     | true (ADD)     |
| react-query           | [react, react-native] | [react, nextjs-app-router, remix, react-native]       | true (already) |
| swr                   | [react, react-native] | [react, nextjs-app-router, remix, react-native]       | true (already) |
| react-hook-form       | [react, react-native] | [react, nextjs-app-router, remix, react-native]       | true (already) |
| react-testing-library | [react]               | [react, nextjs-app-router, remix]                     | true (ADD)     |
| graphql-apollo        | [react, vue, angular] | [react, vue, angular, nextjs-app-router, remix, nuxt] | true (already) |
| graphql-urql          | [react, vue, solidjs] | [react, vue, solidjs, nextjs-app-router, remix, nuxt] | true (already) |
| pinia                 | [vue]                 | [vue, nuxt]                                           | true (ADD)     |
| vee-validate          | [vue]                 | [vue, nuxt]                                           | true (ADD)     |
| vue-test-utils        | [vue]                 | [vue, nuxt]                                           | true (ADD)     |

**Special: `shadcn-ui`** currently has `needs: [react, tailwind]` (AND logic). Split into TWO rules:

1. `needs: [react, nextjs-app-router, remix]` with `needsAny: true` — needs a React framework
2. `needs: [tailwind]` — needs Tailwind

**Conflict rules cleanup:**

- The two existing conflict rules (`[react, vue, angular, solidjs]` and `[nextjs-app-router, remix, nuxt]`) become redundant with `exclusive: true` on the merged category. Merge into one rule for documentation:
  - `skills: [react, vue, angular, solidjs, nextjs-app-router, remix, nuxt]`
  - `reason: "Frameworks are mutually exclusive — choose one"`

**Alternatives cleanup:**

- Merge "Frontend Framework" `[react, vue, angular, solidjs]` and "React Meta-Framework" `[nextjs-app-router, remix]` into:
  - `purpose: "Frontend Framework"` → `skills: [react, vue, angular, solidjs, nextjs-app-router, remix, nuxt]`
- Remove the separate "React Meta-Framework" entry

#### 1d. External repos — metadata.yaml changes

In `/Users/vincentbollaert/dev/personal/claude-subagents` (4 files):

**Category field changes:**

- `web-framework-nextjs-app-router/metadata.yaml`: `category: meta-framework` → `category: framework`
- `web-framework-nextjs-server-actions/metadata.yaml`: `category: meta-framework` → `category: framework`
- `web-framework-remix/metadata.yaml`: `category: meta-framework` → `category: framework`
- `web-framework-nuxt/metadata.yaml`: `category: meta-framework` → `category: framework`

No `categoryExclusive` changes needed for nextjs-app-router, remix, nuxt — they're normal exclusive entries in the merged category. `nextjs-server-actions` already has `categoryExclusive: false` and keeps it.

**Requires field cleanup (CRITICAL):**
After the merge, metadata-level `requires` pointing to another skill in the same `exclusive: true` category creates a logical impossibility — the skill becomes unselectable.

- `web-framework-nextjs-app-router/metadata.yaml`: **REMOVE** `requires: [web-framework-react]` — Next.js IS React
- `web-framework-nextjs-server-actions/metadata.yaml`: **CHANGE** `requires: [web-framework-react]` → `requires: [web-framework-nextjs-app-router]` — server-actions is an add-on to app-router, not to bare React
- `web-framework-nuxt/metadata.yaml`: **REMOVE** `requires: [web-framework-vue-composition-api]` — Nuxt IS Vue
- `web-framework-remix/metadata.yaml`: No `requires` field — already clean

**Schema in claude-subagents:**

- `src/schemas/metadata.schema.json` line 143: remove `"meta-framework"` from category enum

In `/Users/vincentbollaert/dev/claude/skills`:

- No meta-framework skills exist in this repo (confirmed by audit).

#### 1e. Stacks (`config/stacks.yaml` in claude/skills)

Replace all `meta-framework:` keys (9 occurrences, all in nuxt-stack):

- **nuxt-stack:** Fix the inversion — Nuxt goes under `framework`, Vue goes under `base-framework` (like remix-stack already does)

#### 1f. JSON schemas

Remove `"meta-framework"` from enum arrays in:

- `src/schemas/skills-matrix.schema.json` (3 locations: lines 17, 62, 132)
- `src/schemas/stacks.schema.json` (1 location: line 36)
- `src/schemas/project-config.schema.json` (1 location: line 52)

#### 1g. Tests and fixtures

- Update `src/cli/lib/__tests__/fixtures/matrix/valid-matrix.yaml` — has `meta-framework` category definition (lines 18-19)
- Update any other test that references `"meta-framework"` as a subcategory value

#### 1h. Documentation

- `docs/reference/architecture.md` line 494 — Subcategory type listing
- `docs/standards/content/claude-architecture-bible.md` line 1223 — subcategory listing

---

## Part 2: Remove web-extras domain

### Why

`web-extras` is not a real domain — it's a UI grouping in the wizard to split web categories across two steps. Now that the build step supports scrolling, all web categories can be shown in a single step. Removing it before D-31 means D-31 won't have to deal with `web-extras` at all.

### Changes

#### 2a. Type system (`src/cli/types/matrix.ts`)

Remove `"web-extras"` from the `Domain` union type (line 5).

#### 2b. Schemas (`src/cli/lib/schemas.ts`)

Remove `"web-extras"` from `domainSchema` enum (line 38).

#### 2c. Skills matrix (`config/skills-matrix.yaml`)

Change `domain: web-extras` to `domain: web` on these 8 categories:

- `error-handling`
- `file-upload`
- `files`
- `utilities`
- `realtime`
- `animation`
- `pwa`
- `accessibility`

Remove `parentDomain: web` from these same 8 categories (no longer needed when domain IS web).

#### 2d. JSON schemas

Remove `"web-extras"` from enum arrays in:

- `src/schemas/skills-matrix.schema.json` (2 locations: `domain` enum line 108, `parentDomain` enum line 112)

(No occurrences in stacks.schema.json or project-config.schema.json.)

#### 2e. Domain selection (`src/cli/components/wizard/domain-selection.tsx`)

Remove the `web-extras` entry from `AVAILABLE_DOMAINS`.

#### 2f. Constants (`src/cli/consts.ts`)

Remove `"web-extras"` from `DEFAULT_SCRATCH_DOMAINS` (line 173).

#### 2g. Wizard utilities (`src/cli/components/wizard/utils.ts`)

Remove `"web-extras": "Web Extras"` from `getDomainDisplayName()` (line 8).

#### 2h. Wizard store (`src/cli/stores/wizard-store.ts`)

- Remove `"web-extras"` from `ALL_DOMAINS` constant (line 22)
- Remove `getParentDomain()` method (lines 789-791) — dead code after parentDomain removal
- Remove `getParentDomainSelections()` method (lines 794-798) — dead code

#### 2i. Dead `parentDomain` code removal

With no categories using `parentDomain`, the entire prop-threading chain becomes dead code:

- `src/cli/lib/wizard/build-step-logic.ts` lines 118, 121, 138 — remove `parentDomainSelections` parameter
- `src/cli/components/hooks/use-build-step-props.ts` lines 25, 56 — remove `parentDomainSelections` prop
- `src/cli/components/hooks/use-framework-filtering.ts` lines 17, 27, 38, 47 — remove `parentDomainSelections` option
- `src/cli/components/wizard/step-build.tsx` lines 27, 61, 77 — remove `parentDomainSelections` prop type and usage

Optionally also remove the `parentDomain` field from:

- `src/cli/types/matrix.ts` line 87 — `parentDomain?: Domain` on `CategoryDefinition`
- `src/cli/lib/schemas.ts` — `parentDomain: domainSchema.optional()` on `categoryDefinitionSchema`
- `src/schemas/skills-matrix.schema.json` line 110 — `parentDomain` property definition

(Keeping the optional field in types/schemas is harmless but removing it is cleaner.)

#### 2j. Tests

Update tests that reference `"web-extras"` as a domain value.

#### 2k. Documentation

- `docs/reference/architecture.md` lines 493, 737 — Domain type listing and web-extras explanation
- `docs/standards/content/documentation-bible.md` line 729 — Domain type listing
- `docs/features/active/stack-domain-filtering/spec.md` lines 86, 112 — web-extras references

---

## Execution Order

### Part 1: meta-framework merge

1. Remove `meta-framework` from types, schemas, JSON schemas (CLI repo + claude-subagents `metadata.schema.json`)
2. Remove `meta-framework` category from `skills-matrix.yaml`; update `framework` description
3. Remove `nextjs-app-router` and `remix` requires rules from `skills-matrix.yaml`
4. Update 12 downstream requires rules + split shadcn-ui into 2 rules
5. Merge the two conflict rules; merge the two alternatives entries
6. Fix `config/stacks.yaml` in CLI repo (nuxt-stack inversion, replace 9 `meta-framework:` keys)
7. Update 4 metadata.yaml files in claude-subagents: `category` field + remove/fix stale `requires` fields

### Part 2: web-extras removal

1. Remove `web-extras` from `Domain` type (`matrix.ts`), `domainSchema` (`schemas.ts`), and JSON schemas (`skills-matrix.schema.json`)
2. Change `domain: web-extras` to `domain: web` in `skills-matrix.yaml` (8 categories); remove `parentDomain`
3. Remove `web-extras` from `AVAILABLE_DOMAINS` (`domain-selection.tsx`), `DEFAULT_SCRATCH_DOMAINS` (`consts.ts`), `getDomainDisplayName()` (`utils.ts`)
4. Update `DomainSelections` in `wizard-store.ts`; clean up JSDoc in `step-build.tsx`

### Verification

1. Update all tests referencing `meta-framework` or `web-extras`
2. Update documentation (`architecture.md`, `claude-architecture-bible.md`, `documentation-bible.md`, `stack-domain-filtering/spec.md`)
3. Run `npx tsc --noEmit` + `npm test`

## Relationship to D-31

This must be done **before** D-31. It simplifies D-31 by:

- Eliminating `web-meta-framework` as a migration target (4 fewer rows)
- Making the Domain column uniform — all former `web-extras` categories now show `web`
- Reducing the Subcategory union from 39 to 38 values
