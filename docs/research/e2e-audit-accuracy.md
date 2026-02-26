# E2E Testing Strategy Document: Accuracy Audit

**Audited document:** `docs/research/e2e-testing-strategy.md`
**Audit date:** 2026-02-25
**Audited against:** actual codebase at commit `3b58b97`

---

## 1. Codebase Statistics Claims

### Claim: "~2400 tests across 248 files"

- **Reality:** 2568 test cases (`it()` / `test()` calls) across **104** test files. The CLAUDE.md file itself references "2309+ tests", which is also lower than the current count.
- **Verdict:** INACCURATE. The test count (~2400 vs 2568) is in the ballpark but low. The file count (248 vs 104) is **off by 2.4x** -- a significant overstatement. The document may be confusing test files with total source files, or counting something other than `*.test.ts` / `*.test.tsx` files.

### Claim: "280+ mocked callbacks in step-build.test.tsx"

- **Reality:** `step-build.test.tsx` is 714 lines long with **11** `vi.fn()` calls, **7** `toHaveBeenCalled` assertions, and **28** total lines containing any callback-related pattern (vi.fn, onContinue, onToggle, etc.). There are **41** individual test cases.
- **Verdict:** INACCURATE. "280+" is severely inflated -- the actual count of mock callbacks is 11, and even the broadest definition of "callback-related lines" yields 28. This number appears fabricated.

### Claim: "95+ mock assertions in skill-fetcher.test.ts"

- **Reality:** `skill-fetcher.test.ts` is 263 lines with **13** test cases, **23** `expect` assertions total, **7** `toHaveBeenCalled` assertions, and **48** lines containing any "mock" pattern (including variable definitions, imports, `vi.mock()` declarations, `mockReturnValue` calls, etc.).
- **Verdict:** INACCURATE. Even counting every line with the word "mock" only yields 48, roughly half of the claimed 95+. The actual mock _assertion_ count is 7.

### Claim: "Zero tests spawn the actual CLI binary"

- **Reality:** All command tests use `runCliCommand()` from `helpers.ts`, which calls oclif's in-process `run()` function. It intercepts `process.stdout.write` and `console.log` rather than spawning a subprocess. No test file imports `child_process.spawn` to execute `./bin/dev` or the CLI binary. A few test files import `child_process` for mocking purposes (e.g., `diff.test.ts`, `outdated.test.ts`, `update.test.ts`) but these mock `execSync`/`spawn` rather than actually spawning.
- **Verdict:** ACCURATE. No test actually spawns the CLI binary as a subprocess.

---

## 2. Command Names

### Claim: The doc references `cc init`, `cc edit`, `cc compile`, `cc validate`, `cc eject`, `cc uninstall`, `cc new`

- **Reality (actual commands):**
  - **Top-level:** `compile`, `diff`, `doctor`, `edit`, `eject`, `info`, `init`, `list`, `outdated`, `search`, `uninstall`, `update`, `validate`
  - **Subcommands:** `build/{marketplace,plugins,stack}`, `config/{get,index,path,set-project,show,unset-project}`, `import/skill`, `new/{agent,marketplace,skill}`
- **Verdict:**
  - `cc init` -- **ACCURATE** (exists)
  - `cc edit` -- **ACCURATE** (exists)
  - `cc compile` -- **ACCURATE** (exists)
  - `cc validate` -- **ACCURATE** (exists)
  - `cc eject` -- **ACCURATE** (exists)
  - `cc uninstall` -- **ACCURATE** (exists)
  - `cc new` -- **INACCURATE as used**. `new` exists only as a subcommand group (`new agent`, `new skill`, `new marketplace`). There is NO `cc new` command for project creation. The document uses `["new"]` as the wizard command argument in code examples (lines 93, 342) but the actual wizard is `cc init`. The example `pty.spawn("./bin/dev", ["new"], ...)` would NOT launch the setup wizard.

### Missing commands not mentioned:

- `cc diff`, `cc doctor`, `cc info`, `cc list`, `cc outdated`, `cc search`, `cc update`, `cc build`, `cc config`, `cc import` -- none are discussed. The `validate` Phase 2 plan mentions `validate` but not these others. While not every command needs E2E testing, the omission is notable for completeness.
- **Verdict:** The document covers only the core user-facing commands, which is reasonable for a strategy doc. However, missing `cc search` and `cc update` is notable since both are interactive commands that would benefit from E2E testing.

---

## 3. File Paths and Structure

