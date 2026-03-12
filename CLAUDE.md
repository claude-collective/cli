<critical-requirement>
1. NEVER write implementation code or edit test files directly. Always delegate to CLI developer or CLI tester. No exceptions for "small" or "quick" fixes.

2. When delegating to a sub-agent, tell it to read CLAUDE.md before starting work.

3. After any fix, trace ALL scenarios through the code before calling it done.

4. ALWAYS read [.ai-docs/DOCUMENTATION_MAP.md](./.ai-docs/DOCUMENTATION_MAP.md) before working on any area of the codebase. It indexes verified documentation for every major system.

5. NEVER run ANY git commands that modify the staging area or working tree — no `git add`, `git reset`, `git stash`, `git checkout`, `git restore`, `git clean`. The user curates their staging area intentionally. This applies to sub-agents too — explicitly forbid git commands when delegating.
</critical-requirement>

# Project Memory for Claude

This file provides behavioral rules and conventions. For codebase reference documentation, see `.ai-docs/`.

## Workspace Directories

| Directory                          | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `/home/vince/dev/cli`              | CLI tool (this repo) - entry point for all operations |
| `/home/vince/dev/skills`           | Plugin marketplace - skills, agents, stacks           |
| `/home/vince/dev/cv-launch`        | Test project - install targets for testing            |

## NEVER do this

### Git & Workflow
- NEVER run ANY git command that modifies the staging area or working tree (`git add`, `git reset`, `git stash`, `git checkout`, `git restore`, `git clean`)
- NEVER use git worktrees (`isolation: "worktree"`)
- NEVER use `git checkout`, `git restore`, or any command that discards working tree changes — ask the user how to proceed
- NEVER introduce new workflow patterns (tools, flags, strategies) that the user hasn't explicitly requested
- NEVER put machine-specific absolute paths in any file tracked by git

### Type Safety & Casts
- NEVER use `as SkillId` or `as SkillSlug` casts on valid union members — the literal string IS the type. Only cast at parse boundaries (YAML, JSON, CLI args) or for deliberately invalid error-path test data where the cast is at the call site, not inside a factory.
- NEVER use `as unknown as T` double casts — fix the upstream type instead
- NEVER use `{} as Record<K, V>` — use `const x: Partial<Record<K, V>> = {}` with a type annotation
- NEVER use `matrix.skills[id]!` non-null assertions — use `getSkillById(id)` from `matrix-provider.ts`

### Data Integrity
- NEVER use optional chaining (`?.`) or null coalescing (`?? ""`, `|| []`) on data that must exist — use asserting lookups. Silent fallbacks hide bugs.
- NEVER build multi-tier resolution fallbacks (try exact → try alias → try directory name). Data matches on the first lookup or it's an error.
- NEVER fall back to `path.basename(dir)` as a skill ID — use `frontmatter.name` from `parseFrontmatter()`
- NEVER derive `slug` from skill ID or directory path — `slug` is a required field in metadata, always pass it explicitly
- NEVER add backward-compatibility shims or legacy fallbacks — the project is pre-1.0. Remove old code cleanly.

### Test Data
- NEVER construct test data inline — use factories from `__tests__/helpers.ts` and fixtures from `create-test-source.ts`. If a factory doesn't exist, create one.
- NEVER create custom mock skills when a canonical `SKILLS.*` entry from `test-fixtures.ts` would work
- NEVER call `createMockMatrix(SKILLS.react)` inline when a pre-built constant exists in `mock-matrices.ts`
- NEVER pass the entire `SKILLS` registry to `createMockMatrix` — spread individual entries
- NEVER construct `ProjectConfig`, `ProjectSourceConfig`, or `AgentScopeConfig[]` inline — use `buildProjectConfig()`, `buildSourceConfig()`, `buildAgentConfigs()`
- NEVER write inline SKILL.md frontmatter or agent YAML template strings — use `renderSkillMd()`, `renderAgentYaml()` from `content-generators.ts`
- NEVER repeat agent metadata strings inline — use `AGENT_DEFS` from `mock-agents.ts`
- NEVER put TODO/task IDs in test `describe()` blocks

### Code Style
- NEVER create redundant type aliases — use `Pick<>`, `Partial<>`, or `&`. Check `types/` first.
- NEVER add unnecessary comments — only when unintuitive, complex, or for edge cases
- NEVER reassign constants to other constants — use the original directly
- NEVER build intermediate data structures imperatively — use `.map()`, `.flatMap()`, or literal arrays
- NEVER export constants only used within the same file — run grep before adding `export`

## ALWAYS do this

