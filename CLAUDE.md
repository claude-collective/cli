<critical-requirement>
1. NEVER write implementation code or edit test files directly. Always delegate to CLI developer or CLI tester. No exceptions for "small" or "quick" fixes.

2. When delegating to a sub-agent, tell it to read CLAUDE.md before starting work.

3. After any fix, trace ALL scenarios through the code before calling it done.

4. ALWAYS read [.ai-docs/DOCUMENTATION_MAP.md](./.ai-docs/DOCUMENTATION_MAP.md) before working on any area of the codebase. It indexes verified documentation for every major system.
</critical-requirement>

# Project Memory for Claude

This file provides decision trees, behavioral rules, and conventions. For codebase reference documentation, see `.ai-docs/`.

## Workspace Directories

| Directory                          | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `/home/vince/dev/cli`              | CLI tool (this repo) - entry point for all operations |
| `/home/vince/dev/skills`           | Plugin marketplace - skills, agents, stacks           |
| `/home/vince/dev/cv-launch`        | Test project - install targets for testing            |

## NEVER do this

- NEVER use `git stash` — not in the main context, not in sub-agents, never
- NEVER use git worktrees (`isolation: "worktree"`) — always work directly on the main branch
- NEVER introduce new workflow patterns (tools, flags, strategies) that the user hasn't explicitly requested
- NEVER construct test data inline — no inline configs, matrices, skills, stacks. Use factories from `helpers.ts` and fixtures from `create-test-source.ts`. If a factory doesn't exist, create one.
- NEVER put TODO/task IDs (T1, T6, etc.) in test `describe()` blocks — test code is not a task tracker
- NEVER add backward-compatibility shims, migration code, or legacy fallbacks. The project is pre-1.0 — backward compatibility is not a concern. Remove old code cleanly instead of maintaining two paths.
- NEVER add unnecessary comments — only add comments when something is unintuitive, complex, or for edge cases. Self-explanatory code should not have comments. Do not add JSDoc to obvious functions.
- NEVER reassign constants to other constants — use the original constant directly instead of creating aliases like `const FOO = BAR`
- NEVER build intermediate data structures imperatively when the data is static or the rendering is straightforward. No `const arr = []; for (...) { arr.push(...) }` patterns. Use declarative const arrays, `.map()`, `.flatMap()`, or inline JSX. If data is known at write-time, write it as a literal. If it needs transforming, use functional array methods. Imperative accumulation into mutable arrays is never the answer.
- NEVER put machine-specific absolute paths in any file tracked by git. If a file needs private paths, gitignore it first.
- NEVER use inline regex to extract SKILL.md frontmatter fields. Use `parseFrontmatter()` from `lib/loading/loader.ts` — it handles YAML parsing and Zod validation.

## ALWAYS do this

- ALWAYS delegate implementation and test code to sub-agents. Tell them to read CLAUDE.md before starting.
- ALWAYS trace ALL scenarios through the code after any fix — not just the one that prompted the fix.
- ALWAYS grep for the old value when changing test data or renaming anything — find all references repo-wide.
- ALWAYS search for all call sites when removing a workaround.
- When a task is deferred, ALWAYS move it to `TODO-deferred.md` — never delete.
- When fixing test data, ALWAYS evaluate the construction pattern too, not just the values.

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

**RULE: ALWAYS use factories and fixtures for test data. NEVER construct configs, matrices, skills, agents, or stacks inline in test files.**

This means:

- **Skills/agents/SKILL.md/metadata.yaml** → `createCLISkill()`, `createUserSkill()`, `writeTestSkill()`, `writeSourceSkill()`, `createTestSource()`
- **Mock skill objects** → `createMockSkill()` from helpers.ts
- **Mock matrices** → `createMockMatrix()` from helpers.ts
- **Mock categories** → `createMockCategory()` from helpers.ts
- **Full project directories** → `createTestSource()` from fixtures/create-test-source.ts
- **Stacks** → Use `TestStack[]` via `createTestSource({ stacks })` or extend existing fixtures
- **Configs** → Use `buildWizardResult()`, `buildSourceResult()`, or extend helpers

**If a factory doesn't exist for what you need, CREATE ONE in helpers.ts — do not inline the data.**

**RULE: Never create mapping/alias constants to translate incorrect test data to correct values.** Fix test data at the source instead. Do not add workarounds like lookup tables. Alias hacks mask real problems.

**RULE: Never put TODO/task tracking IDs in test describe blocks.** Test describes should be purely descriptive (e.g., `"edit wizard pre-selection"`, not `"edit wizard pre-selection (T3)"`). Tracking IDs are for TODO files, not test code.

```
Is it a complete skill/agent/category object?
├─ YES → Use factory from helpers.ts (createMockSkill, createMockAgent, createMockCategory)
└─ NO → Is it a full project directory structure?
    ├─ YES → Use createTestSource() from fixtures/create-test-source.ts
    └─ NO → Does it create skill files (SKILL.md, metadata.yaml)?
        ├─ YES → Use helpers: createCLISkill(), createUserSkill(), writeTestSkill(), writeSourceSkill()
        └─ NO → Does it create a config, matrix, or stack?
            ├─ YES → Use a factory (createMockMatrix, buildWizardResult, etc.) — NEVER inline
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
- [ ] **ALL test data uses factories/fixtures** — no inline configs, matrices, skills, stacks, or agents
- [ ] No raw `writeFile` for skill/agent test data — use `createCLISkill`, `createUserSkill`, `writeTestSkill`, `writeSourceSkill`, `createTestSource`
- [ ] No inline `SkillsMatrixConfig` or `MergedSkillsMatrix` construction — use `createMockMatrix()`, `createMockSkill()`
- [ ] No alias/mapping hacks to paper over wrong test data — fix the data at the source
- [ ] No TODO/task IDs in test describe blocks — describes are purely descriptive
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

| Document                                     | Purpose                         |
| -------------------------------------------- | ------------------------------- |
| [.ai-docs/DOCUMENTATION_MAP.md](./.ai-docs/DOCUMENTATION_MAP.md) | Codebase documentation index    |
| [TODO.md](./todo/TODO.md)                    | Active tasks and blockers       |

<critical-reminder>
1. You do NOT write code. Delegate to sub-agents. Tell them to read CLAUDE.md.
2. Trace ALL scenarios after any fix.
</critical-reminder>
