# D-38: Split Framework Categories + Remove Base-Framework Pseudo-Categories

## Goal

Split `web-framework` into two categories (`web-framework` for base frameworks, `web-meta-framework` for meta-frameworks), remove the `web-base-framework` and `mobile-platform` pseudo-categories, and use the existing cross-category `requires` mechanism to couple meta-frameworks with their base frameworks — the same pattern as shadcn requiring Tailwind.

## Revised Approach (2026-03-16)

The original plan changed `web-framework` from exclusive to non-exclusive and added complex intra-category conflict rules. The revised approach is simpler: **split into two categories and use the existing `requires` mechanism across them.**

### Why This Is Simpler

| Old Approach                                      | New Approach                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------- |
| `web-framework` becomes non-exclusive (checkbox)  | `web-framework` stays exclusive (radio)                             |
| 6+ granular conflict rules within one category    | Zero new conflict rules needed                                      |
| New auto-select logic for intra-category coupling | Existing cross-category `requires` mechanism (like shadcn→Tailwind) |
| Complex conflict/requires interactions            | Clean separation: base in one category, meta in another             |

---

## New Category Structure

### `web-framework` (existing, stays exclusive)

Base UI frameworks. User picks exactly one.

| Skill   | ID                                  |
| ------- | ----------------------------------- |
| React   | `web-framework-react`               |
| Vue     | `web-framework-vue-composition-api` |
| Angular | `web-framework-angular-standalone`  |
| SolidJS | `web-framework-solidjs`             |
| Svelte  | `web-framework-svelte` (future)     |

### `web-meta-framework` (new, optional, exclusive)

Meta-frameworks built on a base framework. User picks zero or one.

| Skill     | ID                                 | Requires                            |
| --------- | ---------------------------------- | ----------------------------------- |
| Next.js   | `web-framework-nextjs` (merged)    | `web-framework-react`               |
| Remix     | `web-framework-remix`              | `web-framework-react`               |
| Nuxt      | `web-framework-nuxt`               | `web-framework-vue-composition-api` |
| SvelteKit | `web-framework-sveltekit` (future) | `web-framework-svelte`              |
| Astro     | `web-framework-astro` (future)     | none (framework-agnostic islands)   |

### `mobile-framework` (existing, change to non-exclusive)

Only two skills — no need for a separate category split. Just allow both to be selected.

| Skill        | ID                              | Requires                             |
| ------------ | ------------------------------- | ------------------------------------ |
| React Native | `mobile-framework-react-native` | `web-framework-react` (cross-domain) |
| Expo         | `mobile-framework-expo`         | `mobile-framework-react-native`      |

---

## Wizard UX Flow

With the category split, the natural wizard flow handles coupling automatically:

1. **`web-framework` appears first** (required, order: 1) — user selects React
2. **`web-meta-framework` appears second** (optional, order: 2) — user optionally selects Next.js
3. Next.js has `requires: [web-framework-react]` — if React is not selected, Next.js shows as **dimmed with "requires React"** (existing `isDisabled()` behavior, same as shadcn→Tailwind)
4. Once Next.js is selected, React shows **"required by Next.js"** and cannot be deselected (D-39 enhancement)

No auto-select needed for the normal flow because the category ordering means the user selects the base framework first.

---

## Merge Next.js Skills Into One

As part of this change, merge the two Next.js skills into a single `web-framework-nextjs`:

| Before                                | After                                                        |
| ------------------------------------- | ------------------------------------------------------------ |
| `web-framework-nextjs-app-router`     | `web-framework-nextjs`                                       |
| `web-framework-nextjs-server-actions` | Becomes `examples/server-actions.md` inside the merged skill |

**This resolves D-102** (App Router + Server Actions complementary but mutually exclusive).

**This resolves D-101** ("Next.js Fullstack" stack missing Next.js skill — the merged skill is the one to add).

The merged skill structure:

