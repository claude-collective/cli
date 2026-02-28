# D-46 Phase 5: TypeScript Config Migration -- Phased Implementation Plan

**Design doc:** [docs/features/proposed/custom-extensibility-design.md](../docs/features/proposed/custom-extensibility-design.md)
**Goal:** Replace YAML config with TypeScript config using `defineConfig()` with const generic parameters. Custom values are declared in dedicated sections (`customSkills`, `customAgents`, etc.) and TypeScript automatically makes them valid in all other fields. Migrate `skill-categories.yaml` and `skill-rules.yaml` to TS exports.

No backward compatibility -- this is pre-1.0.

---

## The Type-Safe Generic Approach

### How `defineConfig()` works

```typescript
function defineConfig<
  const TSkills extends string[] = [],
  const TAgents extends string[] = [],
  const TDomains extends string[] = [],
  const TCategories extends string[] = [],
>(config: {
  name: string;
  // ... standard fields ...

  // Declare custom entities
  customSkills?: TSkills;
  customAgents?: TAgents;
  customDomains?: TDomains;
  customCategories?: TCategories;

  // Built-in + custom entities validated together
  skills: (SkillId | TSkills[number])[];
  agents: (AgentName | TAgents[number])[];
  domains?: (Domain | TDomains[number])[];

  // Stack keys and values also accept custom values
  stack?: Partial<Record<
    AgentName | TAgents[number],
    Partial<Record<
      Subcategory | TCategories[number],
      SkillValue<TSkills>
    >>
  >>;
}): ProjectConfig { ... }
```

### What consumers write

```typescript
import { defineConfig, defaultCategories, defaultRules } from "@agents-inc/cli";

export default defineConfig({
  name: "acme-project",
  source: "github:acme/skills",
  installMode: "local",

  customSkills: ["acme-deploy-pipeline", "acme-audit-runner"],
  customAgents: ["acme-deployer"],
  customDomains: ["acme"],
  customCategories: ["acme-pipeline"],

  skills: ["web-framework-react", "acme-deploy-pipeline"],
  agents: ["web-developer", "acme-deployer"],
  domains: ["web", "acme"],

  stack: {
    "web-developer": {
      framework: "web-framework-react",
    },
    "acme-deployer": {
      "acme-pipeline": "acme-deploy-pipeline",
    },
  },

  categories: [
    ...defaultCategories,
    { id: "acme-pipeline", displayName: "Deploy Pipeline", domain: "acme", exclusive: true },
  ],

  rules: {
    ...defaultRules,
    aliases: { ...defaultRules.aliases, deploy: "acme-deploy-pipeline" },
  },
});
```

**Why this works**: TypeScript 5.0+ `const` type parameters infer literal tuple types from the `customSkills` array. `TSkills[number]` becomes the union `"acme-deploy-pipeline" | "acme-audit-runner"`, which TypeScript propagates to all other fields. Autocomplete works for BOTH built-in AND custom values. Typos in custom values -> compile error.

---

## Phase 1: Foundation

**What:** Create the core building blocks -- `defineConfig()`, TS config loader/writer, and default category/rules exports.

**Steps (order matters where noted):**

1. Add `jiti` dependency to `package.json`.
2. Add `CONFIG_TS_FILE = "config.ts"` constant to `consts.ts`.
3. Create `default-categories.ts` -- convert `config/skill-categories.yaml` to TS export.
4. Create `default-rules.ts` -- convert `config/skill-rules.yaml` to TS export.
5. Create `define-config.ts` -- `defineConfig()` with const generic parameters + `ConfigInput` type.
6. Create `ts-config-loader.ts` -- jiti-based loader (loads TS file, validates with Zod). Mirror `safeLoadYamlFile` null-on-failure pattern.
7. Create `ts-config-writer.ts` -- generates TS source from `ProjectConfig` objects. Must generate valid `defineConfig()` calls. **(hardest module -- depends on defineConfig API from step 5)**
8. Update `index.ts` re-exports, `package.json` exports, tsup entry point for `@agents-inc/cli/config`.
9. **Round-trip test:** `ProjectConfig -> writer -> .ts file -> jiti loader -> ProjectConfig`, verify equality. This proves the approach before touching any existing code.

**Verification:** Round-trip test passes for all edge cases (custom skills, stack with preloaded flags, optional fields, nested records). Existing tests still pass.

---

## Phase 2: Config loading + writing migration

**What:** Wire all config loading and writing through the new TS modules. Steps touch different files and have no ordering constraint between them.

**Steps:**

1. `project-config.ts` + `config.ts`: swap `safeLoadYamlFile` -> ts-config-loader for both `loadProjectConfig` and `loadProjectSourceConfig`.
2. `compile.ts`: replace inline YAML parsing with `loadProjectConfig()` / ts-config-loader.
3. `source-loader.ts`: replace CLI YAML file loading (`loadSkillCategories(cliPath)`) with TS imports (`defaultCategories`, `defaultRules`). Keep YAML loading for source repos.
4. `local-installer.ts`: `writeConfigFile()` generates `.ts` using ts-config-writer.
5. `config-saver.ts`: `saveSourceToProjectConfig()` generates `.ts`.
6. `installation.ts`: detect `config.ts` instead of `config.yaml`.
7. Update tests affected by each change above.

**Verification:** All existing tests pass with `.ts` config format. Init/edit/compile workflows functional.

---

## Phase 3: Cleanup

**What:** Delete obsolete commands, schemas, and YAML files.

**Command cleanup:**

1. Delete `config/set-project.ts`, `config/unset-project.ts`, `config/get.ts`.
2. Update `config/index.ts` after subcommand deletion.
3. Simplify `config/show.ts` to read-only display via TS loader.
4. Update `config/path.ts` to return `.ts` path.
5. `new/marketplace.ts`: keep YAML scaffolding for categories/rules (source repo format). Only `.claude-src/config` becomes `.ts` if applicable.
6. Update `doctor.ts`, `eject.ts`, `uninstall.tsx` -- change config.yaml references to config.ts.

**Schema cleanup:**

7. Delete `src/schemas/project-config.schema.json`.
8. `schemas.ts`: remove `projectConfigValidationSchema` (keep `projectConfigLoaderSchema` for runtime Zod validation).
9. `local-installer.ts`: remove `yamlSchemaComment` usage, `CONFIG_OPTIONS_COMMENT`, `PATH_OVERRIDES_COMMENT`.
10. Delete `config/skill-categories.yaml` and `config/skill-rules.yaml` (keep `config/stacks.yaml`).

