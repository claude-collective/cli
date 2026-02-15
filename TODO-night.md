## Reminders for Agents

### R1: Use Specialized Agents

- **CLI Developer** (`cli-developer`) - All refactors and features
- **CLI Tester** (`cli-tester`) - All test writing
- **Web Developer** (`web-developer`) - All react code

Do NOT implement features or write tests directly. Always delegate to the appropriate agent.

### R2: Handle Uncertainties

When encountering unknowns or uncertainties:

1. Spawn research subagents to investigate
2. Use CLI Developer to prototype if needed
3. **Create TODO tasks in this file** with findings
4. Document decisions in appropriate docs/ file

### R3: Blockers Go to Top

If a serious blocker is discovered, add it to the **Blockers** section at the top of this file immediately. Do not continue work that depends on the blocked item.

### R4: Do NOT Commit

**Keep all changes uncommitted.** The user will handle committing when ready.

### R5: Move Completed Tasks to Archive

Once a task is done, move it to [TODO-completed.md](./TODO-completed.md).

### R6: Update Task Status

When starting a task: `[IN PROGRESS]`. When completing: `[DONE]`.

**IMPORTANT:** Sub-agents MUST update this TODO.md file when starting and completing subtasks.

### R7: Compact at 70% Context

When context usage reaches 70%, run `/compact`.

### R8: Cross-Repository Changes Allowed

You may make changes in the claude-subagents directory (`/home/vince/dev/claude-subagents`) as well, if needed. This is the source marketplace for skills and agents.

### R9: Max 4 Concurrent Subagents

Always have at most 4 subagents running at the same time. Compact when main claude instance reaches 60% context usage.

### R10: Code Flow Quality

Always test for code flow. Code should flow naturally and in a logical sequence.

---

## Blockers

(none)

---

## High Priority - UX & Accessibility (Research: a800b70)

### [DONE] Add text labels for color-coded states

**Research:** a800b70 found over-reliance on color-only indicators
**Files:** src/cli/components/wizard/category-grid.tsx, step-build.tsx, step-refine.tsx, source-grid.tsx

- Add "(disabled)" suffix to gray items
- Add "(recommended)" suffix to white items
- Add "(discouraged)" suffix to yellow items
- Add semantic text instead of color-only borders

### [DONE] Add semantic labels for validation messages

**Research:** a800b70 found validation messages lack context
**Files:** src/cli/components/wizard/step-build.tsx:41-45

- Validation error should say WHICH category failed
- StepRefine border color needs accompanying text announcement

### [DONE] Add modal help overlay with hotkey reference

**Research:** a800b70 found no comprehensive hotkey help
**Files:** src/cli/components/wizard/wizard-layout.tsx

- Add "press ? for help" overlay showing all keyboard shortcuts
- Include in-context hints for hotkeys on each step

---

## High Priority - Validation (Research: a270ca3)

### [DONE] Fix unsafe array access in plugin-finder

**Research:** a270ca3 found unsafe array indexing
**Files:** src/cli/lib/plugins/plugin-finder.ts:95-97, 85
**Risk:** Silent failures if Promise.all() or split() produces fewer items

- Used `last()` from remeda for safe last-element access (line 87)
- Used `zip()` from remeda to pair skillFiles with fileContents (line 97)
- Eliminates index-based access entirely

### [DONE] Add input validation for --source flag

**Research:** a270ca3 found missing URL/path validation
**Files:** src/cli/lib/configuration/config.ts:100-103
**Risk:** Invalid URLs only caught later by giget

