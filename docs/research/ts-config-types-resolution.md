# TS Config Type Resolution

## Problem

After `agentsinc init`, the generated `.claude-src/config.ts` needs type checking and editor autocomplete. The CLI is run via `npx` — it is NOT installed as a project dependency. Standard TypeScript module resolution requires packages in `node_modules`, which we don't have.

The generated config must provide:

- Full autocomplete for skill IDs, agent names, domains
- Type errors on invalid field names or values
- Zero friction — no `npm install`, no tsconfig changes

## Options Evaluated

### Option 1: `defineConfig()` import from package (current)

```ts
import { defineConfig } from "@agents-inc/cli/config";
export default defineConfig({ ... });
```

**Verdict: Rejected.** Requires `@agents-inc/cli` in `node_modules`. Global install doesn't help (TS resolves from project `node_modules`). Version drift between npx and local install. Too much friction.

### Option 2: Types-only npm package (`@agents-inc/types`)

```ts
import type { ProjectConfig } from "@agents-inc/types";
export default { ... } satisfies ProjectConfig;
```

**Verdict: Possible but high friction.** Still requires `npm install -D`. Still has version drift. Smaller package but same UX problem.

### Option 3: Local `.d.ts` with `declare module`

```ts
// .claude-src/agents-inc.d.ts
declare module "@agents-inc/cli/config" { ... }
```

**Verdict: Rejected.** Requires `.claude-src/` to be in `tsconfig.json`'s `include` scope. Most projects have `include: ["src"]`. Ambient declarations are invisible outside the compilation scope.

### Option 4: Local `import type` + `satisfies` (current favorite)

Generate a `config-types.ts` alongside `config.ts`:

```ts
// .claude-src/config-types.ts
export type SkillId =
  | "web-framework-react"
  | "web-framework-vue-composition-api"
  | "web-styling-scss-modules"
  | "web-styling-tailwind"
  | "web-state-zustand"
  | "api-framework-hono"
  | "api-database-drizzle";
// ... generated from marketplace data

export type AgentName =
  | "web-developer"
  | "api-developer"
  | "web-reviewer"
  | "api-reviewer"
  | "pattern-scout";
// ... generated from agent definitions

export type Domain = "web" | "api" | "mobile" | "cli" | "shared";

export type InstallMode = "local" | "plugin";

export interface StackAgentConfig {
  [category: string]: SkillId | SkillId[];
}

export interface ProjectConfig {
  /** Project name */
  name?: string;
  /** Installation mode */
  installMode?: InstallMode;
  /** Selected skill IDs */
  skills?: SkillId[];
  /** Selected agent names */
  agents?: AgentName[];
  /** Active domains */
  domains?: Domain[];
  /** Stack configuration: agent -> category -> skill assignments */
  stack?: Record<string, Record<string, StackAgentConfig>>;
}
```

```ts
// .claude-src/config.ts
import type { ProjectConfig } from "./config-types";

export default {
  name: "my-project",
  installMode: "local",
  skills: ["web-framework-react", "web-styling-scss-modules"],
  agents: ["web-developer"],
  domains: ["web"],
} satisfies ProjectConfig;
```

**How it works:**

- `import type` is erased at compile time — jiti never resolves it at runtime
- Relative import `./config-types` resolves without `node_modules`
- `satisfies` checks the value against the type without changing it
- String unions give autocomplete for every valid skill ID, agent, domain
- CLI regenerates `config-types.ts` on every `init`/`edit` with current marketplace data
- Unions reflect what's available in the user's configured sources

**Verdict: Current favorite.** Zero dependencies, zero tsconfig changes, full type safety, marketplace-aware unions.

### Option 5: Inline type in generated config

Same as Option 4 but the type is embedded directly in `config.ts` instead of a separate file.

**Verdict: Works but clutters the config file.** Users see 30-50 lines of type definitions before their actual config. Separate file is cleaner.

---

## Implementation Plan (Option 4)

### What changes