**Tests:**

11. Update all config loading/writing tests for `.ts` format.
12. Add tests for generic type inference (compile-time checks).
13. Add tests for custom value propagation into stacks.
14. Full test suite passing + `tsc --noEmit` clean.

**Verification:** No references to deleted files. All tests pass. Zero type errors.

---

## Files affected

| File                                                      | Change                      |
| --------------------------------------------------------- | --------------------------- |
| `package.json`                                            | Add `jiti`, update exports  |
| **New** `src/cli/lib/configuration/define-config.ts`      | `defineConfig()` + generics |
| **New** `src/cli/lib/configuration/ts-config-loader.ts`   | jiti-based loader           |
| **New** `src/cli/lib/configuration/ts-config-writer.ts`   | TS source generator         |
| **New** `src/cli/lib/configuration/default-categories.ts` | `defaultCategories`         |
| **New** `src/cli/lib/configuration/default-rules.ts`      | `defaultRules`              |
| `src/cli/lib/configuration/project-config.ts`             | Load .ts                    |
| `src/cli/lib/configuration/config.ts`                     | Load .ts                    |
| `src/cli/lib/configuration/config-saver.ts`               | Write .ts                   |
| `src/cli/lib/configuration/index.ts`                      | Re-export new modules       |
| `src/cli/lib/installation/local-installer.ts`             | Write .ts config            |
| `src/cli/lib/installation/installation.ts`                | Detect config.ts            |
| `src/cli/lib/loading/source-loader.ts`                    | Use TS defaults             |
| `src/cli/commands/compile.ts`                             | TS config loader            |
| `src/cli/commands/edit.tsx`                               | Config loading path         |
| `src/cli/commands/init.tsx`                               | Config loading path         |
| `src/cli/commands/new/marketplace.ts`                     | Generate .ts                |
| `src/cli/commands/config/show.ts`                         | TS config loader            |
| `src/cli/commands/config/path.ts`                         | .ts path                    |
| `src/cli/consts.ts`                                       | CONFIG_TS constant          |
| `src/cli/lib/schemas.ts`                                  | Remove validation schema    |
| **Delete** `src/cli/commands/config/set-project.ts`       | Removed                     |
| **Delete** `src/cli/commands/config/unset-project.ts`     | Removed                     |
| **Delete** `src/cli/commands/config/get.ts`               | Removed                     |
| **Delete** `src/schemas/project-config.schema.json`       | Replaced by TS types        |
| **Delete** `config/skill-categories.yaml`                 | Replaced by TS              |
| **Delete** `config/skill-rules.yaml`                      | Replaced by TS              |

---

## Dependencies

```
Phase 1 (foundation -- new files only, nothing breaks)
  +-> Phase 2 (migration -- swap existing code to use new modules)
        +-> Phase 3 (cleanup -- delete old code, update tests)
```

Three phases, strictly sequential. Each phase is self-contained and the codebase compiles + tests pass after each one.

## E2E Test Policy

This project has strict end-to-end tests (`npm run test:e2e`) that exercise the full init/edit/compile workflows including config file creation, loading, and agent compilation.

**Rule: All tests (unit + E2E) must pass at every commit. No skipping.**

The config file is an intermediate artifact — the CLI writes it, then reads it back. As long as the write path and read path change together in the same step, E2E tests don't care about the format. If an E2E test asserts on config filename (`config.yaml` → `config.ts`) or content format (expecting YAML), update the assertion in the same commit that changes the behavior.

---

## Not in scope (separate tasks)

- Init/edit scope behavior -- global config detection in `init`, scope-aware `edit` (see [D-65](./D-65-init-edit-scope.md))
- `.d.ts` generation for consumer configs
- Migration CLI command

---

---

## Design Review

**Reviewer:** CLI developer agent
**Date:** 2026-02-27
**Files examined:** All 25+ files listed in the "Files affected" table, plus types, schemas, tsup config, package.json, and jiti documentation.

---

### 1. Viability Assessment

#### Is `jiti` the right choice?

**Yes, with caveats.** jiti v2 (current: 2.6.1) is the de facto standard for runtime TS config loading. It is used by Tailwind CSS, Nuxt, ESLint, Storybook, UnoCSS, and dozens of other major tools. It is zero-dependency and roughly 100KB. The API is straightforward:

```typescript
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const config = await jiti.import("./config.ts", { default: true });
```

**Caveat 1 -- ESM interop.** This project uses `"type": "module"` and tsup ESM output. jiti v2 handles ESM well, but the `interopDefault` proxy behavior (introduced in v2.1) can cause subtle issues. The config loader should use `{ default: true }` to get the default export cleanly.

**Caveat 2 -- Type stripping.** jiti strips types at runtime, it does not type-check. The `defineConfig()` generics provide compile-time safety only when the consumer runs `tsc` or has an IDE. At runtime, jiti sees plain JavaScript. This is fine and expected, but the plan should explicitly acknowledge that `defineConfig()` is a compile-time DX feature, not a runtime validation mechanism. **Runtime validation still needs Zod** (or at minimum the existing `projectConfigLoaderSchema`).

**Caveat 3 -- Bundle size impact.** jiti is a runtime dependency that ships to users. At ~100KB minified, it is acceptable, but it is not trivial. For comparison, `yaml` (already a dependency) is ~140KB.

#### Can `defineConfig()` actually achieve the described type inference?

**Partially. The core concept works, but the `stack` typing as written has a fundamental problem.**

The `const` generic parameter inference with `TSkills[number]` works well for flat arrays:

```typescript
const TSkills = ["acme-deploy-pipeline", "acme-audit-runner"] as const;
type SkillUnion = (typeof TSkills)[number]; // "acme-deploy-pipeline" | "acme-audit-runner"
// Then: skills: (SkillId | SkillUnion)[] -- this works, autocomplete works.
```

**The problem is `stack`.** The plan shows:

```typescript
stack?: Partial<Record<
  AgentName | TAgents[number],
  Partial<Record<
    Subcategory | TCategories[number],
    SkillValue<TSkills>
  >>
>>;
```

This has two issues:

1. **`Partial<Record<UnionA | UnionB, ...>>` does not provide autocomplete for the keys.** TypeScript treats `Record<string, V>` as an index signature when any union member widens to string. Since `TAgents[number]` is a specific literal, this should work IF the consumer has TypeScript 5.0+. But if `TAgents` defaults to `[]`, then `TAgents[number]` is `never`, and `AgentName | never` = `AgentName`, which is fine. So this direction is correct.