### Delegation & Process
- ALWAYS delegate implementation and test code to sub-agents. Tell them to read CLAUDE.md. Tell them: "Do NOT run any git commands."
- ALWAYS trace ALL scenarios through the code after any fix
- ALWAYS grep for the old value when changing test data or renaming anything
- ALWAYS search for all call sites when removing a workaround
- When a task is deferred, ALWAYS move it to `TODO-deferred.md` — never delete

### Type Safety
- ALWAYS use type guards (`isCategory()`, `isDomain()`, `isAgentName()` from `utils/type-guards.ts`) instead of `as` casts for runtime narrowing
- ALWAYS use `getSkillById(id)` or `getSkillBySlug(slug)` from `matrix-provider.ts` for skill lookups where the skill must exist. Only use `matrix.skills[id]` when genuinely optional.
- ALWAYS use `parseFrontmatter()` from `lib/loading/loader.ts` for SKILL.md parsing
- ALWAYS type factory function parameters with the narrowest union type (`SkillId`, not `string`). Error-path tests cast at the call site.
- ALWAYS use `typedEntries()` / `typedKeys()` from `utils/typed-object.ts` (not raw `Object.entries()`)

### Test Data
- ALWAYS prefer `SKILLS.*` from `test-fixtures.ts` over `createMockSkill()` for standard domain skills
- ALWAYS use `createMockMatrix` spread syntax: `createMockMatrix(SKILLS.react, SKILLS.hono)`
- ALWAYS use spread isolation `{ ...SKILLS.react }` when passing to functions that mutate objects in-place
- ALWAYS use pre-built matrix constants from `mock-matrices.ts` instead of inline `createMockMatrix(SKILLS.*)` calls
- ALWAYS use config factories: `buildProjectConfig()`, `buildSourceConfig()`, `buildAgentConfigs()`, `buildSkillConfigs()`
- ALWAYS use `AGENT_DEFS` from `mock-agents.ts` for agent metadata
- When fixing test data, ALWAYS evaluate the construction pattern too, not just the values

---

## Test Data Factories

Use factories from `__tests__/helpers.ts` and constants from `__tests__/mock-data/`. Grep for `createMock*`, `build*`, `SKILLS.*`, `AGENT_DEFS.*`, `render*` to find what's available. Never inline test data — if a factory doesn't exist, create one.

```
Is it a complete skill/agent/category object?
├─ YES → Use factory from helpers.ts (createMockSkill, createMockAgent, createMockCategory)
└─ NO → Is it a full project directory structure?
    ├─ YES → Use createTestSource() from fixtures/create-test-source.ts
    └─ NO → Does it create a config, matrix, or stack?
        ├─ YES → Use a factory (createMockMatrix, buildWizardResult, etc.) — NEVER inline
        └─ NO → Is it a partial object for one test case?
            ├─ YES → Inline is fine
            └─ NO → Use factory with overrides parameter
```

---

## Code Conventions

- **File naming:** kebab-case for ALL files and directories
- **Exports:** Named exports only (no default exports). Use `.js` extensions on relative imports in new files.
- **Constants:** No magic numbers or hardcoded strings — use `STANDARD_FILES.*`, `STANDARD_DIRS.*`, `EXIT_CODES.*`, `UI_SYMBOLS.*`, `CLI_COLORS.*` from `consts.ts`
- **Error handling:** `getErrorMessage(error)` for unknown errors, `this.handleError(error)` in commands, `EXIT_CODES.*` constants, no silent catch blocks
- **Logging:** `warn()` for user issues, `verbose()` for diagnostics, `log()` for always-visible
- **TypeScript:** Zero `any` without justification, no `@ts-ignore` without comment, Zod schemas at parse boundaries, all remaining casts must have comments explaining why

---

## Pre-Commit Checklist

Items not already covered by NEVER/ALWAYS rules above:

- [ ] Tests written and passing (`npm test`)
- [ ] Type check passes (`tsc --noEmit`)
- [ ] No ESLint errors
- [ ] No `console.log` left in code
- [ ] No commented-out code
- [ ] Use `createTempDir()` / `cleanupTempDir()` in tests (not raw `mkdtemp`)
- [ ] Type definitions updated if public API changed

---

## Key Documentation

| Document                                     | Purpose                         |
| -------------------------------------------- | ------------------------------- |
| [.ai-docs/DOCUMENTATION_MAP.md](./.ai-docs/DOCUMENTATION_MAP.md) | Codebase documentation index    |
| [TODO.md](./todo/TODO.md)                    | Active tasks and blockers       |

<critical-reminder>
1. You do NOT write code. Delegate to sub-agents. Tell them to read CLAUDE.md.
2. Trace ALL scenarios after any fix.
3. NEVER run ANY git commands that modify the staging area or working tree. The user curates their staging area intentionally.
</critical-reminder>