```
web-framework-nextjs/
├── SKILL.md              # Core: App Router, file-based routing, layouts, metadata API
├── metadata.yaml         # category: web-meta-framework, requires: [web-framework-react]
├── reference.md
└── examples/
    ├── routing.md        # File-based routing, dynamic routes, parallel routes, intercepting routes
    ├── server-components.md  # RSC patterns, data fetching, caching, streaming
    ├── server-actions.md     # Form mutations, revalidation, optimistic updates, useActionState
    ├── middleware.md          # Edge middleware, redirects, auth checks
    └── api-routes.md         # Route handlers, streaming responses
```

### Skip Directives in Base Framework Skills

Add skip directives to base framework example files that conflict with meta-framework patterns:

In React `SKILL.md` table of contents:

```markdown
- [examples/routing.md](examples/routing.md) - React Router (**skip if using Next.js, Remix, or TanStack Router**)
- [examples/data-fetching.md](examples/data-fetching.md) - Client-side fetching (**skip if using Next.js or Remix**)
```

At the top of `examples/routing.md`:

```markdown
> **Skip this file if your project uses Next.js, Remix, or any meta-framework with its own router.**
> These frameworks replace React Router with their own file-based routing.
```

Same pattern for Vue (skip Vue Router when using Nuxt) and Svelte (skip SPA routing when using SvelteKit).

---

## Changes Required

### Phase 1: Create `web-meta-framework` category

In `skill-categories.ts`:

```typescript
{
  id: "web-meta-framework",
  displayName: "Meta-Framework",
  description: "Full-stack meta-framework (Next.js, Remix, Nuxt, SvelteKit)",
  domain: "web",
  exclusive: true,
  required: false,  // Optional — standalone React/Vue/etc. is valid
  order: 2,         // Appears after web-framework (order: 1)
}
```

### Phase 2: Move meta-framework skills to new category

Update `metadata.yaml` for each meta-framework skill:

```yaml
# web-framework-nextjs/metadata.yaml (merged skill)
category: web-meta-framework
requires:
  - web-framework-react

# web-framework-remix/metadata.yaml
category: web-meta-framework
requires:
  - web-framework-react

# web-framework-nuxt/metadata.yaml
category: web-meta-framework
requires:
  - web-framework-vue-composition-api
```

And in `skill-rules.ts`, add the corresponding `requires` entries.

### Phase 3: Merge Next.js skills

1. Create `web-framework-nextjs/` with merged content from `web-framework-nextjs-app-router` and `web-framework-nextjs-server-actions`
2. Server Actions becomes `examples/server-actions.md`
3. Remove both old skill directories
4. Update all references (stacks, rules, tests)

### Phase 4: Add skip directives to base framework skills

Add "skip if using [meta-framework]" notes to:

- React: `examples/routing.md`, `examples/data-fetching.md`
- Vue: equivalent routing/data-fetching examples (if they exist)
- (Future) Svelte: SPA routing examples

### Phase 5: Remove `web-base-framework` and `mobile-platform` pseudo-categories

Same as original D-38 plan:

1. **`stacks.yaml`**: Merge all `web-base-framework` entries into `web-framework` arrays; merge `mobile-platform` into `mobile-framework`
2. **Type system**: Remove `"web-base-framework"` and `"mobile-platform"` from `Category` union, `SUBCATEGORY_VALUES`, `stackSubcategorySchema`
3. **JSON schemas**: Remove from `stacks.schema.json` and `project-config.schema.json`

### Phase 6: Make `mobile-framework` non-exclusive

Change `mobile-framework` from `exclusive: true` to `exclusive: false` so React Native + Expo can both be selected. Add requires rule: Expo needs React Native.

### Phase 7: Update stacks

All stacks that reference meta-frameworks need updating:

```yaml
# Before (nextjs-fullstack):
web-developer:
  web-framework:
    - id: web-framework-react
      preloaded: true

# After:
web-developer:
  web-framework:
    - id: web-framework-react
      preloaded: true
  web-meta-framework:
    - id: web-framework-nextjs
      preloaded: true
```

Same for remix-stack, nuxt-stack, and any future stacks (T3, SvelteKit, Astro).