1. **`ts-config-writer.ts`** — Replace `defineConfig` import with `import type { ProjectConfig } from "./config-types"` + `satisfies ProjectConfig`
2. **New: `ts-config-types-writer.ts`** — Generates `config-types.ts` from marketplace data (skill IDs, agent names, domains)
3. **`init.tsx` / `edit.tsx`** — Write `config-types.ts` alongside `config.ts`
4. **`config-exports.ts`** — Can be removed (no longer imported by generated configs)
5. **`tsup.config.ts`** — Remove `config-exports.ts` entry point
6. **`package.json`** — Remove `"./config"` export
7. **`ts-config-loader.ts`** — Remove jiti alias for `@agents-inc/cli/config`
8. **`define-config.ts`** — Can be removed

### Generated output example

After `agentsinc init`, `.claude-src/` contains:

```
.claude-src/
  config.ts          # User's config (import type + satisfies)
  config-types.ts    # Generated types (skill unions, agent unions, etc.)
```

### Type generation source data

| Union type    | Source                                                  |
| ------------- | ------------------------------------------------------- |
| `SkillId`     | All skill IDs from loaded marketplace(s) + local skills |
| `AgentName`   | All agent names from agent definitions                  |
| `Domain`      | Built-in domains + custom domains from categories       |
| `InstallMode` | Static: `"local" \| "plugin"`                           |
| `Category`    | All category IDs from skill-categories config           |

### Regeneration triggers

- `agentsinc init` — generates both files
- `agentsinc edit` — regenerates both files (skills/agents may have changed)
- `agentsinc compile` — could regenerate types if marketplace data changed
- Source change (add/remove marketplace) — regenerate on next edit

---

## Open Questions

1. Should `config-types.ts` be gitignored? It's generated, but committing it means teammates get types without running the CLI.
2. Should we support hand-editing `config-types.ts`? (Probably not — mark with a "generated, do not edit" comment.)
3. How to handle custom skill IDs from private marketplaces that aren't in the public union?
4. Is there an established pattern in the ecosystem for this problem? (See research below.)

### Option 6: tsconfig `paths` with absolute path to global install

The CLI installs globally and writes `.d.ts` files to a known location (e.g., `~/.config/agents-inc/types/`). The `init` command injects a `paths` entry into the consumer's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@agents-inc/cli/config": ["/home/vince/.config/agents-inc/types/config-exports.d.ts"]
    }
  }
}
```

The existing `import { defineConfig } from "@agents-inc/cli/config"` pattern would work unchanged.

**How it works:**

- TypeScript `paths` supports absolute filesystem paths ([confirmed by esbuild #792](https://github.com/evanw/esbuild/issues/792) citing TS source)
- VS Code's TypeScript language server reads `paths` from tsconfig — IntelliSense works
- `paths` is purely compile-time — doesn't affect runtime (jiti handles runtime via its own alias)
- As of TypeScript 4.1, `baseUrl` is no longer required when using `paths`

**Pros:**

- Keeps `defineConfig` pattern (familiar from Vite/ESLint ecosystem)
- Types auto-update when CLI is updated globally
- No generated files in the project (cleaner `.claude-src/`)

**Cons:**

- Absolute paths are machine-specific (not portable in git)
- Modifies the user's `tsconfig.json` (invasive)
- Requires global install (not npx-only)
- If CLI is not installed globally, types don't resolve
- TypeScript does NOT expand `~` — must use full absolute path

**Verdict: Viable but requires global install.** Works well for single-developer projects. Breaks for teams where different developers have different global install paths. The `init` command would need to resolve and inject the correct absolute path per machine.

### Option 7: Ambient `.d.ts` (no import/export) + `satisfies`

Generate a `.d.ts` file **without** `import`/`export` statements. TypeScript treats files without module syntax as "scripts" — their declarations are globally available without importing.

```ts
// .claude-src/config-types.d.ts (note: .d.ts, not .ts)
// AUTO-GENERATED by agentsinc — DO NOT EDIT

