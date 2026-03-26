# D-155: Declarative Commands + Move Single-Use Operations Back

**Status:** Ready for Dev
**Depends on:** D-154 (operations folder reorganization — do this first or combine)
**Related:** `.ai-docs/agent-suggestions/2026-03-25-declarative-programming-no-context-required.md`

---

## Problem

After D-145 (operations layer extraction), we over-extracted. ~30 functions were moved to `src/cli/lib/operations/` but are only used by a single command. These aren't shared abstractions — they're private implementation details scattered into a separate directory. Meanwhile, the commands themselves are still imperative step-by-step scripts that require line-by-line simulation to understand.

## Goals

1. **Move single-use operations back** to their respective command files as private pure functions
2. **Apply the declarative two-tier pattern** to every command: `run()` reads like pseudocode calling named private methods
3. **Keep the operations layer lean** — only genuinely shared functions (2+ callers)

---

## Part 1: Operations to dissolve back into commands

These operation files should be deleted. Their functions move to the bottom of the respective command file (or a co-located `.helpers.ts` file if the command exceeds ~300 lines).

| Operation file | Functions | Move to |
|---|---|---|
| `eject-project.ts` | `ejectAgentPartials`, `ejectSkills`, `ensureMinimalConfig` | `commands/eject.ts` |
| `uninstall-project.ts` | `detectUninstallTarget`, `removeMatchingSkills`, `removeMatchingAgents`, `uninstallPlugins`, `cleanupEmptyDirs` | `commands/uninstall.tsx` |
| `scaffold-agent.ts` | `parseCompiledAgent`, `buildAgentPrompt`, `invokeMetaAgent`, `loadMetaAgent` | `commands/new/agent.tsx` |
| `scaffold-skill.ts` | `validateSkillName`, `scaffoldSkillFiles`, `updateSkillRegistryConfig`, `generateSkillMd`, `generateMetadataYaml`, `generateSkillCategoriesTs`, `generateSkillRulesTs`, `toTitleCase` | `commands/new/skill.ts` (+ shared generators used by `new/marketplace.ts` stay exported from a shared location) |
| `import-skill.ts` | `parseGitHubSource`, `fetchSkillSource`, `discoverValidSkills`, `importSkillFromSource` | `commands/import/skill.ts` |
| `generate-skill-diff.ts` | `generateSkillDiff`, `formatColoredDiff` | `commands/diff.ts` |
| `resolve-skill-info.ts` | `resolveSkillInfo` | `commands/info.ts` |
| `search-skills.ts` | `fetchSkillsFromExternalSource`, `filterSkillsByQuery`, `copySearchedSkillsToLocal`, `toSourcedSkill` | `commands/search.tsx` |
| `detect-config-changes.ts` | `detectConfigChanges` | `commands/edit.tsx` |
| `migrate-plugin-scope.ts` | `migratePluginSkillScopes` | `commands/edit.tsx` |
| `get-dashboard-data.ts` | `getDashboardData` | `commands/init.tsx` |
| `update-local-skills.ts` | `updateLocalSkills` | `commands/update.tsx` |

### Special cases

- **`scaffold-skill.ts`**: `generateSkillCategoriesTs` and `generateSkillRulesTs` are also imported by `new/marketplace.ts`. These two generators should stay in a shared location (e.g., `lib/skills/generators.ts` or kept in operations). The rest moves to `new/skill.ts`.
- **`detect-both-installations.ts`**: Used by `compile.ts` AND `recompile-project.ts` (an operation). Stays in operations.
- **`find-skill-match.ts`**: Currently only used by `update.tsx`, but is genuinely reusable (search, info could use it). Decision: keep in operations OR move to `lib/skills/` as a shared utility.

---

## Part 2: Operations that stay (genuinely shared)

These are used by 2+ commands and belong in the operations layer:

| Function | Callers |
|---|---|
| `loadSource` | 10 commands |
| `compileAgents` | 4 commands |
| `loadAgentDefs` | 3 commands |
| `detectProject` | 3 commands |
| `copyLocalSkills` | 2 commands |
| `ensureMarketplace` | 2 commands |
| `installPluginSkills` | 2 commands |
| `uninstallPluginSkills` | edit.tsx (single, but pairs with installPluginSkills — keep together) |
| `writeProjectConfig` | 2 commands |
| `collectScopedSkillDirs` | 2 commands |
| `compareSkillsWithSource` | 2 commands |
| `buildSourceSkillsMap` | diff.ts + compare-skills.ts internal |
| `detectBothInstallations` | compile.ts + recompile-project.ts |
| `discoverInstalledSkills` | compile.ts + recompile-project.ts |
| `executeInstallation` | programmatic use (not directly in commands, but designed as composed pipeline) |
| `recompileProject` | programmatic use |