2. **`SkillValue<TSkills>` is referenced but never defined.** The plan needs to specify what this type is. Looking at the current `StackAgentConfig` type: `Partial<Record<Subcategory, SkillAssignment[]>>`. Stack values are `SkillAssignment[]` (objects with `id`, `preloaded`, `local`, `path`), not bare strings. But the example config shows bare strings (`framework: "web-framework-react"`). This is because the current YAML format allows bare strings which are normalized to `SkillAssignment[]` at load time by `normalizeStackRecord()`. The TS config needs to decide: does it accept the same lenient format (bare string | object | array) or does it enforce the normalized format? This is a design decision not addressed in the plan.

3. **The `categories` field in the example uses an array format (`[...defaultCategories, { id: ... }]`), but the existing type `CategoryMap` is `Partial<Record<Subcategory, CategoryDefinition>>` -- a Record, not an array.** The plan's example uses array syntax for categories, which conflicts with the existing type. Either `defineConfig` needs to transform an array into a Record, or the example needs to use Record syntax. The array syntax is more ergonomic for spreading defaults, but it means `defineConfig()` needs transformation logic and the input type differs from `CategoryMap`.

4. **The `rules` field.** The existing `SkillRulesConfig` type has fields `version`, `aliases`, `relationships`, `perSkill`. The example shows `{ ...defaultRules, aliases: { ...defaultRules.aliases, deploy: "acme-deploy-pipeline" } }`. The `defaultRules` export would need to be a plain object matching this shape. The `perSkill` field uses `Partial<Record<SkillDisplayName, PerSkillRules>>` -- this should be fine for spreading.

**Bottom line on generics:** The flat field inference (skills, agents, domains) works perfectly. The nested `stack` inference works but needs careful type design for `SkillValue`. The `categories` and `rules` fields need input-type transformations that are not described in the plan.

#### Does the TS config writer need to handle every edge case of `ProjectConfig`?

**Yes, and this is the hardest part of the entire plan.** The current writer (`writeConfigFile` in `local-installer.ts`) uses `stringifyYaml()` which handles all JS objects automatically. A TS writer must:

- Generate valid TypeScript source code as a string
- Handle `SkillAssignment[]` in stack values (objects with optional fields)
- Handle optional fields (omit `undefined` values, do not write `key: undefined`)
- Handle array formatting
- Handle nested Record formatting
- Handle the `compactStackForYaml` equivalent (bare strings vs objects)
- Import `defineConfig` at the top
- Use `export default` syntax
- Properly escape any string values that might contain quotes
- Generate `as const` arrays for custom value declarations

The YAML writer is 15 lines. The TS writer will be 100+ lines and will be the most error-prone module in the migration. **This should be the first thing prototyped** to validate the approach.

---

### 2. Edge Cases and Risks

#### What happens when `jiti` fails to load a malformed config.ts?

jiti throws standard JavaScript errors. Common failure modes:

- **Syntax error in config.ts** -> SyntaxError with line/column. Error messages from jiti are reasonable.
- **Missing import (defineConfig not found)** -> ReferenceError or module resolution error. This will happen if the user has no `@agents-inc/cli` installed or if `defineConfig` is not exported from the package.
- **Runtime error in config.ts** -> If the config file has side effects or complex logic, any runtime error propagates.

**Risk:** The current YAML loader (`safeLoadYamlFile`) returns `null` on parse failure (graceful degradation). The TS loader via jiti will throw. Every call site needs to wrap the jiti import in try/catch and handle errors gracefully. The plan does not mention error handling strategy for the loader.

**Recommendation:** The `ts-config-loader.ts` should mirror the `safeLoadYamlFile` pattern -- return `null` on failure and log a warning, or return a `Result` type.

#### Circular imports if `defineConfig` imports types used by the loader

**Low risk.** `defineConfig` will import types from `types/`. The loader (`ts-config-loader.ts`) will import `defineConfig` or its output type. Since `defineConfig` is a function (not a class with state), and types are erased at runtime, circular imports are unlikely. However, `defineConfig` should NOT import from `schemas.ts` or any module that has side effects (like the mutable `customExtensions` sets in `schemas.ts`).

#### CLI defaults vs source repo YAML: the dual-format problem

**This is the biggest unaddressed issue in the plan.**

The plan says "Delete `config/skill-categories.yaml`" and replace with `default-categories.ts`. But look at what `loadAndMergeFromBasePath` in `source-loader.ts` actually does (lines 187-291):

```
1. Load CLI categories from config/skill-categories.yaml (PROJECT_ROOT)
2. Load CLI rules from config/skill-rules.yaml (PROJECT_ROOT)
3. Load SOURCE categories from {basePath}/config/skill-categories.yaml (if exists)
4. Load SOURCE rules from {basePath}/config/skill-rules.yaml (if exists)
5. Merge: CLI defaults + source overrides
```

When the CLI's built-in `config/skill-categories.yaml` becomes a TS import (`default-categories.ts`), step 1 changes from "load YAML file" to "import TS module". That is fine.

But **source repos** (like `/home/vince/dev/skills` or any `github:org/marketplace` repo) still ship their own `config/skill-categories.yaml` and `config/skill-rules.yaml`. These are standalone YAML files in external repositories. The CLI cannot control their format.

**This means:**

- The CLI's own defaults become TS imports (step 1-2 above)
- Source repos continue to use YAML (steps 3-4)
- The `loadSkillCategories()` and `loadSkillRules()` functions in `matrix-loader.ts` **must continue to exist** for loading source repo YAML files
- Only the hardcoded `cliCategoriesPath` / `cliRulesPath` in `source-loader.ts` change

The plan says "source-loader.ts: Use TS defaults" which is correct, but it does not acknowledge that `loadSkillCategories()` and `loadSkillRules()` must be preserved for source repo YAML loading. The `skillCategoriesFileSchema` and `skillRulesFileSchema` in `schemas.ts` **must NOT be removed** because they validate source repo YAML.

**Recommendation:** Phase 2 step 6 should say "source-loader.ts: Replace CLI default loading with TS imports. Keep YAML loading for source repos (loadSkillCategories/loadSkillRules stay)."

#### The `compile.ts` command's inline YAML parsing

Looking at `compile.ts` lines 264-291, the `runPluginModeCompile` method does:

