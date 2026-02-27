> **Test Audit (2026-02-19, updated):** 2420 tests pass across 103 test files. T1: IMPLEMENTED. T2: IMPLEMENTED. T3: IMPLEMENTED. T4: IMPLEMENTED. T5: IMPLEMENTED. T6: IMPLEMENTED. T10: NOT POSSIBLE — blocked on D-36 (global install feature). 3 it.todo placeholders in uninstall.test.ts.
>
> **Partial coverage notes:**
>
> - `eject all`: Only flag acceptance tested (eject.test.ts:248-271). No test verifies both partials AND skills produced in one pass.
> - `plugin mode install`: `installPluginConfig()` exercised as eject test setup but never directly tested. No test for `claude plugin install` invocation or `settings.json` enabledPlugins writing.
>
> **Small gaps from completed tasks (D-27/29/30/31/32/35):**
>
> - D-29: No test verifies metadata.yaml is _written_ with `$schema` — only that it can be stripped during reading.
> - D-30: No integration test passes non-empty `selectedAgents` through the full wizard→install→config pipeline.
> - D-32: No test asserts `metadataValidationSchema` rejects invalid categories or accepts valid ones.

> **TODO: Real CLI integration tests.** The current "integration" tests call internal functions (`installLocal()`, `compileAllAgents()`, etc.) directly — they never actually invoke the CLI binary. This means they test a completely different code path than what users run, and bugs slip through because the tests pass in a reality that doesn't match the real CLI. Need a proper integration test suite that spawns `node dist/index.js <command>` (or the built binary) as a child process, feeds it real flags/args, and asserts on stdout/stderr/exit codes/filesystem output. This is the only way to catch issues in the full command→parse→execute→output pipeline.

# Agents Inc. CLI - Testing

## Coverage Overview

All commands inherit base flags `--dry-run` and `--source` / `-s` from `BaseCommand` unless noted.

### Init & Edit

| Task | Command / Area                          | Description                                                                                                | Automated | Local | Plugin | Manual |
| ---- | --------------------------------------- | ---------------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc init`                        | Wizard flow (local/plugin mode selection, skill picking, agent selection), `--refresh`, already-init guard | ✅        | ✅    | ✅     | ✅     |
|      | `agentsinc edit` — flags                | `--refresh`, `--agent-source` flag parsing; error when no installation found                               | ✅        |       |        |        |
| T3   | `agentsinc edit` — wizard pre-selection | Prior skills pre-checked in Zustand store when wizard reopens                                              | ✅        |       |        |        |
| T4   | `agentsinc edit` — domain filtering     | Domains with zero prior selections are hidden from the wizard                                              | ✅        |       |        |        |

### Compile

| Task | Command / Area      | Description                                                                                        | Automated | Local | Plugin | Manual |
| ---- | ------------------- | -------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc compile` | Recompile agents from config; `--verbose` / `-v`, `--agent-source`, `--output` / `-o`, `--dry-run` | ✅        |       |        |        |

### Eject

| Task | Command / Area                                 | Description                                                                                      | Automated  | Local | Plugin | Manual |
| ---- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------ | ---------- | ----- | ------ | ------ |
|      | `agentsinc eject agent-partials`               | Copies agent partials to `.claude-src/agents/`; `--force` / `-f`, `--output` / `-o`, `--refresh` | ✅         |       |        |        |
|      | `agentsinc eject agent-partials` (initialized) | Eject with a real install already in place; config not overwritten                               | ✅         |       |        |        |
|      | `agentsinc eject skills` — flags only          | `--force`, `--output`, `--refresh` parsing against a bare project                                | ✅         |       |        |        |
| T1   | `agentsinc eject skills` (initialized)         | Skills copied from a real initialized project; content preserved                                 | ✅         | ✅    |        |        |
|      | `agentsinc eject all`                          | Runs both agent-partials + skills in one pass (no test verifies both outputs together)           | ✅ partial |       |        |        |
|      | `agentsinc eject` — invalid types              | `agents`, `config`, no arg, unknown value all rejected with error exit                           | ✅         |       |        |        |
|      | `agentsinc eject templates`                    | Copies Liquid templates to `.claude-src/agents/_templates/`                                      | ✅         |       |        |        |
| T2   | `agentsinc eject` — plugin mode                | Eject from a plugin-mode project; output goes to correct plugin directories                      | ✅         |       | ✅     |        |

