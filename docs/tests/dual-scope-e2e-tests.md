# Dual-Pass Compile: Global + Project Agents

## Context

The `compile` command currently detects ONE installation (project first, global fallback via `detectInstallation()`) and compiles all agents to that single location. When a user has both global agents (shared across projects) and project agents, only one set gets compiled.

**Goal**: When both global and project installations exist, bare `compile` should run two independent passes — each driven by its own config, its own skills, and writing to its own agents directory.

---

## Production Changes

### File: `src/cli/commands/compile.ts`

#### Change 1: Rewrite `run()` to detect both installations

Replace the current flow (single `detectInstallation()`) with:

```
1. Detect global installation via detectGlobalInstallation()
2. Detect project installation via detectProjectInstallation(cwd)
   - Skip if cwd === homedir (avoid double-compile)
3. If neither found -> error
4. Load shared resources once:
   - Resolve source (resolveSourceForCompile)
   - Load agent definitions (loadAgentDefsForCompile)
5. If global installation exists -> run global pass
6. If project installation exists -> run project pass
```

`detectProjectInstallation()` and `detectGlobalInstallation()` already exist and are exported from `src/cli/lib/installation/installation.ts`.

#### Change 2: New private method `runCompilePass`

Extract the shared compilation logic into a reusable method:

```typescript
private async runCompilePass(params: {
  label: string;           // "Global" or "Project"
  projectDir: string;      // homedir or cwd
  installation: Installation;
  agentDefs: AgentSourcePaths;
  flags: CompileFlags;
}): Promise<void>
```

Each pass independently:

1. Logs header (`"Compiling global agents..."` / `"Compiling project agents..."`)
2. Calls `discoverAllSkills(projectDir)` — this already handles scope correctly:
   - When `projectDir === homedir`: loads only `~/.claude/skills/` (the `isGlobalProject` guard at line 185 prevents double-loading)
   - When `projectDir !== homedir`: loads both `~/.claude/skills/` and `./claude/skills/`
3. Calls `recompileAgents` with the installation's `agentsDir` as output
4. Logs results

Key: `discoverAllSkills(projectDir)` needs no changes. The existing `isGlobalProject` guard already scopes correctly per pass. `recompileAgents` is stateless and can be called twice safely.

#### Change 3: Make zero-skills non-fatal in dual-pass mode

`discoverAllSkills` at `compile.ts:203-209` currently calls `this.error()` (fatal process exit) when zero skills are found. In dual-pass mode, a global installation with zero skills (e.g., only agent definitions stored globally) would kill the process before the project pass runs.

Fix: `runCompilePass` should check `totalSkillCount === 0` and skip the pass with a log message (e.g., `"No skills found for global pass, skipping"`) instead of exiting. The fatal error should only occur when ALL passes find zero skills.

#### Change 4: Remove `--output` flag and `runCustomOutputCompile`

The `--output` flag is a debug/export shortcut that bypasses installation detection. It adds maintenance burden and isn't part of the core user workflow. Remove it along with `runCustomOutputCompile`. The existing E2E tests that use `--output` should be migrated to use proper installation setups.

**Note**: `runPluginModeCompile` should also be removed or folded into `runCompilePass` since mode derivation is automatic inside `recompileAgents`.

### Files touched

| File                                       | Change                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/cli/commands/compile.ts`              | Rewrite `run()`, add `runCompilePass`, remove `--output` flag and `runCustomOutputCompile` |
| `src/cli/lib/installation/installation.ts` | No changes needed                                                                          |
| `src/cli/lib/agents/agent-recompiler.ts`   | No changes needed                                                                          |

### Notes from code review

- **No config cross-contamination**: `loadProjectConfig(homedir)` returns global config directly (no fallback needed). `loadProjectConfig(cwd)` finds project config and returns early before fallback. Each pass gets its own config.
- **Skill scoping is automatic**: `discoverAllSkills(homedir)` triggers `isGlobalProject = true` which loads only `~/.claude/skills/`. `discoverAllSkills(cwd)` loads both locations with project winning on conflict.
- **Mode derivation is automatic**: `recompileAgents` calls `deriveInstallMode(projectConfig.skills)` internally — no need to pass mode explicitly. Plugin mode uses `"user"` (global) / `"project"` scopes for Claude's native plugin system.
- **Agent defs shared safely**: `loadAgentDefsForCompile` provides source path and templates (same for both passes). Per-pass agent discovery (builtin + project custom) happens inside `recompileAgents` using each pass's `projectDir`.
- **Scope field ignored by compiler**: `AgentScopeConfig.scope` is metadata for the installer/wizard. The compiler uses `projectConfig.agents.map(a => a.name)` — per-config separation handles scope at the `run()` level.
- **D7 safety net exists**: `local-installer.ts:321-338` already filters global agents to only see global skills. This is in the installer path; the compiler achieves the same effect via per-pass skill discovery scoping.

---

## E2E Tests

### New file: `e2e/commands/dual-scope.e2e.test.ts`

### Environment Isolation

All tests use `HOME=globalHome` + `AGENTSINC_SOURCE: undefined` to isolate from the real user config. Assertions on verbose/diagnostic output use the `combined` field (stdout + stderr).

### New helper: `createDualScopeProject(tempDir)` in `e2e/helpers/test-utils.ts`

Creates two independent installations and returns `{ globalHome, projectDir }`:

```
<tempDir>/
  global-home/                        <- fake HOME
    .claude-src/
      config.ts                       <- global config (global agents + global skills + stack)
    .claude/
      skills/
        web-testing-e2e-global/       <- global skill on disk
          SKILL.md
          metadata.yaml
  project/                            <- project dir (cwd)
    .claude-src/
      config.ts                       <- project config (project agents + project+global skills + stack)
    .claude/
      skills/
        web-testing-e2e-local/        <- project skill on disk
          SKILL.md
          metadata.yaml
