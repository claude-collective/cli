# E2E Full Lifecycle Test Design

**Date:** 2026-03-13
**Purpose:** Design a comprehensive test that exercises the full init → edit → compile → uninstall lifecycle, catches known cross-scope bugs, and resolves the two critical blockers from the framework design.

---

## 1. Known Bugs This Test Must Catch

### Bug A: Edit-global-from-project compiles ALL agents to project dir

**Root cause:** `edit.tsx:400-410` calls `recompileAgents()` with `outputDir: installation.agentsDir`, which is always the project's `.claude/agents/`. The `recompileAgents` function (`agent-recompiler.ts:123-140`) writes ALL agents to that single directory — no scope-aware routing.

**Contrast:** `installLocal()`/`installPluginConfig()` use `compileAndWriteAgents()` in `local-installer.ts:462-503` which has `agentScopeMap` and routes global agents to `~/.claude/agents/` and project agents to `projectDir/.claude/agents/`.

**Repro flow:**

1. Init globally: select web-developer agent
2. Init a project
3. From project, edit global scope: add web-tester agent
4. Result: BOTH web-developer.md and web-tester.md end up in `projectDir/.claude/agents/`. Global `~/.claude/agents/` only has the original web-developer.

**Assertion:**

- After editing global scope from project, `~/.claude/agents/web-tester.md` should exist
- `projectDir/.claude/agents/web-tester.md` should NOT exist (it's global-scoped)

### Bug B: Project config.ts accumulates global skills

**Root cause:** The edit command's `buildAndMergeConfig()` builds a config from the full wizard result (all scopes), then `mergeWithExistingConfig()` merges with the existing project config. The existing project config (from a prior `writeScopedConfigs` call) only has project-scoped items. The merge unions them. Then `writeScopedConfigs` → `splitConfigByScope` splits again. But `splitConfigByScope` at `config-generator.ts:248` puts `config.domains` into BOTH global and project configs unconditionally.

**Observable:** The project config.ts includes domains from the global scope. The `domains` array in the project config duplicates the global domains.

**Assertion:**

- Project config.ts should only list project-scoped domains (or inherit from global via import)
- No duplicate domains in project config

### Bug C: Domains accumulate across edits

**Root cause:** `splitConfigByScope()` at `config-generator.ts:234` and `248` copies `config.domains` verbatim to BOTH global and project configs. On subsequent edits, the merge reads the project config (which already has the full domains array), then the wizard adds its domains, producing duplicates.

**User note:** "Let's not worry about this for now. Domains are a tricky thing."

**Status:** Document only, defer fix. Include assertion as `.todo` or skip.

---

## 2. Blocker Resolution Tests

### 2.1 Blocker 7.1: Full Plugin Chain Proof-of-Concept

This test proves the entire chain works before any framework code is written.

```
Test: "full plugin chain: build → register → install → verify"

Setup:
  1. createE2ESource()  →  sourceDir with 10 skills in src/skills/
  2. createTempDir()    →  tempDir for HOME isolation (if 7.6 passes)

Steps (assert at every stage):
  Step 1: build plugins
    runCLI(["build", "plugins"], sourceDir)
    Assert: exit code 0
    Assert: dist/plugins/ contains ≥1 plugin directory
    Assert: each plugin dir has .claude-plugin/plugin.json with name + version

  Step 2: build marketplace
    runCLI(["build", "marketplace", "--name", marketplaceName], sourceDir)
    Assert: exit code 0
    Assert: sourceDir/.claude-plugin/marketplace.json exists
    Assert: JSON has name === marketplaceName, plugins.length >= 1

  Step 3: claude plugin marketplace add
    execCommand("claude", ["plugin", "marketplace", "add", sourceDir])
    Assert: exit code 0 (or "already installed" in stderr)

  Step 4: claude plugin install
    execCommand("claude", ["plugin", "install", `web-framework-react@${marketplaceName}`, "--scope", "project", "--project", projectDir])
    Assert: exit code 0
    Assert: installed_plugins.json has entry for web-framework-react@<marketplace>

  Step 5: Verify filesystem
    Assert: plugin install path from registry has .claude-plugin/plugin.json
    Assert: plugin install path has skills/web-framework-react/SKILL.md

Skip: describe.skipIf(!claudeAvailable)
Timeout: 60_000 (generous for compilation + install)
```

### 2.2 Blocker 7.6: HOME Isolation + Claude CLI Auth

```
Test: "claude plugin commands work with HOME=<tempDir>"

Steps:
  1. const tempDir = await createTempDir()
  2. execCommand("claude", ["--version"], { env: { HOME: tempDir } })
     Assert: completes without error

  3. execCommand("claude", ["plugin", "marketplace", "list", "--json"], { env: { HOME: tempDir } })
     Assert: completes (empty array is fine, no auth error)

  4. execCommand("claude", ["plugin", "marketplace", "add", sourceDir], { env: { HOME: tempDir } })
     Assert: completes without auth error

  5. execCommand("claude", ["plugin", "install", pluginRef, "--scope", "project", "--project", projectDir], { env: { HOME: tempDir } })
     Assert: completes without auth error

If step 4 or 5 fails with auth error:
  → Document: plugin E2E tests cannot isolate HOME
  → Fallback: use real HOME, accept reduced isolation
  → Update framework design accordingly
```

---

## 3. Full Lifecycle Test Design

### 3.1 Scenario: Init Global → Init Project → Edit Global from Project → Uninstall

This is the primary lifecycle test. It exercises all commands and catches all three known bugs.

```
Test: "full lifecycle: global init → project init → cross-scope edit → uninstall"

=== Phase 1: Global Init ===

Setup:
  tempDir = createTempDir()    // HOME for the whole test
  sourceDir = (from createE2EPluginSource() or createE2ESource())

Action:
  Run init wizard from homedir (HOME=tempDir):
    TerminalSession(["init", "--source", sourceDir], {
      cwd: tempDir,
      env: { HOME: tempDir, AGENTSINC_SOURCE: undefined }
    })
  Navigate wizard:
    - Select stack (or customize)
    - Select web domain
    - Select web-developer agent
    - Select web-framework-react skill (global scope)
    - Complete flow

Verify Phase 1:
  Global config:
    P1-A: ~/.claude-src/config.ts exists
    P1-B: config has skills: [{ id: "web-framework-react", scope: "global" }]
    P1-C: config has agents: [{ name: "web-developer", scope: "global" }]
    P1-D: config has domains: ["web"]
  Global agents:
    P1-E: ~/.claude/agents/web-developer.md exists
    P1-F: web-developer.md contains YAML frontmatter (starts with "---")
  No project artifacts:
    P1-G: No projectDir/.claude/ directory exists yet

=== Phase 2: Project Init ===

Setup:
  projectDir = path.join(tempDir, "my-project")
  mkdir(projectDir)
  createPermissionsFile(projectDir)

Action:
  Run init wizard from projectDir:
    TerminalSession(["init", "--source", sourceDir], {
      cwd: projectDir,
      env: { HOME: tempDir, AGENTSINC_SOURCE: undefined }
    })
  Navigate wizard:
    - Select web domain
    - Select web-developer agent (should show as locked/global)
    - Select api-framework-hono skill (project scope)
    - Select api-developer agent (project scope)
    - Complete flow

Verify Phase 2:
  Project config:
    P2-A: projectDir/.claude-src/config.ts exists
    P2-B: project config has ONLY project-scoped skills: [{ id: "api-framework-hono", scope: "project" }]
    P2-C: project config has ONLY project-scoped agents: [{ name: "api-developer", scope: "project" }]
    P2-D: project config does NOT contain web-framework-react
    P2-E: project config does NOT contain web-developer agent
  Global config unchanged:
    P2-F: ~/.claude-src/config.ts still has exactly web-framework-react + web-developer
    P2-G: No new skills or agents were added to global config
  Agent compilation by scope:
    P2-H: projectDir/.claude/agents/api-developer.md exists
    P2-I: projectDir/.claude/agents/ does NOT contain web-developer.md
    P2-J: ~/.claude/agents/web-developer.md still exists (unchanged from Phase 1)

=== Phase 3: Edit Global Scope from Project ===

This is where the known bugs manifest.

Action:
  Run edit wizard from projectDir, targeting global scope:
    TerminalSession(["edit", "--source", sourceDir], {
      cwd: projectDir,
      env: { HOME: tempDir, AGENTSINC_SOURCE: undefined }
    })
  Navigate wizard:
    - Global skills should show as locked
    - Navigate to global section somehow (this depends on UX for editing global from project)
    - Add web-testing-vitest skill to global scope
    - Complete flow

Verify Phase 3 — Config Isolation:
  P3-A: ~/.claude-src/config.ts has web-framework-react AND web-testing-vitest (both global)
  P3-B: projectDir/.claude-src/config.ts still has ONLY api-framework-hono (project)
  P3-C: project config does NOT contain web-framework-react or web-testing-vitest

Verify Phase 3 — Agent Compilation Routing (Bug A):
  P3-D: ~/.claude/agents/web-developer.md exists (was recompiled with new skill context)
  P3-E: projectDir/.claude/agents/ does NOT contain web-developer.md
  P3-F: projectDir/.claude/agents/api-developer.md still exists (project agent untouched)

Verify Phase 3 — No Domain Duplication (Bug C):
  P3-G: ~/.claude-src/config.ts domains array has no duplicates
  P3-H: projectDir/.claude-src/config.ts domains array has no duplicates

=== Phase 4: Compile ===

Action:
  runCLI(["compile"], projectDir, { env: { HOME: tempDir } })

Verify Phase 4:
  P4-A: exit code 0
  P4-B: projectDir/.claude/agents/api-developer.md exists (recompiled)
  P4-C: projectDir/.claude/agents/ does NOT contain web-developer.md (global agent stays global)

=== Phase 5: Uninstall Project ===

Action:
  runCLI(["uninstall", "--yes"], projectDir, { env: { HOME: tempDir } })

Verify Phase 5:
  P5-A: exit code 0
  P5-B: projectDir/.claude-src/config.ts removed (or emptied)
  P5-C: projectDir/.claude/agents/ removed
  P5-D: projectDir/.claude/skills/ removed (if local mode)
  Global untouched:
  P5-E: ~/.claude-src/config.ts still has web-framework-react + web-testing-vitest
  P5-F: ~/.claude/agents/web-developer.md still exists
```

### 3.2 Scenario: Plugin Mode Variant

Same lifecycle as 3.1 but with plugin mode instead of local mode. Requires blockers 7.1 and 7.6 to be resolved first.

```
Additional assertions for plugin mode:
  PP-A: installed_plugins.json has entries for installed plugins
  PP-B: .claude/settings.json has enabledPlugins entries
  PP-C: After uninstall, enabledPlugins entries are removed
  PP-D: After uninstall, plugin directories are removed from disk
  PP-E: Global plugins are NOT uninstalled when project is uninstalled
```

---

## 4. Isolated Bug Reproduction Tests

These are simpler, focused tests that reproduce each known bug in isolation (faster to run, easier to debug).

### 4.1 Bug A Reproduction: Agent Scope Routing in Edit

```
Test: "edit recompile routes agents to correct scope directory"

Setup:
  1. Create project with global agent (web-developer) + project agent (api-developer)
  2. Pre-populate:
     - ~/.claude-src/config.ts with global config
     - projectDir/.claude-src/config.ts with project config
     - ~/.claude/agents/web-developer.md
     - projectDir/.claude/agents/api-developer.md

Action:
  Edit from projectDir, add web-testing-vitest to global scope

Assert:
  - ~/.claude/agents/web-developer.md was updated (recompiled with new skill)
  - projectDir/.claude/agents/ does NOT contain web-developer.md
  - projectDir/.claude/agents/api-developer.md was recompiled (project agent)
```

**Root cause pointer:** `agent-recompiler.ts:123-140` — `compileAndWriteAgents` writes to a single `agentsDir`. Needs `agentScopeMap` routing like `local-installer.ts:492-498`.

### 4.2 Bug B Reproduction: Skill Accumulation

```
Test: "project config.ts does not accumulate global skills after edit"

Setup:
  1. Global config with web-framework-react (global scope)
  2. Project config with api-framework-hono (project scope)

Action:
  Edit from project, add web-testing-vitest to project scope

Assert:
  - Project config.ts has api-framework-hono + web-testing-vitest (both project)
  - Project config.ts does NOT have web-framework-react
  - Global config.ts still has only web-framework-react
```

### 4.3 Bug C Reproduction: Domain Duplication (Deferred)

```
Test: "domains do not duplicate across edit cycles"

Setup:
  1. Global config with domains: ["web"]
  2. Project config with domains: ["web", "api"]

Action:
  Edit from project, add a skill (no domain change)

Assert:
  - Project config.ts domains are ["web", "api"] (not ["web", "api", "web"])
  - Global config.ts domains are ["web"] (unchanged)

Status: DEFERRED per user. Include as skipped test.
```

---

## 5. Test Infrastructure Requirements

### 5.1 What Exists

| Helper                                 | File                               | Status                                    |
| -------------------------------------- | ---------------------------------- | ----------------------------------------- |
| `createE2ESource()`                    | `e2e/helpers/create-e2e-source.ts` | Exists, creates 10 skills                 |
| `TerminalSession`                      | `e2e/helpers/terminal-session.ts`  | Exists, PTY-based wizard driving          |
| `runCLI()`                             | `e2e/helpers/test-utils.ts`        | Exists, non-interactive command execution |
| `createTempDir()` / `cleanupTempDir()` | `e2e/helpers/test-utils.ts`        | Exists                                    |
| `createPermissionsFile()`              | `e2e/helpers/test-utils.ts`        | Exists                                    |
| `ensureBinaryExists()`                 | `e2e/helpers/test-utils.ts`        | Exists                                    |
| `isClaudeCLIAvailable()`               | `src/cli/utils/exec.ts`            | Exists                                    |

### 5.2 What Needs to Be Created

| Helper                     | Purpose                                                                           |
| -------------------------- | --------------------------------------------------------------------------------- |
| `createE2EPluginSource()`  | Builds source + plugins + marketplace.json (spec in framework design Section 1.6) |
| `verifyPluginInSettings()` | Checks enabledPlugins in settings.json (spec in framework design Section 2.3)     |
| `verifyPluginInRegistry()` | Checks installed_plugins.json (spec in framework design Section 2.3)              |
| `verifyConfig()`           | Reads config.ts and checks expected skills/agents/sources                         |
| `readConfigTs()`           | Parses config.ts and returns structured data for assertions                       |

### 5.3 What Needs to Be Investigated

1. **How to edit global scope from project context in the wizard** — The edit wizard loads the project installation. How does a user select "edit global" vs "edit project"? Is there a flag? A wizard step? Need to verify the UX flow before designing wizard keystrokes.

2. **Wizard navigation for adding a skill to global scope** — The wizard has scope toggles (`P` hotkey). Need to verify exact keystroke sequence for changing a skill's scope.

---

## 6. Test File Organization

```
e2e/
  lifecycle/
    full-lifecycle.e2e.test.ts          # Section 3.1 — the big one
    full-lifecycle-plugin.e2e.test.ts    # Section 3.2 — plugin mode variant
  blockers/
    plugin-chain-poc.e2e.test.ts        # Section 2.1 — resolve blocker 7.1
    home-isolation.e2e.test.ts          # Section 2.2 — resolve blocker 7.6
  bugs/
    edit-agent-scope-routing.e2e.test.ts  # Section 4.1 — Bug A
    edit-skill-accumulation.e2e.test.ts   # Section 4.2 — Bug B
```

---

## 7. Execution Order

1. **First:** Run blocker tests (Section 2). If either fails, the plugin-mode lifecycle test cannot proceed. The local-mode lifecycle test and bug reproduction tests can still run.

2. **Second:** Run bug reproduction tests (Section 4). These are fast, focused, and don't need the plugin chain. They validate the cross-scope issues exist (or have been fixed).

3. **Third:** Run the full lifecycle test (Section 3.1) in local mode. This is the comprehensive validation.

4. **Fourth:** Once blockers are resolved, run the plugin-mode lifecycle test (Section 3.2).

---

## 8. Open Questions

1. **Can `cc edit` target global scope from a project?** The edit command's `detectInstallation()` returns the project installation when run from a project dir. The wizard shows global items as "locked." Is there a UX path to edit global items from a project context, or must the user `cd ~` first? If the latter, Bug A only manifests when the user explicitly runs `cc edit` from `~/` after having a project — but the agent compilation still goes to the wrong place.

2. **Does `splitConfigByScope` handle the merge correctly on re-edit?** After the first `writeScopedConfigs` call, the project config.ts only has project items. On re-edit, `mergeWithExistingConfig` loads the project config, merges with the full wizard result, then `splitConfigByScope` splits again. The merge should preserve scope metadata on skills/agents, but need to verify that re-splitting produces the same output as the original split.

3. **What happens to `config-types.ts` during cross-scope edits?** The `writeProjectConfigTypes()` function generates a types file that imports from global. If global types change during a project-context edit, does the project types file get regenerated correctly?

---

## 9. Implementation Status (2026-03-13)

### Implemented Tests

| Section | Scenario                                 | Test File                                       | Status                                       |
| ------- | ---------------------------------------- | ----------------------------------------------- | -------------------------------------------- |
| 2.1     | Blocker 7.1: Plugin Chain                | `e2e/blockers/plugin-chain-poc.e2e.test.ts`     | RESOLVED (5 tests)                           |
| 2.2     | Blocker 7.6: HOME Isolation              | `e2e/blockers/home-isolation.e2e.test.ts`       | RESOLVED (4 tests)                           |
| 3.1     | Full Lifecycle (local mode, simplified)  | `e2e/lifecycle/local-lifecycle.e2e.test.ts`     | COMPLETE (1 test, 4 phases)                  |
| 3.2     | Full Lifecycle (plugin mode, simplified) | `e2e/lifecycle/plugin-lifecycle.e2e.test.ts`    | COMPLETE (1 test, 2 phases)                  |
| 4.1     | Bug A: Agent Scope Routing               | `e2e/bugs/edit-agent-scope-routing.e2e.test.ts` | COMPLETE (1 test, bug appears fixed)         |
| 4.2     | Bug B: Skill Accumulation                | `e2e/bugs/edit-skill-accumulation.e2e.test.ts`  | COMPLETE (1 test, confirms correct behavior) |
| 4.3     | Bug C: Domain Duplication                | —                                               | DEFERRED (per user)                          |

### Key Findings

- **Bug A is fixed:** `agent-recompiler.ts:128-154` has correct scope routing via `agentScopeMap`.
- **Bug B doesn't manifest:** `splitConfigByScope()` correctly filters skills by scope; `loadProjectConfig()` loads only one config (no cross-scope merge).
- **Lifecycle tests simplified:** Cross-scope editing (Phase 3 from Section 3.1) deferred because UX for global editing from project context is undefined (Section 8, Q1).
- **`loadProjectConfig()` doesn't merge:** It returns the first config found (project → global fallback). The edit command never sees both configs simultaneously.