### Diff, Doctor, Info, List

| Task | Command / Area     | Description                                                                                        | Automated | Local | Plugin | Manual |
| ---- | ------------------ | -------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc diff`   | Diff local forked skills vs upstream; optional `[skill]` arg, `--quiet` / `-q` (exit code only)    | ✅        |       |        |        |
|      | `agentsinc doctor` | Project health diagnostics; own `--source` / `-s` and `--verbose` / `-v` (not inherited from base) | ✅        |       |        |        |
|      | `agentsinc info`   | Show skill detail; required `<skill>` arg, `--preview` / `--no-preview` toggle                     | ✅        |       |        |        |
|      | `agentsinc list`   | List installed skills (alias `ls`); base flags only                                                | ✅        |       |        |        |

### Outdated, Search, Validate, Update

| Task | Command / Area       | Description                                                                                                         | Automated | Local | Plugin | Manual |
| ---- | -------------------- | ------------------------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc outdated` | Report skills with newer upstream versions; `--json` for machine-readable output                                    | ✅        |       |        |        |
|      | `agentsinc search`   | Search marketplace; optional `[query]` arg, `--interactive` / `-i` (multi-select), `--category` / `-c`, `--refresh` | ✅        |       |        |        |
|      | `agentsinc validate` | Schema and structure validation; optional `[path]` arg, `--verbose` / `-v`, `--all` / `-a`, `--plugins` / `-p`      | ✅        |       |        |        |
|      | `agentsinc update`   | Pull updated skills from source; optional `[skill]` arg, `--yes` / `-y` (skip confirm), `--no-recompile`            | ✅        |       |        |        |

### Uninstall

| Task | Command / Area                         | Description                                                                                              | Automated | Local | Plugin | Manual |
| ---- | -------------------------------------- | -------------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc uninstall`                  | `--yes` / `-y` (skip confirm), `--all` (also remove `.claude-src/`), `--dry-run`; local/plugin targeting | ✅        |       |        |        |
| T5   | `agentsinc uninstall` — surgical scope | Only CLI-owned agents/skills removed; user content preserved; warnings for unknown files                 | ✅        | ✅    |        |        |
| T7   | `agentsinc uninstall` — plugin mode    | Plugin references removed; user MCP servers, agents, skills untouched                                    | ✅        |       | ✅     |        |
| T8   | `agentsinc uninstall` — local mode     | CLI-copied skills + compiled agents removed; `.claude-src/` removed; user content intact                 | ✅        | ✅    |        |        |
| T9   | `agentsinc uninstall` — project scope  | Default (no targeting flag): all CLI artifacts removed; `.claude/` preserved if user content remains     | ✅        | ✅    |        |        |
| T10  | `agentsinc uninstall` — global         | Global CLI artifacts removed; user global content untouched (blocked on D-36: global install feature)    | ⏳ T10    |       |        |        |
| T11  | `agentsinc uninstall` — preservation   | Cross-cutting: `--dry-run` previews only; user MCP/agents/skills/settings/CLAUDE.md never removed        | ✅        | ✅    | ✅     |        |

### Scaffolding & Import

| Task | Command / Area           | Description                                                                                                                        | Automated | Local | Plugin | Manual |
| ---- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc new skill`    | Scaffold new skill; required `<name>` arg, `--author` / `-a`, `--category` / `-c` (default `local/custom`), `--force` / `-f`       | ✅        |       |        |        |
|      | `agentsinc new agent`    | Scaffold new agent; required `<name>` arg, `--purpose` / `-p`, `--refresh` / `-r`, `--non-interactive` / `-n`                      | ✅        |       |        |        |
|      | `agentsinc import skill` | Import from GitHub; required `<source>` arg, `--skill` / `-n`, `--all` / `-a`, `--list` / `-l`, `--subdir`, `--force`, `--refresh` | ✅        |       |        |        |