```

Global config — self-contained, references only global skill:

```ts
export default {
  name: "global-test",
  skills: [{ id: "web-testing-e2e-global", scope: "global", source: "local" }],
  agents: [{ name: "web-developer", scope: "global" }],
  domains: ["web"],
  stack: {
    "web-developer": {
      "web-testing": { id: "web-testing-e2e-global", preloaded: true },
    },
  },
};
```

Project config — references both project skill AND global skill:

```ts
export default {
  name: "project-test",
  skills: [
    { id: "web-testing-e2e-local", scope: "project", source: "local" },
    { id: "web-testing-e2e-global", scope: "global", source: "local" },
  ],
  agents: [{ name: "api-developer", scope: "project" }],
  domains: ["web"],
  stack: {
    "api-developer": {
      "web-testing": { id: "web-testing-e2e-global", preloaded: true },
      "web-testing-local": { id: "web-testing-e2e-local", preloaded: true },
    },
  },
};
```

Reuses `createLocalSkill()` for skill creation. Config writing follows the `writeFile` + `JSON.stringify` pattern from the existing global fallback test.

---

### Test 1: Compiles agents to both locations

**User journey**: Developer runs `compile` in a project that has both global and project installations. Both sets of agents should be compiled to their respective directories.

**Command**: `compile` (no flags) with `HOME=globalHome`, `cwd=projectDir`

**Assertions**:

- `exitCode === 0`
- `globalHome/.claude/agents/` contains compiled `.md` files
- `projectDir/.claude/agents/` contains compiled `.md` files

**What it catches**: Compile only running one pass when two installations exist.

---

### Test 2: Global agents reference only global skills

**User journey**: Global agents should be compiled using only global skills — they should not leak project-specific skills.

**Command**: `compile` with `HOME=globalHome`, `cwd=projectDir`

**Assertions**:

- `web-developer.md` in `globalHome/.claude/agents/` contains `"web-testing-e2e-global"`
- `web-developer.md` in `globalHome/.claude/agents/` does NOT contain `"web-testing-e2e-local"`

**What it catches**: Global agents seeing project skills (cross-scope leakage).

---

### Test 3: Project agents reference both global and project skills

**User journey**: Project agents should be compiled with skills from both scopes — project-local skills AND global skills that are referenced in the project config's stack.

**Command**: `compile` with `HOME=globalHome`, `cwd=projectDir`

**Assertions**:

- `api-developer.md` in `projectDir/.claude/agents/` contains `"web-testing-e2e-local"`
- `api-developer.md` in `projectDir/.claude/agents/` contains `"web-testing-e2e-global"`

**What it catches**: Project pass failing to discover global skills, or stack not correctly assigning cross-scope skills to project agents.

---

### Test 4: Global-only installation still works

**User journey**: No project config exists, only global. Compile should still work.

**Setup**: Only `globalHome` has `.claude-src/config.ts`. No config in `projectDir`.

**Command**: `compile` with `HOME=globalHome`, `cwd=projectDir`

**Assertions**:

- `exitCode === 0`
- `globalHome/.claude/agents/` contains compiled `.md` files
- `projectDir/.claude/agents/` does NOT exist

**What it catches**: Regression where dual-pass code breaks the single-installation case.

---

### Test 5: Project-only installation still works

**User journey**: No global config exists, only project. Compile should still work.

**Setup**: Only `projectDir` has `.claude-src/config.ts`. Fake HOME has no `.claude-src/`.

**Command**: `compile` with `HOME=globalHome`, `cwd=projectDir`

**Assertions**:

- `exitCode === 0`
- `projectDir/.claude/agents/` contains compiled `.md` files
- `globalHome/.claude/agents/` does NOT exist

**What it catches**: Dual-pass code requiring both installations to exist.

---

### Test 6: Verbose output shows both passes

**User journey**: Developer runs `compile --verbose` and sees clear output for each pass.

**Command**: `compile --verbose` with `HOME=globalHome`, `cwd=projectDir`

**Assertions**:

- combined contains `"Compiling global agents"`
- combined contains `"Compiling project agents"`
- combined contains `"Loaded skill:"` and `"web-testing-e2e-global"`
- combined contains `"Loaded skill:"` and `"web-testing-e2e-local"`

**What it catches**: Missing UX feedback for which pass is running.

---

## Summary

| #   | Test                                       | Risk Mitigated                        |
| --- | ------------------------------------------ | ------------------------------------- |
| 1   | Compiles to both locations                 | Only one pass runs                    |
| 2   | Global agents get global skills only       | Cross-scope skill leakage             |
| 3   | Project agents get global + project skills | Project pass drops cross-scope skills |
| 4   | Global-only still works                    | Single-installation regression        |
| 5   | Project-only still works                   | Dual-pass requires both               |
| 6   | Verbose shows both passes                  | UX gap in output                      |

## Verification

1. `npx tsc --noEmit` — zero type errors
2. `npm run build` — rebuild binary
3. `npx vitest run e2e/commands/compile.e2e.test.ts --config e2e/vitest.config.ts` — existing tests still pass (after migrating off `--output`)
4. `npx vitest run e2e/commands/dual-scope.e2e.test.ts --config e2e/vitest.config.ts` — new tests pass
5. `npx vitest run e2e/interactive/real-marketplace.e2e.test.ts --config e2e/vitest.config.ts` — still passes