### Phase 8: Update tests

- Tests referencing `web-base-framework` or `mobile-platform` → update
- Tests assuming `web-framework` contains meta-frameworks → update
- Add tests for the new `web-meta-framework` category
- Add tests for `requires` cross-category validation (Next.js → React)

---

## Tasks Resolved By This Change

| Task                                              | How Resolved                                                                          |
| ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **D-38**                                          | `web-base-framework` and `mobile-platform` removed; framework categories restructured |
| **D-101** (Next.js stack missing skill)           | Merged `web-framework-nextjs` added to nextjs-fullstack stack                         |
| **D-102** (App Router + Server Actions exclusive) | Merged into one skill; Server Actions is an examples/ file                            |

---

## Files Changed

### CLI repo (`/home/vince/dev/cli`)

| File                                            | Changes                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `src/cli/lib/configuration/skill-categories.ts` | Add `web-meta-framework` category                                             |
| `src/cli/lib/configuration/skill-rules.ts`      | Add `requires` rules for meta→base coupling                                   |
| `src/cli/lib/configuration/default-stacks.ts`   | Update stacks to use `web-meta-framework` key                                 |
| `src/cli/types/generated/source-types.ts`       | Regenerated (new category in union)                                           |
| `src/cli/types-matrix.ts`                       | Remove `web-base-framework`, `mobile-platform` from Category if still present |
| `src/cli/lib/schemas.ts`                        | Remove from `SUBCATEGORY_VALUES`, simplify `stackSubcategorySchema`           |
| `src/schemas/stacks.schema.json`                | Remove pseudo-categories, add `web-meta-framework`                            |
| `src/schemas/project-config.schema.json`        | Same                                                                          |
| Tests (multiple)                                | Update for new category structure                                             |

### Skills repo (`/home/vince/dev/skills`)

| File                                            | Changes                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `web-framework-nextjs/`                         | New merged skill (from app-router + server-actions)                               |
| `web-framework-nextjs-app-router/`              | Removed                                                                           |
| `web-framework-nextjs-server-actions/`          | Removed                                                                           |
| `web-framework-remix/metadata.yaml`             | `category: web-meta-framework`, add `requires`                                    |
| `web-framework-nuxt/metadata.yaml`              | `category: web-meta-framework`, add `requires`                                    |
| `web-framework-react/examples/routing.md`       | Add skip directive for meta-frameworks                                            |
| `web-framework-react/examples/data-fetching.md` | Add skip directive for meta-frameworks                                            |
| `stacks.yaml`                                   | Merge `web-base-framework` into `web-framework`, add `web-meta-framework` entries |

---

## Execution Order

1. Create `web-meta-framework` category in CLI
2. Merge Next.js skills in skills repo
3. Move meta-framework skills to new category (metadata.yaml changes)
4. Add `requires` rules in skill-rules.ts
5. Add skip directives to base framework example files
6. Remove `web-base-framework` and `mobile-platform` pseudo-categories
7. Update stacks
8. Update tests
9. Verify: `tsc --noEmit` + `npm test`

---

## Open Questions (from original plan, updated)

1. ~~Auto-select base framework?~~ **Resolved**: Category ordering handles it. `web-framework` (required, order 1) comes before `web-meta-framework` (optional, order 2). User naturally selects base first. D-39 adds "required by" label and block-deselect as UX polish.

2. ~~Should mobile skills move into web-framework?~~ **Resolved**: No. Keep `mobile-framework` separate, just make it non-exclusive.

3. ~~Next.js stack missing nextjs skill~~ **Resolved**: Merged `web-framework-nextjs` gets added to the stack.

4. ~~nextjs-server-actions handling~~ **Resolved**: Merged into the Next.js skill as an examples/ file.

5. ~~Conflict rule complexity~~ **Resolved**: No new conflict rules needed. Category exclusivity handles base-vs-base conflicts. Meta-framework category is exclusive too (pick one meta-framework). Cross-ecosystem conflicts are prevented by `requires` (Next.js requires React, so it can't coexist with Vue).