### Build

| Task | Command / Area                | Description                                                                                                                                   | Automated | Local | Plugin | Manual |
| ---- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc build stack`       | Build stack into plugin; `--stack` (ID), `--output-dir` / `-o`, `--agent-source`, `--refresh`, `--verbose` / `-v`                             | ✅        |       |        |        |
|      | `agentsinc build plugins`     | Build skills as plugins; `--skills-dir` / `-s`, `--agents-dir` / `-a`, `--output-dir` / `-o`, `--skill` (single), `--verbose` / `-v`          | ✅        |       |        |        |
|      | `agentsinc build marketplace` | Generate marketplace.json; `--plugins-dir` / `-p`, `--output` / `-o`, `--name`, `--version`, `--description`, `--owner-*`, `--verbose` / `-v` | ✅        |       |        |        |

### Config

| Task | Command / Area                     | Description                                                                                          | Automated | Local | Plugin | Manual |
| ---- | ---------------------------------- | ---------------------------------------------------------------------------------------------------- | --------- | ----- | ------ | ------ |
|      | `agentsinc config` / `config:show` | Show resolved config with precedence layers; base flags only                                         | ✅        |       |        |        |
|      | `agentsinc config:path`            | Show config file paths; base flags only                                                              | ✅        |       |        |        |
|      | `agentsinc config:get`             | Get resolved value; required `<key>` arg (`source`, `author`, `marketplace`, `agentsSource`)         | ✅        |       |        |        |
|      | `agentsinc config:set-project`     | Write to project config; required `<key>` + `<value>` args (`source`, `marketplace`, `agentsSource`) | ✅        |       |        |        |
|      | `agentsinc config:unset-project`   | Remove from project config; required `<key>` arg                                                     | ✅        |       |        |        |

### Integration Flows

| Task | Command / Area                           | Description                                                                                  | Automated  | Local | Plugin | Manual |
| ---- | ---------------------------------------- | -------------------------------------------------------------------------------------------- | ---------- | ----- | ------ | ------ |
|      | Local mode install flow                  | Config written, skills copied, agents compiled via `installLocal()`                          | ✅         | ✅    |        |        |
|      | Plugin mode install flow                 | `installMode: plugin` written to config (no test for `settings.json` enabledPlugins writing) | ✅ partial |       | ✅     |        |
|      | Init → Compile pipeline                  | Wizard result → install → compile end-to-end                                                 | ✅         | ✅    |        |        |
|      | Edit → Recompile pipeline                | Skill edits reflected in recompile output                                                    | ✅         |       |        |        |
|      | Source switching                         | Archive/restore local skills on source change                                                | ✅         |       |        |        |
|      | Config precedence                        | flag > env > project > default resolution order                                              | ✅         |       |        |        |
| T6   | Consumer stacks.yaml and matrix override | Custom stacks/matrix loaded, merged with built-ins, respected through install pipeline       | ✅         |       |        |        |
| T12  | Custom marketplace workflow              | `--source` flag, `outdated` detection, build marketplace→build plugins→update cycle          | ⏳ T12     |       |        |        |

**Legend:** ✅ covered · ✅ partial · ⏳ blocked (see task ID) · Manual: fill in after testing

---

## Automated Test Tasks

### T1: Eject Skills From an Initialized Project

Currently `eject skills` is only tested with flag validation against a bare directory. Add an integration test that:

1. Runs `installLocal()` to create a real `.claude-src/config.yaml` + copied skills
2. Runs `eject skills` against that initialized project
3. Verifies skill files are copied to the correct output location
4. Verifies skill content is preserved

**File:** `src/cli/lib/__tests__/commands/eject.test.ts`

---

### T2: Eject in Plugin Mode

No test covers ejection from a plugin-mode project. Add a test that:

1. Creates a project with `installMode: plugin` in config
2. Runs `eject agent-partials` and `eject skills`
3. Verifies output goes to the correct directories for plugin mode

**File:** `src/cli/lib/__tests__/commands/eject.test.ts`

---

### T3: Edit Wizard Pre-Selects Previously Chosen Skills

The edit command opens the wizard with the existing installation's skills — but there is no automated test verifying this pre-population. Add a test that:

1. Creates a project config with a known set of selected skills
2. Loads the wizard state via the same path `edit.tsx` uses
3. Asserts that `domainSelections` in the Zustand store matches the config skills
4. Asserts that skills not in the config are not pre-selected

**Files:** `src/cli/lib/__tests__/commands/edit.test.ts`, `src/cli/stores/wizard-store.ts`

---

### T4: Edit Wizard Hides Domains With No Prior Selections

When running `agentsinc edit`, domains that had zero skills selected during `init` should not appear. Add a test that:

1. Creates a project config with only `web` skills (no `api`, `cli`, etc.)
2. Loads the wizard in edit mode
3. Asserts that the `api` and `cli` domain steps are absent
4. Asserts that the `web` domain step is present

**Files:** `src/cli/lib/__tests__/commands/edit.test.ts`, wizard step-filtering logic

---

### T5: Uninstall Surgical Scope

Now that U-UNINSTALL-SCOPE is implemented, add tests that verify:

1. Only CLI-compiled agent `.md` files are removed from `.claude/agents/` — not the user's own agents
2. Only CLI-copied skill dirs are removed from `.claude/skills/` — not the user's own skills
3. `.claude-src/` is fully removed
4. `.claude/` itself is NOT removed if user content remains after cleanup
5. A warning is shown for unknown files found in `.claude/agents/` or `.claude/skills/`

**File:** `src/cli/lib/__tests__/commands/uninstall.test.ts`

---

### T6: Consumer-Defined Stacks and Matrix Files

Verify that `stacks.yaml` and `skills-matrix.yaml` defined in a consuming project or marketplace are loaded, merged with CLI built-ins, and behave correctly end-to-end. Currently only CLI built-in files from `config/` are tested.

**Stacks (consumer project):**

1. Create a test project with a custom `.claude-src/stacks.yaml` defining a new stack
2. Run `loadStacks()` (or `loadStackById()`) and assert the custom stack is returned
3. Assert CLI built-in stacks are still available alongside the custom one
4. Assert that a custom stack with the same ID as a built-in takes precedence (user stacks override CLI stacks)
5. Run `installLocal()` with the custom stack selected — assert the resulting `config.yaml` reflects the custom stack's agent-skill assignments

**Stacks (marketplace):**

1. Create a test source that contains a `stacks.yaml` alongside its skills
2. Run `loadSkillsMatrixFromSource()` pointed at that source — assert marketplace stacks are merged in
3. Assert CLI built-in stacks and marketplace stacks both appear in the wizard

**Skills matrix (consumer project / marketplace):**

1. Create a test source with a custom `skills-matrix.yaml` that adds a new skill category
2. Run `loadSkillsMatrixFromSource()` — assert the custom category and skills appear in the matrix
3. Assert that `exclusive`, `discourages`, and `recommends` fields from the custom matrix are respected during wizard validation
4. Assert that a custom skill's `preloaded` flag survives through `installLocal()` into `config.yaml`

**Files:**

- `src/cli/lib/__tests__/integration/` — integration test for the full pipeline
- `src/cli/lib/stacks/stacks-loader.ts` — stack loading and merging logic
- `src/cli/lib/loading/source-loader.ts` — matrix loading with source override
- `src/cli/lib/__tests__/fixtures/create-test-source.ts` — extend to support stacks.yaml and matrix fixtures

**Note:** Related to D-08 (deferred) which tracks full support for user-defined stacks in consumer projects. These tests should be written against the current partially-supported behaviour and updated as D-08 is implemented.

---

### T7: Uninstall — Plugin Mode

Test that uninstalling from a plugin-mode project correctly removes CLI plugin references.

1. Create a project with `installMode: plugin` in config
2. Add CLI-installed plugin references (as the CLI would during init)
3. Add pre-existing user content: a custom MCP server in `.claude/mcp.json`, a user-authored agent in `.claude/agents/`, a user-authored skill in `.claude/skills/`
4. Run `agentsinc uninstall --plugin --yes`
5. Verify CLI-installed plugin references are removed
6. Verify pre-existing MCP servers, user agents, and user skills are untouched
7. Verify `.claude-src/config.yaml` is removed or updated

**File:** `src/cli/lib/__tests__/commands/uninstall.test.ts`

---

### T8: Uninstall — Local Mode

Test that uninstalling from a local-mode project removes CLI-owned skills and agents.

1. Create a project with `installMode: local`, with CLI-installed skills and compiled agents
2. Add pre-existing user content alongside CLI content: user-authored agents in `.claude/agents/`, user-authored skills in `.claude/skills/`, custom MCP server config in `.claude/mcp.json`
3. Run `agentsinc uninstall --local --yes`
4. Verify CLI-copied skills in `.claude/skills/` are removed
5. Verify CLI-compiled agents in `.claude/agents/` are removed
6. Verify `.claude-src/` is removed
7. Verify user-authored agents, user-authored skills, and MCP server config remain intact

**File:** `src/cli/lib/__tests__/commands/uninstall.test.ts`

---

### T9: Uninstall — Project Scope (Default)

Test the default uninstall (no `--local` or `--plugin` flag) removes all CLI artifacts while preserving user content.

1. Initialize a project (local mode) with skills and agents
2. Add pre-existing user content (agents, skills, MCP servers)
3. Run `agentsinc uninstall --yes` (no targeting flag)
4. Verify all CLI artifacts are removed (`.claude-src/`, CLI skills, CLI agents)
5. Verify `.claude/` directory is preserved if user content remains
6. Verify `.claude/` directory is fully removed if no user content remains (separate sub-test)

**File:** `src/cli/lib/__tests__/commands/uninstall.test.ts`

---

### T10: Uninstall — Global

Test that global uninstall removes CLI global artifacts without affecting user global content.

1. Install globally with global skills/agents
2. Add pre-existing global MCP servers and user-authored global agents
3. Run `agentsinc uninstall --global --yes`
4. Verify CLI global artifacts are removed
5. Verify pre-existing global MCP servers and user-authored agents are untouched

**File:** `src/cli/lib/__tests__/commands/uninstall.test.ts`

---

### T11: Uninstall — Pre-Existing Content Preservation (Cross-Cutting)

Verify across all uninstall flavors that pre-existing user content is never removed. This is a dedicated test suite with parametrized cases.

**Content that must survive all uninstall operations:**

- `.claude/mcp.json` entries not added by CLI
- `.claude/agents/*.md` files not generated by CLI (no `generatedByAgentsInc` metadata)
- `.claude/skills/*/` directories not copied by CLI (no CLI metadata marker)
- `.claude/settings.json`
- `.claude/CLAUDE.md`
- Any other user-created files in `.claude/`

**Dry-run verification:**

- `--dry-run` shows what would be removed but removes nothing
- `--dry-run` output lists CLI artifacts only, not user content

**File:** `src/cli/lib/__tests__/commands/uninstall.test.ts`

---

### T12: Custom Marketplace End-to-End Workflow

Test the full custom marketplace lifecycle: using `--source` to point at a custom marketplace, checking for outdated skills, and the change→build→update cycle.

**Scenario 1: `--source` flag with custom marketplace**

1. Create a fixture marketplace via `createTestSource()` with versioned skills and a `marketplace.json`
2. Run `agentsinc init --source /path/to/fixture-marketplace` (or call the internal init flow with the source flag)
3. Verify the wizard loads skills from the custom source, not the default
4. Verify the compiled output references skills from the custom source
5. Verify `.claude-src/config.yaml` records the custom source path

**Scenario 2: `outdated` detects stale skills**

1. Create a fixture marketplace with `marketplace.json` at version 1.0.0
2. Install skills from that marketplace into a consuming project
3. Update the fixture marketplace: modify a skill, run `build marketplace` + `build plugins` to produce version 1.1.0
4. Run `agentsinc outdated` in the consuming project
5. Verify it reports the skill as outdated with version diff (1.0.0 → 1.1.0)

**Scenario 3: Full change→build→update cycle**

1. Create a fixture marketplace, install into a consuming project
2. Make a change in the marketplace (modify skill content or add a new skill)
3. Run `agentsinc build marketplace` — verify `marketplace.json` is regenerated with updated metadata
4. Run `agentsinc build plugins` — verify plugin versions are bumped
5. Run `agentsinc edit --refresh` (or `update`) in the consuming project
6. Verify the consuming project picks up the newer skill version
7. Verify recompiled agents reflect the updated skill content

**Test setup:**

- Use `createTestSource()` for the fixture marketplace
- Use a temp directory as the consuming project
- Tests must be self-contained — no dependency on the real skills repo at `/home/vince/dev/skills`

**Files:**

- `src/cli/lib/__tests__/integration/custom-marketplace-workflow.integration.test.ts` (new)
- Leverages `src/cli/lib/__tests__/fixtures/create-test-source.ts` for fixture setup
- Exercises: `source-loader.ts`, `build marketplace`, `build plugins`, `outdated`, `update`/`edit --refresh`

---

## Manual Testing Procedures

```bash
# Alias for convenience — adjust path if installed globally
alias agentsinc="node /Users/vincentbollaert/dev/personal/cli/dist/index.js"
```

---

### 1. Run the Full Automated Suite

```bash
cd /Users/vincentbollaert/dev/personal/cli
npm test
# Expected: all 2300+ tests pass