### Claim: `.claude-src/config.yaml` for project config

- **Reality:** `CLAUDE_SRC_DIR = ".claude-src"` in consts.ts. Config is saved to `.claude-src/config.yaml`. Confirmed in init.tsx, eject.ts, and configuration code.
- **Verdict:** ACCURATE.

### Claim: `.claude/skills/` for local skills

- **Reality:** `LOCAL_SKILLS_PATH = ".claude/skills"` in consts.ts. Confirmed.
- **Verdict:** ACCURATE.

### Claim: `.claude/plugins/manifest.json` for plugin manifest

- **Reality:** There is NO `manifest.json` at `.claude/plugins/`. The actual structure is:
  - Plugins directory: `.claude/plugins/` (from `getProjectPluginsDir()`)
  - Default plugin directory: `.claude/plugins/agents-inc/` (from `DEFAULT_PLUGIN_NAME`)
  - Plugin manifest: `.claude-plugin/plugin.json` (from `PLUGIN_MANIFEST_DIR` + `PLUGIN_MANIFEST_FILE`)
  - So the actual manifest path is `.claude/plugins/agents-inc/.claude-plugin/plugin.json`
- **Verdict:** INACCURATE. The document fabricates a `manifest.json` path that does not exist. The actual manifest is `plugin.json` inside a `.claude-plugin/` subdirectory of each plugin.

### Claim: `.claude/agents/` for compiled agents

- **Reality:** Agents are compiled to `{outputDir}/agents/` where `outputDir` depends on install mode. For plugin mode, this is inside the plugin directory. For local mode, agents are compiled to `.claude/agents/` (confirmed in init.tsx line 278: `"Compiled X agents to .claude/agents/"`).
- **Verdict:** PARTIALLY ACCURATE. Correct for local mode, but for plugin mode agents are inside the plugin directory, not at `.claude/agents/`.

### Claim: `.claude/_archived/` for archived skills during source switch

- **Reality:** `ARCHIVED_SKILLS_DIR_NAME = "_archived"` in consts.ts. The archive path is `.claude/skills/_archived/{skill-id}/` (from source-switcher.ts and its tests: `"/project/.claude/skills/_archived/web-framework-react"`).
- **Verdict:** INACCURATE. The doc shows `.claude/_archived/` but the actual path is `.claude/skills/_archived/`. The `_archived` directory is inside the `skills` directory, not directly under `.claude/`.

### Claim (example test code): `.claude/config.yaml`

- **Reality:** Line 366 uses `path.join(tmpDir, ".claude/config.yaml")` but the actual config path is `.claude-src/config.yaml`. The file system assertions section (line 663) correctly shows `.claude-src/config.yaml`.
- **Verdict:** INACCURATE in example code (line 366). The example test would read from the wrong path.

---

## 4. User Journey Text Signals

### Claim: "Loading marketplace skills..."

- **Reality:** The actual messages are:
  - `"Loading skills..."` (from `STATUS_MESSAGES.LOADING_SKILLS` in messages.ts)
  - `"Loading marketplace source..."` (from `STATUS_MESSAGES.LOADING_MARKETPLACE_SOURCE` in messages.ts)
  - The exact string "Loading marketplace skills..." does NOT exist anywhere in the codebase.
- **Verdict:** INACCURATE. The doc conflates two separate messages into one that doesn't exist.

### Claim: "Loaded X skills (label)"

- **Reality:** The actual text is `"✓ Loaded ${count} skills (${sourceInfo})\n"` -- note the leading checkmark character "✓".
- **Verdict:** PARTIALLY ACCURATE. The format is correct but missing the "✓" prefix. A `waitForText("Loaded")` or `includes("Loaded")` assertion would still work, so this is minor.

### Claim: "Choose a stack"

- **Reality:** `stack-selection.tsx` line 72: `<ViewTitle>Choose a stack</ViewTitle>`. Confirmed in tests.
- **Verdict:** ACCURATE.

### Claim: "Edit Plugin Skills"

- **Reality:** `edit.tsx` line 74: `this.log(`Edit ${modeLabel} Skills\n`)` where `modeLabel` is "Plugin" or "Local". "Edit Plugin Skills" is correct for plugin mode.
- **Verdict:** ACCURATE.

### Claim: "Current plugin has X skills"