type SkillId =
  | "web-framework-react"
  | "web-styling-scss-modules"
  // ...
  ;

type AgentName = "web-developer" | "api-developer" | /* ... */;
type Domain = "web" | "api" | "mobile" | "cli" | "shared";

interface ProjectConfig {
  name?: string;
  installMode?: "local" | "plugin";
  skills?: SkillId[];
  agents?: AgentName[];
  domains?: Domain[];
}
```

```ts
// .claude-src/config.ts — NO import needed
export default {
  name: "my-project",
  skills: ["web-framework-react"],
} satisfies ProjectConfig;
```

**How it works:**

- `.d.ts` files without `import`/`export` are ambient — types are globally available
- No `import type` statement needed in `config.ts` — `ProjectConfig` just exists
- jiti sees `export default { ... }` with no imports — nothing to resolve
- This is exactly how Next.js (`next-env.d.ts`), Astro (`.astro/types.d.ts`), and Wrangler (`worker-configuration.d.ts`) work

**Requires:** The `.d.ts` file must be in TypeScript's compilation scope. Most tsconfigs include `*.d.ts` in the project root by default. If `.claude-src/` is excluded, the user would need to add it to `include` or use a `/// <reference>` directive.

**Verdict: Clean but has the same tsconfig inclusion caveat as Option 3.** If `.claude-src/` is in `include`, this is the simplest approach — no imports at all.

---

## Comparison Matrix

| #     | Approach                        | Types work? | Autocomplete? | Zero install?           | Zero tsconfig?     | Portable? |
| ----- | ------------------------------- | ----------- | ------------- | ----------------------- | ------------------ | --------- |
| 1     | `defineConfig` import           | Yes         | Yes           | No (needs node_modules) | Yes                | Yes       |
| 2     | Types-only npm package          | Yes         | Yes           | No (needs npm install)  | Yes                | Yes       |
| 3     | Local `.d.ts` declare module    | Yes         | Yes           | Yes                     | No (needs include) | Yes       |
| **4** | **`import type` + `satisfies`** | **Yes**     | **Yes**       | **Yes**                 | **Yes**            | **Yes**   |
| 5     | Inline type in config           | Yes         | Yes           | Yes                     | Yes                | Yes       |
| 6     | tsconfig `paths` + global       | Yes         | Yes           | No (needs global)       | No (needs paths)   | No        |
| 7     | Ambient `.d.ts` + `satisfies`   | Yes         | Yes           | Yes                     | Depends            | Yes       |

**Option 4 is the only approach that checks every box.**

---

## Research: How Others Solve This

### Ecosystem Survey (4 research agents)

**Universal finding: No major tool has solved npx-only type checking.** Every tool that provides `defineConfig` or typed config files requires local installation:

| Tool           | Pattern                                                              | Requires local install?           |
| -------------- | -------------------------------------------------------------------- | --------------------------------- |
| Vite           | `defineConfig`                                                       | Yes                               |
| ESLint (v9.9+) | `defineConfig` from `eslint/config`                                  | Yes                               |
| Astro          | `defineConfig` + generated `.astro/types.d.ts`                       | Yes                               |
| Nuxt           | `defineConfig` + generated `.nuxt/tsconfig.json`                     | Yes                               |
| Next.js        | Generated `next-env.d.ts`                                            | Yes                               |
| Drizzle Kit    | `defineConfig`                                                       | Yes                               |
| Vitest         | `defineConfig`                                                       | Yes                               |
| Tailwind v3    | JSDoc `@type{import('tailwindcss').Config}`                          | Yes                               |
| Tailwind v4    | Moved config to CSS (eliminated TS config entirely)                  | N/A                               |
| Prisma         | Code generation into `node_modules/.prisma/` (v6) or local dir (v7+) | Yes                               |
| Wrangler       | `wrangler types` generates `worker-configuration.d.ts`               | Yes (but closest to our approach) |
| Contentlayer   | Generated `.contentlayer/generated/` types                           | Yes                               |
| Payload CMS    | `payload generate:types` generates local `payload-types.ts`          | Yes                               |

