---
type: standard-gap
severity: high
affected_files:
  - src/cli/commands/init.tsx
  - src/cli/lib/operations/project/compile-agents.ts
standards_docs:
  - .ai-docs/standards/cli/init-compilation.md (missing — should document multi-scope compilation)
date: 2026-03-27
reporting_agent: file-search
category: architecture
domain: cli
root_cause: rule-not-visible
---

## What Was Wrong

After `cc init` with a stack selection that includes global-scoped agents, the global agents are NOT compiled to `~/.claude/agents/`. Users must manually run `cc compile` to get their global agents compiled. This affects both the "from scratch" and "stack" approaches when a global installation exists alongside the project.

### Root Cause

The `init.tsx` command's `writeConfigAndCompile` method (lines 420-459) performs a **single compilation pass** to only the project agents directory:

```typescript
// init.tsx:444-456
this.log(STATUS_MESSAGES.COMPILING_AGENTS);
const projectPaths = resolveInstallPaths(process.cwd(), "project");
const agentDefs = await loadAgentDefs();
const { allSkills } = await discoverInstalledSkills(process.cwd());
const compileResult = await compileAgents({
  projectDir: process.cwd(),
  sourcePath: agentDefs.sourcePath,
  skills: allSkills,
  installMode,
  agentScopeMap: buildAgentScopeMap(configResult.config),
  outputDir: projectPaths.agentsDir, // ONLY PROJECT DIR
  // NOTE: scopeFilter is NOT set, no separate passes for global agents
});
```

The issue is:

1. **No multi-scope detection**: Does not call `detectBothInstallations()` to check if both global and project installations exist
2. **No scope filtering**: Does not use the `scopeFilter` parameter of `compileAgents()`
3. **Single pass only**: Makes one compilation call, passing `outputDir` to project directory only
4. **Ignores agent scope map**: Although `buildAgentScopeMap(configResult.config)` is passed, it only directs where outputs go if agents are being compiled in the same pass — but global agents are never routed to `~/.claude/agents/`

By contrast, the `compile` command (lines 98-120 of compile.ts) handles this correctly:

```typescript
// compile.ts:98-120
private async compileAllScopes(
  installations: BothInstallations,
  agentDefs: AgentDefs,
  cwd: string,
): Promise<void> {
  // Build SEPARATE passes for global and project when both exist
  const passes = buildCompilePasses(installations, cwd, agentDefs.sourcePath);

  let totalPassesWithSkills = 0;
  for (const pass of passes) {
    const hadSkills = await this.runCompilePass(pass);
    if (hadSkills) totalPassesWithSkills++;
  }
  // ...
}

// compile.ts:195-223 buildCompilePasses creates separate passes with scopeFilter:
if (installations.global) {
  passes.push({
    label: "Global",
    projectDir: os.homedir(),
    installation: installations.global,
    sourcePath,
    scopeFilter: installations.hasBoth ? "global" : undefined,
  });
}

if (installations.project) {
  passes.push({
    label: "Project",
    projectDir: cwd,
    installation: installations.project,
    sourcePath,
    scopeFilter: installations.hasBoth ? "project" : undefined,
  });
}
```

### Evidence: Agent Scope Assignment

When a stack is selected via wizard, agents are preselected with `scope: "global"` (wizard-store.ts:941):

```typescript
// wizard-store.ts:941
selectedAgents: sorted,
agentConfigs: sorted.map((name) => ({ name, scope: "global" as const })),
```

This scope is preserved through config writing (local-installer.ts:336-342):

```typescript
export function buildAgentScopeMap(config: ProjectConfig): Map<AgentName, "project" | "global"> {
  const map = new Map<AgentName, "project" | "global">();
  for (const agent of config.agents) {
    map.set(agent.name, agent.scope);
  }
  return map;
}
```

And the agent-recompiler correctly routes agents by scope (agent-recompiler.ts:140-149):

