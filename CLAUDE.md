# Project Memory for Claude

**For comprehensive documentation, see [docs/index.md](./docs/index.md)**

This file provides quick decision trees and essential conventions for working with the Agents Inc. CLI codebase.

## NEVER do this

- NEVER use `git stash` — not in the main context, not in sub-agents, never

---

## Decision Trees

### Test Helper Extraction

```
Is the same setup/assertion used in 2+ test cases?
├─ YES → Extract a local helper in the test file
└─ NO → Keep inline

Is the helper used by 2+ test files?
├─ YES → Move to __tests__/helpers.ts or test-fixtures.ts
└─ NO → Keep as local helper

Does it create test data (skills, agents, categories)?
├─ YES → Add to __tests__/helpers.ts as createMock*() factory
└─ NO → Does it manage temp directories?
    ├─ YES → Use createTempDir()/cleanupTempDir() from helpers.ts
    └─ NO → Does it read/parse test files?
        ├─ YES → Add to helpers.ts as read*() or parse*() utility
        └─ NO → Keep as local helper
```

### Type Narrowing

```
Is the value from a known, finite set (< 30 values)?
├─ YES → Union type (e.g., type Domain = "web" | "api" | "cli")
└─ NO → Does it follow a pattern with a finite prefix?
    ├─ YES → Template literal type (e.g., type SkillId = `${Domain}-${string}`)
    └─ NO → Is it user-extensible or open-ended?
        ├─ YES → Keep as string
        └─ NO → Can you enumerate all values?
            ├─ YES → Union type
            └─ NO → Keep as string

Is it a Record with runtime-sparse keys?
├─ YES → Partial<Record<UnionType, V>>
└─ NO → Record<UnionType, V>
```

### Error Handling in CLI Commands

```
Is it a general catch-all error in a command?
├─ YES → Use this.handleError(error) from BaseCommand
└─ NO → Do you need a specific exit code?
    ├─ YES → Use this.error(getErrorMessage(error), { exit: EXIT_CODES.X })
    └─ NO → Is it validation/warning?
        ├─ YES → Use this.warn(message) and continue
        └─ NO → Use verbose() for diagnostic info

Is the error from an unknown source?
├─ YES → Use getErrorMessage(error) from utils/errors.ts
└─ NO → Use error.message directly

Should the operation continue after error?
├─ YES → Log with verbose() or warn(), handle gracefully
└─ NO → Exit with appropriate EXIT_CODES constant
```

### Fixture vs Inline Test Data

```
Is it a complete skill/agent/category object?
├─ YES → Use factory from helpers.ts (createMockSkill, createMockAgent, createMockCategory)
└─ NO → Is it a full project directory structure?
    ├─ YES → Use createTestSource() from fixtures/create-test-source.ts
    └─ NO → Is it static YAML/JSON/markdown content?
        ├─ YES → Is it reused across 2+ test files?
        │   ├─ YES → Create in test/fixtures/{domain}/
        │   └─ NO → Keep inline as string
        └─ NO → Is it a partial object for one test case?
            ├─ YES → Inline is fine
            └─ NO → Use factory with overrides parameter
```

### Where to Place Utilities

```
Is it used by 3+ files?
├─ YES → Is it test-specific?
│   ├─ YES → __tests__/helpers.ts
│   └─ NO → utils/{domain}.ts
└─ NO → Is it used by 2 files in same domain?
    ├─ YES → Extract to shared module in that domain
    └─ NO → Keep as module-level function in the file

Does it have zero instance state?
├─ YES → Module-level function (not class method)
└─ NO → Instance method or separate class

Is it pure logic (no I/O, no side effects)?
├─ YES → lib/{domain}/ for complex logic
└─ NO → Belongs in utils/ or as helper
```

---

## Code Conventions

### File and Directory Naming

**MANDATORY: kebab-case for ALL files and directories**

- Command files: `compile.ts` (NOT `Compile.ts`)
- Test files: `loader.test.ts`
- Utility files: `format-yaml.ts`
- Directories: `lib/configuration/`, `utils/`

### Import/Export Patterns

**MANDATORY: Named exports ONLY (no default exports)**

**Import ordering:**

1. Node.js built-ins (`path`, `fs`, `os`)
2. External dependencies (`zod`, `yaml`, `oclif`)
3. Internal workspace paths (`../types`, `./utils`)
4. Relative imports (`./loader`, `../helpers`)