- **Reality:** `edit.tsx` line 107: `this.log(`✓ Current plugin has ${currentSkillIds.length} skills\n`)`. Note the "✓" prefix not mentioned in the doc.
- **Verdict:** PARTIALLY ACCURATE. Again missing the "✓" prefix, but the core text is correct.

### Claim: "The following will be removed:" (uninstall)

- **Reality:** `uninstall.tsx` line 116: `<Text bold>The following will be removed:</Text>` and line 251: `this.log("The following will be removed:")`.
- **Verdict:** ACCURATE.

### Claim: "Are you sure? (y/n)" (uninstall)

- **Reality:** The actual text is `"Are you sure you want to uninstall?"` (line 143), rendered via the `Confirm` component which adds "(Y/n)" formatting.
- **Verdict:** PARTIALLY ACCURATE. The "(y/n)" part comes from the Confirm component, but the question text is "Are you sure you want to uninstall?" not "Are you sure?".

### Claim: "Start from scratch"

- **Reality:** `stack-selection.tsx` line 10: `const SCRATCH_LABEL = "Start from scratch"`. Confirmed.
- **Verdict:** ACCURATE.

### Claim: "Select domains" / "Select domains to configure"

- **Reality:** `domain-selection.tsx` line 51: `title="Select domains to configure"`. Tests check for "Select domains" as a substring.
- **Verdict:** ACCURATE.

### Claim: "Customize your [Domain] stack"

- **Reality:** `step-build.tsx` line 120: `` `Customize your ${getDomainDisplayName(activeDomain)} stack` ``. Confirmed in tests (e.g., "Customize your Web stack").
- **Verdict:** ACCURATE.

### Claim: "Customize skill sources"

- **Reality:** `step-sources.tsx` line 109: `<ViewTitle>Customize skill sources</ViewTitle>`.
- **Verdict:** ACCURATE.

### Claim: "Install mode: Plugin" / "Install mode: Local"

- **Reality:** `init.tsx` line 155: `"Install mode: ${result.installMode === "plugin" ? "Plugin (native install)" : "Local (copy to .claude/skills/)"}"`. The actual strings include parenthetical descriptions not mentioned in the doc.
- **Verdict:** PARTIALLY ACCURATE. The base text matches but the actual output includes extra detail: "Plugin (native install)" and "Local (copy to .claude/skills/)".

### Claim: "Installation complete"

- **Reality:** No exact match for "Installation complete" found in the codebase. The init command logs various success messages like "Compiled X agents to .claude/agents/" and "Copied X skills to .claude/skills/".
- **Verdict:** CANNOT VERIFY. The exact string "Installation complete" does not appear in the codebase. The actual success signals differ.

---

## 5. Code Patterns (Function Names)

### Claim: `loadSkillsMatrixFromSource()`

- **Reality:** Exists in `src/cli/lib/loading/source-loader.ts`, exported and used in 14 files including `init.tsx`, `edit.tsx`, `eject.ts`.
- **Verdict:** ACCURATE.

### Claim: `selectStack()`

