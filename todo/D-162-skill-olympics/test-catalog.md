# Expressive TypeScript — Code Quality Test Catalog

Catalog of ~120 code examples across 10 anti-pattern categories, sourced from the current codebase and git history. Purpose: select ~20 test cases to benchmark sub-agent refactoring quality.

---

## Categories

| #   | Category                      | Description                                                                | Count |
| --- | ----------------------------- | -------------------------------------------------------------------------- | ----- |
| 1   | **God Functions**             | 100+ line methods doing everything in one place                            | 15    |
| 2   | **Stream of Consciousness**   | Disjointed logic, no phase grouping, constant context-switching            | 15    |
| 3   | **Imperative Accumulation**   | For-loops pushing to arrays where `.map()/.filter()/.flatMap()` would work | 12    |
| 4   | **Code Duplication**          | Near-identical functions or blocks repeated with minor variations          | 10    |
| 5   | **Field-by-Field Repetition** | Same operation repeated N times per property without abstraction           | 8     |
| 6   | **Mixed Concerns**            | Functions doing 3+ unrelated things (smaller than god functions)           | 12    |
| 7   | **Nested Conditionals**       | Deep branching, multi-tier fallbacks, boolean flag matrices                | 10    |
| 8   | **Scattered Side Effects**    | Logging/I/O interleaved throughout business logic                          | 8     |
| 9   | **Parameter Overload**        | Functions with 5+ parameters, unused params, ignored option objects        | 6     |
| 10  | **Clean Examples**            | Good code for reference — what "done right" looks like                     | 15    |

---

## How to Read Each Entry

```
### [ID] Title
- **Source**: current | git:<commit>
- **File**: path (line range)
- **Function**: name
- **Lines**: approximate count
- **Quality**: terrible / bad / average / good
- **Size**: S (<20 lines) | M (20-50) | L (50-100) | XL (100+)

Description of the problem and why it's a good test case.
```

---

## Category 1: God Functions

### [G01] Edit command — entire logic in one run() method

- **Source**: git:43d766d~1
- **File**: src/cli/commands/edit.tsx (lines 91-554)
- **Function**: `Edit.run()`
- **Lines**: ~463
- **Quality**: terrible
- **Size**: XL

The canonical god method. 15+ responsibilities: source loading, skill discovery, wizard rendering, change detection (6 separate Map computations), mode migrations, scope migrations, plugin install/uninstall, local file copying, config writing, agent recompilation, stale file cleanup, summary output. Deeply nested for-loops, inline try-catch blocks around every external call, 6 separate `Map<>` constructions for different change types.

### [G02] Update command — entire logic in one run() method

- **Source**: git:43d766d~1
- **File**: src/cli/commands/update.tsx (lines 140-372)
- **Function**: `Update.run()`
- **Lines**: ~230
- **Quality**: terrible
- **Size**: XL

Source loading, skill comparison across scopes, directory mapping, result merging, specific skill lookup with fuzzy matching ("did you mean?"), outdated filtering, table display, confirmation UI rendering, update loop, recompilation, summary. Two completely different user stories (update all vs update one) interleaved in one function.

### [G03] Init command — installLocalMode with 18-field config merge

- **Source**: git:a904b8d~1
- **File**: src/cli/commands/init.tsx (lines 315-608)
- **Function**: `Init.installLocalMode()`
- **Lines**: ~290
- **Quality**: terrible
- **Size**: XL

Skill copying, config generation, stack loading, skill resolution, 18-field property-by-property config merge, agent compilation, template rendering, permission checking, success banner — all in one method wrapped in a single try-catch. The config merge section alone is 80 lines of `if (existingConfig.X) { localConfig.X = existingConfig.X }`.

### [G04] Doctor command — run() with copy-pasted skip blocks

- **Source**: git:43d766d~1
- **File**: src/cli/commands/doctor.ts (lines 270-443)
- **Function**: `Doctor.run()`
- **Lines**: ~175
- **Quality**: terrible
- **Size**: XL

5 health checks with interleaved formatting/output. The same 6-line "skipResult" block is copy-pasted 3 times. Check execution and result formatting are tangled together. `formatTips()` matches on result message strings (`r.message.includes("recompilation")`) — brittle coupling to display text.

### [G05] Import command — run() with inline security validation

- **Source**: git:43d766d~1
- **File**: src/cli/commands/import/skill.ts (lines 97-290)
- **Function**: `ImportSkill.run()`
- **Lines**: ~170
- **Quality**: terrible
- **Size**: XL

Argument validation, source parsing, repository fetching, inline subdirectory security validation (null bytes, absolute paths, path traversal — 12 lines of checks that belong in a utility), skill discovery, list/skill/all flag branching, import loop with force check, summary output.

### [G06] Diff command — scope merging + 4 output modes

- **Source**: git:43d766d~1
- **File**: src/cli/commands/diff.ts (lines 163-296)
- **Function**: `Diff.run()`
- **Lines**: ~133
- **Quality**: terrible
- **Size**: XL

Scope detection, source loading, skill collection, optional filtering, result aggregation, and 4 different output modes (quiet/no-forked/up-to-date/diff). The `scopedDirs` management uses push, filter, `.length = 0`, then push again — imperatively complex. The entire method is in a single try-catch.

### [G07] Outdated command — JSON/human branching throughout

- **Source**: git:43d766d~1
- **File**: src/cli/commands/outdated.ts (lines 82-202)
- **Function**: `Outdated.run()`
- **Lines**: ~120
- **Quality**: terrible
- **Size**: XL

Two output modes (JSON, human) with branching scattered throughout. Scope detection, source loading, skill comparison, result merging, table formatting, summary generation — all in one method with separate JSON/human error handling paths.

### [G08] Local installer — installLocal() and installPluginConfig() share 70%

- **Source**: git:283ebaa~1
- **File**: src/cli/lib/installation/local-installer.ts
- **Function**: `installLocal()` + `installPluginConfig()`
- **Lines**: ~250 combined
- **Quality**: terrible
- **Size**: XL

Two functions that share 70% of their logic copy-pasted. Both call `buildAndMergeConfig`, `writeScopedConfigs`, `buildCompileAgents`, `compileAndWriteAgents` in the same order with nearly identical parameters.

### [G09] Source loader — 663-line monolith with schema mutation

- **Source**: git:9189b22~1
- **File**: src/cli/lib/loading/source-loader.ts
- **Function**: `loadSkillsMatrixFromSource()` and helpers
- **Lines**: ~663 total
- **Quality**: terrible
- **Size**: XL

Resolves sources, loads skills, **mutates global Zod schemas as a side effect**, merges local skills, loads extra sources, checks health, sets global store state. Contains two nearly identical `discoverAndExtend*` functions. Uses the global-before-project fallback anti-pattern (if project has 1 skill, all global skills are invisible).

### [G10] Matrix loader — 547-line kitchen sink

- **Source**: git:9189b22~1
- **File**: src/cli/lib/matrix/matrix-loader.ts
- **Lines**: ~547
- **Quality**: terrible
- **Size**: XL

YAML schema validation, category loading, rules loading, skill scanning with glob, frontmatter parsing, slug map construction, directory-to-ID mapping, 6 separate relationship resolution functions, skill composer, matrix merger, category auto-synthesis, and a convenience entry point. Uses `directoryPathToId` fallback — the multi-tier resolution pattern CLAUDE.md now bans.

### [G11] Wizard store — 976-line monolithic Zustand store

- **Source**: git:f67358d~1
- **File**: src/cli/stores/wizard-store.ts
- **Lines**: ~976
- **Quality**: terrible
- **Size**: XL

Single `create()` call with ~30 actions mixing navigation, skill selection, domain ordering, scope management, source management, and UI state. Source formatting logic (`buildSourceRows`, `formatSourceLabel`, `getSkillAlias`) embedded directly in the store.

### [G12] Category grid — 420-line component with embedded state machine