**Use `.js` extensions on relative imports in new files**

```typescript
// Example
import path from "path";
import { Command } from "@oclif/core";
import { getErrorMessage } from "../utils/errors.js";
import { loadMatrix } from "./matrix-loader.js";
```

### Constants and Magic Numbers

**RULE: No magic numbers or hardcoded strings**

- All numbers → named constants in `SCREAMING_SNAKE_CASE`
- File names → `STANDARD_FILES.*` from `consts.ts`
- Directory names → `STANDARD_DIRS.*` from `consts.ts`
- Exit codes → `EXIT_CODES.*` from `lib/exit-codes.ts`
- UI symbols → `UI_SYMBOLS.*` from `consts.ts`
- Colors → `CLI_COLORS.*` from `consts.ts`

```typescript
// GOOD
import { STANDARD_FILES, EXIT_CODES } from "./consts.js";
const metadataPath = path.join(dir, STANDARD_FILES.METADATA_YAML);
this.error(message, { exit: EXIT_CODES.INVALID_ARGS });

// BAD
const metadataPath = path.join(dir, "metadata.yaml");
this.error(message, { exit: 2 });
```

### TypeScript Enforcement

- Zero `any` without explicit justification comment
- No `@ts-ignore` or `@ts-expect-error` without explaining comment
- Use `typedEntries()` / `typedKeys()` from `utils/typed-object.ts` (NOT raw `Object.entries()`)
- Boundary casts only at data entry points (YAML parse, JSON parse, CLI args) with comments
- Use Zod schemas at parse boundaries (prefer `safeLoadYamlFile()` from `utils/yaml.ts`)
- All remaining casts must have comments explaining why

### Error Handling

- Use `getErrorMessage(error)` from `utils/errors.ts` for unknown errors
- Use `this.handleError(error)` in oclif commands for general errors
- Use `EXIT_CODES.*` constants (never magic numbers)
- No silent catch blocks (except existence checks)
- Logging levels: `warn()` for user issues, `verbose()` for diagnostics, `log()` for always-visible

---

## Architecture Quick Reference

### Directory Structure

```
src/cli/
├── base-command.ts     # Shared oclif base command class
├── commands/           # oclif CLI commands
├── components/         # Ink React components for interactive UI
├── consts.ts           # Global constants
├── defaults/           # Default configuration/templates
├── hooks/              # oclif lifecycle hooks
├── index.ts            # CLI entry point
├── lib/               # Core business logic
│   ├── agents/        # Agent loading/compilation
│   ├── configuration/ # Config loading/saving/merging
│   ├── exit-codes.ts  # Named exit code constants
│   ├── installation/  # Installation utilities
│   ├── loading/       # YAML/file loading utilities
│   ├── matrix/        # Skills matrix operations
│   ├── plugins/       # Plugin discovery/validation
│   ├── skills/        # Skill loading/resolution
│   ├── stacks/        # Stack compilation
│   ├── wizard/        # Wizard flow logic
│   └── compiler.ts    # Main compilation pipeline
├── stores/            # Zustand state management (for wizard)
├── types/             # TypeScript type definitions
└── utils/             # Cross-cutting utilities
```

### Test Structure

```
src/cli/lib/__tests__/
├── commands/               # Command-level tests
├── fixtures/
│   └── create-test-source.ts  # Integration test source factory
├── helpers.ts              # Shared test utilities (factories, temp dirs)
├── helpers.test.ts         # Tests for helpers themselves
├── integration/            # Integration tests
├── test-constants.ts       # Shared test constants
├── test-fixtures.ts        # Named skill fixtures (getTestSkill)
└── user-journeys/          # End-to-end user journey tests

test/fixtures/             # Static fixture files
├── agents/                # Agent markdown/YAML
├── commands/              # Command fixture files
├── configs/               # Config YAML files
├── matrix/                # Matrix YAML files
├── plugins/               # Plugin structures
├── skills/                # Skill markdown files
└── stacks/                # Stack fixture files
```

---

## Quick Checklists

### Before Committing Code

