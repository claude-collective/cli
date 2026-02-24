# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                                                                                            | Status       |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| D-49 | Add `domain` field to skill `metadata.yaml` and agent `agent.yaml` so custom entities declare their own domain                                                                                  | Pending      |
| D-50 | Eliminate skills-matrix.yaml: move all category metadata (required, exclusive, order, displayName, domain, icon) to individual skill `metadata.yaml`; derive matrix dynamically from skill scan | Pending      |
| D-51 | Remove legacy slash-in-skill-ID code: `plugin-finder.ts:89` split, `skill-fetcher.ts:80-90` dead branch + tests, `compiler.ts:294` replace, `create-test-source.ts:711` replace                 | Pending      |
| U13  | Run Documentor Agent on CLI Codebase                                                                                                                                                            | Pending      |
| H18  | Tailor documentation-bible to CLI repo                                                                                                                                                          | Phase 3 only |
| D-46 | Custom extensibility (see [design doc](../docs/features/proposed/custom-extensibility-design.md))                                                                                               | In Progress  |
| D-37 | Install mode UX redesign (see [design doc](../docs/features/proposed/install-mode-redesign.md))                                                                                                 | Pending      |
| D-33 | README: frame Agents Inc. as an AI coding framework                                                                                                                                             | Pending      |
| D-42 | `agentsinc validate` command for skills repos                                                                                                                                                   | Pending      |
| D-44 | Update README and Notion page for `eject templates` type                                                                                                                                        | Pending      |
| D-45 | Marketplace/plugin build commands should verify `contentHash` in skill metadata                                                                                                                 | Pending      |
| D-47 | Eject a standalone compile function for sub-agent compilation                                                                                                                                   | Pending      |
| T-07 | Replace real skills repo in source-loader.test.ts with fixtures                                                                                                                                 | Pending      |
| T-08 | Audit all test files: extract fixtures, use real IDs                                                                                                                                            | Pending      |
| T-09 | Extract shared base skill/category/matrix fixtures to eliminate cross-file duplication                                                                                                          | Pending      |
| T-12 | End-to-end tests for custom marketplace workflow (`--source`, `outdated`, build→version→update cycle)                                                                                           | Pending      |
| D-48 | Revert `(string & {})` type widening on Domain/Subcategory/AgentName; design proper custom value type strategy                                                                                  | Pending      |
| D-52 | Expand `new agent` command: add agent-summoner to skills repo so remote fetch works from any project                                                                                            | Pending      |
| D-53 | Build step: show "X of N" counter for exclusive categories (e.g., "1 of 1" for client state); hide in expert mode                                                                               | Pending      |
| D-54 | Build step: fix domain ordering — should always be Web, API, Mobile, CLI regardless of domain selection order                                                                                   | Pending      |
| D-55 | Domain deselection should remove skills: deselecting a domain in the domain step should deselect all skills from that domain, so the confirm step count reflects only selected domains          | Pending      |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### Documentation & Tooling

#### U13: Run Documentor Agent on CLI Codebase

Use the `documentor` sub-agent to create AI-focused documentation that helps other agents understand where and how to implement features. The documentor should work incrementally and track progress over time.

**What to document:**

- Component structure and patterns
- State management patterns (Zustand)
- Testing patterns and conventions
- CLI command structure
- Wizard flow and navigation
- Key utilities and helpers

**Output:** Documentation in `docs/` directory

---

#### H18: Generate CLI Documentation via Documentor Agent

Phases 1 (documentation-bible.md) and 2 (documentor workflow.md) are complete. Only Phase 3 remains.

##### Phase 3: Run documentor agent to generate docs

Create `.claude/docs/` directory with:

- `DOCUMENTATION_MAP.md` — master index tracking coverage
- `command-patterns.md` — oclif command conventions
- `wizard-architecture.md` — wizard flow, state management
- `compilation-system.md` — agent/skill compilation pipeline
- `test-patterns.md` — test infrastructure and fixtures
- `type-system.md` — type conventions and branded types

**Success criteria:** `.claude/docs/` exists with 5+ files that help agents answer "where is X?" and "how does Y work?"

---

### CLI Improvements

#### D-37: Install mode UX redesign

Replace the hidden `P` hotkey toggle with an explicit install mode choice on the confirm step. Implement mode migration during edit (local to plugin, plugin to local, per-skill customize). The current `P` toggle during edit is completely broken -- config is never updated, artifacts are never migrated.

**Design doc:** [`docs/features/proposed/install-mode-redesign.md`](../docs/features/proposed/install-mode-redesign.md)

**Location:** `step-confirm.tsx`, `wizard.tsx`, `wizard-layout.tsx`, `help-modal.tsx`, `wizard-store.ts`, `edit.tsx`, `local-installer.ts`, `agent-recompiler.ts`, `types/config.ts`.