- **Source**: git:a7ca0fe~1
- **File**: src/cli/components/wizard/category-grid.tsx
- **Lines**: ~420
- **Quality**: terrible
- **Size**: XL

6 standalone navigation utility functions, 3 sub-components, 2 useEffect hooks, and a massive useInput callback with a 15-item dependency array handling 8 key combinations — all in one file. Focus management, keyboard navigation, section locking, sorting, and rendering tangled together.

### [G13] Step-build — 312-line file mixing business logic and rendering

- **Source**: git:a7ca0fe~1
- **File**: src/cli/components/wizard/step-build.tsx
- **Lines**: ~312
- **Quality**: bad
- **Size**: XL

Contains 7 pure business functions (`validateBuildStep`, `computeOptionState`, `getDisplayLabel`, etc.) plus the React component. The actual component is ~60 lines at the bottom. `buildCategoriesForDomain` takes 7 parameters. All 7 functions were later extracted to `build-step-logic.ts`.

### [G14] Config types writer — 563-line string template builder

- **Source**: git:bd55731~1
- **File**: src/cli/lib/configuration/config-types-writer.ts
- **Lines**: ~563
- **Quality**: bad
- **Size**: XL

Generates TypeScript source as strings with hardcoded template literals. Dynamic imports to avoid circular dependencies. `generateConfigTypesSource()` has 4 separate code paths for determining custom vs marketplace membership across skills/agents/categories/domains — each with its own `Set<>` computation.

### [G15] Compile command — hand-rolled YAML parser + duplicated passes

- **Source**: git:7ca8a07
- **File**: src/cli/commands/compile.ts
- **Function**: `runPluginModeCompile()` + `runCustomOutputCompile()`
- **Lines**: ~300 combined
- **Quality**: terrible
- **Size**: XL

`runCustomOutputCompile` is a near-complete copy of `runPluginModeCompile`. Contains its own hand-rolled YAML parser (splits on newlines, finds colons, strips quotes with regex) when the `yaml` package was already a dependency. 3 separate `process.exit(1)` calls.

---

## Category 2: Stream of Consciousness

Functions where operations follow no coherent phase structure. The reader context-switches constantly.

### [S01] createMarketplaceFiles — 30 inline steps, zero abstraction

- **Source**: current
- **File**: src/cli/commands/new/marketplace.ts (lines 209-273)
- **Function**: `createMarketplaceFiles()`
- **Lines**: ~64
- **Quality**: bad
- **Size**: L

30 sequential operations: generate-compute path-write repeated 5 times for different file types, interspersed with a shell-out to `new:skill`, followed by 5 separate success log messages at the end. Classic stream-of-consciousness: one operation after another in whatever order the author thought of them.

### [S02] Edit loadContext — stuttering let + try/catch + push-message

- **Source**: current
- **File**: src/cli/commands/edit.tsx (lines 114-177)
- **Function**: `loadContext()`
- **Lines**: ~63
- **Quality**: bad
- **Size**: L

Two separate try/catch blocks, each declaring a mutable `let` before the block and assigning inside. Startup messages pushed between unrelated I/O operations. Config loading happens OUTSIDE any try/catch between two try/catch blocks that both handle buffering cleanup. The pattern stutters: declare, try, load, push-message, catch, declare, try, load, push-message, catch.

### [S03] Edit writeConfigAndCompile — two verbs, two concerns

- **Source**: current
- **File**: src/cli/commands/edit.tsx (lines 435-499)
- **Function**: `writeConfigAndCompile()`
- **Lines**: ~64
- **Quality**: bad
- **Size**: L

Logging at line 442 happens BEFORE the operation it describes at line 449. Config writing and agent compilation are independent concerns sharing one function. The `let agentDefsResult` is assigned inside a try/catch. Different error strategies (warning vs warning+suggestion) for different operations in the same function.

### [S04] generateProjectConfigFromSkills — logging scattered through pure generation

- **Source**: current
- **File**: src/cli/lib/configuration/config-generator.ts (lines 47-135)
- **Function**: `generateProjectConfigFromSkills()`
- **Lines**: ~88
- **Quality**: bad
- **Size**: L

Three separate logging statements scattered through what should be a pure config generator. `verbose()` at step 2 is between agent list creation and skill lookups. The "skipped" warning at step 9 is separated from skip detection at step 4 by steps 5-8. Relentless stream: setup, log, lookup, filter, compute, filter, log, warn, group, build, build, build, return.

### [S05] discoverInstalledSkills — four discover+count+log triplets with inconsistent logging

- **Source**: current
- **File**: src/cli/lib/operations/discover-skills.ts (lines 111-153)
- **Function**: `discoverInstalledSkills()`
- **Lines**: ~42
- **Quality**: bad
- **Size**: M

Four discovery operations each followed by count then log. But logging is inconsistent: global skills logged conditionally (only if > 0), project skills logged unconditionally. Four count variables must be held in working memory. Each triplet does the same thing but is implemented slightly differently.

### [S06] tagPublicSourceSkills — two fetches to same source, two try/catches

- **Source**: current
- **File**: src/cli/lib/loading/multi-source-loader.ts (lines 180-221)
- **Function**: `tagPublicSourceSkills()`
- **Lines**: ~41
- **Quality**: bad
- **Size**: M

Two separate try/catch blocks that each do a network fetch for the SAME source. The first gets marketplace name, the second gets actual skills. Different error handling: first silently falls back, second warns. The reader has to realize these are two fetches to the same endpoint for different pieces of data.

### [S07] executeMigration — copy and uninstall interleaved in one try/catch

- **Source**: current
- **File**: src/cli/lib/installation/mode-migrator.ts (lines 81-168)
- **Function**: `executeMigration()`
- **Lines**: ~87
- **Quality**: bad
- **Size**: L

The toLocal block copies skills, then uninstalls old plugin references in the same try/catch. The uninstall loop iterates `plan.toLocal` after the project/global split already iterated different subsets — iterating the same data from a different angle. The toPlugin block has delete and install in separate loops over the same data.

### [S08] generateConfigTypesSource — six sequential "determine what's custom" passes

- **Source**: current
- **File**: src/cli/lib/configuration/config-types-writer.ts (lines 268-379)
- **Function**: `generateConfigTypesSource()`
- **Lines**: ~111
- **Quality**: bad
- **Size**: XL

Mutable `let` variables declared then assigned inside a branching block 5+ lines later. Six sequential passes to determine "what's custom" for skills, agents, categories, and domains. Domain custom-set logic: build set, delete from it, add back to it — three passes to compute one set. You need to hold 5+ dimensions in working memory simultaneously.

### [S09] Pre-refactor edit.tsx startup buffering interleave

- **Source**: git:43d766d~1
- **File**: src/cli/commands/edit.tsx (lines 100-135)
- **Function**: `Edit.run()` — startup section
- **Lines**: ~35
- **Quality**: terrible
- **Size**: M

Buffering enabled, then two completely different data sources loaded (matrix, config), then buffer drained. Config loading happens OUTSIDE any try/catch between two try/catch blocks that both handle buffer cleanup. Log messages interleaved between unrelated loading operations.

### [S10] Pre-refactor init.tsx — operations 38-48 of installLocalMode

- **Source**: git:a904b8d~1
- **File**: src/cli/commands/init.tsx (lines 440-530)
- **Function**: `Init.installLocalMode()` — compilation section
- **Lines**: ~90
- **Quality**: terrible
- **Size**: L

After config is written, the function jumps to: load agents from two sources, merge them, build compile config (three code paths: stack/agent_skills/empty), create Liquid engine, resolve agents, loop-compile each agent. Three different concerns (agent loading, config building, template rendering) with no separation. Then five separate log blocks for the success banner.

### [S11] Pre-refactor source-loader loadAndMergeFromBasePath

- **Source**: git:9189b22~1
- **File**: src/cli/lib/loading/source-loader.ts (lines 200-298)
- **Function**: `loadAndMergeFromBasePath()`
- **Lines**: ~98
- **Quality**: terrible
- **Size**: L