# Run a single file
npm test -- src/cli/lib/__tests__/commands/eject.test.ts
npm test -- src/cli/lib/__tests__/commands/edit.test.ts
npm test -- src/cli/lib/__tests__/integration/init-flow.integration.test.ts
```

---

### 2. Local Mode — Init → Compile

```bash
mkdir -p /tmp/cli-test-local && cd /tmp/cli-test-local

agentsinc init
# Walk the wizard: choose Local mode, select a mix of web + API skills
# After completion verify:
cat .claude-src/config.yaml          # installMode: local, skills listed
ls .claude/skills/                   # copied skill directories
ls .claude/agents/                   # compiled .md agent files

# Re-run compile from existing config
agentsinc compile

# Dry-run (no files written)
agentsinc compile --dry-run

# Compile to custom output
agentsinc compile --output /tmp/test-agents-output
ls /tmp/test-agents-output
```

---

### 3. Local Mode — Init Already Initialized

```bash
cd /tmp/cli-test-local   # project from step 2

agentsinc init
# Expected: warns "already initialized", suggests agentsinc edit, exits cleanly (no error code)
```

---

### 4. Plugin Mode — Init → Compile

```bash
mkdir -p /tmp/cli-test-plugin && cd /tmp/cli-test-plugin

agentsinc init
# Walk the wizard: choose Plugin mode, select skills
cat .claude-src/config.yaml    # installMode: plugin