---

### Positioning & README

#### D-33: README: frame Agents Inc. as an AI coding framework

Rewrite the README to position Agents Inc. as an AI coding framework, not just a CLI tool. The key differentiator is the composability model and the level of extensibility — this needs to be worded carefully to be credible, not buzzwordy.

**What makes it genuinely a framework:**

- **Composable knowledge primitives** — skills are atomic, typed, categorized knowledge modules with a defined schema (markdown + YAML metadata + categories + tags + conflict rules)
- **Agent compilation pipeline** — skills are compiled into role-based agents via Liquid templates, YAML definitions, and markdown partials. This is a real build step, not just config
- **Ejectable internals** — users can eject agent templates, the skills matrix, and compilation artifacts to fully customize the pipeline. This is framework-level extensibility
- **Interactive agent composition** — the wizard lets you interactively build specialized sub-agents from modular skills, which is genuinely unique
- **Marketplace/plugin architecture** — custom skill sources, multi-source resolution, publishable stack plugins
- **Stack architecture** — pre-configured agent bundles with philosophy, agent roles, and skill assignments

**Wording constraints:**

- Must feel honest and specific, not like marketing fluff
- Lead with what it does concretely, then explain the framework aspect
- Avoid "revolutionary" / "powerful" / "game-changing" language
- The framework angle should emerge naturally from describing the features
- Don't overstate — it's a framework for composing Claude Code agents, not a general AI framework

**Possible framing angles to explore:**

- "A build system for AI coding agents" (emphasizes the compilation pipeline)
- "Composable skills for Claude Code" (emphasizes the modularity)
- "An agent composition framework" (emphasizes what makes it unique)
- The eject model mirrors how frameworks like Next.js/CRA work — sane defaults but full escape hatches

**Key sections to rework:**

- Opening paragraph — currently "the CLI for working with Agents Inc. skills" is underselling it
- "what this does" — should explain the framework concept
- "how skills work" — could emphasize the schema/type system aspect
- "architecture" — already describes framework internals, could be elevated

---

#### D-42: `agentsinc validate` command for skills repos

A standalone validation command that marketplace authors can run from within their skills repo to check all metadata for correctness. Currently `checkMatrixHealth` runs automatically during `loadSkillsMatrixFromSource`, but there's no user-facing command for it.

**Usage:**

```bash
# Run from within a skills repo
agentsinc validate --source .

# Or point at a remote source
agentsinc validate --source github:acme-corp/skills
```

**What it validates:**

- Every `metadata.yaml` against the schema (required fields, field types)
- `cliName` format and directory name consistency
- `category` values against known domain-prefixed patterns
- All cross-references (`compatibleWith`, `conflictsWith`, `requires`, `requiresSetup`, `providesSetupFor`) resolve to existing skill IDs
- `categoryExclusive` is present when required
- camelCase key convention (no snake_case)
- Every skill directory has both `SKILL.md` and `metadata.yaml`

**Implementation:**

- New command: `src/cli/commands/validate.ts`
- Reuse `loadSkillsMatrixFromSource` + `checkMatrixHealth` for cross-reference validation
- Add per-skill schema validation using `skillMetadataLoaderSchema`
- Report all issues with file paths and specific values
- Exit with non-zero code if any errors found (warnings are OK)

**Location:** `src/cli/commands/validate.ts`, leveraging existing `matrix-health-check.ts` and `schemas.ts`.

---

#### D-44: Update README and Notion page for `eject templates` type

Update external documentation to reflect D-43's change: `templates` is now a first-class eject type (`agentsinc eject templates`) instead of a flag (`--templates`) on `agent-partials`.

**What to update:**

- **README.md** — update any eject command examples or feature descriptions to show `agentsinc eject templates` instead of `agentsinc eject agent-partials --templates`
- **Notion page** — update the eject command documentation to list `templates` as a separate type alongside `agent-partials`, `skills`, and `all`
- Ensure the eject type list is consistent everywhere: `agent-partials | templates | skills | all`
- Remove any references to the `--templates` / `-t` flag

---

#### D-47: Eject a standalone compile function for sub-agent compilation

Expose a single ejectable function that users can call to compile their sub-agents — and nothing else. This gives consumers a programmatic escape hatch to run the compilation pipeline (skills → templates → agent markdown) without going through the full CLI wizard or command surface.

**What it should do:**

- Take a minimal input: selected skills, selected agents, source path, output directory
- Run the compilation pipeline (resolve skills, apply templates, write agent markdown)
- Return the compiled output (or write to disk)
- No wizard, no interactive prompts, no config reading — just compile