Config loading, schema extension, categories loading, rules loading (7 individual array merges), skill extraction, stack loading, agent domain discovery — each a different data type with its own conditional attachment to the matrix. The reader context-switches from "skill extraction" to "stack loading" to "agent domain mapping" with no transition. Schema extension must happen before validation but this ordering is implicit.

### [S12] Pre-refactor source-loader mergeLocalSkillsIntoMatrix

- **Source**: git:9189b22~1
- **File**: src/cli/lib/loading/source-loader.ts (lines 596-663)
- **Function**: `mergeLocalSkillsIntoMatrix()`
- **Lines**: ~67
- **Quality**: bad
- **Size**: L

Inside the loop: 4 inherit-or-default operations, then a 17-field object literal mixing inherited values with hardcoded defaults and existential fallbacks. After assigning the skill, suddenly switches to checking/creating the CATEGORY entry — a completely different concern embedded in a skill-merge loop. Two verbose log calls: one conditional (inside category creation) and one unconditional.

### [S13] createSkillFiles — scaffolding + marketplace update + config regen

- **Source**: current
- **File**: src/cli/commands/new/skill.ts (lines 184-242)
- **Function**: `createSkillFiles()`
- **Lines**: ~58
- **Quality**: bad
- **Size**: L

Mixes three concerns: scaffold files, update marketplace registry (nested conditional checking filesystem), regenerate config-types if ready. The marketplace check reads the filesystem AGAIN even though `resolveSkillsBasePath` already did the same check. The `configTypesReady` variable was set 100+ lines earlier in `run()`.

### [S14] loadConfigTypesDataInBackground — dynamic imports + empty catch

- **Source**: current
- **File**: src/cli/lib/configuration/config-types-writer.ts (lines 177-210)
- **Function**: `loadConfigTypesDataInBackground()`
- **Lines**: ~33
- **Quality**: bad
- **Size**: M

IIFE async function, dynamic imports to avoid circular deps (breaking reading flow), loads agents from two paths and merges them (duplicating logic from agent-recompiler.ts), filters custom agents, attaches empty `.catch()` to suppress unhandled rejections. Wraps an IIFE in a non-async function — unusual execution model.

### [S15] Pre-refactor discoverAndExtendFromLocalSkills

- **Source**: git:9189b22~1
- **File**: src/cli/lib/loading/source-loader.ts (lines 456-528)
- **Function**: `discoverAndExtendFromLocalSkills()`
- **Lines**: ~72
- **Quality**: terrible
- **Size**: L

Inside the loop: load metadata.yaml, parse, check if custom, extract fields, then load a COMPLETELY DIFFERENT file (SKILL.md), parse frontmatter, extract skill ID. The reader jumps from metadata.yaml to SKILL.md mid-loop. Dynamic YAML import between "check directory exists" and "initialize sets." Three levels of try/catch within a for loop.

---

## Category 3: Imperative Accumulation

### [A01] logChangeSummary — 5 repeated for-loops

- **Source**: current
- **File**: src/cli/commands/edit.tsx (lines 236-277)
- **Function**: `logChangeSummary()`
- **Lines**: ~41
- **Quality**: bad
- **Size**: M

Five near-identical for-loops each doing `for (const X of Y) { this.log(\` + ${getLabel(X)}\`) }` for added skills, removed skills, source changes, scope changes, agent scope changes. Classic extract-to-helper candidate.

### [A02] populateFromStack — triple-nested for loop accumulation

- **Source**: current (also git:f67358d~1 for worse version)
- **File**: src/cli/stores/wizard-store.ts (lines 579-624)
- **Function**: `populateFromStack()`
- **Lines**: ~45
- **Quality**: average
- **Size**: M

Triple-nested for loops: for each agent in stack.agents -> for each category -> for each assignment. Imperatively builds `domainSelections`, `domains`, and `allSkillIds` with duplicate checking via Set + includes. All inside a Zustand `set()` callback.

### [A03] toggleTechnology — imperative config sync

- **Source**: current
- **File**: src/cli/stores/wizard-store.ts (lines 727-765)
- **Function**: `toggleTechnology()`
- **Lines**: ~38
- **Quality**: average
- **Size**: M

Imperatively computes `removed` and `added` arrays, filters and appends to `updatedConfigs`. The exclusive/non-exclusive branching plus "sync skillConfigs" logic. Returns deeply nested state spread for `domainSelections[domain][category]`.

### [A04] toggleDomain — imperative set ops with nested loops

- **Source**: git:f67358d~1
- **File**: src/cli/stores/wizard-store.ts (lines 600-640)
- **Function**: `toggleDomain()`
- **Lines**: ~55
- **Quality**: bad
- **Size**: L

Imperatively collects removed skill IDs with nested for-loops over `Object.values()`, filters `skillConfigs`. The restore branch manually iterates over stack selections to build `restoredSkillIds`, checks against existing IDs, creates new configs.

### [A05] buildAgentSkills — triple-nested loop with non-null assertions

- **Source**: git:b6f7b90~1
- **File**: src/cli/lib/config-generator.ts (lines 120-175)
- **Function**: `buildAgentSkills()`
- **Lines**: ~55
- **Quality**: bad
- **Size**: L

For each skillId -> get agents -> for each agent -> push to accumulated map. Uses `agentSkills[typedAgentId]!.push(...)` after conditional initialization. `shouldPreloadSkill()` branching adds a 4th level.

### [A06] buildCompileConfig — imperative object construction in loop

- **Source**: current
- **File**: src/cli/lib/agents/agent-recompiler.ts (lines 95-117)
- **Function**: `buildCompileConfig()`
- **Lines**: ~23
- **Quality**: bad
- **Size**: M

Loop builds `compileAgents` object imperatively. Should be `Object.fromEntries(agentNames.map(...))`. Warnings accumulated in array but only pushed at end.

### [A07] getAllSelectedTechnologies — nested iteration over nested maps

- **Source**: current
- **File**: src/cli/stores/wizard-store.ts (lines 947-960)
- **Function**: `getAllSelectedTechnologies()`
- **Lines**: ~13
- **Quality**: average
- **Size**: S

Nested for-loops over `domainSelections` -> `domainSel[category]` to flatten all selected skill IDs. Could be `Object.values(domainSelections).flatMap(d => Object.values(d ?? {}).flat())`.

### [A08] classifySkillDirs — for-loop with conditional push to two arrays

- **Source**: current
- **File**: src/cli/commands/uninstall.tsx (lines 404-432)
- **Function**: `removeMatchingSkills()` (inner classification loop)
- **Lines**: ~28
- **Quality**: bad
- **Size**: M

Manual for-loop pushing to `removedNames` or `skippedNames` based on a condition. Textbook `partition()`.

### [A09] compileAllSkills — sequential I/O in imperative loop

- **Source**: current
- **File**: src/cli/lib/compiler.ts (lines 279-337)
- **Function**: `compileAllSkills()`
- **Lines**: ~59
- **Quality**: bad
- **Size**: L

Good opening: `pipe(Object.values(resolvedAgents), flatMap(...), filter(...))` with `uniqueBy()`. Then falls into imperative `for` loop with 3-level nesting (isFolder? -> file type conditional -> check subdirs). Each subdirectory (examples, scripts) uses repeated pattern.

### [A10] resolveStackSkills — 3 resolution strategies + directory expansion

- **Source**: git:9634c8a~1
- **File**: src/cli/lib/resolver.ts (lines 210-285)
- **Function**: `resolveStackSkills()`
- **Lines**: ~75
- **Quality**: bad
- **Size**: L

3 resolution strategies (array, categorized object, fallback) selected by nested if-else. Then iterates with `expandSkillIdIfDirectory()`. Uses Set for dedup alongside array accumulation. Throws with multi-line error messages constructed inline.

### [A11] Pre-refactor compile discoverAllSkills — 4 sequential load+count+log

- **Source**: git:43d766d~1
- **File**: src/cli/commands/compile.ts (lines 195-260)
- **Function**: `Compile.discoverAllSkills()`
- **Lines**: ~65
- **Quality**: terrible
- **Size**: L

