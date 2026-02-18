# Agents Inc. CLI - Task Tracking

| ID   | Task                                                       | Status       |
| ---- | ---------------------------------------------------------- | ------------ |
| U13  | Run Documentor Agent on CLI Codebase                       | Pending      |
| H18  | Tailor documentation-bible to CLI repo                     | Phase 3 only |
| #4   | Handle plugins + local skills together                     | Pending      |
| D-27 | Switch config/metadata fields from snake_case to camelCase | Done         |
| D-28 | Fix startup warning/error messages                         | Pending      |
| D-29 | Ensure skills metadata YAML includes $schema reference     | Pending      |
| D-30 | Add Agents selection step to wizard                        | Pending      |

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

### Development

#### #4: Handle plugins + local skills together

Implement functionality to support both plugins and local skills working together simultaneously. This should allow users to use external plugins while also having access to their locally-defined skills without conflicts.

---

### Config Standardization

#### D-27: Switch Config/Metadata Fields from snake_case to camelCase

Rename all 27 snake_case fields to camelCase across YAML configs, TypeScript types, Zod schemas, JSON schemas, and all property accesses. Affects ~50 files and 6 JSON schemas.

**Full audit with field inventory, file touchpoints, migration layers, and special considerations:**
[todo/D-27-snake-case-audit.md](./D-27-snake-case-audit.md)

---

### UX / Polish

#### D-28: Fix Startup Warning/Error Messages

**See research doc:** [docs/research/startup-message-persistence.md](../docs/research/startup-message-persistence.md)

The CLI shows warning/error messages and the ASCII logo on startup that flash briefly then disappear. Ink's `clearTerminal` wipes all pre-Ink terminal output because `WizardLayout` uses `height={terminalHeight}`, triggering a full-screen clear on every render cycle.

**Root cause:** Pre-Ink `this.log()` / `warn()` calls print to the terminal, then Ink's first render erases everything via `ansiEscapes.clearTerminal`.

**Planned fix:** Buffer pre-Ink messages and render them via Ink's `<Static>` component (which survives `clearTerminal`).

**Changes needed:**

- `src/cli/commands/init.tsx`, `src/cli/commands/edit.tsx` — buffer messages instead of `this.log()` / `this.warn()`, pass buffer to `<Wizard>`
- `src/cli/components/wizard/wizard-layout.tsx` — add `<Static>` block for startup messages
- `src/cli/utils/logger.ts` + loading modules — support buffered output mode
- Audit which warnings are actionable vs noise; downgrade informational messages to `verbose()`

---

#### D-29: Ensure Skills Metadata YAML Includes $schema Reference

Each `metadata.yaml` file for skills should include a `$schema` field pointing to the JSON schema, enabling IDE validation and ensuring consistency across all skill metadata files.

**Changes needed:**

- Add `$schema` reference to all `metadata.yaml` files in source skill directories
- Update skill scaffolding (`new/skill.ts`) to include `$schema` in generated metadata
- Update `createTestSource()` and `writeTestSkill()` to include `$schema` in test fixtures
- Verify the validator accepts the `$schema` field (it should be ignored or explicitly allowed)

---

### Wizard / Features

#### D-30: Add Agents Selection Step to Wizard

**Problem:** Currently all agents are determined implicitly by `getAgentsForSkill()` in `config-generator.ts`, which pattern-matches selected skill paths against `skillToAgents` in `agent-mappings.yaml`. Users have zero visibility or control over which of the 18 agents get compiled.

**Solution:** Add a new "Agents" wizard step (after Sources, before or after Build) where users can select/deselect which sub-agents to compile.

**Pre-selection logic:**

- Based on selected domains, auto-check domain-specific agents:
  - `web` → web-developer, web-reviewer, web-researcher, web-tester
  - `api` → api-developer, api-reviewer, api-researcher
  - `cli` → cli-developer, cli-tester, cli-reviewer, cli-migrator
- Cross-cutting agents (web-pm, web-architecture) → pre-selected if any domain is selected
- **Meta agents NOT pre-selected by default:** agent-summoner, skill-summoner, documentor
- **Pattern agents NOT pre-selected by default:** pattern-scout, web-pattern-critique

**Existing mapping:** `agentSkillPrefixes` in `agent-mappings.yaml` already maps each agent to domain prefixes — this can drive the pre-selection logic by inverting the mapping (domain → agents with that prefix).

**UI approach:**

- Extract the domain selection checkbox grid from `domain-selection.tsx` into a reusable `CheckboxGrid` component
- Reuse `CheckboxGrid` for both domain selection and agent selection
- Group agents by category (developer, reviewer, researcher, tester, meta, pattern, planning, migration) — matches the `src/agents/` directory structure

**Changes needed:**

1. **Extract reusable component:** `domain-selection.tsx` → `CheckboxGrid` (generic) + `DomainSelection` (wraps it)
2. **New component:** `step-agents.tsx` — renders `CheckboxGrid` with agent items grouped by category
3. **Wizard store:** Add `selectedAgents: AgentName[]` state, `toggleAgent()`, `setAgentPreselection(domains: Domain[])` actions
4. **Wizard flow:** Insert agents step into step sequence (wizard.tsx, wizard-layout.tsx)
5. **Config generation:** Use `selectedAgents` from wizard result instead of deriving from skills
6. **Types:** Add `selectedAgents` to `WizardResultV2`

**Agent categories for grouping (from `src/agents/` directory structure):**

- Developer: web-developer, api-developer, cli-developer, web-architecture
- Reviewer: web-reviewer, api-reviewer, cli-reviewer
- Researcher: web-researcher, api-researcher
- Tester: web-tester, cli-tester
- Planning: web-pm
- Pattern: pattern-scout, web-pattern-critique
- Meta: agent-summoner, skill-summoner, documentor
- Migration: cli-migrator

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