```typescript
const configContent = await readFile(configPath);
const parsed = parseYaml(configContent);
const configResult = projectConfigLoaderSchema.safeParse(parsed);
```

This loads the **project config** (`.claude-src/config.yaml`) using inline YAML parsing rather than the shared `loadProjectConfig()` function. The plan correctly identifies this needs to change, but the fix is simpler than described: just replace the inline parsing with `loadProjectConfig()` or the new TS loader equivalent. The TS config loader should be the single path.

#### Config merging with TS files

The plan does not address how `mergeWithExistingConfig()` in `config-merger.ts` works with TS configs.

Currently:

1. Wizard produces a new `ProjectConfig` object
2. `mergeWithExistingConfig()` loads the existing config (via `loadProjectConfig()`) and merges
3. The merged `ProjectConfig` object is written to disk as YAML

With TS config:

1. Wizard produces a new `ProjectConfig` object (same)
2. `mergeWithExistingConfig()` loads existing config -- now from `.ts` via jiti (works)
3. The merged `ProjectConfig` object must be written as **valid TypeScript source** -- the `ts-config-writer.ts` must generate a complete `defineConfig()` call from the merged object

**Risk:** The merged config may have custom values from the existing config (e.g., `customSkills: ["acme-deploy"]`). The TS writer must preserve these. The `ProjectConfig` type does NOT have `customSkills`/`customAgents`/`customDomains`/`customCategories` fields -- these are input-only fields that `defineConfig()` strips from its output. This means **the merge path loses custom entity declarations**.

**This is a design flaw.** Options:

1. Add custom entity fields to `ProjectConfig` so they round-trip through the merge
2. Read the existing config.ts file as text and do AST-level merging (over-engineering)
3. Have the TS writer infer custom entities from the skills/agents/domains that are not in the built-in unions
4. Extend `ProjectConfig` with an optional `customEntities` bag that `defineConfig()` preserves

**Recommendation:** Option 3 or 4. The TS writer should analyze the ProjectConfig, find any skill IDs that don't match `SkillId` pattern, agents not in `AgentName` union, etc., and generate `customSkills`/`customAgents` arrays automatically.

#### Global config at `~/.claude-src/config.ts`

**This is fine.** The user already has `~/.claude-src/config.yaml`. A `.ts` file is only marginally different. Users who don't know TypeScript can treat it as a structured data file (the `defineConfig()` call looks like JSON with slightly different syntax). And the CLI generates the file automatically -- users rarely edit it by hand.

However, **the global config does not need `defineConfig()` generics.** Global configs typically just have `source`, `marketplace`, `author`, `agentsSource`, `sources`, `branding`, etc. These are `ProjectSourceConfig` fields, not `ProjectConfig` fields. The global config should use a simpler `defineSourceConfig()` or just a plain object export.

**Important distinction the plan conflates:** There are TWO different config types:

- `ProjectConfig` (in `types/config.ts`) -- full project config with skills, agents, stack. Written by `local-installer.ts` to `.claude-src/config.yaml`. Loaded by `project-config.ts`.
- `ProjectSourceConfig` (in `config.ts`) -- source configuration with source URL, marketplace, custom paths, bound skills, branding. Written by `config-saver.ts` to `.claude-src/config.yaml`. Loaded by `config.ts > loadProjectSourceConfig()`.

Currently, these are **both stored in the same file** (`.claude-src/config.yaml`). `ProjectConfig` is a superset that contains `ProjectSourceConfig` fields plus skills/agents/stack. The loader schemas differ (`projectConfigLoaderSchema` vs `projectSourceConfigSchema`). The `loadProjectSourceConfig()` uses the source schema and `loadProjectConfig()` uses the full project schema.

The plan treats them as one config but they have different loaders, different schemas, and different write paths. The `defineConfig()` type system needs to accommodate both.

#### `new/marketplace.ts` scaffolding

Currently, `new/marketplace.ts` scaffolds a standalone marketplace repo with:

- `config/skill-categories.yaml`
- `config/skill-rules.yaml`
- `config/stacks.yaml`
- `src/skills/dummy-skill/`
- `README.md`

If we change to TS config, the scaffolded marketplace would need... what exactly?

Marketplace repos are **standalone projects** that may or may not have `@agents-inc/cli` as a dependency. Currently they just need YAML files that the CLI reads. If we make the CLI's own defaults TS imports, **marketplace repos still use YAML** because:

1. They don't need `defineConfig()` -- they export categories/rules, not project config
2. They don't have `@agents-inc/cli` as a dependency
3. The CLI loads their YAML files via `loadSkillCategories()` / `loadSkillRules()`

**The plan says "Update `new/marketplace.ts` to scaffold `.ts` config instead of `.yaml`."** This is wrong for skill-categories.yaml and skill-rules.yaml. Marketplace repos should continue scaffolding YAML for categories and rules because those are loaded by the CLI from the source repo as YAML.

The only file that could become TS in a marketplace repo is the `.claude-src/config.yaml` (the `ProjectSourceConfig`). But that file is optional in marketplace repos and rarely used.

**Recommendation:** `new/marketplace.ts` should continue scaffolding YAML files. The only change needed is if the marketplace's own `.claude-src/config.yaml` becomes `.ts`.

#### `ProjectSourceConfig` has fields that point to YAML files

`ProjectSourceConfig` has these fields:

```typescript
categoriesFile?: string; // default: "config/skill-categories.yaml"
rulesFile?: string;      // default: "config/skill-rules.yaml"
stacksFile?: string;     // default: "config/stacks.yaml"
```

These allow source repos to use custom paths for their YAML configuration files. The `loadAndMergeFromBasePath()` uses these to locate the source's category/rules files. These fields and the YAML loading they point to **must be preserved**.

---

### 3. Missing from the Plan

#### How does `tsup` handle the new TS default exports?

The tsup config (in `tsup.config.ts`) bundles `src/cli/commands/**/*.{ts,tsx}` and `src/cli/index.ts`. The new `define-config.ts`, `default-categories.ts`, `default-rules.ts` are under `src/cli/lib/configuration/` -- these get bundled into the library code automatically via import chains.

**However,** the `package.json` `exports` field currently only has `"."` pointing to `./dist/index.js`. If consumers need to import `defineConfig` from `@agents-inc/cli`, the library's main entry point needs to re-export it. The plan mentions updating `package.json` exports but does not specify the exact structure.

