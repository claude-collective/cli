# Agents Inc. CLI - Task Tracking

| ID   | Task                                             | Status       |
| ---- | ------------------------------------------------ | ------------ |
| D-08 | Support user-defined stacks in consumer projects | Pending      |
| U13  | Run Documentor Agent on CLI Codebase             | Pending      |
| H18  | Tailor documentation-bible to CLI repo           | Phase 3 only |
| #4   | Handle plugins + local skills together           | Pending      |
| D-27 | Switch config/metadata fields from snake_case to camelCase | Pending |
| D-28 | Fix startup warning/error messages              | Pending      |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).
For final release tasks, see [TODO-final.md](./TODO-final.md).

---

## Reminders for Agents

See [docs/guides/agent-reminders.md](../docs/guides/agent-reminders.md) for the full list of rules (use specialized agents, handle uncertainties, blockers, commit policy, archiving, status updates, context compaction, cross-repo changes).

---

## Active Tasks

### Stacks

#### D-08: Support User-Defined Stacks in Consumer Projects

**See research doc:** [docs/research/user-defined-stacks.md](../docs/research/user-defined-stacks.md)

Allow consumers to define stacks at four levels with a clear hierarchy in the wizard:

1. **Project-level stacks** (top) — defined in a `stacks.yaml` referenced from `.claude-src/config.yaml` via the existing `stacks_file` field
2. **Global stacks** — user-defined stacks that apply across all projects (e.g., `~/.config/agents-inc/stacks.yaml`)
3. **Private marketplace stacks** — from configured marketplace sources
4. **Public stacks** (bottom) — built-in CLI stacks from `config/stacks.yaml`, hidden when a private source is configured

Each section has its own heading in the Stack Selection screen. Stacks are tagged with a `StackOrigin` (`"project" | "global" | "marketplace" | "public"`) and `originLabel` for display. The loader needs to change from either/or to merging from all origins.

**Files:** `src/cli/lib/stacks/stacks-loader.ts`, `src/cli/lib/loading/source-loader.ts`

---

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

Standardize all config and metadata field names to use camelCase instead of snake_case. This affects YAML config files (`config.yaml`, `metadata.yaml`) and their corresponding TypeScript types/schemas.

**Fields to rename:**

**config.yaml:**
- `agents_source` → `agentsSource`
- `skills_dir` → `skillsDir`
- `agents_dir` → `agentsDir`
- `stacks_file` → `stacksFile`
- `matrix_file` → `matrixFile`

**metadata.yaml (`forked_from`):**
- `forked_from` → `forkedFrom`
- `skill_id` → `skillId`
- `content_hash` → `contentHash`

**Files to change:**
- `src/cli/lib/configuration/config.ts` — `ProjectSourceConfig` type
- `src/cli/lib/skills/skill-metadata.ts` — `ForkedFromMetadata` type
- `src/cli/lib/schemas.ts` — Zod schemas
- All consumers of these types
- JSON schemas in `schemas/`

---

### UX / Polish

#### D-28: Fix Startup Warning/Error Messages

The CLI shows numerous warning or error messages on startup that clutter the terminal. Audit all messages shown during initialization, identify which are unnecessary or too verbose, and either suppress, downgrade to `verbose()`, or fix the underlying issues.

**Investigation needed:**

- Catalog all warnings/errors shown during a normal `agentsinc init` or `agentsinc edit` startup
- Determine which are actionable vs noise (e.g., missing optional config, fallback paths, network timeouts)
- Downgrade informational messages to `verbose()` so they only show with `--verbose` flag
- Fix any underlying issues causing spurious warnings (e.g., missing files that should be expected)

**Files likely involved:** `src/cli/hooks/init.ts`, `src/cli/lib/loading/`, `src/cli/lib/configuration/`, `src/cli/utils/logger.ts`

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
