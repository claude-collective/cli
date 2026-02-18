# Agents Inc. CLI - Task Tracking

| ID               | Task                                   | Status       |
| ---------------- | -------------------------------------- | ------------ |
| U13              | Run Documentor Agent on CLI Codebase   | Pending      |
| U15              | Add Comprehensive Help Overlay         | Pending      |
| H18              | Tailor documentation-bible to CLI repo | Phase 3 only |
| #1               | Create proper Work web stack           | Pending      |
| #2               | Add proper documentation               | Pending      |
| #4               | Handle plugins + local skills together | Pending      |
| #15              | Create Agents Inc. logo                | Pending      |
| #19              | Sub-agent learning capture system      | Pending      |
| U-LOGO           | Upload logo / branding asset           | Pending      |
| U-UI-ITERATION   | Wizard UI polish pass                  | Pending      |
| U-SOURCES-SCROLL | Add scrolling to Sources step          | Done         |
| WUX-3            | Visually verify wizard UX changes      | Pending      |

---

For completed tasks, see [TODO-completed.md](./TODO-completed.md).
For deferred tasks, see [TODO-deferred.md](./TODO-deferred.md).

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

#### U15: Add Comprehensive Help Overlay

Add a comprehensive help section/overlay accessible via `?` key to show users how to get the most out of the CLI:

**Content to include:**

- Keyboard shortcuts (expand on existing help modal)
- Navigation patterns
- Tips for wizard flow
- Common workflows (init, edit, compile, update)
- Source management tips
- Expert mode features

**Implementation:**

- Expand existing `help-modal.tsx` with more comprehensive content
- Add context-sensitive help (different content per step)
- Include examples and tips
- Make it easy to discover (`?` key always visible)

**Files:** `src/cli/components/wizard/help-modal.tsx`

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

#### #1: Create proper Work web stack

Build a comprehensive web stack configuration for work-related projects. This should include all necessary tooling, frameworks, and configurations needed for professional web development.

---

#### #2: Add proper documentation

Create comprehensive documentation covering the project structure, usage patterns, configuration options, and development guidelines. This should help developers understand and contribute to the project effectively.

---

#### #4: Handle plugins + local skills together

Implement functionality to support both plugins and local skills working together simultaneously. This should allow users to use external plugins while also having access to their locally-defined skills without conflicts.

---

#### #19: Implement sub-agent learning capture system

Create a system to capture learnings from sub-agents after they complete their work, which can be used to continuously improve agent performance and documentation.

**Core functionality:**

- Implement a post-completion hook that fires when a sub-agent finishes its task
- The hook prompts the agent with reflection questions:
  - "Did you struggle with any part of this task?"
  - "Were there any conventions or patterns you needed that weren't documented?"
  - "What would have made this task easier?"
  - "Did you discover any patterns worth documenting for future agents?"
- Store learnings in a structured format (e.g., `.claude/learnings.md` or `.claude/agent-feedback.jsonl`)
- Categorize learnings by: struggles, undocumented conventions, discovered patterns, suggested improvements

**Use cases:**

- Identify gaps in coding standards and documentation
- Discover patterns that should be added to TypeScript Types Bible or Clean Code Standards
- Track recurring pain points across multiple agent runs
- Generate prompts for improving agent instructions or system prompts
- Feed learnings back into the agent improvement cycle

**Implementation considerations:**

- Make it opt-in (user can enable/disable via config)
- Keep prompts concise to avoid token overhead
- Support both automatic capture (hook) and manual capture (command like `cc learn`)
- Consider deduplication of similar learnings
- Provide command to review accumulated learnings (`cc learnings list`)
- Add tooling to convert learnings into documentation updates (`cc learnings apply`)

**Related:** Task #18 (AI documentation iteration) - learnings can inform documentation improvements

---

### Design & Branding

#### #15: Create a logo for Agents Inc

Design and create a logo for the Agents Inc. brand. The logo should be professional, scalable (vector format), and suitable for use in:

- CLI interface/terminal output
- Documentation and README files
- GitHub repository
- Marketing materials
- Potential white-label scenarios

