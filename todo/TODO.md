# Agents Inc. CLI - Task Tracking

| ID   | Task                                                                                                                                                                                     | Status        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| D-50 | ~~Eliminate skills-matrix.yaml~~ — superseded by [matrix decomposition design](../docs/features/proposed/matrix-decomposition-design.md) + [phased plan](./TODO-matrix-decomposition.md) | Superseded    |
| D-46 | Custom extensibility (see [design doc](../docs/features/proposed/custom-extensibility-design.md))                                                                                        | In Progress   |
| D-37 | Install mode UX redesign (see [design doc](../docs/features/proposed/install-mode-redesign.md))                                                                                          | Refined       |
| D-33 | README: frame Agents Inc. as an AI coding framework (see [implementation plan](./D-33-readme-reframe.md))                                                                                | Ready for Dev |
| D-44 | Update README and Notion page for `eject templates` type (see [implementation plan](./D-44-docs-eject-templates.md))                                                                     | Ready for Dev |
| D-47 | ~~Eject a standalone compile function~~ — deferred, low priority (see [TODO-deferred.md](./TODO-deferred.md))                                                                            | Deferred      |
| T-12 | End-to-end tests for custom marketplace workflow (see [implementation plan](./T-12-e2e-marketplace-tests.md))                                                                            | Has Open Qs   |
| D-52 | Expand `new agent` command: config lookup + compile-on-demand (see [implementation plan](./D-52-expand-new-agent.md))                                                                    | Ready for Dev |
| D-54 | Remove expert mode: make expert mode behavior the default (see [implementation plan](./D-54-remove-expert-mode.md))                                                                      | Ready for Dev |
| D-59 | Unified scrolling across all wizard views (see [implementation plan](./D-59-unified-scrolling.md))                                                                                       | Ready for Dev |
| D-36 | Global install support with project-level override (see [implementation plan](./D-36-global-install.md))                                                                                 | Ready for Dev |
| D-37 | Merge global + project installations in resolution (see [implementation plan](./D-37-merge-installs.md))                                                                                 | Has Open Qs   |
| D-08 | ~~User-defined stacks~~ — deferred, not important (see [TODO-deferred.md](./TODO-deferred.md))                                                                                           | Deferred      |
| D-53 | Rename `agent.yaml` to `metadata.yaml` (see [implementation plan](./D-53-rename-agent-yaml.md))                                                                                          | Ready for Dev |
| D-38 | Remove web-base-framework, allow multi-framework (see [implementation plan](./D-38-remove-base-framework.md))                                                                            | Has Open Qs   |
| D-39 | Couple meta-frameworks with base frameworks (see [implementation plan](./D-39-couple-meta-frameworks.md))                                                                                | Ready for Dev |
| D-40 | ~~`agentsinc register` command~~ — absorbed into D-41 (config sub-agent handles registration) (see [TODO-deferred.md](./TODO-deferred.md))                                               | Deferred      |
| D-41 | Create Agents Inc config sub-agent (see [implementation plan](./D-41-config-sub-agent.md))                                                                                               | Ready for Dev |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

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

### Framework Infrastructure

#### D-36: Global install support with project-level override

**Priority:** Medium
**Implementation plan:** [`D-36-global-install.md`](./D-36-global-install.md)

Add a `--global` flag to `agentsinc init` for global vs project-level installation. Global installs go to `~/.claude-src/config.yaml`, `~/.claude/skills/`, `~/.claude/agents/`. Project-level installs remain at `{cwd}/.claude-src/` as today. Phase 1: full override (project replaces global, no merging).

**Acceptance criteria:**

- [ ] `agentsinc init --global` installs to home directory
- [ ] `agentsinc init` (no flag) installs to `{cwd}` (current behavior)
- [ ] `agentsinc edit` from a project with its own installation uses that project's config
- [ ] `agentsinc edit` from a project without its own installation falls back to global
- [ ] `agentsinc compile` follows the same resolution order
- [ ] Plugin mode: `--scope user` used for global, `--scope project` for project-level

---

#### D-37: Merge global + project installations in resolution

**Priority:** Low (deferred until D-36 is stable)
**Depends on:** D-36
**Implementation plan:** [`D-37-merge-installs.md`](./D-37-merge-installs.md)

Extend D-36's full-override behavior to support merging global and project-level installations. When a project-level installation exists, it currently replaces the global one entirely. This task adds the option to merge them — project-level selections take priority for overlapping categories, global fills in the rest.

**Example:**

- Global: `web-framework-react`, `web-state-zustand`, `web-testing-vitest`
- Project: `api-framework-hono`
- Merged result: all four skills active

**Key design decisions (from implementation plan):**

- Merge is opt-in via `merge: true` in project config (preserves D-36 full-override default)
- Exclusive category conflicts: project wins. Non-exclusive categories: union.
- Agents are merged (union), with project overriding per-agent per-subcategory stack mappings
- `edit` always modifies the project-level config; global skills shown as inherited
- `excludeGlobalSkills` deferred to a later phase for simplicity
- Merge operates at the config level, not the matrix loading level

---

#### D-53: Rename `agent.yaml` to `metadata.yaml`

**Implementation plan:** [`D-53-rename-agent-yaml.md`](./D-53-rename-agent-yaml.md)

Rename the agent definition file from `agent.yaml` to `metadata.yaml` for consistency with skill metadata files. CLI-repo-only change (~52 files). No fallback period needed (pre-1.0).

---

### Framework Features

#### D-38: Remove web-base-framework, allow multi-framework

**Priority:** Medium
**See plan:** [D-38-remove-base-framework.md](./D-38-remove-base-framework.md)

