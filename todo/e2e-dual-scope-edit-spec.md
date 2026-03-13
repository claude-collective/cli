# E2E Spec: Dual-Scope Edit with Mixed Sources

**Date:** 2026-03-13
**Status:** IMPLEMENTED — 9 tests at `e2e/lifecycle/dual-scope-edit.e2e.test.ts` (7 expected-fail, 2 passing)

---

## 1. What We're Testing

The full lifecycle: init a global installation, init a project installation, then edit from the project — verifying that the CLI correctly handles dual-scope state with mixed sources throughout the real user flow.

Each test follows the **full flow** (init → edit → verify). "Thin" means each test makes the **minimum changes** during the edit step to prove one specific behavior — not that we skip init.

---

## 2. The Full Flow

Every test in this suite follows these phases:

### Phase A: Init Global

Run `cc init --source <sourceDir>` from `<HOME>` directory. Navigate the wizard to select **web domain** skills + **web-developer** agent. This creates:
- `<HOME>/.claude-src/config.ts` — global config
- `<HOME>/.claude/agents/web-developer.md` — compiled global agent
- `<HOME>/.claude/skills/web-framework-react/` — global local skill

### Phase B: Init Project

Run `cc init --source <sourceDir>` from `<HOME>/project/`. The `GlobalConfigPrompt` appears because a global installation exists. Choose **"Create new project installation"** (Arrow Down + Enter — it's the second option). Navigate the wizard to select **API domain** skills + **api-developer** agent. This creates:
- `<projectDir>/.claude-src/config.ts` — project config (with global refs as locked)
- `<projectDir>/.claude/agents/api-developer.md` — compiled project agent
- `<projectDir>/.claude/skills/api-framework-hono/` — project local skill

### Phase C: Edit (varies per test)

Run `cc edit --source <sourceDir>` from `<projectDir>`. The wizard shows both scopes — global items locked, project items editable. Each test makes one specific change, then completes.

### Phase D: Verify (varies per test)

Check configs, agents, skills, and output for the expected result.

**Key constraint:** Phase A and B establish the same starting state for all tests. Only Phase C (the edit action) and Phase D (the assertions) differ.

---

## 3. Shared Fixture

All tests share the same E2E source, created once in `beforeAll`:

```typescript
let fixture: { sourceDir: string; tempDir: string };

beforeAll(async () => {
  fixture = await createE2ESource();  // or createE2EPluginSource() for plugin tests
}, 120_000);
```

Each test creates its own `tempDir` with its own fake HOME and project directory for full isolation.

---

## 4. Init Navigation Helpers

Since every test runs the same init flows, extract navigation into helpers:

```typescript
/** Phase A: Init globally — select first stack, accept defaults */
async function initGlobal(sourceDir: string, homeDir: string): Promise<void> {
  const session = new TerminalSession(
    ["init", "--source", sourceDir],
    homeDir,
    { env: { HOME: homeDir, AGENTSINC_SOURCE: undefined } },
  );
  // Stack → Enter, Domains → Enter, Build (Web) → Enter, Build (Shared) → Enter
  // Sources → Enter, Agents → Enter, Confirm → Enter
  // Wait for "initialized successfully"
  await session.destroy();
}

/** Phase B: Init project — GlobalConfigPrompt → "Create new project" → select API skills */
async function initProject(sourceDir: string, homeDir: string, projectDir: string): Promise<void> {
  const session = new TerminalSession(
    ["init", "--source", sourceDir],
    projectDir,
    { env: { HOME: homeDir, AGENTSINC_SOURCE: undefined } },
  );
  // GlobalConfigPrompt → Arrow Down → Enter (create new project)
  // Stack → Enter, Domains → select API domain → Enter
  // Build (API) → Enter, Build (Shared) → Enter
  // Sources → Enter, Agents → Enter, Confirm → Enter
  // Wait for "initialized successfully"
  await session.destroy();
}
```

**Open question:** During initGlobal, do we need to deselect API domain (so only Web is global)? Or does the stack auto-select all domains? If all domains are selected in the global init, the project init would have everything as global-locked. We need the global init to select ONLY Web domain, and the project init to select ONLY API domain — creating a clean split.

**Navigation for domain deselection:** On the "Select domains to configure" step, domains are checkboxes. Space toggles selection. If Web, API, and Shared are all pre-selected by the stack, we need to:
- Arrow Down to API, Space to deselect
- Arrow Down to Shared, Space to deselect (or leave Shared selected for both — methodology skills are in Shared)
- Enter to continue with only Web selected

---

## 5. Test Slices

### File: `e2e/lifecycle/dual-scope-edit.e2e.test.ts`

Each test is a single `it()` that runs Phases A → B → C → D. Tests are independent and can run in parallel.

---

### Test 1: Edit shows global items as locked, project items as editable

**What it proves:** The edit wizard correctly displays both scopes — global skills/agents have lock indicators, project skills/agents are interactive.

**Phase C (edit action):** Navigate through without making any changes. Just observe output.

**Phase D (assertions):**
- Exit code 0
- Output shows scope indicators: `"G "` for global skills, `"P "` for project skills
- Output shows agent scope badges: `"[G]"` for web-developer, `"[P]"` for api-developer
- Config files unchanged (both global and project configs preserved as-is)
- Agent files unchanged (both directories preserved)

**skipIf:** None

**Expected:** PASS

---

### Test 2: Toggle a project skill's scope to global

**What it proves:** Pressing `S` on a project-scoped skill during the build step moves it to global scope in the config.

**Phase C (edit action):**
1. Wait for build step
2. On the API domain build page, focus is on `api-framework-hono` (project-scoped)
3. Press `s` to toggle scope to global
4. Navigate through remaining steps without changes

**Phase D (assertions):**
- Global config now contains `api-framework-hono` with `scope: "global"`
- Project config does NOT contain `api-framework-hono` (it moved to global)

**skipIf:** None

**Expected:** May FAIL (scope routing bugs). Mark `it.fails` if so.

---

### Test 3: Toggle a project agent's scope to global

**What it proves:** Pressing `S` on a project-scoped agent on the agents step routes the compiled agent file to the global agents directory.

**Phase C (edit action):**
1. Navigate through build steps without changes
2. On agents step, Arrow Down to `api-developer` (past locked `web-developer`)
3. Press `s` to toggle `api-developer` to global scope
4. Complete wizard

**Phase D (assertions):**
- `api-developer.md` exists at `<HOME>/.claude/agents/api-developer.md` (global)
- `api-developer.md` does NOT exist at `<projectDir>/.claude/agents/` (moved from project)
- `web-developer.md` still at `<HOME>/.claude/agents/` (unchanged)

**skipIf:** None

**Expected:** May FAIL (scope routing bugs). Mark `it.fails` if so.

---

### Test 4: Change a project skill's source from local to plugin

**What it proves:** Switching a project skill from local source to plugin source via the Sources customize view triggers mode migration — local files removed, plugin installed.

**Phase A/B variant:** Use `createE2EPluginSource()` instead of `createE2ESource()` (needs a marketplace for the plugin source option to appear in the Sources grid).

**Phase C (edit action):**
1. Navigate through build steps without changes
2. On Sources step: Arrow Down to "Customize skill sources" → Enter
3. In the customize view, navigate to `api-framework-hono` row
4. Arrow Right to the marketplace source column → Space to select
5. Enter to continue
6. Navigate through Agents → Confirm

**Phase D (assertions):**
- Output contains migration message (e.g., "Switching" or "Installing plugin:")
- Local skill files removed from `<projectDir>/.claude/skills/api-framework-hono/`
- Config updated: `api-framework-hono` now has `source: "<marketplace>"`

**skipIf:** `!claudeAvailable` (plugin install requires Claude CLI)

**Expected:** May FAIL. Mark `it.fails` if so.

---

### Test 5: Change a project skill's source from plugin to local

**What it proves:** Switching a project skill from plugin to local via Sources customize view triggers migration — plugin uninstalled, skill copied locally.

**Phase A/B variant:** Use `createE2EPluginSource()`. During Phase B init, configure the project skill as plugin source (either via the Sources step during init, or by using the `P` hotkey to set all to plugin).

**Phase C (edit action):**
1. Navigate through build steps without changes
2. On Sources step: Arrow Down to "Customize" → Enter
3. In customize view, navigate to the plugin-source skill row
4. Arrow Left to "local" column → Space to select
5. Enter → Agents → Confirm

**Phase D (assertions):**
- Output contains "Switching" or "Uninstalling plugin:"
- Skill copied to `<projectDir>/.claude/skills/api-framework-hono/SKILL.md`
- Config updated: skill now has `source: "local"`

**skipIf:** `!claudeAvailable`

**Expected:** May FAIL. Mark `it.fails` if so.

---

### Test 6: Compiled agents contain only their assigned skills

**What it proves:** After edit, each compiled agent file contains only the skills assigned to it by the stack — no cross-contamination between agents.

**Phase C (edit action):** Navigate through edit without changes (include an unresolvable skill like `web-styling-tailwind` in the config to force the full edit flow with recompilation).

**Phase D (assertions):**
- Read `web-developer.md` content:
  - Contains `web-framework-react` (its assigned skill)
  - Contains `web-testing-vitest` (dynamic skill for web agent)
  - Does NOT contain `api-framework-hono` (belongs to api-developer)
- Read `api-developer.md` content:
  - Contains `api-framework-hono` (its assigned skill)
  - Does NOT contain `web-framework-react` (belongs to web-developer)

**skipIf:** None

**Expected:** May FAIL (cross-contamination bug found in plugin-scope-lifecycle). Mark `it.fails` if so.

---

### Test 7: Config split preserves source fields after edit

**What it proves:** When `writeScopedConfigs()` splits the unified config by scope, the `source` field on each skill is preserved correctly in both output files.

**Phase C (edit action):** Navigate through edit without changes (with unresolvable skill trigger).

**Phase D (assertions):**
- Read global config: skills have correct `source` values
- Read project config: skills have correct `source` values
- No source field lost, swapped, or defaulted during the split

**skipIf:** None

**Expected:** PASS

---

### Test 8: Mixed source coexistence — plugin and local skills in the same project

**What it proves:** After editing a plugin-mode project to switch *some* skills to local, both source types coexist correctly — local skills have files on disk, plugin skills remain registered, and the config reflects the mixed state.

**Phase A/B variant:** Use `createE2EPluginSource()`. Init globally with plugin mode (all skills as plugins). Init project with plugin mode too.

**Phase C (edit action):**
1. Navigate through build steps without changing selections
2. On Sources step: Arrow Down to "Customize skill sources" → Enter
3. In customize view, navigate to ONE project skill (e.g., `api-framework-hono`)
4. Arrow Left to "local" column → Space to select (switching this one skill to local)
5. Leave other skills as plugin (do NOT press `L` bulk hotkey)
6. Enter → Agents → Confirm

**Phase D (assertions):**
- Exit code 0
- Output contains migration message for the switched skill ("Switching" to local)
- `api-framework-hono` has `source: "local"` in config
- `api-framework-hono` files exist at `<projectDir>/.claude/skills/api-framework-hono/SKILL.md`
- Other skills (e.g., `web-framework-react`) still have `source: "<marketplace>"` in config
- Other skills do NOT have local files in `.claude/skills/` (they're still plugin-only)
- Settings.json still has `enabledPlugins` entries for the remaining plugin skills

**skipIf:** `!claudeAvailable`

**Expected:** May FAIL (per-skill migration may not handle mixed state correctly). Mark `it.fails` if so.

---

### Test 9: Compiled agents reference both plugin and local skills correctly

**What it proves:** When an agent's assigned skills come from mixed sources (some plugin, some local), the compiled agent markdown correctly references all of them — regardless of source mode.

**Phase A/B variant:** Use `createE2EPluginSource()`. Init with plugin mode. Then edit to switch ONE skill to local (creating mixed state, same as Test 8 Phase C).

**Alternative simpler approach:** If Test 8 is too complex to chain, set this up as a single init → edit → verify:
1. Init with plugin mode (all plugins)
2. Edit: switch `web-testing-vitest` to local (this is a dynamic skill for web-developer agent)
3. Verify web-developer.md agent:
   - Frontmatter `skills:` contains `web-framework-react` (still plugin, preloaded)
   - Body contains `web-testing-vitest` (now local, dynamic)
   - Both skill references are present despite different source modes
4. Verify api-developer.md agent:
   - Contains `api-framework-hono` (still plugin)
   - Does NOT contain web skills (no cross-contamination)

**Why this matters:** The agent compiler (`compileAgentForPlugin` in `stack-plugin-compiler.ts`) resolves skills from the source directory. If a skill was migrated to local (copied to `.claude/skills/`), the compiler must still find and include it. If it only looks in the plugin source, local skills would be missing from the compiled output.

**skipIf:** `!claudeAvailable`

**Expected:** May FAIL. Mark `it.fails` if so.

---

## 6. Open Questions (Must Resolve Before Implementation)

### Q1: Domain selection during init

The stack in `createE2ESource()` pre-selects all 3 domains (Web, API, Shared). For the dual-scope split to work:
- **Global init** should select only Web (+ Shared for methodology skills)
- **Project init** should select only API (+ Shared)

How do we deselect domains on the "Select domains to configure" step? What's the keystroke sequence? Are domains toggled with Space? In what order do they appear?

**Why it matters:** If both inits select all domains, every skill ends up in the global config. The project init needs to add only new (project-scoped) skills.

**Alternative:** If domain deselection is fragile, we could use a simpler approach — init globally with all domains, then the project init via "Create new project" starts fresh and adds project-specific skills. But we need to verify what "Create new project" actually does when a global config exists.

### Q2: GlobalConfigPrompt — "Create new project" behavior

When the user chooses "Create new project installation" in the GlobalConfigPrompt:
- Does it run a full fresh init wizard (ignoring the global config)?
- Or does it pre-populate with global items as locked?
- Does it automatically include global-scoped items in the project config?

Read `src/cli/commands/init.tsx` to understand the "create new project" path.

### Q3: Agents step focus with locked agents

When `web-developer` is locked on the agents step:
- Is it still shown in the list?
- Does focus start on it (but Space is a no-op)?
- Or does focus start on the first unlocked agent (`api-developer`)?
- How many Arrow Down presses to reach `api-developer` from the initial focus position?

Read `src/cli/components/wizard/step-agents.tsx` to confirm.

### Q4: Source grid row order and skill identification

In the Sources customize view, skills appear as rows. In what order?
- Same as build step (grouped by domain)?
- Alphabetical?
- Only project-scoped skills (since global are locked)?

How many rows appear? This determines Arrow Down count to reach a specific skill.

### Q5: Does "no changes" early exit apply when the only change is scope?

The edit command exits early at `edit.tsx:242-246` when no skill changes are detected. Does a scope-only change (via `S` hotkey) count as a "change"? Or does it trigger the early exit?

If scope changes don't trigger the full flow, Tests 2 and 3 would need the unresolvable skill trick.

### Q6: forkedFrom metadata requirement

The uninstall/edit flow requires `metadata.yaml` with `forkedFrom` data for skill removal logic. Do the skill directories created by init include this metadata? Or do we need to ensure the E2E source skills have it?

Check `e2e/helpers/create-e2e-source.ts` to verify.

---

## 7. File Organization

```
e2e/lifecycle/dual-scope-edit.e2e.test.ts        ← 7 tests (full lifecycle)
e2e/helpers/test-utils.ts                        ← initGlobal(), initProject() helpers (if reusable)
```

Describe structure:
```
describe("dual-scope edit lifecycle")
  beforeAll: create E2E source fixture

  describe("display and locking")
    Test 1: global items locked, project items editable

  describe("scope changes via S hotkey")
    Test 2: toggle skill scope
    Test 3: toggle agent scope

  describe.skipIf(!claudeAvailable)("source changes via Sources step")
    Test 4: local → plugin
    Test 5: plugin → local

  describe("agent content and config integrity")
    Test 6: compiled agents have correct skills
    Test 7: config split preserves sources

  describe.skipIf(!claudeAvailable)("mixed source coexistence")
    Test 8: plugin + local skills in same project
    Test 9: agent compilation from mixed-source skills
```

---

## 8. Parallelization

Each test creates its own temp dir (fake HOME + project inside it). Tests are fully isolated and can run in parallel within vitest's worker pool. The shared `beforeAll` fixture (`createE2ESource` / `createE2EPluginSource`) is created once per file.

| Test | Init phases | Edit action | Claude CLI? | Est. time |
|------|------------|-------------|-------------|-----------|
| 1 | 2 inits (~15s) | No changes | No | ~20s |
| 2 | 2 inits (~15s) | Scope toggle | No | ~20s |
| 3 | 2 inits (~15s) | Scope toggle | No | ~20s |
| 4 | 2 inits (~15s) | Source switch | Yes | ~25s |
| 5 | 2 inits (~15s) | Source switch | Yes | ~25s |
| 6 | 2 inits (~15s) | No changes (unresolvable trigger) | No | ~20s |
| 7 | 2 inits (~15s) | No changes (unresolvable trigger) | No | ~20s |
| 8 | 2 inits (~15s) | Per-skill source switch (mixed) | Yes | ~25s |
| 9 | 1 init (~10s) | Source switch + verify agent content | Yes | ~25s |

---

## 9. Relationship to Existing Tests

| Existing Test | What it covers | Gap this spec fills |
|---|---|---|
| `edit-agent-scope-routing.e2e.test.ts` | Agent scope routing with manual setup | Full lifecycle (init → edit), not manual config |
| `edit-skill-accumulation.e2e.test.ts` | Skill scope isolation with manual setup | Full lifecycle, mixed sources |
| `edit-wizard-plugin.e2e.test.ts` (P-EDIT-3/4) | Bulk mode migration (L/P hotkeys) | Per-skill source changes |
| `plugin-scope-lifecycle.e2e.test.ts` | Scope toggle during init | Scope toggle during edit (from established dual-scope state) |
| `cross-scope-lifecycle.e2e.test.ts` | Edit global from project via GlobalConfigPrompt | Create project + edit project (not edit global) |

This spec covers the combination that no existing test reaches: **established dual-scope state → edit from project → per-skill scope/source changes → verify agent content and config integrity**. Tests 8 and 9 specifically cover the **mixed source coexistence** scenario: plugin and local skills in the same project, with agents compiled from both.

---

## 10. Implementation Status

**File:** `e2e/lifecycle/dual-scope-edit.e2e.test.ts`

| Test | Status | Notes |
|------|--------|-------|
| 1: Locked display | `it.fails` | Scope indicators (G/P, [G]/[P]) not rendering in output |
| 2: Skill scope toggle | `it.fails` | Skill ends up in wrong config after S toggle |
| 3: Agent scope toggle | `it.fails` | Agent file routed to wrong directory |
| 4: Local → plugin | `it.fails` | Local files not removed after source switch |
| 5: Plugin → local | PASSING | — |
| 6: Agent content | `it.fails` | Skill cross-contamination between agents |
| 7: Config split | `it.fails` | Source fields lost during splitConfigByScope() |
| 8: Mixed coexistence | PASSING | — |
| 9: Mixed agent compile | `it.fails` | Empty preloadedSkills in plugin-mode compilation |

**Open questions resolved during implementation:**
- Q1: Domain deselection not needed — `initGlobal()` uses "a" (accept all), `initProject()` selects API domain specifically via GlobalConfigPrompt → "Create new project"
- Q2: "Create new project" runs a full fresh init wizard, ignoring global config
- Q3: Focus management on agents step — locked agents are shown but not interactive; focus starts on first unlocked
- Q4: Source grid shows only project-scoped skills (global locked)
- Q5: Scope changes via S hotkey DO trigger the full edit flow (no unresolvable skill trick needed)
- Q6: E2E source skills include forkedFrom metadata via createE2ESource()

**Bugs discovered:**
1. `skill-copier.ts:214-215` — uses `process.cwd()` instead of discovery dir for local skill path resolution
2. Source switch to plugin doesn't delete local skill files
3. Plugin-mode compilation produces empty preloadedSkills list