---

## Part 3: Apply declarative two-tier pattern to each command

After moving functions back, restructure each command so `run()` reads like pseudocode.

### Pattern

```typescript
export default class Edit extends BaseCommand {
  // --- Top tier: orchestrator ---
  async run(): Promise<void> {
    const context = await this.loadContext(flags);
    const result = await this.runWizard(context);
    if (!result) return;

    const changes = detectConfigChanges(context.config, result, context.skillIds);
    if (!hasAnyChanges(changes)) {
      this.log(INFO_MESSAGES.NO_CHANGES_MADE);
      return;
    }

    this.logChangeSummary(changes);
    await this.applyMigrations(changes, result, context);
    await this.applyScopeChanges(changes, result, context);
    await this.applyPluginChanges(changes, result, context);
    await this.copyNewLocalSkills(changes, result, context);
    await this.writeConfigAndCompile(result, context);
    await this.cleanupStaleFiles(changes, context);
    this.logCompletionSummary(changes);
  }

  // --- Bottom tier: named private methods ---
  // Each does one thing, named for its purpose.
  // Pure functions (no this.log) go as module-level functions at bottom of file.

  private async loadContext(flags) { ... }
  private async runWizard(context) { ... }
  private logChangeSummary(changes) { ... }
  private async applyMigrations(changes, result, context) { ... }
  // etc.
}

// --- Pure functions (bottom of file) ---
function hasAnyChanges(changes: ConfigChanges): boolean { ... }
function formatScopeLabel(scope: "project" | "global"): string { ... }
```

### Commands to restructure

| Command | Current lines | Estimated after | Key restructuring |
|---|---|---|---|
| `edit.tsx` | ~435 | ~450 (+ helpers) | Split `run()` into 8-10 named methods |
| `init.tsx` | ~407 | ~420 (+ helpers) | Split `handleInstallation` into 5 named methods |
| `compile.ts` | ~210 | ~220 | Split `runCompilePass` + `discoverAllSkills` inline into named methods |
| `update.tsx` | ~300 | ~310 | Split run() into load/compare/confirm/update/recompile methods |
| `eject.ts` | ~265 | ~350 (absorbs eject-project.ts) | Already has named methods; absorb operations back |
| `uninstall.tsx` | ~256 | ~400 (absorbs uninstall-project.ts) | Already well-structured; absorb operations back |
| `diff.ts` | ~165 | ~280 (absorbs generate-skill-diff.ts) | Split run() into load/diff/display methods |
| `doctor.ts` | ~450 | ~450 | Already has named check functions; just clean up run() |
| `outdated.ts` | ~184 | ~184 | Already clean; minimal changes |
| `search.tsx` | ~237 | ~320 (absorbs search-skills.ts) | Split interactive/static into named steps |
| `info.ts` | ~147 | ~235 (absorbs resolve-skill-info.ts) | Absorb + split run() |
| `import/skill.ts` | ~225 | ~420 (absorbs import-skill.ts) | Absorb + split run() into validate/discover/select/import |
| `new/skill.ts` | ~197 | ~380 (absorbs scaffold-skill.ts) | Absorb + keep named generators |
| `new/agent.tsx` | ~187 | ~300 (absorbs scaffold-agent.ts) | Absorb + split into load/prompt/invoke |

### The test: "Can you read `run()` without simulating any of its parts?"

Every command's `run()` should pass this test after restructuring. If you have to mentally trace a block to understand what it does, extract it to a named method.

---

## Part 4: Barrel export cleanup

After dissolving single-use operations:
- Remove deleted files from `operations/index.ts` barrel exports
- Remove deleted types from `operations/types.ts`
- Update any test files that import from operations to import from the command file instead
- Verify no external consumers depend on the dissolved exports

---

## Execution order

1. Move single-use operations back to their commands (Part 1)
2. Apply declarative pattern to each command (Part 3)
3. Clean up barrel exports (Part 4)
4. Gate: `tsc --noEmit` + `npm test -- --run` + full E2E suite

Parts 1 and 2 can be done per-command (e.g., do edit.tsx fully, then init.tsx, etc.) to keep each change testable.

---

## Verification

After each command is restructured:
- `run()` method reads like pseudocode (no inline data transforms, no simulation needed)
- All private methods are named for their purpose
- Pure functions are at the bottom of the file (or in `.helpers.ts`)
- No single-use functions remain in the operations layer
- All tests pass (unit + E2E for that command)

Final gate:
- `tsc --noEmit`
- `npm test -- --run` (4885 tests)
- `npx vitest run --config e2e/vitest.config.ts` (558 tests)
