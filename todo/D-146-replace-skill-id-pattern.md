# D-146: Replace SKILL_ID_PATTERN with Generated Data

## Problem

`SKILL_ID_PATTERN` in `schemas.ts:79` hardcodes domain prefixes:

```ts
export const SKILL_ID_PATTERN = /^(web|api|cli|mobile|infra|meta|security|shared)-.+-.+$/;
```

This is a parallel source of truth that drifts from the generated types. Currently it's:
- **Missing `ai`** — causes warnings for all AI-domain skills in stack configs
- **Includes phantom `security`** — no such domain exists (`shared-security-*` is in the `shared` domain)

The same hardcoded regex appears in 3 locations total. The generated `source-types.ts` already exports `SKILL_IDS` and `DOMAINS` — validation should derive from those.

## Strategy

Two distinct validation needs:

| Need | Tool | Used by |
|------|------|---------|
| Membership ("is this a known skill?") | `Set<string>` from `SKILL_IDS` | `stacks-loader.ts`, `skillIdSchema` |
| Format ("does this look like a valid skill ID?") | Regex derived from `DOMAINS` | `source-validator.ts`, `source-switcher.ts` |

Format checks remain for source validation (repos may have skills not yet in generated types) and security validation (filesystem path safety).

## Changes

### `src/cli/lib/schemas.ts`

Remove `SKILL_ID_PATTERN`. Add derived constants:

```ts
const KNOWN_SKILL_IDS = new Set<string>(SKILL_IDS);
const DOMAIN_GROUP = DOMAINS.join("|");
export const SKILL_ID_FORMAT = new RegExp(`^(${DOMAIN_GROUP})-.+-.+$`);
export const CATEGORY_FORMAT = new RegExp(`^(${DOMAIN_GROUP})-.+$`);
export function isKnownSkillId(id: string): boolean {
  return KNOWN_SKILL_IDS.has(id);
}
```

Update `skillIdSchema` to use `Set` refinement instead of regex. Update `categoryPathSchema` (line 119) to use `CATEGORY_FORMAT`.

### `src/cli/lib/stacks/stacks-loader.ts`

Replace `SKILL_ID_PATTERN.test(assignment.id)` with `isKnownSkillId(assignment.id)`.

### `src/cli/lib/source-validator.ts`

- Line 72: replace hardcoded category regex with `CATEGORY_FORMAT`
- Line 232: replace `SKILL_ID_PATTERN` with `SKILL_ID_FORMAT`

### `src/cli/lib/skills/source-switcher.ts`

Replace `SKILL_ID_PATTERN` with `SKILL_ID_FORMAT`.

### Tests

- `schemas.test.ts` — update imports, rename describe block, add `isKnownSkillId()` tests
- `stacks-loader.test.ts:373` — update description/comment
- `source-switcher.test.ts:84` — update comment

### Documentation

- `.ai-docs/reference/type-system.md` lines 38, 251, 285 — update references

## Verification

1. `npx vitest run src/cli/lib/schemas.test.ts`
2. `npx vitest run src/cli/lib/stacks/stacks-loader.test.ts`
3. `npx vitest run src/cli/lib/skills/source-switcher.test.ts`
4. `npx vitest run src/cli/lib/plugins/plugin-settings.test.ts` (originally showed warnings)
5. `npx tsc --noEmit`
6. Grep for remaining `SKILL_ID_PATTERN` references