Four separate load-then-count-then-log pairs from different sources. The conditional skip logic (`isGlobalProject`) checked twice. More `verbose()`/`this.log()` calls than actual data operations. Three-way conditional just to format a summary message.

### [A12] groupSkillsByBucket — imperative bucket assignment

- **Source**: current
- **File**: src/cli/components/wizard/info-panel.tsx (lines 101-130)
- **Function**: `groupSkillsByBucket()`
- **Lines**: ~30
- **Quality**: average
- **Size**: M

Manual for-loop with 4-way if/else (global+local, global+plugin, project+local, project+plugin) pushing to bucket arrays. A textbook `groupBy` candidate.

---

## Category 4: Code Duplication

### [D01] validateSkillFrontmatter / validateAgentFrontmatter — 80% identical

- **Source**: current
- **File**: src/cli/lib/plugins/plugin-validator.ts (lines 185-264)
- **Functions**: `validateSkillFrontmatter()`, `validateAgentFrontmatter()`
- **Lines**: ~34 each, 80% duplicated
- **Quality**: bad
- **Size**: L (combined)

Both do: extract frontmatter, validate against schema, check name is kebab-case. Only difference is the schema and optional name-check. Should be `validateFrontmatterContent(content, schema, additionalChecks?)`.

### [D02] removeMatchingSkills / removeMatchingAgents — same structure

- **Source**: current
- **File**: src/cli/commands/uninstall.tsx (lines 395-432, 460-497)
- **Functions**: `removeMatchingSkills()`, `removeMatchingAgents()`
- **Lines**: ~37 each
- **Quality**: bad
- **Size**: L (combined)

Nearly identical: classify items, remove matching, clean up empty directory. No generic "remove matching items" function.

### [D03] installLocal / installPluginConfig — 70% copied

- **Source**: git:283ebaa~1
- **File**: src/cli/lib/installation/local-installer.ts
- **Functions**: `installLocal()`, `installPluginConfig()`
- **Lines**: ~250 combined
- **Quality**: terrible
- **Size**: XL

Both call the same 5 functions in the same order with nearly identical parameters. The post-install display logic is copy-pasted verbatim.

### [D04] 5 near-identical resolve functions

- **Source**: git:2388e90~1
- **File**: src/cli/lib/matrix/matrix-resolver.ts
- **Functions**: `resolveConflicts`, `resolveCompatibilityGroups`, `resolveRequirements`, `resolveAlternatives`, `resolveDiscourages`
- **Lines**: ~82 combined
- **Quality**: bad
- **Size**: L

All five follow identical pattern: iterate rules, map slugs to IDs, filter nulls, check membership. Reduced to a single `resolveRelationships` in the refactor.

### [D05] isDiscouraged / getDiscourageReason — bool vs string split

- **Source**: git:2388e90~1
- **File**: src/cli/lib/matrix/matrix-resolver.ts
- **Functions**: `isDiscouraged()` (~45 lines), `getDiscourageReason()` (~45 lines)
- **Lines**: ~90 combined
- **Quality**: terrible
- **Size**: L

Exact same three-phase traversal. `isDiscouraged` returns `true`; `getDiscourageReason` returns a string. A single function returning `{ discouraged: boolean; reason?: string }` eliminates ~40 lines.

### [D06] isRecommended / getRecommendReason — same pattern again

- **Source**: git:2388e90~1
- **File**: src/cli/lib/matrix/matrix-resolver.ts
- **Functions**: `isRecommended()`, `getRecommendReason()`
- **Lines**: ~35 combined
- **Quality**: bad
- **Size**: M

Same bool+reason split. `getRecommendReason` just returns `skill.recommendedReason` making the split pointless.

### [D07] loadFromLocal / loadFromRemote — near-identical copies

- **Source**: git:f5b1735~1
- **File**: src/cli-v2/lib/source-loader.ts
- **Functions**: `loadFromLocal()`, `loadFromRemote()`
- **Lines**: ~40 each
- **Quality**: bad
- **Size**: L (combined)

~30 lines of identical logic: matrix-path resolution, skills extraction, matrix merge, stack loading. Only difference is source of `skillsPath`.

### [D08] generateStandaloneConfig / generateProjectConfigWithGlobalImport

- **Source**: git:a3fc923~1
- **File**: src/cli/lib/configuration/config-writer.ts (lines 160-330)
- **Functions**: Both
- **Lines**: ~80 each
- **Quality**: bad
- **Size**: XL (combined)

Both imperatively build TypeScript source line-by-line using `lines.push()`. The second adds an import preamble. 80% identical. Both manually track which types to import based on boolean flags.

### [D09] Doctor skip blocks — same 6-line block copy-pasted 3x

- **Source**: git:43d766d~1
- **File**: src/cli/commands/doctor.ts (lines 350-420)
- **Lines**: ~70
- **Quality**: terrible
- **Size**: L

Identical `skipResult` block (status "skip", message "Skipped (config invalid)", formatCheckLine, forEach log) repeated 3 times for different checks.

### [D10] Pre-refactor compile — runPluginModeCompile / runCustomOutputCompile

- **Source**: git:7ca8a07
- **File**: src/cli/commands/compile.ts
- **Functions**: Both
- **Lines**: ~180 + ~120
- **Quality**: terrible
- **Size**: XL

Near-complete copy of skill discovery, source resolution, and dry-run handling. Same hand-rolled YAML parser duplicated.

---

## Category 5: Field-by-Field Repetition

### [F01] Init config merge — 18 sequential if-blocks

- **Source**: git:a904b8d~1
- **File**: src/cli/commands/init.tsx (lines 395-470)
- **Lines**: ~80
- **Quality**: terrible
- **Size**: L

18 `if (existingConfig.fieldName) { localConfig.fieldName = existingConfig.fieldName }` blocks. Three different merge strategies (simple override, array union, deep merge) hidden in the list with no differentiation.

### [F02] Relationship merging — 7 array spreads

- **Source**: current (also git:9189b22~1)
- **File**: src/cli/lib/loading/source-loader.ts (lines 237-259)
- **Lines**: ~23
- **Quality**: bad
- **Size**: M

`[...sourceRules.relationships.conflicts, ...defaultRules.relationships.conflicts]` repeated for all 7 relationship types. Should be a loop over relationship keys.

### [F03] sanitizeCompiledAgentData — repetitive field sanitization

- **Source**: current
- **File**: src/cli/lib/compiler.ts (lines 77-112)
- **Function**: `sanitizeCompiledAgentData()`
- **Lines**: ~36
- **Quality**: bad
- **Size**: M

Every field sanitized with the same pattern. Lines 83, 86 repeat the same array-check pattern. Should be a generic `sanitizeFields(data, fieldList)`.

### [F04] splitConfigByScope — 6 parallel filter/split operations

- **Source**: git:bd55731~1
- **File**: src/cli/lib/configuration/config-generator.ts
- **Function**: `splitConfigByScope()`
- **Lines**: ~55
- **Quality**: bad
- **Size**: L

6 separate filter-split-reassemble sequences: skills, agents, stack, selectedAgents, domains. Each creates intermediate variables (`globalSkills`, `projectSkills`, etc.) and manually assembles two config objects. Screams for a generic "partition by scope" utility.

### [F05] Wizard layout dropdown construction — sequential if-blocks

- **Source**: current
- **File**: src/cli/components/wizard/wizard-layout.tsx (lines 125-154)
- **Lines**: ~30
- **Quality**: average
- **Size**: M

Sequential `if (store.step === "stack")`, `if (store.step === "domains")`, `if (store.step === "sources")` building dropdown config objects. Should be a map-based approach.

### [F06] Step-settings raw text input — character-by-character handling

- **Source**: git:a7ca0fe~1
- **File**: src/cli/components/wizard/step-settings.tsx
- **Lines**: ~215
- **Quality**: bad
- **Size**: XL