- Add regex validation for URL formats (http://, https://, github:, gh:)
- Add basic path existence checking for local sources

### [DONE] Validate parsed skill names are non-empty

**Research:** a270ca3 found no length validation after regex extraction
**Files:** src/cli/lib/plugins/plugin-finder.ts:99-107
**Risk:** Empty skill names added to matrix

- Validate `nameMatch[1].trim().length > 0` before using
- Add max length validation (e.g., <= 100 chars)

### [DONE] Add bounds check for split() results in compiler

**Research:** a270ca3 found unsafe split access
**Files:** src/cli/lib/compiler.ts:52

- Split result into named `parts` variable with `|| name` fallback
- Malformed/empty paths gracefully fall back to agent name as category

### [DONE] Validate sanitized cache dir in source-fetcher

**Research:** a270ca3 found possible empty string result
**Files:** src/cli/lib/loading/source-fetcher.ts:23-29
**Risk:** Invalid cache path if input is all special chars

- Add fallback: `const sanitized = sanitizeSourceForCache(source) || "unknown"`

### [DONE] Validate environment variables

**Research:** a270ca3 found unvalidated env var access
**Files:** src/cli/lib/configuration/config.ts:109
**Fix:** Wrapped env var validation in try/catch with `warn()` + graceful fallback to next source in precedence chain. Added whitespace-only handling. 7 new tests, 108 total config tests passing.

---

## Medium Priority - DRY Opportunities (Research: a8e974d)

### [DONE] Extract Zod error formatting utility (9 occurrences, ~9 LOC reduction)

**Research:** a8e974d found identical error formatting pattern
**Files:** stacks-loader.ts, matrix-loader.ts (x2), local-skill-loader.ts, skill-plugin-compiler.ts, agent-plugin-compiler.ts, skill-metadata.ts, loader.ts, source-fetcher.ts

- Created `formatZodErrors(issues: z.ZodIssue[]): string` in schemas.ts
- Replaced 9 duplicate inline implementations across 8 files

### [DONE] Extract YAML load+validate helper (4 call sites)

**Research:** a8e974d found repeated schema validation pattern
**Files:** config.ts, project-config.ts, config-saver.ts, defaults-loader.ts
**Helper:** `safeLoadYamlFile<T>()` in `src/cli/utils/yaml.ts`

- 29 LOC reduction (43 lines removed at call sites, 14-line helper added)
- stacks-loader.ts excluded: uses throw-on-error pattern incompatible with warn+return-null helper

### [DONE] Extract YAML file roundtrip helper (17 LOC reduction)

**Research:** a8e974d found repeated load-merge-save pattern
**Files:** config-saver.ts

- `saveSourceToProjectConfig` now composes `loadProjectSourceConfig` + `saveProjectConfig` from config.ts
- Eliminated 6 redundant imports, reimplemented load logic, and reimplemented save logic
- No new helper needed: the composable functions already existed in config.ts

### [DONE] Extract SkillReference builder helper (2 occurrences)

**Research:** a8e974d found duplicate nested loops
**Files:** resolver.ts:100-111, stacks-loader.ts:97-109

- Reused existing `resolveAgentConfigToSkills` from stacks-loader.ts in resolver.ts (eliminated inline loop)
- 12 LOC reduction

### [DONE] Extract test fixture factory pattern (9 wrapper functions)

**Research:** a8e974d found nearly-identical test wrapper functions
**Files:** test-fixtures.ts, helpers.ts, step-sources.test.tsx

- Created `SKILL_FIXTURES` config map with `getTestSkill(name, overrides?)` accessor
- Eliminated 9 wrapper functions (createTestReactSkill, createTestVueSkill, etc.)
- 18 LOC reduction across test-fixtures.ts and helpers.ts

### [DONE] Extract selection context initialization (9 call sites)

**Research:** a8e974d found repeated initialization in matrix-resolver
**Files:** matrix-resolver.ts (getDependentSkills, isDisabled, getDisableReason, isDiscouraged, getDiscourageReason, isRecommended, getRecommendReason, validateSelection, getAvailableSkills)

- Created `initializeSelectionContext(currentSelections, matrix)` returning `{ resolvedSelections, selectedSet }`
- 9 LOC reduction (9 duplicated 2-line patterns replaced with 1-line helper calls)

---

## Medium Priority - UX Improvements (Research: a800b70)

### [DONE] Add progress indication to long operations

**Research:** a800b70 found no progress for source loading and skill copying
**Files:** edit.tsx:74-95, 222-235; init.tsx

- Source loading: "Loading marketplace source..." with "Loaded X skills (source)" completion
- Skill copying: "Copying X of Y skills..." with per-skill progress via onProgress callback
- Added CopyProgressCallback type and onProgress param to copySkillsToPluginFromSource

### [DONE] Add inline navigation hints on first-time steps

**Research:** a800b70 found missing navigation hints in step content
**Files:** step-approach.tsx, step-refine.tsx, step-stack.tsx

- Add hints in main content area, not just footer
- Make navigation discoverable without reading footer

### [DONE] Improve validation error messages with remediation

**Research:** a800b70 found dead-end validation errors
**Files:** step-build.tsx:88-100, build-step-logic.ts:31-34

- Added remediation guidance to validation message: "Use arrow keys to navigate, then SPACE to select."
- Added dimmed escape path hint below error: "Press ESC to go back, or select a skill and press ENTER to continue."

### [DONE] Add examples to all command help text

**Research:** a800b70 found inconsistent help text
**Files:** edit.tsx, init.tsx, list.ts, outdated.ts, validate.ts, eject.ts, diff.ts, info.ts

- Added usage examples to 8 commands missing them
- Used object format `{ description, command }` matching search.tsx:116-120 pattern

---

## Low Priority - UX Polish (Research: a800b70)

### [DONE] Add consistent symbols alongside colors

- Added ✓/○/!/- symbols alongside colors in category-grid, source-grid, wizard-tabs, step-build
- Legend row now shows symbols matching the grid indicators
- Domain tabs show filled circle for active, open circle for inactive
- Wizard step tabs show checkmark completed, filled circle current, open circle pending, dash skipped

### [DONE] Improve terminology consistency

- Standardized "Pre-built template" to "Stack" across all wizard steps
- Fixed British "Customise" to American "Customize" in step-build.tsx
- "Customize skill sources" already consistent across step-sources and step-refine

### [DONE] Make confirmation step reachable with preview

**Research:** a800b70 found confirm step unreachable
**Files:** step-confirm.tsx, wizard.tsx

- Sources step now navigates to confirm step instead of calling handleComplete directly
- Confirm step shows stack name, selected domains, technology/skill counts, and install mode
- Navigation hints added: ENTER to install, ESC to go back

---

## Research Completed (All 14 Agents - Iterations 1-4)

**Iteration 1 Research (8 agents):**

- ✅ **a9e10a7:** View component audit
- ✅ **ac4878a:** Type cast audit
- ✅ **a2c39ca:** DRY audit
- ✅ **ae048ca:** Test audit
- ✅ **a98b2a4:** Complexity audit
- ✅ **a41b8ea:** Hook extraction
- ✅ **aa1bd9e:** Store audit
- ✅ **a630e21:** Constants audit

**Iteration 2 Research (3 agents):**

- ✅ **a32229f:** Error message audit
- ✅ **a5680c0:** Performance audit
- ✅ **aa4598d:** Integration test gaps

**Iteration 4 Research (3 agents):**

- ✅ **a800b70:** UX & Accessibility audit (10+ issues across keyboard nav, color blindness, loading states)
- ✅ **a270ca3:** Validation & Data Integrity audit (15+ gaps in array access, input validation)
- ✅ **a8e974d:** Code Duplication audit (10 patterns, 121-180 LOC reduction potential)

**Iteration 5 Research (3 agents):**

- ✅ **a7d237b:** Security vulnerability audit (10+ HIGH/MEDIUM path traversal, injection risks)
- ✅ **ac66e12:** Documentation audit (JSDoc gaps, outdated architecture docs, missing type conventions)
- ✅ **ab369bc:** Dead code elimination (13+ skipped tests, duplicate utils, console.logs)

---

## High Priority - Security (Research: a7d237b)

### [DONE] Fix path traversal in source-switcher.ts

**Research:** a7d237b found HIGH risk path traversal
**Files:** src/cli/lib/skills/source-switcher.ts:12-65
**Risk:** skillId used directly in path.join() without boundary validation

- Added `validateSkillId()` using existing `SKILL_ID_PATTERN` + null byte/traversal/slash checks
- Added `validatePathBoundary()` using `path.resolve()` + `startsWith()` containment check
- All 3 functions (`archiveLocalSkill`, `restoreArchivedSkill`, `hasArchivedSkill`) now validate before any fs ops
- 17 tests passing (10 new security tests added)

### [DONE] Fix path traversal in skill-copier.ts

**Research:** a7d237b found HIGH risk path traversal
**Files:** src/cli/lib/skills/skill-copier.ts:19-26, 56-61, 137-139
**Risk:** skill.path from matrix/config used directly in path.join()

- Added `validateSkillPath()` with `path.resolve()` + boundary check + null byte detection
- Applied to all 4 path construction functions: getSkillSourcePath, getSkillDestPath, getSkillSourcePathFromSource, getFlattenedSkillDestPath
- 8 tests added covering traversal, absolute paths, null bytes, and valid paths

### [DONE] Add strict validation at YAML/JSON parsing boundaries

**Research:** a7d237b found HIGH risk data integrity issue
**Files:** src/cli/lib/loading/source-fetcher.ts:173-185, multiple
**Risk:** Zod schemas use `.passthrough()` for lenient loading

- Extra fields passed through untouched, no file size limits (DoS risk)
- Malformed marketplace.json with embedded code/scripts not fully validated
  **Fix:** Added file size limits (10MB marketplace, 1MB plugin/config), JSON nesting depth validation (max 10 levels), plugin count limits (max 10,000), plugin name character validation, unknown field warnings at security-critical boundaries. `.passthrough()` kept for backward compat per MEMORY.md but unknown fields now logged.

---

## High Priority - Documentation (Research: ac66e12)

### [DONE] Add JSDoc to complex exported functions

**Research:** ac66e12 found 6+ functions >20 LOC without JSDoc
**Files:** compiler.ts, resolver.ts, matrix-loader.ts, matrix-resolver.ts, config-generator.ts, plugin-validator.ts
**Fix:** Added comprehensive JSDoc to 25+ exported functions across 6 files:

- compiler.ts: `compileAgent()`, `compileAllAgents()`, `compileAllSkills()`, `copyClaudeMdToOutput()`, `compileAllCommands()`, `createLiquidEngine()`, `removeCompiledOutputDirs()`
- matrix-resolver.ts: `resolveAlias()`, `getDependentSkills()`, `isDisabled()`, `getDisableReason()`, `validateSelection()`, `getAvailableSkills()`, `getSkillsByCategory()`, `isCategoryAllDisabled()`
- resolver.ts: `resolveAgents()`, `buildSkillRefsFromConfig()`, `resolveAgentSkillsFromStack()`, `resolveAgentSkillRefs()`
- plugin-validator.ts: `validatePluginStructure()`, `validatePluginManifest()`, `validatePlugin()`, `validateAllPlugins()`
- matrix-loader.ts: `loadSkillsMatrix()`, `extractAllSkills()`, `mergeMatrixWithSkills()`, `loadAndMergeSkillsMatrix()`
- config-generator.ts: `generateProjectConfigFromSkills()`, `buildStackProperty()`

### [DONE] Document public APIs in skill-metadata.ts and multi-source-loader.ts

**Research:** ac66e12 found 8+ undocumented public APIs
**Files:** skill-metadata.ts, multi-source-loader.ts, local-installer.ts

- Added JSDoc to 3 exported types and 5 exported functions in skill-metadata.ts
- Enhanced JSDoc on 2 exported functions in multi-source-loader.ts with @param/@returns/@remarks
- Added JSDoc to 2 exported types and 1 exported function in local-installer.ts with field-level docs
- All 50 tests passing, 0 type errors in modified files

### [DONE] Add field documentation to complex types and schemas

**Research:** ac66e12 found missing field-level documentation
**Files:** types/matrix.ts, types/skills.ts, lib/schemas.ts
**Examples:**

- `DomainSelections = Partial<Record<Domain, Partial<Record<Subcategory, SkillId[]>>>>` - nesting unexplained
- `SkillRequirement.needsAny?: boolean` - no comment explaining AND vs OR semantics
- 726 LOC of Zod schemas have no field-level documentation
  **Fix:** Added field-level JSDoc comments to all non-obvious fields across 3 files:
- types/matrix.ts: DomainSelections (triple nesting explained), CategoryMap (Partial explained), CategoryDefinition.exclusive/required, MergedSkillsMatrix fields, ResolvedSkill (15+ fields), SkillOption (6 fields), ExtractedSkillMetadata
- types/skills.ts: SubcategorySelections, ResolvedSubcategorySkills, SkillAssignment.preloaded, SkillMetadataConfig (8 fields)
- lib/schemas.ts: 6 section headers, 50+ field-level comments across projectConfigLoaderSchema, localRawMetadataSchema, localSkillMetadataSchema, stackSchema, marketplacePluginSchema, versionedMetadataSchema, defaultMappingsSchema, settingsFileSchema, importedSkillMetadataSchema, projectSourceConfigSchema, metadataValidationSchema, stackConfigValidationSchema, and validation schemas

### [DONE] Create docs/type-conventions.md

**Research:** ac66e12 found referenced but missing documentation
**File:** docs/type-conventions.md (doesn't exist, referenced in MEMORY.md)
**Content needed:**

- SkillId format: `${SkillIdPrefix}-${string}-${string}` (3+ segments)
- CategoryPath format: `${prefix}-${string}` or bare Subcategory
- When to use resolveAlias() vs direct ID access
- Boundary cast patterns and when they're acceptable
- typedEntries vs Object.entries usage rules
  **Fix:** Create comprehensive type conventions documentation

---

## High Priority - Testing (Research: ab369bc)

### [DONE] Fix 13+ skipped tests in agent-recompiler and stack-plugin-compiler

**Research:** ab369bc found HIGH priority skipped tests
**Files:** agent-recompiler.test.ts (7 skipped), stack-plugin-compiler.test.ts (11 skipped)
**Fix:**

- agent-recompiler.test.ts: Fixed CLI_REPO_PATH (was 3 levels up, needed 4 — pointed to src/ not project root). Removed TODO comment. Fixed config.yaml version field. All 7 skipped tests now passing (9 total).
- stack-plugin-compiler.test.ts: Deleted 9 tests for removed features (tags, principles, CLAUDE.md copy, hooks, missing skill error). Fixed 2 skill tests to use Stack agent configs instead of agent YAML skills. All 30 tests passing, 0 skipped.

---

## Medium Priority - Security (Research: a7d237b)

### [DONE] Strengthen cache path sanitization

**Research:** a7d237b found MEDIUM risk sanitization weakness
**File:** src/cli/lib/loading/source-fetcher.ts:23-30
**Risk:** sanitizeSourceForCache() doesn't prevent collisions, Unicode attacks, or length issues

- `github:user/repo` and `github-userrepo` could collide after sanitization
- No length limits; very long URLs create filesystem issues
  **Fix:** Replaced regex-only sanitization with SHA-256 hash (16 hex chars) + readable prefix (max 32 chars). Added CACHE_HASH_LENGTH and CACHE_READABLE_PREFIX_LENGTH constants to consts.ts. Added 10 unit tests covering determinism, collision resistance, length bounds, Unicode safety, and filesystem safety. All 2022 tests passing.

### [DONE] Add source URL validation before giget

**Research:** a7d237b found MEDIUM validation gaps
**File:** src/cli/lib/configuration/config.ts:237-349
**Issues:**

- validateLocalPath misses symlink traversal, UNC paths on Windows
- validateRemoteSource uses simple string operations, missing git submodule URL validation
  **Fix:** Added null byte check (all source types), UNC path blocking (local paths), path traversal blocking in remote URLs (git shorthand and HTTP), private/reserved IP blocking (SSRF prevention), IPv6 private address blocking. Symlink resolution deferred to point-of-use (source-fetcher) since validateSourceFormat is a synchronous format check. 16 new tests added, 102 total, 2043 tests passing across full suite.

### [DONE] Add path boundary validation to import skill command

**Research:** a7d237b found MEDIUM risk path manipulation
**File:** src/cli/commands/import/skill.ts:184-202
**Risk:** flags.subdir is user-supplied with minimal validation

- `--subdir ../../../etc` could escape repository boundary
- directoryExists() check helps but doesn't prevent symlink escapes
  **Fix:** Added 3-layer validation before any file operations: null byte check, absolute path rejection, and path.resolve() boundary check verifying resolved path stays within repoPath. 5 new tests added covering traversal, absolute paths, null bytes, intermediate traversal, and nested subdir allowance. 2042 tests passing, 0 regressions.

### [DONE] Add validation to CLI argument construction

**Research:** a7d237b found MEDIUM risk in exec utility
**File:** src/cli/utils/exec.ts:47-59, 109-127
**Risk:** pluginPath and marketplace name passed directly without validation

- No validation that path exists or is reasonable length
- name parameter not constrained; could be 100KB+ string
  **Fix:** Added length limits (pluginPath: 1024, githubRepo: 256, name: 128, pluginName: 256), format validation (GITHUB_REPO_PATTERN, SAFE_NAME_PATTERN, SAFE_PLUGIN_PATH_PATTERN), and control character rejection for all 3 functions: claudePluginInstall, claudePluginMarketplaceAdd, claudePluginUninstall. 38 tests added covering empty, oversized, control chars, shell metacharacters, and valid inputs. 2081 tests passing, 0 regressions.

### [DONE] Add content escaping for Liquidjs template rendering

**Research:** a7d237b found MEDIUM template injection risk
**File:** src/cli/lib/compiler.ts:23-85
**Risk:** Liquidjs with strictVariables: false means user content could include liquid syntax

- agent.name rendered as `{{ agent.name }}` without escaping
- Malicious CLAUDE.md with liquid syntax could exploit custom filters
  **Fix:** Added `sanitizeLiquidSyntax()` and `sanitizeCompiledAgentData()` in compiler.ts. All user-controlled fields (agent metadata, skill metadata, file content) are stripped of Liquid delimiters (`{{`, `}}`, `{%`, `%}`) before template rendering. Applied to both `compileAgent` (compiler.ts) and `compileAgentForPlugin` (stack-plugin-compiler.ts). Warns when stripping detected syntax. 18 new tests added, 119 total tests passing across compiler/resolver/stack-plugin-compiler.

### [DONE] Fix race condition in archive/restore operations

**Research:** a7d237b found MEDIUM TOCTOU vulnerability
**File:** src/cli/lib/skills/source-switcher.ts:12-51
**Risk:** async directoryExists() check followed by async copy() creates race window

- Filesystem state could change between check and copy
  **Fix:** Replaced check-then-use pattern with try-catch around copy/remove operations. `archiveLocalSkill` catches errors and warns with the error message. `restoreArchivedSkill` catches errors and returns false. Eliminates TOCTOU window since `copy()` will fail atomically if source is missing. `hasArchivedSkill` unchanged (simple check, no TOCTOU). 17 tests passing.

---

## Medium Priority - Documentation (Research: ac66e12)

### [DONE] Update architecture.md for multi-source UX Phase 6

**Research:** ac66e12 found outdated architecture docs
**File:** docs/architecture.md
**Fix:** Updated architecture.md with comprehensive multi-source documentation:

- Added "Multi-Source Annotation" step to core pipeline and detailed flow (step 3)
- Added new "Multi-Source System" subsection with source types, 5-phase loading pipeline, configuration, source selection flow, archive/restore, bound skill search, and settings overlay
- Added BoundSkill/BoundSkillCandidate to Key Interfaces table
- Added boundSkills to wizard state, SearchModal to component hierarchy
- Fixed SkillSourceType union (removed erroneous "plugin" variant)
- Added MS phase to evolution history

### [DONE] Update commands.md for current init behavior

**Research:** ac66e12 found contradictions in user docs
**File:** docs/commands.md
**Issues:**

- Line 23 says "Individual skill plugin installation not supported" but Phase 3b added this
- No documentation of --source flag's GitHub and private source formats
- Missing --refresh flag documentation
- No mention of wizard steps: approach → stack/sources → build → sources-customize → confirm
  **Fix:** Update commands.md to match current CLI behavior

### [DONE] Update README.md installation modes and features

**Research:** ac66e12 found outdated getting started guide
**File:** README.md
**Issues:**

- Lines 92-106 say "Default Mode: Local" but wizard defaults to "stack" approach with plugin mode
- No mention of multi-source setup
- No mention of cc search interactive mode with bound skills
- Skill import feature not in command list
  **Fix:** Update README to reflect current defaults and features

### [DONE] Add @param/@returns to wizard store actions

**Research:** ac66e12 found undocumented store methods
**File:** src/cli/stores/wizard-store.ts:99-147
**Fix:** Added comprehensive JSDoc to all 25 action and getter methods in WizardState:

- Store-level comment block documenting the composition pattern and state flow
- WizardStep type documented with progression order
- Complex actions (populateFromStack, populateFromSkillIds, toggleTechnology, buildSourceRows) have multi-line JSDoc with @param descriptions and side effects
- Getters (getAllSelectedTechnologies, getSelectedTechnologiesPerDomain, buildSourceRows) have @returns descriptions
- Simple setters/toggles have concise single-line JSDoc
- 0 type errors, 67 tests passing

### [DONE] Convert excessive comments to JSDoc or improve function names

**Research:** ac66e12 found 4+ instances of over-explanation
**Files:** compiler.ts:47, local-installer.ts:132, 174-176, 256
**Fix:**

- compiler.ts: Removed obvious inline comment on sourceRoot/agentBaseDir fallback (variable names are self-documenting)
- local-installer.ts: Removed 2 "Store initialization" comments on accumulator patterns (Partial<Record<...>> and for-loop make intent clear)
- local-installer.ts: Condensed 3-line comment to 1-line on stack customization logic
- config-generator.ts: Already fixed in prior JSDoc task (lines 28-42 have proper JSDoc)
- skill-copier.ts: Already clean (no excessive comments found)

### [DONE] Move buried TODO from test file to TODO-night.md

**Research:** ac66e12 found hidden blocker
**File:** src/cli/lib/agents/agent-recompiler.test.ts:23
**Fix:** Resolved directly — the TODO was removed along with fixing all 7 skipped tests. Root cause was wrong CLI_REPO_PATH (3 levels up instead of 4). No Phase 6 changes needed; agents don't have skills in their YAMLs.

### [DONE] Document boundary cast pattern centrally

**Research:** ac66e12 found repeated pattern without central documentation
**Files:** config-generator.ts:25, skill-copier.ts:102, matrix-resolver.ts:25
**Issue:** Each file re-explains boundary cast pattern; no centralized guide
**Fix:** Expanded existing Boundary Cast Patterns section in docs/type-conventions.md from 5 to 7 categories with real codebase file references, acceptable/unacceptable guidance, summary table, and post-safeParse explanation. Added cross-reference from typescript-types-bible.md section 6.

---

## Medium Priority - Dead Code Elimination (Research: ab369bc)

### [DONE] Consolidate duplicate test utility functions

**Research:** ab369bc found duplicate fileExists/directoryExists/parseFrontmatter
**Files:** 5+ integration test files duplicate helpers instead of importing
**Examples:**

- import-skill.integration.test.ts, source-switching.integration.test.ts, wizard-init-compile-pipeline.test.ts duplicate fileExists/directoryExists
- install-compile.test.ts, compile-flow.test.ts duplicate parseFrontmatter
  **Source of truth:** src/cli/utils/fs.ts (exported), src/cli/lib/**tests**/helpers.ts (exported)
  **Fix:** Removed all 7 local `fileExists`/`directoryExists` duplicates across 5 integration test files + create-test-source.ts fixture. Added `parseTestFrontmatter` to helpers.ts (test-specific lightweight parser returning `Record<string, unknown>`, distinct from production `parseFrontmatter` which returns typed `SkillFrontmatter` with Zod validation). Replaced 2 local `parseFrontmatter` implementations in compile-flow.test.ts and install-compile.test.ts. create-test-source.ts now re-exports from helpers.ts. 94 test files, 2012 tests passing, 0 regressions.

### [DONE] Consolidate duplicate integration test helpers

**Research:** ab369bc found duplicate readYaml/buildWizardResult/buildSourceResult
**Files:** source-switching.integration.test.ts, init-flow.integration.test.ts, wizard-init-compile-pipeline.test.ts
**Fix:** Extracted `readTestYaml`, `buildWizardResult`, and `buildSourceResult` to shared `helpers.ts`. Updated 3 integration test files to import from shared helpers instead of defining locally. Also consolidated `fileExists`/`directoryExists` imports (from create-test-source -> helpers). 119 integration tests passing, 0 regressions.

### [DONE] Remove or repurpose unused test helpers

**Research:** ab369bc found exported but unused test utilities
**File:** src/cli/lib/**tests**/helpers.ts
**Resolution:**

- `createMockMatrixWithMethodology()` - Removed (dead code, never called anywhere)
- `createMockProjectConfig()` - Removed (only self-tested, never used in real tests)
- `createSkillContent()`, `createMetadataContent()`, `createAgentYamlContent()` - Un-exported (used internally by writeTestSkill/writeTestAgent but never imported externally)
- Removed `ProjectConfig` from type imports (no longer needed)
- Removed corresponding tests from helpers.test.ts (3 tests removed)
- 94 test files, 2012 tests passing, 0 regressions

### [DONE] Replace console.log with logger in production files

**Research:** ab369bc found 6 production files with console.log
**Files:** skill-plugin-compiler.ts, plugin-validator.ts, agent-plugin-compiler.ts, stack-plugin-compiler.ts, compiler.ts, output-validator.ts, schema-validator.ts
**Issue:** Should use verbose() from src/cli/utils/logger.ts or commands should use this.log()
**Fix:** Added `log()` to logger.ts for always-visible output. Replaced all console.log with `log()`, console.warn with `warn()`, console.error with `warn()` across 7 production files. 2015 tests passing, 0 type errors.

---

## Iteration 6 Research (4 agents)

- acf47f6: View component logic extraction audit (14 findings across wizard components)
- ab98ab7: Type cast and loose types audit (boundary casts, mid-pipeline casts)
- a8a233b: Test coverage gaps audit (missing test files, quality issues)
- a56412b: DRY and repeated constants audit (60+ hardcoded strings, 7 large functions)

---

## High Priority - DRY & Constants (Research: a56412b)

### [DONE] Use CLI_COLORS constants in all component files

**Research:** a56412b found 16 hardcoded color strings
**Files:** step-build.tsx, step-confirm.tsx, step-refine.tsx, help-modal.tsx, permission-checker.tsx, category-grid.tsx, source-grid.tsx, wizard-tabs.tsx, menu-item.tsx, search-modal.tsx, section-progress.tsx, step-sources.tsx, step-settings.tsx, wizard-layout.tsx, view-title.tsx, wizard.tsx
**Fix:** Replaced all hardcoded "cyan", "green", "yellow", "gray", "white", "red" with CLI_COLORS.PRIMARY, CLI_COLORS.SUCCESS, CLI_COLORS.WARNING, CLI_COLORS.NEUTRAL, CLI_COLORS.UNFOCUSED, CLI_COLORS.ERROR from consts.ts across 14 files. category-grid.tsx, wizard-tabs.tsx, step-stack.tsx, skill-search.tsx already used CLI_COLORS. Left "blackBright" (non-semantic border shade), "dim" (code snippet rendering), and "#000" (literal black text on colored background) unchanged.

### [DONE] Use STANDARD_FILES/DIRS constants in test files

**Research:** a56412b found 60+ hardcoded path/file strings in tests
**Files:** local-skill-loader.test.ts, skill-copier.test.ts, config.test.ts, config-merger.test.ts, source-fetcher.test.ts
**Fix:** Replaced 160+ hardcoded strings with CLAUDE_DIR, CLAUDE_SRC_DIR, LOCAL_SKILLS_PATH, STANDARD_FILES.SKILL_MD, STANDARD_FILES.METADATA_YAML, STANDARD_FILES.CONFIG_YAML, STANDARD_DIRS.SKILLS, PLUGIN_MANIFEST_DIR. 194 tests passing across 5 files.

### [DONE] Replace inline getErrorMessage pattern with utility import

**Research:** a56412b found 3+ files with inline error extraction
**Files:** source-switcher.ts:60, plugin-validator.ts:132, exec.ts:231
**Fix:** Import `getErrorMessage` from `../utils/errors` instead of inline `error instanceof Error ? error.message : String(error)`

### [DONE] Decompose validateSelection in matrix-resolver.ts (~100+ lines)

**Research:** a56412b found oversized validation function
**File:** src/cli/lib/matrix/matrix-resolver.ts
**Fix:** Already decomposed in prior iteration into validateConflicts(), validateRequirements(), validateExclusivity(), validateRecommendations(), validateSetupUsage() + mergeValidationResults(). Main function is ~20 lines calling 5 pure helpers. 99 tests passing.

### [DONE] Extract resolveSkillPath helper in skill-copier.ts

**Research:** a56412b found 3 similar path validation patterns
**File:** src/cli/lib/skills/skill-copier.ts (lines 40-52, 83-90)
**Fix:** Extract `resolveSkillPath(basePath, skillPath)` that combines path.join + validateSkillPath

---

## High Priority - View Logic Extraction (Research: acf47f6)

### [DONE] Extract useWizardInitialization hook from wizard.tsx

**Research:** acf47f6 found useState anti-pattern for store initialization
**File:** src/cli/components/wizard/wizard.tsx:65-78
**Fix:** Extracted to src/cli/components/hooks/use-wizard-initialization.ts using useRef-based guard (preserves synchronous timing). useState removed from wizard.tsx. 100 tests passing (wizard-store + wizard integration).

### [DONE] Move step progress logic from wizard-layout.tsx to store

**Research:** acf47f6 found business logic (step completion tracking) in view
**File:** src/cli/components/wizard/wizard-layout.tsx:82-106
**Fix:** Moved completedSteps/skippedSteps computation to wizard-store.ts as `getStepProgress()` getter. Replaced inline useMemo in wizard-layout.tsx with store getter call. 100 tests passing.

### [DONE] Extract useSourceGridSearchModal hook from source-grid.tsx

**Research:** acf47f6 found duplicated cleanup logic in search modal handlers
**File:** src/cli/components/wizard/source-grid.tsx:129-182
**Fix:** Extracted to `src/cli/components/hooks/use-source-grid-search-modal.ts`. Consolidated duplicated cleanup into shared `resetSearch` callback. 28 tests passing.

### [DONE] Extract useBuildStepProps hook from wizard.tsx

**Research:** acf47f6 found 40+ lines of inline prop composition
**File:** src/cli/components/wizard/wizard.tsx:182-221
**Fix:** Extracted to `src/cli/components/hooks/use-build-step-props.ts`. Hook accepts store+matrix, returns `StepBuildProps`. Build case is now `<StepBuild {...buildStepProps} />`. 279 tests passing.

### [DONE] Extract useSourceOperations hook from step-settings.tsx

**Research:** acf47f6 found duplicated async error handling pattern
**File:** src/cli/components/wizard/step-settings.tsx:99-125
**Fix:** Extracted to `src/cli/components/hooks/use-source-operations.ts`. Hook accepts projectDir + onReload callback, returns { handleAdd, handleRemove, statusMessage, clearStatus }. step-settings.tsx reduced by 27 lines. 18 tests passing.

---

## High Priority - Type Improvements (Research: ab98ab7)

### [DONE] Simplify typedEntries cast in multi-source-loader.ts

**Research:** ab98ab7 found complex double-cast on typedEntries
**Files:** src/cli/lib/loading/multi-source-loader.ts:69-70, 89-90
**Fix:** The cast `typedEntries<SkillId, NonNullable<(typeof matrix.skills)[SkillId]>>(matrix.skills as Record<SkillId, NonNullable<...>>)` is overly complex. Since `matrix.skills` is `Partial<Record<SkillId, ResolvedSkill>>`, use simple `typedEntries(matrix.skills)` with the `if (!skill) continue` guard that already exists.

---

## High Priority - Test Coverage (Research: a8a233b)

### [DONE] Add unit tests for src/cli/utils/errors.ts

**Research:** a8a233b found untested utility
**File:** src/cli/utils/errors.ts
**Fix:** Expanded errors.test.ts from 7 to 12 tests. Added coverage for empty Error messages, booleans, objects with message property (non-Error), arrays, and symbols. All passing.

### [DONE] Add unit tests for src/cli/utils/yaml.ts

**Research:** a8a233b found missing tests for safeLoadYamlFile
**File:** src/cli/utils/yaml.ts (no yaml.test.ts exists)
**Fix:** Created yaml.test.ts with 20 tests across 6 categories: valid YAML (3), invalid YAML (2), missing file (2), schema validation failure (5), oversized file (3), edge cases (5)

### [DONE] Add unit tests for src/cli/lib/configuration/config-generator.ts

**Research:** a8a233b found missing tests for complex logic
**File:** src/cli/lib/configuration/config-generator.ts
**Fix:** Created config-generator.test.ts with 30 tests (20 for generateProjectConfigFromSkills, 10 for buildStackProperty). Covers empty selections, multi-domain, agent deduplication, unknown skills, optional fields, methodology mappings, stack extraction, empty arrays, local skills.

### [DONE] Add unit tests for src/cli/lib/plugins/plugin-manifest.ts

**Research:** a8a233b found untested plugin manifest handling
**File:** src/cli/lib/plugins/plugin-manifest.ts
**Fix:** Created plugin-manifest.test.ts with 55 tests covering all 6 exported functions: generateSkillPluginManifest (13), generateAgentPluginManifest (10), generateStackPluginManifest (20), writePluginManifest (6), getPluginDir (3), getPluginManifestPath (3). All passing.

### [DONE] Add unit tests for src/cli/lib/plugins/plugin-version.ts

**Research:** a8a233b found missing version utility tests
**File:** src/cli/lib/plugins/plugin-version.ts
**Fix:** Created plugin-version.test.ts with 40 tests (9 for getPluginVersion, 31 for bumpPluginVersion). Covers patch/minor/major bumps, pre-release strings, zero-major, partial versions, invalid strings, sequential bumps, schema validation, manifest field preservation.

### [DONE] Add unit tests for src/cli/utils/frontmatter.ts

**Research:** a8a233b found untested frontmatter utility
**File:** src/cli/utils/frontmatter.ts
**Fix:** Created frontmatter.test.ts with 21 tests across 6 categories: valid frontmatter (5), missing frontmatter (3), malformed YAML (2), empty content (3), frontmatter with no body (2), edge cases (6)

### [DONE] Add unit tests for src/cli/lib/configuration/source-manager.ts

**Research:** a8a233b found existing source-manager.test.ts may have gaps
**File:** src/cli/lib/configuration/source-manager.ts
**Fix:** Added 12 new tests (22 total). Covers missing config file, no sources array, duplicate prevention, last source removal, plugin skill counting with/without matrix, custom source URLs, empty skills array, combined local+plugin counting. All passing.

---

## Medium Priority - Code Organization (Research: acf47f6, a56412b)

### [DONE] Split step-stack.tsx subcomponents into separate files

**Research:** acf47f6 found two large subcomponents in one file
**File:** src/cli/components/wizard/step-stack.tsx:97-164
**Fix:** Extracted `StackSelection` to `stack-selection.tsx` (75 lines) and `DomainSelection` to `domain-selection.tsx` (90 lines). step-stack.tsx reduced from 176 to 20 lines. 23 tests passing.

### [DONE] Extract recompileAgents helper functions from agent-recompiler.ts

**Research:** a56412b found 62-line function with multiple responsibilities
**File:** src/cli/lib/agents/agent-recompiler.ts:78-140
**Fix:** Extracted 3 private helpers: `resolveAgentNames()`, `buildCompileConfig()`, `compileAndWriteAgents()`. Main function reduced from ~62 to ~35 lines. 9 tests passing.

### [DONE] Extract compileAgent template helpers from compiler.ts

**Research:** a56412b found 75-line function
**File:** src/cli/lib/compiler.ts:117-192
**Fix:** Extracted `readAgentFiles()` (I/O) and `buildAgentTemplateContext()` (pure data transform) as private helpers. `compileAgent` is now a thin orchestrator (~12 lines). 67 tests passing.

---

## Iteration 7 Research (1 agent)

- aa18e4c: Code quality audit — test gaps, silent catches, large components, unused exports

---

## High Priority - Test Coverage (Research: aa18e4c)

### [DONE] Add unit tests for typed-object.ts

**Research:** aa18e4c found critical type-safety utility untested
**File:** src/cli/utils/typed-object.ts (9 LOC, 2 exported functions)
**Fix:** Created typed-object.test.ts with 11 tests. Covers typedEntries (6): basic Record, Partial Record, empty, union keys, tuple structure, complex values. typedKeys (5): basic, empty, partial, union, absent keys. All passing.

### [DONE] Add unit tests for logger.ts

**Research:** aa18e4c found untested utility
**File:** src/cli/utils/logger.ts (36 LOC, 4 exported functions)
**Fix:** Created logger.test.ts with 13 tests. Covers setVerbose (3): enable, disable, toggle. verbose (3): suppressed when off, outputs when on, 2-space prefix. log (3): always outputs, no modification. warn (4): always outputs, "Warning:" prefix. All passing.

### [DONE] Add unit tests for messages.ts

**Research:** aa18e4c found untested message constants
**File:** src/cli/utils/messages.ts (55 LOC, 4 const objects)
**Fix:** Created messages.test.ts with 13 tests across 5 categories. Covers key presence, non-empty values, STATUS_MESSAGES ellipsis convention, DRY_RUN_MESSAGES `[dry-run]` prefix, semantic grouping. All passing.

---

## Medium Priority - Error Handling (Research: aa18e4c)

### [DONE] Add verbose logging to silent catch blocks

**Research:** aa18e4c found silent error swallowing
**Files:** src/cli/lib/marketplace-generator.ts:54-63, src/cli/lib/versioning.ts:85-93
**Fix:** Added verbose() with getErrorMessage() to both catch blocks. Users can now debug plugin loading and versioning failures with --verbose. 39 tests passing.

---

## Medium Priority - View Logic Extraction (Research: aa18e4c)

### [DONE] Extract useCategoryGridInput hook from category-grid.tsx

**Research:** aa18e4c found 75-line useCallback handling all keyboard input + focus management
**File:** src/cli/components/wizard/category-grid.tsx:346-419
**Fix:** Extracted to `src/cli/components/hooks/use-category-grid-input.ts` (186 lines). Moved keyboard handler, 2 useEffect hooks, and 3 utility functions (isSectionLocked, findValidStartColumn, findNextUnlockedIndex). category-grid.tsx reduced from 476 to 336 LOC. 291 component tests passing.

---

## Iteration 8 Research (1 agent)

- ac0c15a: Deeper code quality audit — component sizes, store decomposition, test DRY, command patterns

---

## High Priority - DRY (Research: ac0c15a)

### [DONE] Investigate detectInstallation in uninstall.tsx — NOT a duplicate

**Research:** ac0c15a flagged as DRY violation, investigation found it's NOT a duplicate
**File:** src/cli/commands/uninstall.tsx:31-47
**Finding:** The uninstall version returns `UninstallTarget` (6 booleans + 6 paths for individual removal), while the shared version returns `Installation | null` (mode + single config path). Different signatures, different purposes. No changes needed.

### [DONE] Standardize error handling across commands

**Research:** ac0c15a found inconsistent error handling
**Files:** compile.ts, build/plugins.ts, build/stack.tsx, build/marketplace.ts, init.tsx, new/agent.tsx, new/skill.ts
**Fix:** Replaced 11 instances of `this.error(getErrorMessage(error), { exit: EXIT_CODES.ERROR })` with `this.handleError(error)` across 7 files. Cleaned up unused getErrorMessage/EXIT_CODES imports. Skipped commands with custom prefixes or different fallbacks. 2259 tests passing.

---

## Medium Priority - Store Decomposition (Research: ac0c15a)

### [DONE] Decompose populateFromSkillIds in wizard-store.ts

**Research:** ac0c15a found 42-line method with multiple concerns
**File:** src/cli/stores/wizard-store.ts:412-453
**Fix:** Extracted `resolveSkillForPopulation()` module-level helper handling per-skill validation and domain/subcategory resolution. Main method reduced from 42 to 27 lines. Added `SkillLookupEntry` type alias. Removed unused `domains` Set. 67 tests passing.

### [DONE] Extract bound skill merging from buildSourceRows

**Research:** ac0c15a found 55-line method with sorting + merging concerns
**File:** src/cli/stores/wizard-store.ts:672-726
**Fix:** Extracted `buildBoundSkillOptions()` module-level helper for bound skill filtering and option-building. Uses filter+map instead of filter+for...push. 67 tests passing.

---

## Medium Priority - Test Quality (Research: ac0c15a)

### [DONE] Extract flag acceptance test helper in new/agent.test.ts

**Research:** ac0c15a found 7+ repetitive test bodies with identical pattern
**File:** src/cli/lib/**tests**/commands/new/agent.test.ts:44-139
**Fix:** Extracted local `expectFlagAccepted()` helper replacing 8 identical test bodies. All 12 test descriptions preserved. All passing.

---

## Iteration 9 Research (1 agent)

- a129a25: Final polish audit — unused exports, cast patterns, import consistency

---

## Medium Priority - Dead Code (Research: a129a25)

### [DONE] Remove unused resolveTemplate from resolver.ts

**Research:** a129a25 found exported but unused function
**File:** src/cli/lib/resolver.ts:22
**Fix:** Confirmed zero production imports. Removed function and its 3 tests from resolver.test.ts.

### [DONE] Boundary cast comments on SkillDisplayName lookups — already present

**Research:** a129a25 found 2 `as unknown as SkillDisplayName` casts
**Files:** src/cli/lib/matrix/matrix-resolver.ts:26, src/cli/lib/matrix/matrix-loader.ts:235
**Finding:** Both already have explanatory comments from prior type-narrowing work. No changes needed.

---

## Completed Tasks Summary

**Iteration 1:** 20 tasks (hooks, functions, constants, tests)
**Iteration 2:** 12 tasks (code quality, comments, dead code)
**Iteration 3:** 16 tasks (error messages, integration tests, performance)
**Iteration 4:** 22 tasks (UX/accessibility, validation, DRY)
**Tests Added:** 233+ tests (+14%)
**Performance Improvements:** 50-70% faster renders, 5-10x faster I/O, 40-60% faster installation
**Zero regressions, zero type errors**

See TODO-completed.md for full details of all 48 completed tasks.