```typescript
const scope = agentScopeMap?.get(agentName) ?? "project";
const targetDir = scope === "global" ? globalAgentsDir : agentsDir;
await writeFile(path.join(targetDir, `${agentName}.md`), output);
```

**BUT init.tsx never makes a separate pass with `scopeFilter: "global"` to ensure global agents are processed, so they are written to neither the global nor project directory.**

## Code Path from Wizard to (Missing) Compilation

1. **Wizard confirms selection** → `wizard.tsx:209` calls `onComplete(result)` with `agentConfigs` containing scope info
2. **Init receives result** → `init.tsx:186` `runWizard()` returns `WizardResultV2`
3. **Install phase** → `init.tsx:193` calls `handleInstallation(result, ...)`
4. **Config and compile** → `init.tsx:305-310` calls `writeConfigAndCompile(result, ...)`
5. **Config written** → `writeProjectConfig()` merges wizard result into config with agent scopes
6. **Scope map built** → `init.tsx:453` builds `agentScopeMap` from config agents
7. **Single compile call** → `init.tsx:448-455` calls `compileAgents()` with:
   - `projectDir: process.cwd()`
   - `outputDir: projectPaths.agentsDir` (PROJECT ONLY)
   - **Missing**: No `scopeFilter`, no separate global pass
8. **Only project agents compiled** → global agents skip compilation silently
9. **User must manually `cc compile`** → Standalone compile command detects both installations and makes two passes

## Exact File:Line References

**Bug location:**

- `src/cli/commands/init.tsx:420-459` — `writeConfigAndCompile()` method (single-pass compilation)
- `src/cli/commands/init.tsx:444-456` — `compileAgents()` call lacking multi-scope logic

**Correct pattern (for reference):**

- `src/cli/commands/compile.ts:98-120` — `compileAllScopes()` detects and handles both scopes
- `src/cli/commands/compile.ts:195-223` — `buildCompilePasses()` creates separate passes with `scopeFilter`
- `src/cli/lib/operations/project/detect-both-installations.ts` — Function to detect both installations
- `src/cli/lib/operations/project/compile-agents.ts:7-18` — `CompileAgentsOptions` type with `scopeFilter` field

**Related agent-routing code:**

- `src/cli/lib/agents/agent-recompiler.ts:140-149` — Correct scope routing when `agentScopeMap` is used
- `src/cli/lib/installation/local-installer.ts:336-342` — `buildAgentScopeMap()` extraction from config

## Proposed Standard

### New Standard: "Multi-Scope Compilation in Init"

**Location:** Create `.ai-docs/standards/cli/init-compilation.md`

**Content should specify:**

1. **When init should detect both installations:**
   - Always call `detectBothInstallations(projectDir)` in `writeConfigAndCompile()`
   - Check if `installations.hasBoth === true`

2. **How to make separate compilation passes:**
   - When `hasBoth === true`, create a global pass first, then project pass
   - Use `buildCompilePasses()` pattern from compile.ts or inline equivalent
   - Set `scopeFilter: "global"` for global pass, `scopeFilter: "project"` for project pass

3. **Output directories must match scope:**
   - Global pass: output to `~/.claude/agents/`
   - Project pass: output to project `.claude/agents/`

4. **Skills discovery per pass:**
   - Each pass should discover skills from its respective scope (global or project)
   - Use the same `discoverInstalledSkills()` for each `projectDir` variant

5. **Validation:**
   - All agents in config should be compiled, regardless of scope
   - If any global-scoped agents exist in config, at least one pass must target global agents directory
   - Test both "stack" and "scratch" initialization flows with global agents

### Enforcement Mechanism

Update `src/cli/commands/init.tsx` to match the compile.ts pattern:

1. Import `detectBothInstallations` from operations
2. Detect both installations in `writeConfigAndCompile()`
3. Build separate passes using the compile.ts pattern
4. Loop through passes and run each with appropriate `scopeFilter`

This ensures init and compile commands use consistent logic for multi-scope compilation.