Manually implements text input by tracking char codes, 6 useState hooks for different UI modes, two-mode branching in useInput handler. A mini state machine without the state machine.

### [F07] Pre-refactor config-types-writer — 4 custom-set computations

- **Source**: current
- **File**: src/cli/lib/configuration/config-types-writer.ts (lines 316-355)
- **Lines**: ~40
- **Quality**: bad
- **Size**: M

Repeated pattern: "iterate matrix, check property, add to set" done separately for skills, agents, categories, and domains. Each with its own `Set<>` and its own iteration loop.

### [F08] validatePluginManifest — scattered field checks

- **Source**: current
- **File**: src/cli/lib/plugins/plugin-validator.ts (lines 114-183)
- **Function**: `validatePluginManifest()`
- **Lines**: ~69
- **Quality**: average
- **Size**: L

Schema validation, then kebab-case check, then semver check, then description check, then directory path resolution, then filesystem existence checks. Pure validations and I/O validations interleaved in a flat list.

---

## Category 6: Mixed Concerns

### [M01] validateSource — 4 implicit phases

- **Source**: current
- **File**: src/cli/lib/source-validator.ts (lines 118-234)
- **Function**: `validateSource()`
- **Lines**: ~116
- **Quality**: bad
- **Size**: XL

Phase 2 re-checks `fileExists(skillMdPath)` even though Phase 1 already built `skillMdDirs` with this info. Convention validation called in two different control flow paths (schema failure branch AND success branch) with different arguments.

### [M02] fetchSkills — dead code + 3 mixed concerns

- **Source**: current
- **File**: src/cli/lib/skills/skill-fetcher.ts (lines 1-90)
- **Function**: `fetchSkills()`
- **Lines**: ~74
- **Quality**: bad
- **Size**: L

Plugin source resolution, skill path resolution, file copying. The `plugin` variable is found but never used (dead code). Should delegate more to helpers.

### [M03] executeInstallation — duplicated mode branching

- **Source**: current
- **File**: src/cli/lib/operations/execute-installation.ts
- **Function**: `executeInstallation()`
- **Lines**: ~74
- **Quality**: bad
- **Size**: L

Branches on install mode with nearly identical fallback logic at lines 52-68 and 83-99. Mode-handler strategy would eliminate the duplication.

### [M04] recompileAgents — long pipeline

- **Source**: current
- **File**: src/cli/lib/agents/agent-recompiler.ts (lines 157-231)
- **Function**: `recompileAgents()`
- **Lines**: ~74
- **Quality**: average
- **Size**: L

Chains operations with intermediate variables. The concerns (load agents, build config, resolve, compile, write) are sequential but could be clearer with named phases.

### [M05] validatePlugin — reads same file twice

- **Source**: current
- **File**: src/cli/lib/plugins/plugin-validator.ts (lines 351-370)
- **Function**: `validatePlugin()`
- **Lines**: ~19
- **Quality**: bad
- **Size**: S

`validatePluginManifest` parses `plugin.json`, then `loadManifestForValidation` reads it AGAIN because the validation function doesn't return its parsed result.

### [M06] Pre-refactor search runInteractive — search becomes import

- **Source**: git:8ca0d11
- **File**: src/cli/commands/search.tsx
- **Function**: `runInteractive()`
- **Lines**: ~80
- **Quality**: bad
- **Size**: L

Contains inline skill importing logic after search resolves. Fabricates metadata: `category: "imported"`, `author: "@" + source.name`. Derives display names from directory names via `split("-").map(titleCase)`.

### [M07] loadSkillsFromDir — scanning + parsing + warning in one loop

- **Source**: current
- **File**: src/cli/lib/operations/discover-skills.ts (lines 24-76)
- **Function**: `loadSkillsFromDir()`
- **Lines**: ~53
- **Quality**: bad
- **Size**: L

Loop processes skills with nested conditions: metadata existence check, frontmatter parsing try-catch, missing frontmatter handler. Warnings scattered throughout. The `relativePath` computation is duplicated at lines 39-40 and 64.

### [M08] Pre-refactor ejectAgentPartials — boolean flag matrix

- **Source**: git:73a8297
- **File**: src/cli/commands/eject.ts
- **Function**: `ejectAgentPartials()`
- **Lines**: ~60
- **Quality**: bad
- **Size**: L

`directOutput` boolean propagates through every function creating two subtly different paths. `templatesFlag` adds another dimension: 2x2 behavior matrix. `destDir` is a 3-way ternary.

### [M09] Pre-refactor init handleInstallation — dry-run duplicates real path

- **Source**: git:95301f4
- **File**: src/cli/commands/init.tsx
- **Function**: `handleInstallation()`
- **Lines**: ~65
- **Quality**: bad
- **Size**: L

3-tier fallback cascade (stack -> marketplace -> local mode). Each tier has its own dry-run AND real-execution paths. The `flags` parameter is typed as `any`.

### [M10] generateMarketplace — file scan + transform + sort

- **Source**: current
- **File**: src/cli/lib/marketplace-generator.ts
- **Function**: `generateMarketplace()`
- **Lines**: ~53
- **Quality**: bad
- **Size**: L

Glob execution, manifest parsing, data transformation, sorting. Error handling inconsistent: continue on read failure but not on parse failure. No abstraction of plugin-to-marketplace-entry conversion.

### [M11] Pre-refactor eject ensureMinimalConfig — 3 config sources

- **Source**: git:6d2e057
- **File**: src/cli/commands/eject.ts
- **Function**: `ensureMinimalConfig()`
- **Lines**: ~55
- **Quality**: bad
- **Size**: L

Builds `Record<string, unknown>` imperatively (6 conditional assignments), serializes with YAML, concatenates a 15-line comment string. Three different config-loading paths. Couples config initialization to the eject workflow.

### [M12] validateAllPlugins — verbose discovery + result aggregation

- **Source**: current
- **File**: src/cli/lib/plugins/plugin-validator.ts (lines 381-457)
- **Function**: `validateAllPlugins()`
- **Lines**: ~76
- **Quality**: average
- **Size**: L

Plugin discovery loop with verbose logging, result aggregation, suffix-based filtering logic repeated in skill/agent validators.

---

## Category 7: Nested Conditionals

### [N01] resolveTargetSkills — 4+ branches with early returns

- **Source**: current
- **File**: src/cli/commands/update.tsx (lines 166-222)
- **Function**: `resolveTargetSkills()`
- **Lines**: ~56
- **Quality**: bad
- **Size**: L

Single-skill path deeply nested within bulk-update flow. Checks: found? current? local-only? Each with its own error message including similarity suggestions.

### [N02] Pre-refactor update findSkillByPartialMatch — 3-tier fallback

- **Source**: git:af87ddb
- **File**: src/cli/commands/update.tsx
- **Function**: `findSkillByPartialMatch()`
- **Lines**: ~30
- **Quality**: terrible
- **Size**: M

Exact match -> partial name match -> directory name match. The exact "multi-tier resolution fallback" pattern banned in CLAUDE.md.

### [N03] resolveSkillsDir — 3 sequential error conditions

- **Source**: current
- **File**: src/cli/commands/import/skill.ts (lines 161-180)
- **Function**: `resolveSkillsDir()`
- **Lines**: ~19
- **Quality**: bad
- **Size**: S

Null byte check, absolute path check, path escape check as sequential if-throw blocks. The path escape check spans 6 lines for what should be a one-liner.

### [N04] Pre-refactor validateProjectConfig — hand-rolled Zod replacement

- **Source**: git:b6f7b90~1
- **File**: src/cli/lib/project-config.ts
- **Function**: `validateProjectConfig()`
- **Lines**: ~250
- **Quality**: terrible
- **Size**: XL

Hand-rolled validation with 3 nesting levels: outer field check -> array iteration -> inner type checks. Separate `validateCustomAgents()`, `validateCustomAgentConfig()`, `validateSkillEntry()`, `validateAgentSkillConfig()` each doing the same `typeof` + `Array.isArray` + nested field validation. All replaced by Zod schemas.

