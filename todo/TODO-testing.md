> **Test Audit (2026-02-18):** 2407 tests pass across 103 test files. T1: NOT YET IMPLEMENTED (eject.test.ts only has flag/argument validation and agent-partials tests against bare directories; no test calls installLocal() then eject skills). T2: NOT YET IMPLEMENTED (no test creates an installMode: plugin project then runs eject). T3: NOT YET IMPLEMENTED (edit.test.ts only tests flags and "no installation" error; no test checks domainSelections pre-population in the Zustand store). T4: NOT YET IMPLEMENTED (no test verifies domain filtering in edit mode). T5: EXISTS AND PASSES (uninstall.test.ts lines 389-541 has a full "selective skill removal (generatedByAgentsInc)" describe block covering: remove CLI skills, skip user skills, skip skills without metadata, mixed scenario, preserve .claude/ if user content remains, remove .claude/ if empty, remove compiled agents, multiple CLI skills, and dry-run preview of selective removal). T6: NOT YET IMPLEMENTED (no integration test loads consumer-defined stacks.yaml or skills-matrix.yaml; grep for "consumer stacks", "loadStacksFromSource", "loadSkillsMatrixFromSource" found zero matches in test files). Coverage table corrections: T5 row should be changed from ❌ to ✅ since surgical uninstall scope is fully tested. All other ✅ markers verified as accurate.

# Agents Inc. CLI - Testing

## Coverage Overview

| Command / Area                                 | Description                                       | Automated  | Manual |
| ---------------------------------------------- | ------------------------------------------------- | ---------- | ------ |
| `agentsinc init`                               | Wizard flow, flag parsing, already-init guard     | ✅         |        |
| `agentsinc edit` — flags                       | Flag parsing, no-installation error               | ✅         |        |
| `agentsinc edit` — wizard pre-selection        | Prior skills pre-checked when wizard reopens      | ❌ T3      |        |
| `agentsinc edit` — domain filtering            | Domains absent if no skills were picked from them | ❌ T4      |        |
| `agentsinc compile`                            | Recompile agents, dry-run, output flag            | ✅         |        |
| `agentsinc eject agent-partials`               | Copies partials, config guard, --force, --output  | ✅         |        |
| `agentsinc eject agent-partials` (initialized) | Eject with a real install already in place        | ❌ T1      |        |
| `agentsinc eject skills` — flags only          | Flag parsing against a bare project               | ✅ partial |        |
| `agentsinc eject skills` (initialized)         | Skills copied from a real initialized project     | ❌ T1      |        |
| `agentsinc eject all`                          | Runs both agent-partials + skills in one pass     | ✅ partial |        |
| `agentsinc eject` — invalid types              | `templates`, `agents`, `config` all rejected      | ✅         |        |
| `agentsinc eject` — plugin mode                | Eject from a plugin-mode project                  | ❌ T2      |        |
| `agentsinc diff`                               | Diff local skills against upstream source         | ✅         |        |
| `agentsinc doctor`                             | Project health and config diagnostics             | ✅         |        |
| `agentsinc info`                               | Show installed agents and skills                  | ✅         |        |
| `agentsinc list`                               | List available skills from configured source      | ✅         |        |
| `agentsinc outdated`                           | Report skills with newer upstream versions        | ✅         |        |
| `agentsinc search`                             | Search marketplace by name/tag/category           | ✅         |        |
| `agentsinc validate`                           | Schema and structure validation                   | ✅         |        |
| `agentsinc update`                             | Pull updated skills from source                   | ✅         |        |
| `agentsinc uninstall`                          | Flags, dry-run, local/plugin targeting, removal   | ✅         |        |
| `agentsinc uninstall` — surgical scope         | Only removes CLI-owned files, not user content    | ✅         |        |
| Consumer stacks.yaml and matrix override       | Custom stacks/matrix in project or marketplace    | ❌ T6      |        |
| `agentsinc new skill`                          | Scaffold a new skill with correct structure       | ✅         |        |
| `agentsinc new agent`                          | Scaffold a new agent                              | ✅         |        |
| `agentsinc import skill`                       | Import a skill from an external URL or repo       | ✅         |        |
| `agentsinc build stack`                        | Compile a stack into a standalone plugin          | ✅         |        |
| `agentsinc build plugins`                      | Build individual skills as plugins                | ✅         |        |
| `agentsinc build marketplace`                  | Generate marketplace.json from built plugins      | ✅         |        |
| `agentsinc version` / `version:show`           | Display current CLI/plugin version                | ✅         |        |
| `agentsinc version:bump`                       | Bump patch, minor, or major version               | ✅         |        |
| `agentsinc version:set`                        | Set an explicit version string                    | ✅         |        |
| `agentsinc config` / `config:show`             | Show resolved config with precedence layers       | ✅         |        |
| `agentsinc config:path`                        | Show where config files live                      | ✅         |        |
| `agentsinc config:get`                         | Get a single resolved config value                | ✅         |        |
| `agentsinc config:set-project`                 | Write a value to project-level config             | ✅         |        |
| `agentsinc config:unset-project`               | Remove a value from project-level config          | ✅         |        |
| Local mode install flow                        | Config, skills copy, agent compile via installer  | ✅         |        |
| Plugin mode install flow                       | `installMode: plugin` written to config           | ✅ partial |        |
| Init → Compile pipeline                        | Wizard result → install → compile end-to-end      | ✅         |        |
| Edit → Recompile pipeline                      | Skill edits reflected in recompile output         | ✅         |        |
| Source switching                               | Archive/restore local skills on source change     | ✅         |        |
| Config precedence                              | flag > env > project > default resolution order   | ✅         |        |

**Legend:** ✅ covered · ✅ partial · ❌ gap (see task ID) · Manual: fill in after testing

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
agentsinc eject templates    # Expected: error exit (invalid type)
agentsinc eject agents       # Expected: error exit (invalid type)
agentsinc eject config       # Expected: error exit (invalid type)
agentsinc eject              # Expected: error exit (type required)
agentsinc eject bad-value    # Expected: error exit (unknown type)
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

### 13. Version Commands

```bash
agentsinc version
agentsinc version:show

# Dry-run bumps (no files written)
agentsinc version:bump patch --dry-run
agentsinc version:bump minor --dry-run
agentsinc version:bump major --dry-run
agentsinc version:set 99.99.99 --dry-run
```

---

### 14. New Skill / New Agent / Import Skill

```bash
cd /tmp/cli-test-local   # initialized project

agentsinc new skill my-custom-skill
ls .claude-src/skills/my-custom-skill/
cat .claude-src/skills/my-custom-skill/SKILL.md

agentsinc new agent my-custom-agent

agentsinc import skill web-framework-react --source /path/to/source
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
| 11  | `eject templates`                              | Error exit (invalid type)                               |
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
| 27  | `version`                                      | Version number shown                                    |
| 28  | `search react`                                 | Results returned                                        |