Consider creating multiple variations (full logo, icon only, monochrome) for different use cases.

---

#### U-LOGO: Upload Logo / Branding Asset

Upload the Agents Inc. logo asset so it can be referenced from the README, marketplace listing, and any future web presence. (See also #15 — logo design.)

**Files:** `README.md`, potentially `assets/` or `public/`

---

### CLI Improvements

#### U-UI-ITERATION: UI Polish Pass on Wizard

Iterate over the full wizard UI to improve visual consistency, spacing, and clarity across all steps (Stack, Build, Sources, Confirm). Review column widths, alignment, color usage, empty states, and overall visual hierarchy.

**Files:** `src/cli/components/wizard/`

---

#### U-SOURCES-SCROLL: Add Scrolling to the Sources Step [DONE]

The Sources step "customize" view overflows the terminal when many skills are selected. Add pixel-accurate scroll support by replicating the pattern already used in `CategoryGrid` (Build step).

**Approach:** Duplicate the Build step's measurement + scroll pattern. Do NOT extract a shared component — the shell is just 3 lines of JSX + one hook call, not worth abstracting.

**Implementation (2 files):**

1. **`src/cli/components/wizard/step-sources.tsx`** (customize view, lines 102–115):
   - Import `useMeasuredHeight` from `../hooks/use-measured-height.js`
   - Call `useMeasuredHeight()` alongside existing hooks (~line 34)
   - Change outer Box (line 105) to `<Box flexDirection="column" width="100%" flexGrow={1} flexBasis={0}>`
   - Wrap `<SourceGrid>` in `<Box ref={gridRef} flexGrow={1} flexBasis={0}>`
   - Pass `availableHeight={gridHeight}` to `<SourceGrid>`

2. **`src/cli/components/wizard/source-grid.tsx`** (lines 122–245):
   - Add `availableHeight?: number` to `SourceGridProps` (line 25)
   - Add section ref tracking + `useEffect` height measurement (pattern: `category-grid.tsx:295–319`)
   - Add `scrollTopPx` state + scroll-into-view `useEffect` driven by `focusedRow` (pattern: `category-grid.tsx:297,324–343`)
   - Compute `scrollEnabled = availableHeight >= SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS` (pattern: `category-grid.tsx:321`)
   - When scroll-enabled: render with `<Box height={availableHeight} overflow="hidden">` + negative `marginTop` (pattern: `category-grid.tsx:379–384`)
   - When not scroll-enabled: render flat (current behaviour — `availableHeight` defaults to 0)
   - Attach `ref={(el) => setSectionRef(index, el)}` to each `SourceSection` wrapper

**Reference files (read-only patterns):**

- `src/cli/components/wizard/category-grid.tsx:294–385` — complete scroll implementation
- `src/cli/components/wizard/step-build.tsx:69,124` — measurement shell wiring
- `src/cli/consts.ts` — `SCROLL_VIEWPORT.MIN_VIEWPORT_ROWS` constant

**Acceptance criteria:**

- "customize" view scrolls when rows exceed terminal height
- Focused row is always visible (auto-scroll on arrow navigation)
- No scrolling when all rows fit
- "choice" view (two-option selector) is unaffected
- Terminal resize re-measures and adjusts viewport
- Existing `SourceGrid` tests still pass (`availableHeight` defaults to 0 = no scroll)

---

#### WUX-3: Visually Verify Wizard UX Changes

The agents reported success on wizard UX changes but visual verification is needed. Manually verify:

- No icons in skill tags
- No colored borders on unfocused tags
- Stable skill order
- Proper tag wrapping on narrow terminals

**Action:** Manual testing with `agentsinc init` or `agentsinc edit` in an 80-column terminal.

---

## Testing Tasks

See [TODO-testing.md](./TODO-testing.md) for the full testing guide: coverage table (what is and isn't tested), automated test tasks T1-T6, step-by-step manual procedures for every command, and the 28-point quick-pass checklist.

---

## Notes

- Test target directory: `/home/vince/dev/cv-launch`
- Source marketplace: `/home/vince/dev/claude-subagents`
- CLI under test: `/home/vince/dev/cli`