agentsinc compile
```

---

### 5. Edit — Same Skills and Domains Preserved

```bash
cd /tmp/cli-test-local   # initialized in step 2 with web + API skills

# Note which skills and domains are in the config
cat .claude-src/config.yaml

agentsinc edit
# VERIFY manually:
# → Skills you selected in step 2 are pre-checked in the builder
# → If only web skills were selected, the API domain step should NOT appear
# → Saving any changes and re-running edit should reflect those changes

# Edit with source refresh
agentsinc edit --refresh
```

---

### 6. Edit — Domain Filtering (Web Only)

```bash
mkdir -p /tmp/cli-test-web-only && cd /tmp/cli-test-web-only

agentsinc init
# Walk the wizard: select ONLY web skills (skip API, CLI, etc.)

agentsinc edit
# VERIFY: only the web domain step is shown — API, CLI, mobile steps are absent
```

---

### 7. Eject — Agent Partials (Templates Level)

```bash
mkdir -p /tmp/cli-test-eject && cd /tmp/cli-test-eject

# Basic eject
agentsinc eject agent-partials
ls .claude-src/agents/         # should contain partial files
cat .claude-src/config.yaml    # should be created with installMode: local

# Verify existing config is NOT overwritten
echo "name: my-project" > .claude-src/config.yaml
agentsinc eject agent-partials
cat .claude-src/config.yaml    # should still say "name: my-project"