### [N05] SkillTag nested ternary for label visibility

- **Source**: current
- **File**: src/cli/components/wizard/category-grid.tsx (lines 117-123)
- **Function**: `SkillTag` component
- **Lines**: ~7
- **Quality**: average
- **Size**: S

`hasRequiredBy ? getLabel() : hasUnmetDeps ? getLabel() : showLabels && isFocused ? getLabel() : null` — nested ternary for conditional display. Should be a named function.

### [N06] Pre-refactor eject — 2x2 boolean behavior matrix

- **Source**: git:73a8297
- **File**: src/cli/commands/eject.ts
- **Function**: `ejectAgentPartials()`
- **Lines**: ~60
- **Quality**: bad
- **Size**: L

`directOutput` x `templatesFlag` creates 4 code paths. `destDir` is `directOutput ? outputBase : templatesFlag ? ... : ...`. Reader must simulate all combinations to understand behavior.

### [N07] regenerateConfigTypes — scope branching

- **Source**: current
- **File**: src/cli/lib/configuration/config-types-writer.ts (lines 220-256)
- **Function**: `regenerateConfigTypes()`
- **Lines**: ~36
- **Quality**: average
- **Size**: M

Mutable `let source` declared then assigned inside an if/else. Three concerns (resolve scope, generate content, write file) that should be separate.

### [N08] Pre-refactor loadSkillsMatrixFromSource — fallback anti-pattern

- **Source**: git:9189b22~1
- **File**: src/cli/lib/loading/source-loader.ts (lines 100-115)
- **Lines**: ~15
- **Quality**: terrible
- **Size**: S

The fragile fallback: `if (localSkills.length === 0) { try global }`. If project has 1 skill, all global skills are invisible. The "if empty, try fallback" pattern instead of "always merge both."

### [N09] Pre-refactor resolveAgents — mixed validation + error message building

- **Source**: git:9634c8a~1
- **File**: src/cli/lib/resolver.ts (lines 385-425)
- **Function**: `resolveAgents()`
- **Lines**: ~40
- **Quality**: bad
- **Size**: M

Error message construction at lines 164-173 checks available agents and formats suggestions inline. Validates AND resolves AND builds configs. Structural cast comment indicates type safety gap.

### [N10] Pre-refactor validatePluginsAction — 3-branch success/failure

- **Source**: git:dfb5e47
- **File**: src/cli/commands/validate.ts
- **Function**: `validatePluginsAction()`
- **Lines**: ~75
- **Quality**: terrible
- **Size**: L

4 identical try/catch blocks. Summary formatting with raw `console.log` repeated 4 times. Three branches: valid+no-warnings, valid+warnings, invalid — each with `console.log` + `process.exit` combo.

---

## Category 8: Scattered Side Effects

### [E01] discoverAllSkills — more log calls than operations

- **Source**: git:43d766d~1
- **File**: src/cli/commands/compile.ts (lines 195-260)
- **Function**: `Compile.discoverAllSkills()`
- **Lines**: ~65
- **Quality**: bad
- **Size**: L

(Also listed as A11.) More `verbose()`/`this.log()` calls than actual data operations. Each of 4 discovery operations immediately followed by a conditional log.

### [E02] generateProjectConfigFromSkills — 3 log statements in a "pure" generator

- **Source**: current
- **File**: src/cli/lib/configuration/config-generator.ts (lines 47-135)
- **Function**: `generateProjectConfigFromSkills()`
- **Lines**: ~88
- **Quality**: bad
- **Size**: L

(Also listed as S04.) Three `verbose()` calls in a function named "generate." A config generator should be pure.

### [E03] Pre-refactor doctor formatTips — matches on display text

- **Source**: git:43d766d~1
- **File**: src/cli/commands/doctor.ts
- **Function**: `formatTips()`
- **Lines**: ~25
- **Quality**: terrible
- **Size**: M

Checks `r.message.includes("recompilation")` and `r.message.includes("config")` to decide which tips to show. Brittle coupling to display text strings.

### [E04] Pre-refactor uninstall — duplicate display for --yes and interactive

- **Source**: git:43d766d~1
- **File**: src/cli/commands/uninstall.tsx
- **Lines**: ~30
- **Quality**: bad
- **Size**: M

The same removal plan rendered as a React component (interactive path) AND as plain text (--yes path). Two completely different rendering paradigms for the same information.

### [E05] writeConfigAndCompile — log before operation

- **Source**: current
- **File**: src/cli/commands/edit.tsx (lines 435-499)
- **Function**: `writeConfigAndCompile()`
- **Lines**: ~64
- **Quality**: bad
- **Size**: L

(Also listed as S03.) Logging at line 442 happens BEFORE the operation it describes at line 449.

### [E06] Pre-refactor compile — success banner as 5 separate log calls

- **Source**: git:a904b8d~1
- **File**: src/cli/commands/init.tsx (lines 575-605)
- **Lines**: ~30
- **Quality**: average
- **Size**: M

Five separate `this.log()` calls with manual formatting for directory listings, config path, and instructions. Each has its own template literal with padding/colors.

### [E07] validatePlugin chain — warn inside loop, aggregate outside

- **Source**: current
- **File**: src/cli/lib/plugins/plugin-validator.ts
- **Lines**: ~40 across several functions
- **Quality**: average
- **Size**: M

Warnings emitted during iteration (plugin-by-plugin) but results aggregated for summary display. The reader sees side effects mid-loop interleaved with return value construction.

### [E08] Wizard store decorative section headers

- **Source**: git:f5b1735~1
- **File**: src/cli-v2/stores/wizard-store.ts
- **Lines**: ~24 (pure noise)
- **Quality**: bad
- **Size**: S

8 ASCII-art section dividers (`// ─────────`) adding 24 lines of decorative noise. Fields grouped under them (`focusedRow`, `focusedCol`) are self-documenting.

---

## Category 9: Parameter Overload

### [P01] compileAndWriteAgents — 8 parameters

- **Source**: git:283ebaa~1
- **File**: src/cli/lib/installation/local-installer.ts
- **Function**: `compileAndWriteAgents()`
- **Lines**: ~45
- **Quality**: bad
- **Size**: M

8 parameters (6 required + 2 optional). Most could be bundled into a context object.

### [P02] getAgentSkills — 7 params, 2 unused

- **Source**: git:9634c8a~1
- **File**: src/cli/lib/resolver.ts
- **Function**: `getAgentSkills()`
- **Lines**: ~40
- **Quality**: terrible
- **Size**: M

7 parameters, 2 prefixed with `_` (unused). A `GetAgentSkillsOptions` interface was defined but the function uses positional parameters instead.

### [P03] resolveAgents — 6 params, ignored options interface

- **Source**: git:9634c8a~1
- **File**: src/cli/lib/resolver.ts
- **Function**: `resolveAgents()`
- **Lines**: ~40
- **Quality**: bad
- **Size**: M

6 parameters with a `ResolveAgentsOptions` interface defined but never used.

### [P04] buildCategoriesForDomain — 7 parameters

- **Source**: git:a7ca0fe~1
- **File**: src/cli/components/wizard/step-build.tsx
- **Function**: `buildCategoriesForDomain()`
- **Lines**: ~50
- **Quality**: bad
- **Size**: L

7 parameters for a function that was later moved to `build-step-logic.ts`. The parameter count indicates the function is doing too much.

### [P05] Pre-refactor eject — directOutput threaded through every function

- **Source**: git:73a8297
- **File**: src/cli/commands/eject.ts
- **Lines**: across 4 functions
- **Quality**: bad
- **Size**: M per function

`directOutput` boolean propagated through `ejectTemplates`, `ejectConfig`, `ejectSkills`, `ejectAgentPartials`. Each function has two subtly different paths based on this flag. Boolean-driven polymorphism anti-pattern.

### [P06] Pre-refactor init installIndividualPlugins — 5+ contextual params

