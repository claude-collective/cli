# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                                                  | Status      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| D-50 | Eliminate skills-matrix.yaml: derive matrix dynamically from skill metadata (see detailed notes below)                                                | Pending     |
| U13  | Run Documentor Agent on CLI Codebase                                                                                                                  | Done        |
| H18  | Tailor documentation-bible to CLI repo                                                                                                                | Done        |
| D-46 | Custom extensibility (see [design doc](../docs/features/proposed/custom-extensibility-design.md))                                                     | In Progress |
| D-37 | Install mode UX redesign (see [design doc](../docs/features/proposed/install-mode-redesign.md))                                                       | Pending     |
| D-33 | README: frame Agents Inc. as an AI coding framework                                                                                                   | Pending     |
| D-44 | Update README and Notion page for `eject templates` type                                                                                              | Pending     |
| D-47 | Eject a standalone compile function for sub-agent compilation                                                                                         | Pending     |
| T-08 | Audit all test files: extract fixtures, use real IDs                                                                                                  | Pending     |
| T-12 | End-to-end tests for custom marketplace workflow (`--source`, `outdated`, build→version→update cycle)                                                 | Pending     |
| D-52 | Expand `new agent` command: add agent-summoner to skills repo so remote fetch works from any project                                                  | Pending     |
| D-53 | Rename `agent.yaml` to `metadata.yaml` for consistency with skills                                                                                    | Deferred    |
| D-54 | Remove expert mode: make expert mode behavior the default, then remove the concept entirely                                                           | Pending     |
| D-55 | Clean up dead code: remove `escapedSkillId` regex and `(@author)` stripping in `skill-fetcher.ts` — skill IDs are kebab-case only                     | Done        |
| D-56 | Rename `agentDomains` → `agentDefinedDomains`, update "override" comments to "define/precedence" language                                             | Done        |
| D-57 | Fix `TEST_SKILLS.antiOverEngineering`: remove unnecessary inline `path` override in config-generator test                                             | Done        |
| D-58 | `orderDomains`: put custom domains first, then built-in domains                                                                                       | Done        |
| D-59 | Unified scrolling across all wizard views — apply the same scrolling pattern (marginTop offset + `useMeasuredHeight`) to every step that can overflow | Pending     |

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

### D-50: Eliminate skills-matrix.yaml — derive matrix from skill metadata

Move all category metadata (required, exclusive, order, displayName, domain, icon) to individual skill `metadata.yaml` files; derive the `MergedSkillsMatrix` dynamically from scanning skills.

**Current problem (blocking custom marketplaces):**

The wizard UI reads category/domain info from `matrix.categories` (`MergedSkillsMatrix.categories`), which is populated exclusively from `skills-matrix.yaml`. Skills from a custom marketplace that don't have a corresponding `skills-matrix.yaml` entry are invisible in the wizard — even if they declare `domain` and `category` in their own `metadata.yaml`.

**Key code locations that need to change:**

1. **`matrix-loader.ts:mergeMatrixWithSkills()`** — line 270 sets `categories: matrix.categories` (from skills-matrix.yaml only). Must auto-synthesize `CategoryDefinition` entries from skill metadata when the category doesn't already exist in the matrix. The skill's `domain`, `category`, `categoryExclusive` fields should be sufficient to create a category entry.

2. **Wizard UI components** — `step-build.tsx`, `category-grid.tsx`, `domain-selection.tsx` all look up `matrix.categories[subcategory].domain` to organize skills by domain tab. If a category isn't in the matrix, the skill is invisible regardless of what's on the `ResolvedSkill` itself. These need to work even when the category was synthesized from metadata.

3. **`matrix-health-check.ts`** — warns "category has no domain" by checking `matrix.categories`. This check should still work but may need adjustment once categories can come from skill metadata.

4. **`source-loader.ts:discoverAndExtendFromSource()`** — already discovers custom domains/categories/skillIds and registers them with `extendSchemasWithCustomValues()`. But this only extends _schema validation_ — it doesn't create `CategoryDefinition` entries in the matrix. The schema extension is necessary but not sufficient.

**What `metadata.yaml` already supports:** `domain`, `category`, `categoryExclusive`, `custom`, `tags`, `author`. What's missing from metadata: `displayName`, `icon`, `order`, `required` (these currently live in `skills-matrix.yaml` category definitions).

**End state:** A custom marketplace with only skills (no `skills-matrix.yaml`) should work out of the box. Each skill's `metadata.yaml` provides enough info (`domain`, `category`, `categoryExclusive`) to appear in the wizard.

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

### Wizard UX

#### D-59: Unified scrolling across all wizard views

Apply the same scrolling pattern used in `step-agents.tsx`, `category-grid.tsx`, and `source-grid.tsx` to every wizard step that can overflow the terminal viewport. Currently only 3 of 8 step views support scrolling.

**Views that already scroll:**

- `step-build.tsx` → delegates to `category-grid.tsx` (pixel-offset + `measureElement`)
- `step-sources.tsx` → delegates to `source-grid.tsx` (same pattern)
- `step-agents.tsx` (row-based marginTop offset)

**Views that need scrolling:**

- **`step-stack.tsx`** (stack selection) — most important. With custom marketplace stacks + built-in stacks, the list can overflow. Currently delegates to `StackSelection` / `DomainSelection` subcomponents with no scroll support.
- **`step-settings.tsx`** (source management) — users with many custom sources (5+) will overflow.
- **`checkbox-grid.tsx`** (domain selection within `step-stack.tsx`) — with many custom domains, can overflow.

**Views that don't need scrolling:**

- `step-confirm.tsx` — intentionally brief summary
- `step-refine.tsx` — only 2 options

**Existing pattern to reuse (all three scrolling views use the same approach):**

1. Measure viewport height via `useMeasuredHeight()` hook
2. Pass `availableHeight` to the content component
3. Gate scrolling: `scrollEnabled = availableHeight > 0 && availableHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS`
4. Track focused item position, adjust `scrollTopPx` offset to keep it visible
5. Render: `<Box height={availableHeight} overflow="hidden"><Box marginTop={-scrollTopPx}>{content}</Box></Box>`

**Key files:**

- Scrolling pattern reference: `src/cli/components/wizard/category-grid.tsx:294-384`
- Height measurement hook: `src/cli/components/hooks/use-measured-height.ts`
- Scroll constants: `src/cli/consts.ts:145-156` (`SCROLL_VIEWPORT`)
- Unused virtual scroll hook (potential alternative): `src/cli/components/hooks/use-virtual-scroll.ts`

**Targets:**

- `src/cli/components/wizard/step-stack.tsx` + `stack-selection.tsx`
- `src/cli/components/wizard/step-settings.tsx`
- `src/cli/components/wizard/checkbox-grid.tsx`

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/skills`
- CLI under test: `/home/vince/dev/cli`