# Custom output directory
agentsinc eject agent-partials --output /tmp/custom-partials
ls /tmp/custom-partials

# Force overwrite
agentsinc eject agent-partials --force

# Second run without --force should warn but not crash
agentsinc eject agent-partials
```

---

### 8. Eject — Invalid Types Rejected

```bash
agentsinc eject agents       # Expected: error exit (invalid type)
agentsinc eject config       # Expected: error exit (invalid type)
agentsinc eject              # Expected: error exit (type required)
agentsinc eject bad-value    # Expected: error exit (unknown type)
```

### 8b. Eject Templates

```bash
agentsinc eject templates    # Expected: copies templates to .claude-src/agents/_templates/
```

---

### 9. Eject — Skills and All

```bash
cd /tmp/cli-test-eject

agentsinc eject skills
# Expected: copies skill files from configured source

agentsinc eject skills --output /tmp/ejected-skills
ls /tmp/ejected-skills

agentsinc eject all
# Expected: runs agent-partials + skills in one go
```

---

### 10. Uninstall

```bash
mkdir -p /tmp/cli-test-uninstall && cd /tmp/cli-test-uninstall
agentsinc init   # complete wizard

# Dry-run preview — nothing removed
agentsinc uninstall --dry-run
ls .claude .claude-src   # both should still exist