- **Reality:** Exists as a Zustand store action on `useWizardStore`: `selectStack: (stackId) => set({ selectedStackId: stackId })`. It's a store method, not a standalone function.
- **Verdict:** ACCURATE (it exists as a store action, which the doc's usage context implies).

### Claim: `populateFromSkillIds()`

- **Reality:** Exists as a Zustand store action on `useWizardStore`. Used in `use-wizard-initialization.ts`, `stack-selection.tsx`, and tested in `edit.test.ts`.
- **Verdict:** ACCURATE.

### Claim: `installLocal()`

- **Reality:** Exists in `src/cli/lib/installation/local-installer.ts`, exported via `index.ts`. Used in `init.tsx` and numerous test files.
- **Verdict:** ACCURATE.

### Claim: `compileAllAgents()`

- **Reality:** Exists in `src/cli/lib/compiler.ts` and tested in `compiler.test.ts`.
- **Verdict:** ACCURATE.

---

## 6. Architecture Claims

### Claim: "Ink checks `stdin.isTTY === true` to enable raw mode"

- **Reality:** Confirmed in `node_modules/ink/build/components/App.js` line 35: `return this.props.stdin.isTTY;` inside `isRawModeSupported()`. This value is passed to the `StdinContext` and checked before `setRawMode()` is called.
- **Verdict:** ACCURATE.

### Claim: "`child_process.spawn()` creates pipes, not TTYs -- `stdin.isTTY` is `undefined`"

- **Reality:** Verified empirically: `spawn('echo', ['hi'], { stdio: 'pipe' })` produces `stdin.isTTY === undefined`.
- **Verdict:** ACCURATE.

### Claim: "Raw mode is required for `useInput()`, `useFocus()`, and all interactive hooks"

- **Reality:** `use-input.js` calls `setRawMode(true)` on mount. `use-focus.js` calls `setRawMode(true)` when focus is acquired. Without raw mode, keyboard input events won't fire.
- **Verdict:** ACCURATE.

---

## 7. File System Assertions Guide

### After `init` (Local Mode) -- Claim

```
project/
  .claude-src/config.yaml
  .claude/skills/{skill-id}/SKILL.md + metadata.yaml
  .claude/agents/{agent-name}.md
```

- **Reality:** Config is at `.claude-src/config.yaml` (correct). Skills are at `.claude/skills/{id}/` (correct). Agents at `.claude/agents/` (correct for local mode). The metadata.yaml "injected forked_from field" claim is correct per `skill-copier.ts` and `skill-metadata.ts`.
- **Verdict:** ACCURATE for local mode.

### After `init` (Plugin Mode) -- Claim

```
project/
  .claude-src/config.yaml
  .claude/plugins/manifest.json
  .claude/agents/{agent-name}.md
```

- **Reality:** Config path correct. But `.claude/plugins/manifest.json` does NOT exist. The actual structure is `.claude/plugins/agents-inc/.claude-plugin/plugin.json`. Also, agents in plugin mode are inside the plugin directory (`.claude/plugins/agents-inc/agents/`), NOT at `.claude/agents/`.
- **Verdict:** INACCURATE. Both the manifest path and agents path are wrong for plugin mode.

### After `edit` (Source Switch) -- Claim

```
project/
  .claude/_archived/{skill-id}/
  .claude/skills/{skill-id}/
  .claude/agents/
```

- **Reality:** The archive path is `.claude/skills/_archived/{skill-id}/`, NOT `.claude/_archived/{skill-id}/`. The `_archived` directory lives inside the `skills` directory.
- **Verdict:** INACCURATE. The archive path is wrong.

### After `uninstall --all` -- Claim

```
project/
  .claude/skills/ (user-created preserved)
  (agents/ removed)
  (.claude-src/ removed)
```

- **Reality:** Confirmed in uninstall.tsx: skills with `forked_from` matching configured sources are removed; skills without `forked_from` are preserved. Agents directory is removed if config exists. `.claude-src/` removed with `--all`. `.claude/` removed only if empty.
- **Verdict:** ACCURATE. The behavior description matches the code.

### After `compile` -- Claim

```
project/
  .claude/agents/{agent-name}.md
```

- **Reality:** The compile command (`compile.ts`) uses `recompileAgents()` which writes to the agents directory determined by the installation mode. For plugin mode this is inside the plugin directory, for local mode it would be `.claude/agents/`. The doc's simplified view is only correct for local/custom output mode.
- **Verdict:** PARTIALLY ACCURATE. Only correct for local mode or `--output` flag.

### After `eject` -- Claim

```
project/
  .claude/agents/_templates/
  .claude/skills/
  (config created if missing)
```

- **Reality:** Eject's default output base is `CLAUDE_SRC_DIR` (`.claude-src`), NOT `.claude`. Templates eject to `.claude-src/agents/_templates/` (line 280). Skills eject to `.claude/skills/` (using `LOCAL_SKILLS_PATH`). Config is created at `.claude-src/config.yaml` if missing.
- **Verdict:** INACCURATE. The templates path is wrong -- they go to `.claude-src/agents/_templates/`, not `.claude/agents/_templates/`.

---

## Summary Table

| #   | Claim                                                                                        | Verdict            | Severity                                                                  |
| --- | -------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------- |
| 1   | ~2400 tests across 248 files                                                                 | INACCURATE         | Medium -- file count is 2.4x inflated (104 actual)                        |
| 2   | 280+ mocked callbacks in step-build.test.tsx                                                 | INACCURATE         | High -- actual count is 11 vi.fn() calls, not 280+                        |
| 3   | 95+ mock assertions in skill-fetcher.test.ts                                                 | INACCURATE         | High -- actual count is 7 mock assertions, not 95+                        |
| 4   | Zero tests spawn the CLI binary                                                              | ACCURATE           | --                                                                        |
| 5   | `cc new` as wizard command                                                                   | INACCURATE         | High -- wizard is `cc init`, `new` is subcommands only                    |
| 6   | `.claude/plugins/manifest.json`                                                              | INACCURATE         | High -- actual is `.claude/plugins/agents-inc/.claude-plugin/plugin.json` |
| 7   | `.claude/_archived/`                                                                         | INACCURATE         | Medium -- actual is `.claude/skills/_archived/`                           |
| 8   | "Loading marketplace skills..."                                                              | INACCURATE         | Low -- actual messages are different                                      |
| 9   | "Installation complete"                                                                      | CANNOT VERIFY      | Medium -- string not found in codebase                                    |
| 10  | `.claude/config.yaml` in example code                                                        | INACCURATE         | Medium -- should be `.claude-src/config.yaml`                             |
| 11  | Eject creates `.claude/agents/_templates/`                                                   | INACCURATE         | Medium -- actual is `.claude-src/agents/_templates/`                      |
| 12  | Plugin mode agents at `.claude/agents/`                                                      | INACCURATE         | Medium -- agents are inside plugin directory                              |
| 13  | "Are you sure? (y/n)"                                                                        | PARTIALLY ACCURATE | Low -- actual is "Are you sure you want to uninstall?"                    |
| 14  | Function names (5 checked)                                                                   | ACCURATE           | --                                                                        |
| 15  | Ink TTY/raw mode architecture                                                                | ACCURATE           | --                                                                        |
| 16  | child_process.spawn pipe behavior                                                            | ACCURATE           | --                                                                        |
| 17  | "Choose a stack" text signal                                                                 | ACCURATE           | --                                                                        |
| 18  | "Edit Plugin Skills" text signal                                                             | ACCURATE           | --                                                                        |
| 19  | "Start from scratch" text signal                                                             | ACCURATE           | --                                                                        |
| 20  | "Customize your [Domain] stack"                                                              | ACCURATE           | --                                                                        |
| 21  | "Customize skill sources"                                                                    | ACCURATE           | --                                                                        |
| 22  | "The following will be removed:"                                                             | ACCURATE           | --                                                                        |
| 23  | Hotkeys: P (install mode), E (expert), G (settings)                                          | ACCURATE           | --                                                                        |
| 24  | Uninstall `--all` behavior                                                                   | ACCURATE           | --                                                                        |
| 25  | Missing commands (diff, doctor, info, list, outdated, search, update, build, config, import) | OMISSION           | Low -- strategy doc, not inventory                                        |
| 26  | "Install mode: Plugin" / "Local" text                                                        | PARTIALLY ACCURATE | Low -- actual includes parenthetical descriptions                         |

---

## Overall Assessment

**15 claims ACCURATE, 9 INACCURATE, 3 PARTIALLY ACCURATE, 1 CANNOT VERIFY, 1 OMISSION.**

The document is **architecturally sound** in its analysis of the TTY problem, tool evaluation, and testing strategy recommendations. The technical analysis of Ink's raw mode requirement, node-pty's capabilities, and the testing layer architecture is well-researched and accurate.

However, the document has **significant factual errors in codebase-specific details**: inflated statistics (280+ callbacks when there are 11, 248 files when there are 104), wrong file paths (`.claude/plugins/manifest.json`, `.claude/_archived/`), wrong command names (`cc new` instead of `cc init`), and incorrect file system assertion trees. These errors would cause any E2E tests built from this document to fail at the assertion level.

### Recommended Fixes (Priority Order)

1. **Fix `cc new` to `cc init`** throughout (example code lines 93, 342, and implementation plan references)
2. **Fix `.claude/plugins/manifest.json`** to the actual plugin structure (`.claude/plugins/{name}/.claude-plugin/plugin.json`)
3. **Fix `.claude/_archived/`** to `.claude/skills/_archived/`
4. **Fix `.claude/agents/_templates/`** in eject section to `.claude-src/agents/_templates/`
5. **Fix `.claude/config.yaml`** in example code to `.claude-src/config.yaml`
6. **Fix plugin mode agents path** from `.claude/agents/` to inside plugin directory
7. **Correct inflated statistics**: 104 test files (not 248), 11 vi.fn() in step-build (not 280+), 7 mock assertions in skill-fetcher (not 95+)
8. **Fix "Loading marketplace skills..."** to actual messages: "Loading skills..." and "Loading marketplace source..."
9. **Remove or correct "Installation complete"** to actual success messages
10. **Fix "Are you sure? (y/n)"** to "Are you sure you want to uninstall?"
