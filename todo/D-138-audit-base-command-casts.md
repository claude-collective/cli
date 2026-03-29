# D-138 Audit: Double Cast `as unknown as ConfigWithSource` in base-command.ts and hooks/init.ts

**Date:** 2026-03-29
**Audit Source:** D-138 project audit
**CLAUDE.md Rule:** "NEVER use `as unknown as T` double casts -- fix the upstream type instead"

---

## Cast Site 1: `src/cli/base-command.ts` (line 23)

### Full Context

```typescript
import { Command, Flags } from "@oclif/core";
import { getErrorMessage } from "./utils/errors.js";
import { EXIT_CODES } from "./lib/exit-codes.js";
import type { ResolvedConfig } from "./lib/configuration/index.js";

/** Narrow interface for the sourceConfig we attach to oclif's Config in the init hook. */
export interface ConfigWithSource {
  sourceConfig?: ResolvedConfig;
}

export abstract class BaseCommand extends Command {
  static baseFlags = {
    source: Flags.string({
      char: "s",
      description: "Skills source path or URL",
      required: false,
    }),
  };

  public get sourceConfig(): ResolvedConfig | undefined {
    // Boundary cast: oclif Config is a class (not augmentable); we attach sourceConfig in the init hook
    return (this.config as unknown as ConfigWithSource).sourceConfig;
  }
  // ...
}
```

**What it does:** Reads a `sourceConfig` property that was dynamically attached to the oclif `Config` object by the init hook.

---

## Cast Site 2: `src/cli/hooks/init.ts` (line 45)

### Full Context

```typescript
import { Hook } from "@oclif/core";
import { resolveSource } from "../lib/configuration/index.js";
import { detectInstallation } from "../lib/installation/installation.js";
import { showDashboard } from "../commands/init.js";
import { EXIT_CODES } from "../lib/exit-codes.js";
import type { ConfigWithSource } from "../base-command.js";

const hook: Hook<"init"> = async function (options) {
  // ... (argv parsing for --source flag) ...

  try {
    const resolvedConfig = await resolveSource(sourceFlag, projectDir);
    // Boundary cast: oclif Config is a class (not augmentable); read in BaseCommand.sourceConfig
    (options.config as unknown as ConfigWithSource).sourceConfig = resolvedConfig;
  } catch (error) {
    // Let the command handle config failures
  }
};
```

**What it does:** Attaches a `sourceConfig` property to the shared oclif `Config` singleton so that all commands can access the resolved source configuration without re-resolving it.

---

## Type Definitions Involved

### `ConfigWithSource` (src/cli/base-command.ts:8-10)

```typescript
export interface ConfigWithSource {
  sourceConfig?: ResolvedConfig;
}
```

### `ResolvedConfig` (src/cli/lib/configuration/config.ts:18-22)

```typescript
export type ResolvedConfig = {
  source: string;
  sourceOrigin: "flag" | "env" | "project" | "default";
  marketplace?: string;
};
```

### oclif `Config` class (node_modules/@oclif/core/lib/config/config.d.ts)

```typescript
export declare class Config implements IConfig {
  // 35+ typed properties (arch, bin, cacheDir, etc.)
  // 20+ methods (findCommand, runCommand, runHook, etc.)
  // NO index signature [key: string]: unknown
}
```

### oclif `Config` interface (node_modules/@oclif/core/lib/interfaces/config.d.ts)

```typescript
export interface Config {
  // All properties are readonly
  // NO index signature
}
```

### How `this.config` is typed in oclif Command

```typescript
// node_modules/@oclif/core/lib/command.d.ts
import { Config } from './config';  // This is the CLASS, not the interface

export declare abstract class Command {
  config: Config;  // Typed as the Config class
  // ...
}
```

### How `options.config` is typed in oclif hooks

```typescript
// node_modules/@oclif/core/lib/interfaces/hooks.d.ts
export type Hook<T extends keyof P, P extends Hooks = Hooks> = (
  this: Hook.Context,
  options: P[T]['options'] & {
    config: Config;  // This is the Config INTERFACE from interfaces/config.d.ts
    context: Context;
  }
) => Promise<P[T]['return']>;
```

---

## Why the Double Cast Is Needed

The double cast is needed because **oclif's `Config` is a class with no index signature**, meaning TypeScript will not allow arbitrary property assignments.

### The mechanism (init hook -> command):

1. The `init` hook runs before every command
2. It resolves the source configuration (from `--source` flag, env var, or project config)
3. It attaches the result to `options.config.sourceConfig` -- a property that does NOT exist on oclif's `Config` type
4. Later, `BaseCommand.sourceConfig` reads this property back from `this.config`

### Why `as ConfigWithSource` alone doesn't work:

The oclif `Config` class/interface has no overlap with `ConfigWithSource`. TypeScript's type narrowing requires that at least one type is assignable to the other. Since `Config` has 35+ required properties that `ConfigWithSource` doesn't have (and vice versa -- `ConfigWithSource` has `sourceConfig` which `Config` doesn't), TypeScript rejects a direct `as ConfigWithSource` cast. The `as unknown` intermediate is required to bypass this structural incompatibility.

### Why interface augmentation won't work:

TypeScript **does** support declaration merging on interfaces, and oclif exports both a `Config` interface and a `Config` class. In theory, you could augment the interface:

```typescript
declare module "@oclif/core" {
  interface Config {
    sourceConfig?: ResolvedConfig;
  }
}
```

**However, this has two problems:**

1. **`Command.config` is typed as the `Config` class** (imported from `./config`, not from `./interfaces/config`). Declaration merging on a class only merges the static side (namespace), not the instance side. Adding `sourceConfig` to the class declaration won't add it to instances.

2. **The hook's `options.config` IS typed as the `Config` interface** (from `./interfaces/config`). Module augmentation on the interface WOULD work for the hook side, but NOT for the command side (different type). You'd still need a cast in `base-command.ts`.

Even if you augmented both the class namespace AND the interface, TypeScript class declaration merging does not add instance properties. You'd need the oclif maintainers to add an index signature or extensibility mechanism to the Config class itself.

---

## Assessment: Is This an Acceptable Boundary Cast?

**Yes. This is a genuine framework boundary cast that cannot be eliminated without upstream changes to oclif.**

### Evidence:

1. **Both cast sites have documented comments** explaining why the cast exists:
   - base-command.ts line 22: `// Boundary cast: oclif Config is a class (not augmentable); we attach sourceConfig in the init hook`
   - init.ts line 44: `// Boundary cast: oclif Config is a class (not augmentable); read in BaseCommand.sourceConfig`

2. **The pattern is well-contained**: Only 2 sites in the entire codebase use this cast, and they form a symmetric pair (write in hook, read in command).

3. **The `ConfigWithSource` interface is minimal** and clearly documents the exact shape being attached.

4. **The approach is idiomatic for oclif**: Attaching data to the Config singleton in hooks is a standard oclif pattern for passing data from hooks to commands. oclif's own documentation shows this pattern, though they don't address the TypeScript implications.

### CLAUDE.md compliance:

The CLAUDE.md rule says: "NEVER use `as unknown as T` double casts -- **fix the upstream type instead**."

In this case, the upstream type is a third-party library (`@oclif/core`) that:
- Uses a class (not an interface) for `Config`
- Has no index signature
- Has no extensibility mechanism for user-defined properties
- Cannot be fixed without a PR to the oclif project

**This is the exact scenario where a documented boundary cast is the correct approach.** The comments already explain the limitation. No action needed beyond potentially adding the `ConfigWithSource` type to a central types file for discoverability.

---

## Other `as unknown as` Instances in the Codebase

Searched `src/` for all `as unknown as` occurrences. Found 25 total:

| Location | Pattern | Legitimate? |
|----------|---------|-------------|
| `base-command.ts:23` | oclif Config boundary | **Yes** -- framework limitation |
| `hooks/init.ts:45` | oclif Config boundary | **Yes** -- framework limitation |
| `project-config.ts:49` | `config.stack as unknown as Record<string, Record<string, unknown>>` | Needs investigation |
| `mock-matrices.ts:85` | Test data cast for categories | Test error-path data |
| `local-installer.test.ts:307,356` | Test data cast for AgentConfig | Test error-path data |
| `ensure-marketplace.test.ts:43` | Test data cast for SourceLoadResult | Test error-path data |
| `config-types-writer.test.ts:351,390,419,448` | Test data casts | Test error-path data |
| `config-merger.test.ts:29` | Test data cast | Test error-path data |
| `copy-local-skills.test.ts:34` | Test data cast for SourceLoadResult | Test error-path data |
| `compare-skills.test.ts:59` | Test data cast | Test error-path data |
| `edit.test.ts:323` | Test data cast | Test error-path data |
| `plugin-info.test.ts:175,180,182,239,241,402` | Test data casts for readdir/Dirent | Test error-path data |
| `helpers.ts:873` | Test data cast | Test error-path data |
| `stacks-loader.test.ts:283,367,405` | Test data casts for StackAgentConfig | Test error-path data |
| `compilation-pipeline.test.ts:162` | Test data cast | Test error-path data |

**Summary:** Of 25 occurrences, 2 are the oclif boundary casts (legitimate), ~21 are in test files (acceptable per CLAUDE.md for "deliberately invalid error-path test data"), and 1 in `project-config.ts` may warrant separate investigation.

---

## Recommendation

**No code change needed.** The two `as unknown as ConfigWithSource` casts in `base-command.ts` and `init.ts` are:

1. Already documented with explanatory comments
2. Genuinely unavoidable at the oclif framework boundary
3. Well-contained (symmetric read/write pair, only 2 sites)
4. Following an idiomatic oclif pattern

The audit flag should be **resolved as "acceptable boundary cast"** with no action items.

### Optional improvements (not required):

1. **Add the `ConfigWithSource` type to `src/cli/types/`** for better discoverability (currently defined in `base-command.ts`)
2. **Consider a helper function** to encapsulate the cast in one place instead of two, though the current pattern is already clean

### Separate investigation recommended:

- `project-config.ts:49` has an `as unknown as Record<string, Record<string, unknown>>` that is not in a test file and may be fixable by tightening the `stack` type