**Recommendation:** Add to `package.json`:

```json
"exports": {
  ".": { "import": "./dist/index.js" },
  "./config": { "import": "./dist/lib/configuration/index.js" }
}
```

Or alternatively, re-export `defineConfig` from the main `src/cli/index.ts` entry point. But note: the main entry point is the oclif CLI binary (`#!/usr/bin/env node`). It should NOT export library functions. A separate export path is needed.

Actually, looking at `tsup.config.ts`, the entry points do NOT include `src/cli/lib/**/*.ts`. These files are bundled as dependencies of the entry points but are NOT standalone entry points. This means **there is no `dist/lib/configuration/index.js` to point an export to**. tsup creates chunked output where lib files may be inlined or deduplicated.

**This is a real problem.** For `defineConfig` to be importable by consumers, either:

1. Add `src/cli/lib/configuration/define-config.ts` as an explicit tsup entry point
2. Create a new `src/cli/config.ts` entry point that re-exports `defineConfig`
3. Export `defineConfig` from the main CLI entry point (bad -- mixes CLI binary with library)

**Recommendation:** Add a new tsup entry point `src/cli/config-exports.ts` that re-exports the public API (`defineConfig`, `defaultCategories`, `defaultRules`), and add a package.json export for `@agents-inc/cli/config`.

#### The `package.json` `files` array

Currently includes `"config/"`. If `config/skill-categories.yaml` and `config/skill-rules.yaml` are deleted (Phase 4), the `config/` directory still has `config/stacks.yaml`. So `"config/"` stays.

But wait -- the tsup `onSuccess` hook copies `config/` to `dist/config/`. If categories/rules YAML files are deleted but stacks.yaml remains, this copy still works. However, `config/stacks.yaml` is loaded at runtime via `loadStacks(PROJECT_ROOT)`. If `PROJECT_ROOT` resolves to `dist/` in production, the stacks need to be in `dist/config/`. So `stacks.yaml` must remain in `config/` and continue being copied.

