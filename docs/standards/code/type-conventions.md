# Type Conventions

> Rules and patterns for the Agents Inc. CLI type system. Consult this document
> when working with skill IDs, category paths, aliases, boundary casts, and typed helpers.
>
> For foundational principles (fix at source, union types, template literals, `Partial<Record>`,
> pre/post-resolution types, cast classification), see [`typescript-types-bible.md`](../typescript-types-bible.md).

---

## Table of Contents

1. [SkillId Format](#skillid-format)
2. [CategoryPath Format](#categorypath-format)
3. [Alias Resolution](#alias-resolution)
4. [Boundary Cast Patterns](#boundary-cast-patterns)
5. [typedEntries and typedKeys](#typedentries-and-typedkeys)
6. [Testing Patterns](#testing-patterns)

---

## SkillId Format

### Definition

```typescript
// src/cli/types/skills.ts
type SkillIdPrefix = "web" | "api" | "cli" | "mobile" | "infra" | "meta" | "security";
type SkillId = `${SkillIdPrefix}-${string}-${string}`;
```

A `SkillId` has **3 or more** kebab-case segments: `prefix-subcategory-name`. The prefix
is constrained to one of 7 values; everything after the first dash is open `string`.

### Rules

- **Always dashes, never slashes.** IDs are `web-framework-react`, not `web/framework/react`.
  Slashes are filesystem directory paths (`directoryPath` field), not identifiers.
- **No `(@author)` suffix.** The author lives in `metadata.yaml`, never appended to the ID.
- **Minimum 3 segments.** `web-react` is invalid (only 2 segments). `web-framework-react` is valid.
- **kebab-case only.** No underscores, camelCase, or uppercase.

### Examples

| Valid                                    | Why                      |
| ---------------------------------------- | ------------------------ |
| `web-framework-react`                    | 3 segments, valid prefix |
| `api-database-prisma`                    | 3 segments, valid prefix |
| `meta-methodology-anti-over-engineering` | 4 segments, valid prefix |
| `security-auth-better-auth`              | 4 segments, valid prefix |

| Invalid                      | Why                                     |
| ---------------------------- | --------------------------------------- |
| `web`                        | Only 1 segment (no dashes after prefix) |
| `web-react`                  | Only 2 segments                         |
| `unknown-framework-react`    | Invalid prefix                          |
| `web/framework/react`        | Slashes, not dashes                     |
| `web-framework-react(@acme)` | Author suffix not allowed               |

### Runtime Validation

The Zod schema in `src/cli/lib/schemas.ts` enforces the same pattern at parse boundaries:

```typescript
export const SKILL_ID_PATTERN = /^(web|api|cli|mobile|infra|meta|security)-.+-.+$/;

export const skillIdSchema = z
  .string()
  .regex(SKILL_ID_PATTERN, "Must be a valid skill ID (e.g., 'web-framework-react')")
  as z.ZodType<SkillId>;
```

### Compile-Time vs Runtime

- **Compile-time:** The template literal `${SkillIdPrefix}-${string}-${string}` catches
  structurally invalid strings in TypeScript. A literal like `"web-react"` won't type-check.
- **Runtime:** `SKILL_ID_PATTERN` catches invalid IDs coming from YAML, JSON, or user input
  where TypeScript can't verify at compile time.

---

## CategoryPath Format

### Definition

```typescript
// src/cli/types/skills.ts
type CategoryPath =
  | `${SkillIdPrefix}/${string}` // "web/framework"
  | `${SkillIdPrefix}-${string}` // "web-framework"
  | Subcategory // "framework", "testing"
  | "local"; // user-defined local skills
```

A `CategoryPath` identifies which category a skill belongs to. It accepts multiple formats
because category references appear in different contexts.

### When to Use Each Format

| Format               | Example           | Used In                                           |
| -------------------- | ----------------- | ------------------------------------------------- |
| `prefix/subcategory` | `"web/framework"` | `metadata.yaml` category field (slash convention) |
| `prefix-subcategory` | `"web-framework"` | Normalized IDs in code, skill ID prefixes         |
| Bare `Subcategory`   | `"framework"`     | When the domain is already known from context     |
| `"local"`            | `"local"`         | User-defined skills from `.claude/skills/`        |

### Runtime Validation

```typescript
// src/cli/lib/schemas.ts
export const categoryPathSchema = z.string().refine(
  (val): val is CategoryPath => {
    if (val === "local") return true;
    if (/^(web|api|cli|mobile|infra|meta|security)\/.+$/.test(val)) return true;
    if (/^(web|api|cli|mobile|infra|meta|security)-.+$/.test(val)) return true;
    return subcategorySchema.safeParse(val).success;
  },
  {
    message:
      "Must be a valid category path (e.g., 'web/framework', 'web-framework', 'testing', or 'local')",
  },
);
```

### Extracting Subcategory from CategoryPath

When you need the bare `Subcategory` from a `CategoryPath`, take the last segment:

```typescript
// src/cli/lib/configuration/config-generator.ts
// Boundary cast: the last segment of a CategoryPath is always a valid Subcategory
const subcategory = skill.category.split(/[/-]/).pop() as Subcategory;
```

---

## Alias Resolution

### The Problem

Users and YAML files may reference skills by their short display name (`"react"`) or by
their full canonical ID (`"web-framework-react"`). Code that processes skill selections
must handle both.

### resolveAlias()

`resolveAlias()` in `src/cli/lib/matrix/matrix-resolver.ts` converts a display name to
its canonical `SkillId` using the matrix's `displayNameToId` lookup:

```typescript
export function resolveAlias(aliasOrId: SkillId, matrix: MergedSkillsMatrix): SkillId {
  return matrix.displayNameToId[aliasOrId as unknown as SkillDisplayName] || aliasOrId;
}
```

### When to Use resolveAlias()

**Use `resolveAlias()` when** the input might be an alias:

- User selections from the wizard (may be display names or IDs)
- Values read from `stacks.yaml` (may use short names)
- Values from YAML relationship rules (`conflicts`, `requires`, etc.)
- Any `SkillId` that hasn't been through matrix resolution yet

```typescript
// Resolving user selections before processing
const resolvedSelections = currentSelections.map((s) => resolveAlias(s, matrix));
```

**Use the ID directly when** you know it's already canonical:

- After `resolveAlias()` has been called
- Values from `ResolvedSkill.id` (already resolved during matrix merge)
- Values from `MergedSkillsMatrix.skills` keys (already canonical)
- Compile-time literal constants like `DEFAULT_PRESELECTED_SKILLS`

```typescript
// Already resolved - no alias lookup needed
const skill = matrix.skills[resolvedId];
```

### Pre-Resolution vs Post-Resolution Types

This distinction is encoded in the type system. See `typescript-types-bible.md` section 5
for the full pattern. In brief:

```typescript
// Pre-resolution: may contain aliases
type ExtractedSkillMetadata = {
  compatibleWith: SkillId[]; // may actually be display names at parse time
};

// Post-resolution: always canonical
type ResolvedSkill = {
  compatibleWith: SkillId[]; // guaranteed canonical after matrix merge
};
```

---

## Boundary Cast Patterns

### What Is a Boundary Cast?

A boundary cast is an explicit `as` assertion at a data entry point where runtime types
don't match compile-time types. These occur where typed code meets untyped data: parsing
YAML/JSON, reading from the filesystem, iterating `Object.entries/keys`, receiving CLI
args, or constructing test fixtures. They are the **only** legitimate casts in the codebase.

### Rule: Every Boundary Cast Gets a Comment

Every `as` cast must have a comment starting with `// Boundary cast:` explaining **why**
the cast is safe. If you can't write the comment, the cast probably shouldn't exist.

```typescript
// Boundary cast: <reason this cast is safe at this specific location>
const value = untypedValue as TypedValue;
```

### When Boundary Casts Are Acceptable

**1. YAML/JSON parse boundaries** -- data enters as `unknown` and needs narrowing after
validation.

```typescript
// Boundary cast: Zod loader schema validates structure; cast narrows passthrough output
return result.data as ProjectConfig;

// Boundary cast: YAML frontmatter parsed as unknown, narrow to record for field access
const meta = parsedFrontmatter as Record<string, unknown>;
```

Real examples: `project-config.ts:64`, `loader.ts:27`, `output-validator.ts:90`,
`plugin-validator.ts:252`, `compile.ts:335`

**2. Filesystem boundaries** -- directory names, filenames, and Map keys derived from the
filesystem are untyped strings that correspond to typed identifiers by convention.

```typescript
// Boundary cast: directory names from filesystem are agent names by convention
return files.map((f) => path.basename(f, ".md") as AgentName);

// Boundary cast: skillId comes from Map<string, ...> keys (directory names or forkedFrom.skill_id)
results.push({ id: skillId as SkillId, ... });
```

Real examples: `agent-recompiler.ts:45`, `skill-metadata.ts:207`,
`local-installer.ts:153`, `compile.ts:68,107`

**3. Type narrowing after runtime validation** -- a value's type is wider than what
runtime checks have established. The cast narrows to the validated subset.

```typescript
// Boundary cast: category is a Subcategory at the data boundary (domain checked below)
const subcat = skill.category as Subcategory;
const domain = categories[subcat]?.domain;
if (!domain) {
  warn(`...`);
  continue;
}

// Boundary cast: the last segment of a CategoryPath is always a valid Subcategory
const subcategory = categoryPath.split("/").pop() as Subcategory;
```

Real examples: `wizard-store.ts:422`, `config-generator.ts:24`

**4. Data definition boundaries** -- literal data structures where TypeScript can verify
the values but the container type is `Record<string, ...>`.

```typescript
// Boundary cast: literal strings are valid AgentName values at this data definition boundary
export const SKILL_TO_AGENTS: Record<string, AgentName[]> = {
  "web/*": ["web-developer", "web-reviewer", ...],
};
```

Real examples: `skill-agent-mappings.ts:19,134,141`

**5. Display name to SkillId boundaries** -- display names are typed as `SkillDisplayName`
but must pass through `SkillId`-typed APIs for downstream resolution via `resolveAlias()`.

```typescript
// Boundary cast: aliasOrId may contain a display name from legacy contexts
return matrix.displayNameToId[aliasOrId as unknown as SkillDisplayName] || aliasOrId;

// Boundary cast: display name resolved to SkillId downstream by resolveAlias
const techAsId = skill.displayName as SkillId;
```

Real examples: `matrix-resolver.ts:25`, `wizard-store.ts:435`, `matrix-loader.ts:234`

**6. oclif/framework boundaries** -- framework types don't declare custom properties
attached at runtime.

```typescript
// Boundary cast: oclif Config doesn't declare sourceConfig; we attach it in the init hook
const source = (this.config as Config & { sourceConfig?: string }).sourceConfig;
```

Real examples: `base-command.ts:25`, `init.ts:33`

**7. Test data construction** -- test fixtures are data entry boundaries, same as YAML
parsing. Partial mocks and intentionally invalid data are acceptable with a comment.

```typescript
// Boundary cast: test provides partial agents record; mock only needs the test agent
const agents = { "web-developer": mockAgent } as Record<AgentName, AgentDefinition>;

// Boundary cast: intentionally invalid skill ID to test validation
const invalidId = "bad" as SkillId;
```

Real examples: `local-installer.test.ts:301,339`, `stacks-loader.test.ts:336,417`

### When Boundary Casts Are NOT Acceptable

**Mid-pipeline casts** indicate a type error upstream. Fix the source type instead:

```typescript
// BAD: mid-pipeline workaround -- no boundary, just hiding a type error
const id = someFunction() as SkillId;

// GOOD: fix the return type of someFunction()
function someFunction(): SkillId { ... }
```

**Consumer code casts** -- if calling code needs a cast, the library's return type is
wrong. Fix it at the source so all consumers benefit:

```typescript
// BAD: every consumer casts
const skills = getSkills() as SkillId[];  // getSkills returns string[]

// GOOD: fix getSkills() to return SkillId[]
function getSkills(): SkillId[] { ... }
```

**Lazy workarounds** -- if you're casting to silence a type error without understanding
why, the cast is wrong. Investigate the type mismatch first.

### Post-safeParse Casts

After Zod validation with `.passthrough()`, the output type is wider than the actual
interface. The cast narrows it back. This is intentional throughout the codebase:

```typescript
const result = projectConfigLoaderSchema.safeParse(parsed);
if (!result.success) return null;
// Boundary cast: Zod validated the structure; .passthrough() widened the type, cast narrows it
return result.data as ProjectConfig;
```

The `.passthrough()` option preserves unknown fields for forward compatibility. The Zod
output type becomes `{ ...schema fields... } & { [k: string]: unknown }`, which isn't
assignable to the strict interface. The `as` cast narrows back to the validated shape.

### Summary Table

| Category                | When                                                  | Example File                                       |
| ----------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| YAML/JSON parse         | After Zod validation of parsed data                   | `project-config.ts`, `loader.ts`                   |
| Filesystem              | Directory/file names to typed identifiers             | `agent-recompiler.ts`, `skill-metadata.ts`         |
| Type narrowing          | After runtime check narrows a wider type              | `wizard-store.ts`, `config-generator.ts`           |
| Data definition         | Literal data with typed values in `Record<string, T>` | `skill-agent-mappings.ts`                          |
| Display name resolution | Display names passing through SkillId APIs            | `matrix-resolver.ts`, `wizard-store.ts`            |
| Framework               | oclif/library types missing custom properties         | `base-command.ts`, `init.ts`                       |
| Test fixtures           | Partial mocks and intentionally invalid data          | `local-installer.test.ts`, `stacks-loader.test.ts` |
| Object.entries/keys     | Prefer `typedEntries`/`typedKeys` instead             | `typed-object.ts`                                  |

---

## typedEntries and typedKeys

### The Problem

TypeScript's `Object.entries()` always returns `[string, V][]` and `Object.keys()` always
returns `string[]`, even when the object has narrower key types. This forces a boundary
cast on every loop:

```typescript
// BAD: repeated boundary casts
for (const [domain, selections] of Object.entries(domainSelections) as [
  Domain,
  SubcategorySelections,
][]) {
  // ...
}
```

### The Solution

`src/cli/utils/typed-object.ts` provides type-preserving wrappers:

```typescript
import { typedEntries, typedKeys } from "../utils/typed-object";

// GOOD: no cast needed
for (const [domain, selections] of typedEntries<Domain, SubcategorySelections>(domainSelections)) {
  // ...
}

// GOOD: keys preserve their type
const domains = typedKeys<Domain>(domainSelections);
```

### Implementation

```typescript
// src/cli/utils/typed-object.ts
export function typedEntries<K extends string, V>(obj: Partial<Record<K, V>>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}

export function typedKeys<K extends string>(obj: Partial<Record<K, unknown>>): K[] {
  return Object.keys(obj) as K[];
}
```

The cast is encapsulated once in the utility instead of scattered across every call site.

### Rules

1. **Always use `typedEntries`/`typedKeys`** instead of `Object.entries/keys` with casts.
2. **Import from `src/cli/utils/typed-object.ts`** (not re-implemented per file).
3. **Provide explicit type parameters** so the key type is visible at the call site.
4. **Raw `Object.entries/keys` is fine** when key types don't matter (e.g., iterating a
   plain `Record<string, unknown>`).

### Before / After

```typescript
// BEFORE: boundary cast at every call site
const entries = Object.entries(stack.skills) as [AgentName, Partial<Record<Subcategory, SkillId>>][];
for (const [agent, skills] of entries) { ... }

// AFTER: single import, no casts
import { typedEntries } from "../utils/typed-object";
for (const [agent, skills] of typedEntries<AgentName, Partial<Record<Subcategory, SkillId>>>(stack.skills)) { ... }
```

---

## Testing Patterns

### No Test Constants Needed

Literal strings are type-checked against the union types at compile time. There is no need
to create test constants or shared fixtures for type values:

```typescript
// GOOD: literals are validated by TypeScript
const skillId: SkillId = "web-test-skill"; // compiles
const badId: SkillId = "web-test"; // ERROR: doesn't match template

const agent: AgentName = "web-developer"; // compiles
const badAgent: AgentName = "unknown-agent"; // ERROR: not in union
```

### No Casting in Tests

Tests should use valid typed literals, not `as` casts. If a test value doesn't type-check,
either the value or the type is wrong:

```typescript
// BAD: hiding a type error
const id = "invalid" as SkillId;

// GOOD: use a value that matches the type
const id: SkillId = "web-test-mock";
```

### Exception: Intentionally Invalid Test Data

When testing validation or error handling, boundary casts are acceptable with a comment:

```typescript
// Boundary cast: intentionally invalid skill ID to test validation
const invalidId = "bad" as SkillId;
expect(() => validate(invalidId)).toThrow();
```

### Exception: Test Fixture Boundaries

Test helpers that construct mock data are data entry boundaries, same as YAML parsing:

```typescript
// Boundary cast: test provides partial agents record; mock only needs the test agent
const agents = { "web-developer": mockAgent } as Record<AgentName, AgentDefinition>;
```

### Summary

| Scenario                                     | Cast Allowed?                         |
| -------------------------------------------- | ------------------------------------- |
| Valid literal that matches the type          | No cast needed (TypeScript checks it) |
| Intentionally invalid data for error testing | Yes, with `// Boundary cast:` comment |
| Partial mock data in test fixtures           | Yes, with `// Boundary cast:` comment |
| Convenience cast to avoid fixing a type      | Never                                 |

---

## Quick Reference

### Type Locations

| Type                    | File                      | Purpose                                            |
| ----------------------- | ------------------------- | -------------------------------------------------- |
| `SkillId`               | `src/cli/types/skills.ts` | Canonical skill identifier                         |
| `SkillIdPrefix`         | `src/cli/types/skills.ts` | 7 valid prefixes                                   |
| `SkillDisplayName`      | `src/cli/types/skills.ts` | Human-readable labels (118 values)                 |
| `CategoryPath`          | `src/cli/types/skills.ts` | Category identifier (multiple formats)             |
| `SubcategorySelections` | `src/cli/types/skills.ts` | `Partial<Record<Subcategory, SkillId[]>>`          |
| `Domain`                | `src/cli/types/matrix.ts` | Wizard domain grouping (6 values)                  |
| `Subcategory`           | `src/cli/types/matrix.ts` | Category key (37 values)                           |
| `AgentName`             | `src/cli/types/agents.ts` | Built-in agent identifiers (18 values)             |
| `DomainSelections`      | `src/cli/types/matrix.ts` | Full wizard selection state                        |
| `CategoryMap`           | `src/cli/types/matrix.ts` | `Partial<Record<Subcategory, CategoryDefinition>>` |

### Validation Locations

| Schema               | File                     | Validates                     |
| -------------------- | ------------------------ | ----------------------------- |
| `skillIdSchema`      | `src/cli/lib/schemas.ts` | `SkillId` at runtime          |
| `SKILL_ID_PATTERN`   | `src/cli/lib/schemas.ts` | Raw regex for `SkillId`       |
| `categoryPathSchema` | `src/cli/lib/schemas.ts` | `CategoryPath` at runtime     |
| `subcategorySchema`  | `src/cli/lib/schemas.ts` | `Subcategory` enum at runtime |
| `agentNameSchema`    | `src/cli/lib/schemas.ts` | `AgentName` enum at runtime   |

### Key Functions

| Function         | File                                    | Purpose                           |
| ---------------- | --------------------------------------- | --------------------------------- |
| `resolveAlias()` | `src/cli/lib/matrix/matrix-resolver.ts` | Display name to canonical SkillId |
| `typedEntries()` | `src/cli/utils/typed-object.ts`         | Type-safe `Object.entries`        |
| `typedKeys()`    | `src/cli/utils/typed-object.ts`         | Type-safe `Object.keys`           |