- **Source**: git:a904b8d~1
- **File**: src/cli/commands/init.tsx
- **Function**: `installIndividualPlugins()`
- **Lines**: ~100
- **Quality**: bad
- **Size**: XL

References `flags`, `sourceResult`, `projectDir`, `marketplaceInfo`, `selectedStack` from outer scope. Not technically parameters but effectively captures 5+ contextual dependencies.

---

## Category 10: Clean Examples (Reference)

What "done right" looks like — for calibrating test expectations.

### [C01] toggleFilterIncompatible — thin orchestrator with pure helpers

- **Source**: current
- **File**: src/cli/stores/wizard-store.ts (lines 797-815)
- **Function**: `toggleFilterIncompatible()`
- **Lines**: ~19
- **Quality**: good
- **Size**: S

Guard clauses, named pure function calls (`findIncompatibleWebSkills`, `removeSkillsFromSelections`), assembly. No inline data transformations.

### [C02] formatColoredDiff — clean pipeline

- **Source**: current
- **File**: src/cli/commands/diff.ts (lines 281-309)
- **Function**: `formatColoredDiff()` + `isContentChangeLine()`
- **Lines**: ~28
- **Quality**: good
- **Size**: M

`split().map().join()` pipeline. Named predicate function with clear documentation.

### [C03] useBuildStepProps — thin orchestrator hook

- **Source**: current
- **File**: src/cli/components/hooks/use-build-step-props.ts (lines 12-61)
- **Function**: `useBuildStepProps()`
- **Lines**: ~49
- **Quality**: good
- **Size**: M

Reads store, derives values, creates callbacks, returns single props object. All logic clear and focused.

### [C04] useFrameworkFiltering — memoized pure function

- **Source**: current
- **File**: src/cli/components/hooks/use-framework-filtering.ts (lines 16-36)
- **Function**: `useFrameworkFiltering()`
- **Lines**: ~20
- **Quality**: good
- **Size**: S

Wraps `useMemo` around a pure function call. Simple, focused, zero side effects.

### [C05] useModalState — reusable generic hook

- **Source**: current
- **File**: src/cli/components/hooks/use-modal-state.ts (lines 14-28)
- **Function**: `useModalState<T>()`
- **Lines**: ~14
- **Quality**: good
- **Size**: S

Generic type parameter, two callbacks, clean interface. Perfect reusable abstraction.

### [C06] detectProject — pure composition

- **Source**: current
- **File**: src/cli/lib/operations/detect-project.ts
- **Function**: `detectProject()`
- **Lines**: ~15
- **Quality**: good
- **Size**: S

Composes simpler operations. Returns null for missing state (no throwing). Clear return type.

### [C07] Doctor check functions — consistent single-concern returns

- **Source**: current
- **File**: src/cli/commands/doctor.ts (lines 35-231)
- **Functions**: `checkConfigValid()`, `checkSkillsResolved()`, `checkAgentsCompiled()`, `checkNoOrphans()`, `checkSourceReachable()`
- **Lines**: ~15-40 each
- **Quality**: good
- **Size**: S-M

Each returns consistent `CheckResult` type. Pure logic, single concern, well-isolated.

### [C08] Helper functions above wizard store

- **Source**: current
- **File**: src/cli/stores/wizard-store.ts (lines 28-77)
- **Functions**: `createDefaultSkillConfig()`, `getAllDomainsFromCategories()`, `sortDomainsCanonically()`, `findIncompatibleWebSkills()`, `removeSkillsFromSelections()`
- **Lines**: ~5-15 each
- **Quality**: good
- **Size**: S

Pure, focused, no global state reads. Clear inputs/outputs.

### [C09] typedEntries / typedKeys — type-safe utilities

- **Source**: current
- **File**: src/cli/utils/typed-object.ts
- **Lines**: ~8 each
- **Quality**: good
- **Size**: S

Preserve generic types without casting. Pure functions, clear intent.

### [C10] fs utilities — defensive wrapper layer

- **Source**: current
- **File**: src/cli/utils/fs.ts (lines 1-73)
- **Functions**: `readFile`, `fileExists`, `writeFile`, etc.
- **Lines**: 3-10 each
- **Quality**: good
- **Size**: S

Size limits for DoS prevention, consistent async/await, single responsibility.

### [C11] buildCompilePasses + formatDiscoveryMessage — extracted helpers

- **Source**: current
- **File**: src/cli/commands/compile.ts (lines 195-223)
- **Functions**: `buildCompilePasses()`, `formatDiscoveryMessage()`
- **Lines**: ~15 each
- **Quality**: good
- **Size**: S

Pure functions with clear single responsibility. Extracted from the former god method.

### [C12] schema-validator VALIDATION_TARGETS — table-driven architecture

- **Source**: current
- **File**: src/cli/lib/schema-validator.ts (lines 61-154)
- **Lines**: ~93
- **Quality**: good
- **Size**: L

Declarative array drives all validation logic. Each entry is self-describing. No if-else chains.

### [C13] Wizard renderStep — clean dispatcher

- **Source**: current
- **File**: src/cli/components/wizard/wizard.tsx (lines 218-277)
- **Function**: `renderStep()`
- **Lines**: ~60
- **Quality**: good
- **Size**: L

Switch statement dispatching to child components. Store reads at top, rendering below.

### [C14] Step agents — pure helpers + memoized data

- **Source**: current
- **File**: src/cli/components/wizard/step-agents.tsx (lines 166-306)
- **Functions**: `buildAgentGroups()`, `buildFlatRows()`, `buildFocusableIds()` + component
- **Lines**: ~140 total
- **Quality**: good
- **Size**: XL

Complex data preparation done in pure functions outside the component, cached with useMemo. Component is thin.

### [C15] getInstallModeLabel — clear derivation

- **Source**: current
- **File**: src/cli/components/wizard/step-confirm.tsx (lines 23-32)
- **Function**: `getInstallModeLabel()`
- **Lines**: ~10
- **Quality**: good
- **Size**: S

Pure function with early returns. Encapsulates mode-determination. No side effects.

---

## Selection Guide: Picking 20 Test Cases

Aim for coverage across categories and sizes. Suggested distribution:

| Category                | Pick | Rationale                                      |
| ----------------------- | ---- | ---------------------------------------------- |
| God Functions           | 3    | Need XL examples to test decomposition ability |
| Stream of Consciousness | 3    | The pattern the user cares most about          |
| Imperative Accumulation | 3    | Common, clearly measurable improvement         |
| Code Duplication        | 2    | Tests ability to unify                         |
| Field-by-Field          | 2    | Tests ability to abstract repetition           |
| Mixed Concerns          | 2    | Tests ability to separate responsibilities     |
| Nested Conditionals     | 2    | Tests ability to flatten/simplify              |
| Scattered Side Effects  | 1    | Tests ability to group I/O                     |
| Parameter Overload      | 1    | Tests ability to restructure interfaces        |
| Clean Examples          | 1    | Control: should recognize and leave alone      |

**Priority picks** (best test value per example):

| ID  | Why                                                                          |
| --- | ---------------------------------------------------------------------------- |
| G03 | 290-line init with 18-field merge — tests decomposition + repetition removal |
| G01 | 463-line edit run() — the ultimate decomposition challenge                   |
| G04 | Doctor with copy-pasted skip blocks — tests duplication recognition          |
| S01 | createMarketplaceFiles 30 inline steps — purest stream-of-consciousness      |
| S04 | generateProjectConfigFromSkills — logging in a "pure" function               |
| S07 | executeMigration — interleaved copy/uninstall concerns                       |
| A02 | populateFromStack — nested imperative accumulation                           |
| A09 | compileAllSkills — good opening, then falls into imperative loop             |
| A08 | classifySkillDirs — textbook partition candidate                             |
| D01 | validateSkillFrontmatter pair — tests unification                            |
| D05 | isDiscouraged/getDiscourageReason — bool/string split                        |
| F01 | 18-field config merge — tests repetition elimination                         |
| F03 | sanitizeCompiledAgentData — tests DRY extraction                             |
| M01 | validateSource 4 phases — tests phase separation                             |
| M03 | executeInstallation duplicated branches — tests strategy pattern             |
| N04 | hand-rolled validateProjectConfig — tests "recognize Zod replacement"        |
| N01 | resolveTargetSkills branches — tests simplification                          |
| E03 | formatTips string matching — tests recognizing brittle coupling              |
| P02 | getAgentSkills 7 params — tests interface restructuring                      |
| C01 | toggleFilterIncompatible — control: already clean                            |