Sources: [Vite Config](https://vite.dev/config/), [ESLint defineConfig](https://eslint.org/blog/2025/03/flat-config-extends-define-config-global-ignores/), [Anthony Fu "Type Your Config"](https://antfu.me/posts/type-your-config), [Astro TypeScript](https://docs.astro.build/en/guides/typescript/), [Nuxt TypeScript](https://nuxt.com/docs/4.x/guide/concepts/typescript), [Next.js TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript), [Wrangler Types](https://developers.cloudflare.com/workers/languages/typescript/), [Prisma Code Generation](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/generating-prisma-client)

### External type resolution workarounds

| Approach                        | Works?             | VS Code?                                                                        | Verdict                                                                                       |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm link` + `preserveSymlinks` | Partial            | [Unreliable (VS Code #25312)](https://github.com/microsoft/vscode/issues/25312) | Not viable                                                                                    |
| tsconfig `paths` (absolute)     | Yes                | Yes                                                                             | Viable but not portable                                                                       |
| `NODE_PATH`                     | No                 | No                                                                              | [Explicitly rejected by TS team (#8760)](https://github.com/Microsoft/TypeScript/issues/8760) |
| `typeRoots` (external dir)      | Yes (ambient only) | Yes                                                                             | Only for global types, not module imports                                                     |
| VS Code settings                | No                 | N/A                                                                             | No type resolution settings exist                                                             |
| `package.json` `imports` (`#`)  | Partial            | Partial                                                                         | Only intra-package, doesn't help                                                              |
| Git submodules                  | Yes                | Yes                                                                             | Too much friction                                                                             |
| CDN types (esm.sh)              | Deno only          | Deno only                                                                       | Not applicable to Node.js                                                                     |

Sources: [TS #8760](https://github.com/Microsoft/TypeScript/issues/8760), [TS #31527](https://github.com/microsoft/TypeScript/issues/31527), [TS #9552](https://github.com/microsoft/TypeScript/issues/9552), [VS Code #25312](https://github.com/microsoft/vscode/issues/25312), [esbuild #792](https://github.com/evanw/esbuild/issues/792)

### TypeScript remote type proposals (all dormant)

- [TS #31178](https://github.com/microsoft/TypeScript/issues/31178) — "Import interfaces from URLs" (2019, no team engagement)
- [TS #41730](https://github.com/microsoft/TypeScript/issues/41730) — "URL imports for modules" (in discussion, no implementation)
- [TS #35749](https://github.com/microsoft/TypeScript/issues/35749) — "URI style import" (open, dormant)
- [TS #63115](https://github.com/microsoft/typescript/issues/63115) — `// @ts-import` directive proposal (awaiting feedback)

Deno [retreated from HTTP imports](https://deno.com/blog/http-imports), citing reliability issues and version management problems. Now recommends `npm:` and `jsr:` specifiers instead.

### Key insight: `create-t3-app` debate

[t3-oss/create-t3-app#1963](https://github.com/t3-oss/create-t3-app/issues/1963) — Maintainer argued _against_ `defineConfig` in favor of `satisfies`, calling `defineConfig` "just an identity function with types" and noting `satisfies` avoids importing runtime code. Closed as "not planned." This validates the `satisfies` direction.

### Conclusion

Option 4 (`import type` from local generated file + `satisfies`) is genuinely novel — **no tool in the ecosystem does this yet**. The closest precedents are:

- Wrangler's `wrangler types` (generates local `.d.ts`, but still requires local install)
- Prisma v7's generated client (generates into local dir, but from an installed package)
- Astro's `.astro/types.d.ts` (generated types, but with `/// <reference>` back to installed package)

The key differentiator of Option 4 is that the generated type file is **fully self-contained** — it includes the actual string unions, not references back to a package. This makes it the only approach that achieves zero-install type safety.