**Why:** Users who integrate agent compilation into their own build systems or CI pipelines need a clean function call, not a CLI command. This is the "framework" escape hatch — eject the compile function and call it however you want.

**Implementation approach:**

- Extract the core compilation logic from `src/cli/lib/compiler.ts` into a standalone, importable function
- The function should have no dependency on oclif, Ink, Zustand, or any CLI/UI layer
- Make it available via `agentsinc eject compile` (writes a self-contained `.ts` file to the project) or as a public export from the package

**Location:** `src/cli/lib/compiler.ts` (extract from), new ejectable output TBD.

---

#### D-45: Marketplace/plugin build commands should verify `contentHash` in skill metadata

The marketplace and plugin build commands should verify that the `contentHash` field in each skill's `metadata.yaml` is present and correct. This ensures published skills have integrity checks that consumers can verify during installation.

**What to check:**

- `contentHash` is present in `metadata.yaml` for every skill being built/published
- The hash matches the actual content of the skill files (SKILL.md + metadata.yaml)
- Build fails with a clear error if hashes are missing or mismatched

**Location:** Plugin build pipeline, marketplace build pipeline, `agentsinc validate` (D-42) should also check this.

---

#### T-07: Replace real skills repo in source-loader.test.ts with fixtures

`source-loader.test.ts` loads the real `/home/vince/dev/skills` sibling repo for 13 of its 24 tests. This is fragile, non-portable, and violates the project convention of using `createTestSource()`.

**Key findings from investigation:**

- 13 tests use `SKILLS_SOURCE` (the real repo); the other 11 are already self-contained
- `createTestSource()` already supports everything needed — no infrastructure changes required
- 3 tests hardcode count thresholds (`> 50` skills, `> 10` categories) that need adjusting
- Test 11 (line 207) needs a skill with a domain-mapped category — already supported by `createTestSource()`'s `generateMatrix()` which sets `domain` from category prefix

**Plan:**

1. Create a single shared fixture via `createTestSource()` in a module-level `beforeAll`/`afterAll` with ~8 skills from `DEFAULT_TEST_SKILLS` + `EXTRA_DOMAIN_TEST_SKILLS`, plus 1 test stack
2. Remove `SKILLS_REPO_ROOT` / `SKILLS_SOURCE` constants (lines 8-12)
3. Replace all `SKILLS_SOURCE` references with `fixtureSource.sourceDir`
4. Update 3 hardcoded count assertions (lines 272, 507-508, 588-589) to match fixture data
5. Leave the 11 already self-contained tests untouched

**Scope:** ~30-40 lines changed in `source-loader.test.ts`, 0 new files, 0 new helpers.

**Location:** `src/cli/lib/loading/source-loader.test.ts`

---

#### T-08: Audit all test files: extract fixtures, use real IDs

All test files should follow the conventions enforced in `matrix-health-check.test.ts` and `category-grid.test.tsx` during this session:

1. **No fake skill IDs** — use real IDs from the skills repo (e.g., `web-framework-react`, not `web-test-react`). Only use fake IDs when explicitly testing error paths for invalid data.
2. **No fake categories** — use valid `Subcategory` union members (e.g., `"web-framework"`, not `"test-category"`).
3. **No inline test data construction** — never construct `SkillsMatrixConfig`, `MergedSkillsMatrix`, `ResolvedSkill`, configs, or stacks inline in test bodies. Use factories from `__tests__/helpers.ts` (`createMockSkill`, `createMockMatrix`, `createMockCategory`, etc.) or fixtures from `create-test-source.ts`.
4. **Extract all test data to top-level named constants** — don't call factory functions inside `it()` blocks. Define every skill, category, and matrix variant as a named constant at the top of the file. Test bodies should only call the function under test + assertions.

**Specific callout:** `category-grid.test.tsx` lines 1190-1226 manually re-lists `Subcategory` and `SkillId` values in hand-picked pools to generate dynamic test data. This duplicates data that already exists in types and fixtures. Use `createComprehensiveMatrix` or real fixture data instead of hand-building pools.

**Files already done (skip these):**

- `src/cli/lib/matrix/matrix-health-check.test.ts`
- `src/cli/components/wizard/category-grid.test.tsx` (IDs fixed, but pools still need replacing per callout above)

**Files to audit:** All other `*.test.ts` and `*.test.tsx` files under `src/cli/`. Prioritize files that construct matrices, skills, categories, or configs inline.

**Location:** All test files under `src/cli/`

---

#### T-09: Extract shared base skill/category/matrix fixtures to eliminate cross-file duplication

The same `createMockSkill("web-framework-react", "web-framework")` call is repeated across 10+ test files. The base skill is identical — only per-file overrides differ (`categoryExclusive`, `displayName`, `tags`, etc.). Same for common categories and simple matrices.