# Actual uninstall
agentsinc uninstall --yes
ls .claude 2>/dev/null || echo "✓ .claude removed"
ls .claude-src 2>/dev/null || echo "✓ .claude-src removed"

# --- Re-init and test targeting ---
agentsinc init

# Local only
agentsinc uninstall --yes --local
ls .claude-src 2>/dev/null || echo "✓ .claude-src removed"

# Plugin only (no-op if not in plugin mode)
agentsinc uninstall --yes --plugin
```

---

### 11. Config Commands

```bash
mkdir -p /tmp/cli-test-config && cd /tmp/cli-test-config

agentsinc config              # overview
agentsinc config:path         # shows .claude-src/config.yaml path
agentsinc config:show         # all layers with precedence

# Set and verify
agentsinc config:set-project source github:my-org/my-skills
agentsinc config:get source                          # → github:my-org/my-skills

# Env var overrides project config
CC_SOURCE=/env/override agentsinc config:get source  # → /env/override

# Valid keys
agentsinc config:get marketplace
agentsinc config:get agents_source
agentsinc config:get author

# Invalid key → exit code 2
agentsinc config:get invalid-key
echo "Exit: $?"   # should be 2

# Unset
agentsinc config:unset-project source
agentsinc config:get source    # falls back to default
```

---

### 12. Info, Doctor, Diff, Outdated, Validate

```bash
cd /tmp/cli-test-local   # initialized project from step 2