**The plan correctly handles this** (Phase 4 step 7 says "remove `config/` if now empty" -- and it won't be empty because `stacks.yaml` remains).

#### How do tests mock the TS config loader?

Currently, tests use `createTempDir()` and write YAML files, then call `loadProjectConfig()` or `safeLoadYamlFile()`. With jiti-based loading:

1. Tests would need to write `.ts` files to temp directories
2. jiti would need to load them at runtime (possible but slower than YAML parsing)
3. Test isolation: jiti caches modules. Tests that write different configs to the same path may see stale cached values.

**Risk:** jiti uses `require.cache` integration for caching. Concurrent tests writing to the same temp path could have cache collisions. The loader should either:

- Clear the jiti cache between loads (`jiti.import` with `{ cache: false }` or similar)
- Use unique file paths per test (already the pattern with `createTempDir()`)

**Recommendation:** Add a note about test isolation. The TS config loader should accept an option to disable caching, or tests should use `createJiti` with caching disabled.

#### `safeLoadYamlFile` call sites

Grepping for `safeLoadYamlFile` in production code shows only:

- `project-config.ts:39` -- loads ProjectConfig
- `config.ts:82` -- loads ProjectSourceConfig
- `config.ts:99` -- loads global ProjectSourceConfig

These are exactly the call sites that need to change. The YAML loading utility itself (`utils/yaml.ts`) stays because it is used for other YAML files (agent metadata, skill metadata, stacks, etc.).

#### Additional files not in the plan

Files that reference config.yaml or config loading that are NOT in the plan's "Files affected" table:

1. **`src/cli/commands/doctor.ts`** -- Validates config.yaml existence and content. Needs updating to check for config.ts.
2. **`src/cli/commands/eject.ts`** -- Lines 177, 187, 257: Creates/references config.yaml. Needs updating.
3. **`src/cli/commands/uninstall.tsx`** -- References config.yaml presence for detecting CLI-managed installations.
4. **`src/cli/commands/config/index.ts`** -- Topic definition. May need updating if subcommands are deleted.
5. **`src/cli/lib/installation/installation.ts`** -- Already listed, but uses `STANDARD_FILES.CONFIG_YAML` constant. Needs to also check for `CONFIG_TS_FILE`.

**Recommendation:** Add `doctor.ts`, `eject.ts`, `uninstall.tsx`, and `config/index.ts` to the files affected table.

#### `ProjectConfig` vs `ProjectSourceConfig` -- which becomes TS?

The plan does not clearly distinguish:

- **`ProjectConfig`** -- the full project configuration (skills, agents, stack, installMode, domains, selectedAgents). Written by the wizard/init flow via `writeConfigFile()` in `local-installer.ts`. This is the config that benefits most from `defineConfig()` generics because it has typed skill IDs, agent names, etc.

- **`ProjectSourceConfig`** -- source configuration (source URL, marketplace, branding, custom paths, bound skills). Written by `saveProjectConfig()` in `config.ts`. This is a simpler config that does NOT benefit from generics.

Currently, both live in `.claude-src/config.yaml`. The `loadProjectConfig()` reads using `projectConfigLoaderSchema` which is a superset. The `loadProjectSourceConfig()` reads using `projectSourceConfigSchema` which is a subset.

**Both config types should become TS files.** But they should remain in the same file (`.claude-src/config.ts`). The `defineConfig()` function should handle both use cases:

- Full project config: `export default defineConfig({ name, skills, agents, stack, ... })`
- Source-only config: `export default defineConfig({ source, marketplace, ... })`

`defineConfig()` should accept a union input type that allows either full or partial configs.

---

### 4. Factual Errors in the Plan

1. **Phase 4 step 7: "remove `config/` if now empty"** -- `config/stacks.yaml` still exists. `config/` will not be empty. The step should say "remove deleted YAML files from `config/`, keep `stacks.yaml`."

2. **Phase 3 step 6: "Update `new/marketplace.ts` to scaffold `.ts` config instead of `.yaml`."** -- Incorrect. `new/marketplace.ts` scaffolds `skill-categories.yaml`, `skill-rules.yaml`, and `stacks.yaml` for marketplace repos. These are source repo files loaded as YAML by the CLI. They should remain YAML. See detailed analysis above.

3. **Phase 5 init behavior step 3: "If project config exists -> launch the wizard in edit mode."** -- This is already the current behavior. `init.tsx` already checks `detectProjectInstallation()` and shows the dashboard if installed. The plan describes existing behavior as new.

4. **Phase 5 edit behavior: "If neither found -> error."** -- This is already the current behavior. `edit.tsx` already calls `detectInstallation()` which falls back to global, and errors if no installation found.

5. **Files affected table missing `doctor.ts`, `eject.ts`, `uninstall.tsx`** -- These commands reference config.yaml and need updating.

---

### 5. Recommendations

#### Reorder phases

The current dependency chain is:

```
Phase 1 -> Phase 2 -> Phase 3 + Phase 4 -> Phase 5 -> Phase 6
```

**Problems:**

- Phase 5 (init/edit scope) is independent of the TS config migration. `init` and `edit` already have global fallback behavior. Phase 5 should be a separate task, not gated behind schema cleanup.
- Phase 6 (tests) should not be a separate phase. Tests should be written alongside each phase.

**Recommended reorder:**

```
Phase 1: Foundation (defineConfig, loader, writer, defaults)
  +-> Phase 2: Config loading migration (project-config, config, compile, source-loader)
        +-> Phase 3: Config writing migration (local-installer, config-saver)
              +-> Phase 4: Command cleanup + schema cleanup (combined)
```

Phase 5 (init/edit scope) should be a **separate task** -- it is a UX feature, not part of the config format migration.

Phase 6 (tests) should be absorbed into each phase.

#### Minimum viable first phase

To prove the approach works before committing, the MVP should be:

1. Create `defineConfig()` function
2. Create TS config writer (the hardest part)
3. Create TS config loader (jiti)
4. Write a round-trip test: `ProjectConfig object -> TS writer -> TS file -> jiti loader -> ProjectConfig object` and verify equality

If the round-trip test passes for all edge cases (custom skills, stack with preloaded flags, optional fields, nested records), the approach is proven. If the TS writer cannot faithfully represent a `ProjectConfig`, the entire plan falls apart.

**This round-trip test should be the first thing implemented.**

#### Split or combine?

- **Combine** Phase 3 and Phase 4. They are both "cleanup" phases with no dependencies between them.
- **Split** Phase 2 into "reading" and "writing". Config loading (read path) is lower risk than config writing (write path). Proving the read path works first gives confidence.
- **Remove** Phase 5 from this plan. It is orthogonal to the config format migration.

#### What about the `categories` and `rules` fields in `defineConfig`?

The example shows `categories` and `rules` as fields on the config object, but `ProjectConfig` does NOT have these fields. `ProjectConfig` has `skills`, `agents`, `stack`, `installMode`, etc. Categories and rules come from separate files (`skill-categories.yaml`, `skill-rules.yaml`) loaded by `source-loader.ts`.

If `defineConfig()` accepts `categories` and `rules`, these are input-only fields that are NOT part of `ProjectConfig`. They would need to be:

1. Stored separately (as TS exports from the config file, not as `export default`)
2. Or stored in a new field on the config and extracted by the loader
3. Or the `defineConfig` return type is NOT `ProjectConfig` but a new type that includes categories/rules

**This is a significant design decision not addressed in the plan.** The simplest approach: `defaultCategories` and `defaultRules` are imported/used by `source-loader.ts` directly (as TS imports), NOT embedded in the user's config file. User config files do NOT contain categories/rules -- those come from the source repo's YAML files. The `categories` and `rules` fields should be removed from the `defineConfig` example.

**Exception:** If a user wants to override built-in categories in their project config, they would need some mechanism. But this is a new feature, not a migration of existing behavior.

#### Preserve Zod validation at the load boundary

The plan removes `projectConfigValidationSchema` but does not mention what replaces it. The TS loader loads arbitrary JavaScript -- it has NO type safety at runtime. The loaded object MUST be validated by Zod before being used:

```typescript
// ts-config-loader.ts
const raw = await jiti.import(configPath, { default: true });
const result = projectConfigLoaderSchema.safeParse(raw);
if (!result.success) {
  /* handle error */
}
```

**The `projectConfigLoaderSchema` must be preserved.** The `projectConfigValidationSchema` (strict mode) can be removed since IDE validation via JSON schema is no longer relevant for TS files. But the lenient loader schema is still needed.

---

### 6. Summary of Required Plan Changes

| Item                                                 | Current Plan        | Should Be                                                  |
| ---------------------------------------------------- | ------------------- | ---------------------------------------------------------- |
| `new/marketplace.ts` categories/rules                | Scaffold .ts        | Keep scaffolding .yaml (source repo format)                |
| `loadSkillCategories`/`loadSkillRules`               | Implied removal     | Must be preserved for source repo YAML                     |
| `projectConfigLoaderSchema`                          | Implied removal     | Must be preserved for runtime validation                   |
| `skillCategoriesFileSchema`/`skillRulesFileSchema`   | Implied removal     | Must be preserved for source repo YAML                     |
| Phase 5 (init/edit scope)                            | Gated after Phase 4 | Should be a separate task                                  |
| Phase 6 (tests)                                      | Separate phase      | Absorb into each phase                                     |
| `SkillValue<TSkills>` type                           | Undefined           | Needs explicit design                                      |
| `categories`/`rules` in defineConfig                 | In example          | Remove -- these come from source repos, not project config |
| `doctor.ts`, `eject.ts`, `uninstall.tsx`             | Not listed          | Add to files affected                                      |
| Custom entity round-trip in merge                    | Not addressed       | Design decision needed (option 3 or 4)                     |
| TS config loader error handling                      | Not addressed       | Must mirror safeLoadYamlFile null-on-failure pattern       |
| Test isolation with jiti caching                     | Not addressed       | Add cache-busting strategy                                 |
| tsup entry point for `defineConfig` export           | Not addressed       | Need separate entry point for library exports              |
| `ProjectConfig` vs `ProjectSourceConfig` distinction | Conflated           | Explicitly design for both in one file                     |
| TS writer round-trip test                            | Not mentioned       | Should be the first thing implemented                      |

---

## Industry Research

**Date:** 2026-02-27
**Scope:** How popular OSS projects implement `defineConfig()`, TS config loading, and config codegen -- filtered for relevance to this migration.

---

### 1. `defineConfig()` Patterns Across the Ecosystem

**Universal pattern: Identity function.** Vite, Vitest, ESLint, Nuxt (c12), and Drizzle all use `defineConfig` as a pure identity function -- it returns its input unchanged. Zero runtime cost. The value is purely compile-time DX (autocomplete + type-checking).

**Vite's approach (most popular):** Simple overloads, no generics. Accepts static objects, promises, or functions. `defineConfig(config: UserConfig): UserConfig`. Works because Vite's config fields don't reference each other -- there's no "value declared in field A becomes valid in field B" constraint.

**Our use case requires const generics.** Unlike Vite, we need custom skills declared in `customSkills` to become valid in `stack` assignments. This requires TypeScript 5.0+ `const` type parameters:

```typescript
function defineConfig<const T extends ConfigShape>(config: T): T {
  return config;
}
```

The `const` modifier forces literal inference -- without it, custom skill names widen to `string` and lose type safety. **Critical limitation:** the `const` inference only works when values are passed as inline literals. If a user builds the config object separately and passes it as a variable, types widen:

```typescript
// WORKS -- full autocomplete in stack
defineConfig({ customSkills: ["acme-deploy"], stack: { ... } });

// BROKEN -- types widen before reaching defineConfig
const skills = ["acme-deploy"];
defineConfig({ customSkills: skills, stack: { ... } }); // no autocomplete
```

This limitation should be documented for consumers.

**Drizzle's discriminated union approach** is relevant for our built-in finite enums (Domain, AgentName) but doesn't help for user-defined custom values -- those need const generics.

**c12's `createDefineConfig` factory** (`unjs/c12`, used by Nuxt) is a pattern for generating typed wrappers. If we ever need separate config scopes (e.g., `defineProjectConfig` vs `defineSourceConfig`), this factory pattern avoids code duplication.

---

### 2. jiti: Practical Gotchas

All findings are jiti v2 specific (the version we'd use).

**Pin the exact version.** Nuxt's history shows jiti minor bumps breaking config loading. [jiti 1.19.0 broke Nuxt 3.6.1](https://github.com/nuxt/nuxt/issues/21931) due to cross-platform temp directory issues. ESLint now requires jiti >= 2.2.0. Pin to an exact version in `package.json` (no `^`).

**Test isolation: disable both caches.**

```typescript
const jiti = createJiti(import.meta.url, {
  moduleCache: false, // prevents stale modules between tests
  fsCache: false, // ensures fresh transpilation each time
});
```

Without `moduleCache: false`, jiti integrates with Node.js CommonJS cache -- importing the same config path in multiple tests returns the first test's version. Our loader should accept an option to disable caching, or always create fresh jiti instances in tests.

**`tsconfigPaths` is not automatic.** jiti does NOT follow `tsconfig.json` path aliases by default. This [burned Drizzle users](https://github.com/drizzle-team/drizzle-orm/issues/1228). If consumers use path aliases in their config files, we'd need `tsconfigPaths: true`. For now, since our configs are simple and self-contained, this isn't needed -- but document it as a known limitation.

**`interopDefault` Proxy overhead.** jiti v2.1+ wraps every imported module in a Proxy (~25-50ns per property access). Disable with `interopDefault: false` on hot paths. Config loading happens once at startup, so this is a non-issue for us.

**ESM interop.** Our project uses `"type": "module"` and tsup ESM output. jiti v2 handles ESM well. Use `{ default: true }` option on `jiti.import()` to cleanly get the default export without Proxy wrapping.

---

### 3. Config Codegen: Not Actually Hard

The design review estimated 100+ lines for the TS writer. In practice, it's ~20-30 lines.

The config is pure data -- strings, numbers, booleans, arrays, nested objects. No functions, no class instances, no symbols. `JSON.stringify(obj, null, 2)` handles serialization. The writer just wraps it:

```typescript
function generateConfigSource(config: ProjectConfig): string {
  const compact = compactStackValues(config); // bare strings for non-preloaded skills
  const body = JSON.stringify(compact, null, 2);
  return `import { defineConfig } from "@agents-inc/cli/config";\n\nexport default defineConfig(${body});\n`;
}
```

Stack values support three YAML formats (bare string, object, array) which `normalizeAgentConfig()` normalizes to `SkillAssignment[]` at load time. The writer just outputs the compact form (bare strings where `preloaded: false`, objects otherwise) -- same logic as `compactStackForYaml` today. The loader normalizes it back. No AST tools needed.

**magicast** ([unjs/magicast](https://github.com/unjs/magicast)) exists for AST-level config file modification (used by Astro's `astro add`). We don't need it -- we always write the full config from an in-memory object, never surgically edit user-modified files. If that changes, magicast is the tool, but it has formatting gotchas ([#41](https://github.com/unjs/magicast/issues/41), [#68](https://github.com/unjs/magicast/issues/68)) and only supports `export default defineConfig({...})` well.

---

### 4. ESLint's Migration Retrospective -- Critical Lessons

The [ESLint v9.0.0 retrospective](https://eslint.org/blog/2025/05/eslint-v9.0.0-retrospective/) documents their config migration failures. Key lessons for us:

**1. "Avoid bundling breaking changes."** ESLint shipped config format change + rule API change simultaneously. Users couldn't tell which change caused errors. **For us: Ship config migration as an isolated change. Don't combine with other breaking changes in the same release.**

**2. "Prioritize tooling over documentation."** Direct quote from their users: "I don't have a spare two hours to read through all the documentation. Just do it for me automatically." **For us: Build a migration command (`cc migrate-config`) that converts YAML to TS automatically, rather than writing migration guides.**

**3. "Improve error messages."** When config failed to load, ESLint gave no direction. **For us: Config loading errors must include actionable next steps. E.g., "Expected config.ts, found config.yaml. Run `cc migrate-config` to convert."**

**4. TypeScript bug TS2742.** "The inferred type of 'default' cannot be named" -- occurs when `defineConfig` return type references internal types that aren't exported from the package. [GitHub issue](https://github.com/microsoft/TypeScript/issues/62558). **For us: All types referenced in the `defineConfig` signature MUST be exported from the package, or consumers get cryptic TS errors. Verify this in CI.**

---

### 5. tsup Bundling for Consumer Import

Research confirms the design review's concern: **the main CLI entry point should NOT export `defineConfig`** (it's a binary, not a library).

**Pattern from the ecosystem:**

1. Create a separate entry point: `src/cli/config-exports.ts` re-exporting `defineConfig`, `defaultCategories`, `defaultRules`.
2. Add it to tsup config as an explicit entry.
3. Add to `package.json` exports:

```json
"exports": {
  ".": { "import": "./dist/index.js" },
  "./config": { "import": "./dist/config-exports.js" }
}
```

4. Ensure `dts: true` in tsup for `.d.ts` generation.
5. Export ALL types that `defineConfig` references (prevents TS2742).

Consumer usage: `import { defineConfig } from "@agents-inc/cli/config"`.

---

### 6. Config Merging: defu

Nuxt/c12 uses [unjs/defu](https://github.com/unjs/defu) for deep config merging with left-to-right priority. This is purpose-built for config objects and handles arrays, nested objects, and defaults correctly. Worth evaluating as an alternative to hand-written merge logic in `config-merger.ts`, though our merge needs are simple enough that it may not be needed.

---

### 7. Decisions

Based on industry research and design review analysis, these are our choices:

| Decision                     | Choice                                                  | Rationale                                                                                                                                                             |
| ---------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `defineConfig` pattern       | const generic identity function                         | Custom values must flow between fields (skills → stack). Requires TS 5.0+ `const` type parameters. Vite-style simple overloads insufficient for our use case.         |
| TS config loading            | jiti v2, pinned exact version                           | Industry standard (Nuxt, ESLint, Drizzle). Pin version -- Nuxt history shows minor bumps breaking things.                                                             |
| TS config writing            | `JSON.stringify` + template wrapper                     | Config is pure data. No AST tools needed. ~20-30 lines, not 100+.                                                                                                     |
| Config modification          | Full overwrite, not surgical edit                       | We always write from an in-memory `ProjectConfig` object. No need for magicast/AST-level editing.                                                                     |
| Test isolation               | Fresh jiti instance per test, both caches disabled      | `moduleCache: false` + `fsCache: false` prevents stale modules between tests.                                                                                         |
| Consumer import path         | Separate tsup entry point (`@agents-inc/cli/config`)    | CLI binary must not export library functions. Separate `config-exports.ts` entry.                                                                                     |
| TS2742 prevention            | Export all types referenced in `defineConfig` signature | TypeScript bug causes cryptic errors if return type references unexported types.                                                                                      |
| Source repo format           | YAML stays for source repos                             | Source repos don't have `@agents-inc/cli` as a dependency. CLI loads their YAML via existing `loadSkillCategories`/`loadSkillRules`. Only project config becomes TS.  |
| `export default` enforcement | Required pattern                                        | Simplifies both the writer and any future AST tooling.                                                                                                                |
| `const` inline limitation    | Document for consumers                                  | Config must be defined inline in the `defineConfig()` call for full type inference. Extracted variables widen types.                                                  |
| Migration UX                 | Actionable error messages                               | ESLint's retrospective: users don't read docs. "Found config.yaml, expected config.ts" with next steps. Migration command is out of scope but error messages are not. |
| defu for merging             | Not adopting                                            | Our merge logic in `config-merger.ts` is simple enough. No new dependency needed.                                                                                     |

---

## Remaining Work (Not Yet Done)

The initial migration only converted CLI defaults to TS imports and project config to `config.ts`. The following YAML loading, writing, validation, and scaffolding code was NOT converted:

### Categories and Rules YAML Loading (Still YAML)

- `matrix-loader.ts`: `loadSkillCategories()` and `loadSkillRules()` still parse YAML via `parseYaml()` + Zod
- `source-loader.ts` lines 208-252: loads `skill-categories.yaml` and `skill-rules.yaml` from source paths as YAML
- `source-validator.ts` lines 196-249: validates categories/rules as YAML
- `schema-validator.ts` lines 58-70, 110-114: validation targets reference YAML patterns

### Stacks YAML Loading (Still YAML)

- `stacks-loader.ts`: `loadStacks()` reads `stacks.yaml` via `readFile()` + `parseYaml()` + Zod
- `source-loader.ts` lines 266-268: loads stacks from source as YAML, falls back to CLI's `config/stacks.yaml`
- `build/stack.tsx` line 87: loads stacks via YAML loader
- `config/stacks.yaml`: CLI-owned file still exists as YAML (should be `default-stacks.ts`)

### Scaffolding Commands (Still Generate YAML)

- `new/marketplace.ts`: `generateStacksYaml()`, writes `stacks.yaml`, `skill-categories.yaml`, `skill-rules.yaml`
- `new/skill.ts`: `generateSkillCategoriesYaml()`, `generateSkillRulesYaml()`, `updateConfigFiles()` — all YAML

### Constants Still Referencing YAML

- `consts.ts` lines 29-31: `SKILL_CATEGORIES_YAML_PATH`, `SKILL_RULES_YAML_PATH`, `STACKS_FILE_PATH`
- `consts.ts` lines 49-50: `STANDARD_FILES.SKILL_CATEGORIES_YAML`, `STANDARD_FILES.SKILL_RULES_YAML`

### Config Type Definitions Referencing YAML

- `config.ts` lines 46-48: `categoriesFile?`, `rulesFile?`, `stacksFile?` comments reference YAML paths

### Test Fixtures Still Writing YAML

- `create-test-source.ts` lines 502-615: writes `skill-categories.yaml`, `skill-rules.yaml`, `stacks.yaml`
- Multiple test files reference YAML file paths and loading

### Comments Referencing YAML (Cosmetic)

- `types/matrix.ts`: 7 comments reference `.yaml` files
- `types/stacks.ts`: 2 comments reference `stacks.yaml`
- `schemas.ts`: 6+ comments reference YAML
- `default-categories.ts`, `default-rules.ts`: comments say "equivalent to .yaml"

### What Needs To Happen

No backward compatibility. No YAML fallbacks. No dual-path loading. TS everywhere, clean break.

1. Convert `config/stacks.yaml` → `default-stacks.ts` (same pattern as categories/rules)
2. Update `loadStacks()` to use `loadTsConfig()` instead of YAML parsing
3. Update `loadSkillCategories()` and `loadSkillRules()` to use `loadTsConfig()` instead of YAML parsing
4. Update `new/marketplace.ts` to scaffold TS files instead of YAML
5. Update `new/skill.ts` to scaffold/update TS files instead of YAML
6. Update `source-validator.ts` to validate TS files
7. Update `schema-validator.ts` validation targets
8. Rename constants: `STACKS_FILE_PATH` → TS path, remove YAML constants
9. Update `create-test-source.ts` to write TS fixtures
10. Update all YAML-referencing comments
11. All tests must pass — unit, integration, and E2E
12. Code review pass: type reuse, fixture reuse, DRY, no unnecessary casts, shared functions, constant reuse, branch simplification