- [ ] No `any` without justification
- [ ] No magic numbers (use named constants from `consts.ts`)
- [ ] No hardcoded file/dir names (use `STANDARD_FILES.*` / `STANDARD_DIRS.*`)
- [ ] Named exports only (no default exports)
- [ ] kebab-case file names
- [ ] Use `getErrorMessage()` for unknown errors
- [ ] Use `EXIT_CODES.*` constants
- [ ] Use `typedEntries()` / `typedKeys()` (not raw Object methods)
- [ ] Boundary casts have comments
- [ ] Use `createTempDir()` / `cleanupTempDir()` in tests (not raw `mkdtemp`)
- [ ] Import test helpers from `__tests__/helpers.ts` (don't redefine)
- [ ] Tests written and passing (`npm test`)
- [ ] Type check passes (`tsc --noEmit`)
- [ ] No TypeScript errors
- [ ] No ESLint errors (if configured)

### Before Submitting PR

- [ ] All tests pass (2309+ tests)
- [ ] No TypeScript errors
- [ ] No new ESLint warnings
- [ ] Code formatted
- [ ] Branch up to date with main
- [ ] Meaningful commit messages
- [ ] PR description explains changes
- [ ] No `console.log` left in code
- [ ] No commented-out code
- [ ] Related documentation updated (`docs/*.md`)
- [ ] Type definitions updated if public API changed
- [ ] Added JSDoc to exported functions over 20 LOC

---

## Key Documentation

| Document                                                                                     | Purpose                                     |
| -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| [docs/index.md](./docs/index.md)                                                             | Documentation index and system overview     |
| [docs/reference/architecture.md](./docs/reference/architecture.md)                           | System architecture and data flow           |
| [docs/standards/code/clean-code-standards.md](./docs/standards/code/clean-code-standards.md) | Enforceable code quality rules              |
| [typescript-types-bible.md](./typescript-types-bible.md)                                     | Type narrowing patterns and cast guidelines |
| [docs/reference/commands.md](./docs/reference/commands.md)                                   | CLI command reference                       |
| [docs/reference/data-models.md](./docs/reference/data-models.md)                             | Type definitions and schemas                |
| [TODO.md](./todo/TODO.md)                                                                    | Active tasks and blockers                   |

---

## Common Patterns

### Factory Functions (Test Helpers)

```typescript
// Pattern: (requiredParams, overrides?: Partial<T>): T
export function createMockSkill(
  id: SkillId,
  category: CategoryPath,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    description: `${id} skill`,
    category,
    // ... defaults (categoryExclusive, tags, author, etc.)
    ...overrides,
  };
}
```

### Temp Directory Lifecycle (Tests)

```typescript
// GOOD: Use shared helpers
import { createTempDir, cleanupTempDir } from "../__tests__/helpers.js";

let tempDir: string;
beforeEach(async () => {
  tempDir = await createTempDir();
});
afterEach(async () => {
  await cleanupTempDir(tempDir);
});

// BAD: Raw mkdtemp/rm
import { mkdtemp, rm } from "fs/promises";
import os from "os";
```

### Zod Schema Validation

```typescript
// GOOD: Use safeLoadYamlFile helper (returns T | null, logs warnings internally)
import { safeLoadYamlFile } from "./utils/yaml.js";
import { skillMetadataLoaderSchema } from "./schemas.js";

const data = await safeLoadYamlFile(filePath, skillMetadataLoaderSchema);
if (!data) return null;

// GOOD: Direct safeParse + formatZodErrors (for inline validation)
import { formatZodErrors, skillFrontmatterLoaderSchema } from "./schemas.js";

const parsed = skillFrontmatterLoaderSchema.safeParse(parseYaml(content));
if (!parsed.success) {
  warn(`Invalid frontmatter in '${location}': ${formatZodErrors(parsed.error.issues)}`);
  return null;
}

// BAD: Manual parse + validate
const content = await readFile(path, "utf-8");
const parsed = parseYaml(content);
const validated = schema.parse(parsed); // throws
```

### Error Messages in Commands

```typescript
// GOOD: Consistent with logger style (see utils/logger.ts style guide)
this.warn(`Failed to load skill '${skillId}'`); // No "Warning:" prefix — added automatically
this.log(`Compiled ${count} agents successfully.`); // Period: complete sentence
this.log(`Skipping '${id}': missing SKILL.md`); // No period: fragment after colon
verbose(`Resolved source path: '${sourcePath}'`); // Single-quoted dynamic values

// BAD: Inconsistent style
this.warn(`Warning: Failed to load skill ${skillId}`); // Don't add "Warning:" — both oclif this.warn() and logger warn() add it
this.log(`Compiled ${count} agents successfully`); // Complete sentences should end with period
this.warn(`failed to load skill ${skillId}`); // Start with capital letter
```