**Approach:** Add shared base constants to `__tests__/helpers.ts` or `__tests__/test-fixtures.ts`:

```typescript
// Base fixtures — no overrides, just the canonical defaults
export const REACT_SKILL = createMockSkill("web-framework-react", "web-framework");
export const ZUSTAND_SKILL = createMockSkill("web-state-zustand", "web-client-state");
export const HONO_SKILL = createMockSkill("api-framework-hono", "api-api");
export const VITEST_SKILL = createMockSkill("web-testing-vitest", "web-testing");

export const FRAMEWORK_CATEGORY = createMockCategory("web-framework", "Framework");
export const CLIENT_STATE_CATEGORY = createMockCategory("web-client-state", "Client State");
export const TESTING_CATEGORY = createMockCategory("web-testing", "Testing");
```

Per-file customization via spread:

```typescript
// Test that needs displayName
const skill = { ...REACT_SKILL, displayName: "React", categoryExclusive: true };

// Test that uses the base as-is
const matrix = createMockMatrix({ "web-framework-react": REACT_SKILL });
```

**Files with highest duplication:**

- `config-generator.test.ts` — 18 occurrences of bare react skill
- `step-build.test.tsx` — react, vue, zustand, pinia skills
- `build-step-logic.test.ts` — react, vue, zustand with displayName
- `matrix-health-check.test.ts` — react, zustand, categories
- `plugin-finder.test.ts`, `wizard-store.test.ts`, `init-flow.integration.test.ts`

**Do NOT extract:** Pathological/error-case fixtures (orphan skills, unresolved refs, missing domains). These are single-consumer and belong in the test file that uses them.

**Location:** `src/cli/lib/__tests__/helpers.ts` or `src/cli/lib/__tests__/test-fixtures.ts`

---

#### D-48: Revert `(string & {})` type widening; design proper custom value type strategy

Phase 3 of D-46 incorrectly widened `Domain`, `Subcategory`, and `AgentName` with `| (string & {})`. This defeats the purpose of strict union types — any string is now accepted at compile time without a compiler error. Casting custom values to the strict type (`"acme" as Domain`) is also wrong: it lies to TypeScript about what the value is, and downstream code that narrows on the union (switch statements, equality checks) silently fails on custom values.

**Immediate action (option C from design doc Q3):**

1. Remove `| (string & {})` from `Domain` (types/matrix.ts), `Subcategory` (types/matrix.ts), and `AgentName` (types/agents.ts)
2. Restore the strict closed unions
3. At parse boundaries where custom values enter the system (YAML loading, matrix merge), use boundary casts with comments explaining why
4. Fix any resulting compile errors by adding boundary casts at the data entry points only

**Follow-up (needs design):**

Come up with a proper mechanism for custom values that doesn't lie to TypeScript. Casting is a stopgap — it pretends a custom value IS a built-in type when it isn't. If code later does pattern matching or string methods expecting built-in format, it silently breaks. Options to explore:

- Branded/tagged union types that force callers to handle the custom case
- Separate code paths for built-in vs custom values at the type level
- Generic functions parameterized over the value set
- A discriminated union wrapper (`{ kind: "builtin", value: Domain } | { kind: "custom", value: string }`)

The right answer should make it impossible to accidentally treat a custom value as a built-in one without explicit handling.

**Location:** `src/cli/types/matrix.ts`, `src/cli/types/agents.ts`, and all files that pass custom values through the system.

---

#### T-12: End-to-end tests for custom marketplace workflow

Test the full custom marketplace lifecycle: using `--source` to point at a custom marketplace, checking for outdated skills, and the change→build→update cycle.

**Test scenarios:**

1. **`--source` flag works with custom marketplaces** — `agentsinc init --source /path/to/custom-marketplace` loads skills from the custom source, not the default. Verify the wizard shows skills from the custom source and the compiled output references them correctly.

2. **`outdated` command detects stale skills** — After installing from a custom marketplace, make a change in the marketplace source, bump the version via `agentsinc build marketplace` + `agentsinc build plugins`, then verify `agentsinc outdated` correctly reports the consuming project has older versions.

3. **Full update cycle** — Make a change in a custom marketplace (add/modify a skill), run `agentsinc build marketplace` and `agentsinc build plugins` to bump the version, then run `agentsinc edit --refresh` (or equivalent) in the consuming app and verify it picks up the newer version.

**Test setup:**

- Use `createTestSource()` to create a fixture marketplace with versioned skills
- Use `/home/vince/dev/cv-launch` as the consuming project (or a temp directory)
- Tests should be self-contained — no dependency on the real skills repo

**Location:** `src/cli/lib/__tests__/integration/` or `src/cli/lib/__tests__/user-journeys/`

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