Remove the `web-base-framework` and `mobile-platform` stacks-only subcategory keys. Merge their skills into the `web-framework` / `mobile-framework` arrays. Change `web-framework` from fully exclusive to supporting compatible multi-selection (React + Remix, Vue + Nuxt, etc.).

When a user selects a meta-framework (Next.js, Remix, Nuxt), the corresponding base framework (React, Vue) should be recommended or auto-included. However, some base framework patterns conflict with meta-framework patterns (e.g., React Router vs Next.js App Router). A "slimmed down" version of the base framework skill may be needed for meta-framework contexts.

**Problem:** The React skill teaches generic React patterns including routing, but when using Next.js, you want Next.js routing, not React Router. Similarly for data fetching patterns. The full React skill includes patterns that conflict with Next.js conventions.

**Possible approaches:**

- **Skill variants:** Create slimmed-down variants of base framework skills for meta-framework contexts (e.g., `web-framework-react-for-nextjs` that excludes routing/data-fetching sections)
- **Conditional sections:** Add conditional sections in SKILL.md that are included/excluded based on what other skills are selected (e.g., `<!-- if not: web-framework-nextjs -->` around the routing section)
- **Skill composition:** Split framework skills into atomic sub-skills (react-components, react-routing, react-data-fetching) and let meta-frameworks exclude the ones they replace
- **Conflict rules in metadata.yaml:** Use existing `conflictsWith` to mark specific patterns as conflicting, letting the system warn users

**Investigation needed:**

- Audit each meta-framework skill to identify which base framework patterns it replaces
- Determine the right granularity (full skill variants vs conditional sections vs sub-skills)
- Consider whether this is even a problem in practice — does having both the React routing skill and Next.js routing skill actually cause issues for the AI agent consuming them?

---

#### D-39: Couple meta-frameworks with base frameworks

**Priority:** Medium
**Depends on:** D-38
**See plan:** [D-39-couple-meta-frameworks.md](./D-39-couple-meta-frameworks.md)

When a user selects a meta-framework (e.g., Next.js), automatically select the corresponding base framework skill (e.g., React) and block deselection while the meta-framework depends on it. This ensures users get both the meta-framework-specific patterns and the underlying framework knowledge.

**Key decisions (from refinement):**

- Auto-select base framework when meta-framework is toggled on (not just validation)
- Block deselection of base framework while dependents exist
- Add `requiredBy` visual indicator ("required by Next.js") to locked skills
- Auto-select logic lives in `use-build-step-props.ts` hook (not the store)
- Only same-subcategory auto-selection (no cross-category)
- Expert mode bypasses auto-select and deselect blocking

---

#### D-41: Create Agents Inc config sub-agent

**Priority:** Medium

Create a specialized Claude Code sub-agent that understands the Agents Inc CLI's configuration system in depth. This is NOT a developer agent — it handles all configuration-related tasks that currently require manual knowledge of the CLI's YAML structures, schemas, and type system.

**What it does:**

- Creates and updates `metadata.yaml` files for skills (with correct domain-prefixed `category` values, author, cliName, etc.)
- Creates and updates `stacks.yaml` entries (agent definitions, skill assignments, preloaded flags)
- Updates `skills-matrix.yaml` (adding/modifying categories, skill entries, dependency rules)
- Updates `.claude-src/config.yaml` mappings (source paths, plugin settings, skill assignments)
- Updates `agent-mappings.yaml` skill-to-agent routing
- Knows the valid `Subcategory` enum values and enforces them
- Understands skill relationships (`requires`, `compatibleWith`, `conflictsWith`, `requiresSetup`, `providesSetupFor`)
- Can validate configs against JSON schemas before writing

**Key knowledge areas:**

- The 38 domain-prefixed subcategory values and their domains
- Stack structure: agents → subcategories → skill assignments (with `preloaded`, `selected` flags)
- Skills matrix: categories with `id`, `displayName`, `domain`, `categoryExclusive`, `skills` arrays with dependency rules (`needsAny`, `conflictsWith`)
- Metadata schema: required fields (`category`, `author`, `cliName`, `cliDescription`, `usageGuidance`)
- The distinction between matrix categories (36) and stacks-only keys (+2: `web-base-framework`, `mobile-platform`)
- How `extractSubcategoryFromPath` and `categoryPathSchema` resolve category paths

**Why this is needed:**

- Configuration tasks (creating metadata, adding stacks, updating the matrix) are error-prone and require deep familiarity with the schema
- The D-31 migration showed how many files need coordinated updates when config values change
- A dedicated config agent prevents developer agents from making config mistakes (wrong category values, invalid schema, missing required fields)
- Replaces D-40 (`agentsinc register`) entirely — the config agent handles skill registration conversationally (read SKILL.md, infer category, generate metadata.yaml, wire config.yaml) instead of requiring users to memorize flags

**Implementation:**

- Create `src/agents/meta/config-manager/` with the standard agent structure
- Pre-load the JSON schemas, `SUBCATEGORY_VALUES`, and example configs into the agent's context
- Give it Read, Write, Edit, Glob, Grep tools (no Bash needed — it's purely config manipulation)
- Add it to `agent-mappings.yaml` so it's available as a sub-agent for other agents

**Acceptance criteria:**

- [ ] Can create a valid `metadata.yaml` from a skill name and category
- [ ] Can register an existing skill: read its SKILL.md, infer category/description, generate metadata.yaml, wire into config.yaml (replaces D-40)
- [ ] Can add a new stack to `stacks.yaml` with correct agent/subcategory/skill structure
- [ ] Can add a new category to `skills-matrix.yaml` with proper schema
- [ ] Validates all output against schema rules
- [ ] Refuses to use bare subcategory names (enforces domain-prefix)
- [ ] Other agents can delegate config tasks to it via the Task tool

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