agentsinc info           # installed agents + skills
agentsinc doctor         # project health
agentsinc diff           # local vs upstream diff
agentsinc outdated       # skills with available updates
agentsinc validate       # schema + structure validation
agentsinc search react   # marketplace search results
```

---

### 13. New Skill / New Agent / Import Skill

```bash
cd /tmp/cli-test-local   # initialized project

agentsinc new skill my-custom-skill
ls .claude-src/skills/my-custom-skill/
cat .claude-src/skills/my-custom-skill/SKILL.md

agentsinc new agent my-custom-agent

agentsinc import skill web-framework-react --source /path/to/source
```

---

### 14. Custom Marketplace Workflow

```bash
# --- Setup: use the real custom marketplace at /home/vince/dev/skills ---

# Init with custom source
mkdir -p /tmp/cli-test-marketplace && cd /tmp/cli-test-marketplace
agentsinc init --source /home/vince/dev/skills
cat .claude-src/config.yaml   # source should point to /home/vince/dev/skills

# Check outdated
agentsinc outdated
# Expected: lists any skills with newer versions in source

# --- Change→Build→Update cycle ---
# 1. Make a change in the marketplace
cd /home/vince/dev/skills
# Edit any skill's SKILL.md (add a comment or trivial change)

# 2. Build marketplace + plugins
agentsinc build plugins --skills-dir skills --agents-dir agents --output-dir plugins
agentsinc build marketplace --plugins-dir plugins --output marketplace.json

# 3. Update the consuming project
cd /tmp/cli-test-marketplace
agentsinc outdated              # should show the changed skill as outdated
agentsinc edit --refresh        # should pick up the newer version
agentsinc outdated              # should show no outdated skills
```

---

### Quick Pass Checklist

| #   | Scenario                                       | Expected                                                |
| --- | ---------------------------------------------- | ------------------------------------------------------- |
| 1   | `npm test`                                     | All 2300+ tests pass                                    |
| 2   | `init` local mode                              | `installMode: local`, skills + agents written           |
| 3   | `init` plugin mode                             | `installMode: plugin`                                   |
| 4   | `init` already initialized                     | Warns, suggests edit, no error exit                     |
| 5   | `edit` after local init (web + API)            | Both domains shown, prior skills pre-checked            |
| 6   | `edit` after web-only init                     | API domain step absent                                  |
| 7   | `compile`                                      | Agents compiled without errors                          |
| 8   | `compile --dry-run`                            | No files written                                        |
| 9   | `eject agent-partials`                         | `.claude-src/agents/` created; config created if absent |
| 10  | `eject agent-partials` twice without `--force` | Warns, does not crash or overwrite                      |
| 11  | `eject templates`                              | Templates copied to `.claude-src/agents/_templates/`    |
| 12  | `eject skills`                                 | Skill files copied from source                          |
| 13  | `eject all`                                    | Runs both agent-partials + skills                       |
| 14  | `uninstall --dry-run`                          | Shows preview, removes nothing                          |
| 15  | `uninstall --yes`                              | Removes `.claude/` and `.claude-src/`                   |
| 16  | `uninstall --yes --local`                      | Removes local dirs only                                 |
| 17  | `uninstall --yes --plugin`                     | Removes plugin only                                     |
| 18  | `config:get source`                            | Returns resolved value                                  |
| 19  | `CC_SOURCE=x config:get source`                | Env var wins                                            |
| 20  | `config:set-project source val`                | Written to `.claude-src/config.yaml`                    |
| 21  | `config:get invalid-key`                       | Exit code 2                                             |
| 22  | `doctor`                                       | Health report shown                                     |
| 23  | `diff`                                         | Diff vs upstream shown                                  |
| 24  | `outdated`                                     | Outdated skills listed                                  |
| 25  | `validate`                                     | Validation report shown                                 |
| 26  | `info`                                         | Installed agents + skills shown                         |
| 28  | `search react`                                 | Results returned                                        |
| 29  | `init` with specific agents selected           | `config.yaml` agents list matches wizard selection      |