---

## Multi-Axis Scoring Rubric

Each test case is rated 0-3 on every axis. After refactoring, rate again. The delta is the score.

### Axis Definitions

| Axis                                | 0 (Clean)                   | 1 (Minor)                                 | 2 (Moderate)                                   | 3 (Severe)                                   |
| ----------------------------------- | --------------------------- | ----------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| **GOD** — God Function              | Single concern, <30 lines   | 2-3 concerns, 30-60 lines                 | 5+ concerns, 60-150 lines                      | Entire workflow, 150+ lines                  |
| **SOC** — Stream of Consciousness   | Clear phases, coherent flow | Minor interleaving (1-2 context switches) | Frequent switching (3-5 unrelated transitions) | No discernible structure                     |
| **IMP** — Imperative Accumulation   | Declarative throughout      | 1-2 imperative loops                      | Dominant pattern, nested mutation              | Triple-nested loops with manual accumulation |
| **DUP** — Code Duplication          | DRY                         | Minor repetition (2-3 lines)              | Copy-paste blocks (10+ lines)                  | Near-identical sibling functions             |
| **FBF** — Field-by-Field Repetition | Abstracted / loop-driven    | 2-3 repetitions                           | 5-8 repetitions                                | 10+ (the 18-field merge)                     |
| **MIX** — Mixed Concerns            | Single concern              | 2 concerns in one function                | 3-4 concerns                                   | Validation + I/O + UI + state in one         |
| **NST** — Nested Conditionals       | Flat with guards            | 2 nesting levels                          | 3 levels, multi-branch                         | 4+ levels, boolean flag matrices             |
| **SFX** — Scattered Side Effects    | I/O grouped at boundaries   | Minor interleaving                        | Logging between every operation                | Side effects drive control flow              |
| **PRM** — Parameter Overload        | 0-2 params                  | 3-4 params                                | 5-6 params                                     | 7+ or unused params present                  |
| **TST** — Testability               | Pure, no setup needed       | Needs fixtures/data                       | Needs mocks for I/O                            | Untestable without full integration          |

### Automation Guide

| Axis | Method                                                           | Tool            |
| ---- | ---------------------------------------------------------------- | --------------- |
| GOD  | Count LOC + distinct I/O calls + return types                    | ts-morph AST    |
| SOC  | **LLM judge** — needs intent understanding                       | LLM-as-judge    |
| IMP  | Count `for`/`while` vs `.map()`/`.filter()`/`.flatMap()`         | ts-morph AST    |
| DUP  | Structural similarity between functions                          | ts-morph + diff |
| FBF  | Count repeated pattern instances                                 | regex / AST     |
| MIX  | **LLM judge** — needs concern boundary understanding             | LLM-as-judge    |
| NST  | Max nesting depth of control flow                                | ts-morph AST    |
| SFX  | **Partially** — detect I/O calls between pure expressions        | ts-morph + LLM  |
| PRM  | Count function parameters                                        | ts-morph AST    |
| TST  | **Partially** — detect side-effect dependencies (fs, net, store) | ts-morph + LLM  |

---

## Multi-Axis Ratings: 20 Recommended Test Cases

Scale: 0 (clean) to 3 (severe). Higher = worse = more room for improvement.

| ID      | GOD | SOC | IMP | DUP | FBF | MIX | NST | SFX | PRM | TST | Size | Difficulty    |
| ------- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---- | ------------- |
| **G01** | 3   | 3   | 2   | 1   | 1   | 3   | 2   | 3   | 1   | 3   | XL   | Architectural |
| **G03** | 3   | 3   | 1   | 1   | 3   | 3   | 2   | 2   | 1   | 3   | XL   | Architectural |
| **G04** | 2   | 2   | 0   | 3   | 0   | 2   | 1   | 2   | 0   | 2   | XL   | Judgment      |
| **S01** | 1   | 3   | 0   | 0   | 2   | 2   | 0   | 2   | 0   | 2   | L    | Judgment      |
| **S04** | 1   | 2   | 1   | 0   | 0   | 2   | 1   | 3   | 1   | 2   | L    | Judgment      |
| **S07** | 1   | 3   | 1   | 1   | 0   | 3   | 2   | 1   | 0   | 3   | L    | Judgment      |
| **A02** | 0   | 1   | 3   | 0   | 0   | 1   | 1   | 0   | 0   | 1   | M    | Mechanical    |
| **A08** | 0   | 0   | 3   | 0   | 0   | 1   | 1   | 1   | 0   | 2   | M    | Mechanical    |
| **A09** | 1   | 1   | 3   | 0   | 1   | 1   | 2   | 0   | 0   | 2   | L    | Mechanical    |
| **D01** | 0   | 0   | 0   | 3   | 1   | 0   | 0   | 0   | 0   | 1   | L    | Mechanical    |
| **D05** | 0   | 0   | 1   | 3   | 0   | 0   | 1   | 0   | 0   | 1   | L    | Mechanical    |
| **F01** | 2   | 2   | 0   | 0   | 3   | 1   | 0   | 0   | 0   | 2   | L    | Mechanical    |
| **F03** | 0   | 0   | 0   | 0   | 3   | 0   | 0   | 0   | 0   | 0   | M    | Trivial       |
| **M01** | 1   | 2   | 0   | 1   | 0   | 3   | 2   | 1   | 0   | 3   | XL   | Judgment      |
| **M03** | 1   | 1   | 0   | 2   | 0   | 2   | 2   | 0   | 0   | 2   | L    | Judgment      |
| **N01** | 1   | 1   | 0   | 0   | 0   | 2   | 3   | 1   | 0   | 2   | L    | Mechanical    |
| **N04** | 2   | 1   | 1   | 2   | 1   | 1   | 3   | 0   | 0   | 2   | XL   | Judgment      |
| **E03** | 0   | 0   | 0   | 0   | 0   | 1   | 1   | 3   | 0   | 1   | M    | Mechanical    |
| **P02** | 0   | 0   | 0   | 0   | 0   | 1   | 0   | 0   | 3   | 1   | M    | Mechanical    |
| **C01** | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | 0   | S    | Control       |

### Score Distribution

**Highest total scores** (worst code, best test subjects):

- G01: 22/30 — the 463-line edit god method
- G03: 22/30 — the 290-line init with 18-field merge
- S07: 15/30 — executeMigration interleaved concerns
- M01: 13/30 — validateSource 4 phases
- G04: 12/30 — doctor copy-pasted skip blocks

**Mechanical difficulty** (clear right answer, good for automated scoring):

- A02, A08, A09: imperative → declarative has one obvious transformation
- D01, D05: unification has a clear target shape
- F01, F03: repetition elimination is measurable
- E03, P02: specific anti-pattern removal

**Judgment difficulty** (multiple valid solutions, needs LLM judge):

- G01, G03: how to decompose is a design decision
- S01, S04, S07: what constitutes a "phase" is subjective
- M01, M03: where to draw concern boundaries
- N04: whether to introduce Zod or just simplify manually

### Refactoring Difficulty Distribution

| Difficulty    | Count | IDs                                         |
| ------------- | ----- | ------------------------------------------- |
| Trivial       | 1     | F03                                         |
| Mechanical    | 9     | A02, A08, A09, D01, D05, F01, N01, E03, P02 |
| Judgment      | 7     | S01, S04, S07, M01, M03, N04, G04           |
| Architectural | 2     | G01, G03                                    |
| Control       | 1     | C01                                         |
