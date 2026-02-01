# Wizard UX Redesign - Concerns & Clarifications

This document tracks concerns and questions about the wizard UX redesign. Each item should be resolved before implementation.

---

## Terminology Clarification

### Current Hierarchy (skills-matrix.yaml)

```
Top-level Category (frontend, backend, mobile, setup, reviewing)
└── Subcategory (framework, styling, client-state, server-state, etc.)
    └── Skill (react, vue, tailwind, zustand, etc.)
```

### Redesign Terminology

```
Domain (Web, API, CLI, Mobile)
└── Category (Framework, Styling, Client State, Server State, etc.)
    └── Option/Technology (React, Vue, Tailwind, Zustand, etc.)
```

### Mapping

| Redesign Term     | Current Term       | Example                       |
| ----------------- | ------------------ | ----------------------------- |
| Domain            | Top-level category | Web = frontend, API = backend |
| Category          | Subcategory        | Framework, Styling            |
| Option/Technology | Skill              | React, Tailwind               |

**Decision needed:** Should we rename in code/YAML, or just use different terms in UI?

---

## Concern 1: Stacks Get Wrong Skills (CRITICAL BUG)

**Status:** RESOLVED - Decision made, implementation pending

### The Problem

When you select `angular-stack`, you get **React skills** because:

1. `angular-stack` includes `web-developer` agent
2. `web-developer` has React hardcoded in `agent.yaml`:
   ```yaml
   skills:
     framework:
       id: web/framework/react (@vince) # ← Always React!
     styling:
       id: web/styling/scss-modules (@vince)
     state:
       id: web/state/zustand (@vince)
   ```
3. `stackToResolvedStack()` extracts skills from agents
4. Result: Angular stack gets React skills

**File:** `src/agents/developer/web-developer/agent.yaml:32-43`

### Root Cause

Phase 6 moved skills INTO agents, but agents are shared across stacks. The `web-developer` agent is used by ALL stacks (nextjs, angular, vue, etc.) but has React-specific skills.

### Options to Fix

| Option                           | Description                                                 | Pros                                        | Cons                                              |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------- | ------------------------------------------------- |
| **A. Skills in stacks**          | Stacks define category→skill mappings directly              | Clean separation, stacks are self-contained | Duplicates skill lists, agents lose skill context |
| **B. Stack-specific agents**     | Create `react-web-developer`, `angular-web-developer`, etc. | Each agent tailored                         | Agent explosion, maintenance burden               |
| **C. Parameterized agents**      | Agents reference slots, stacks fill them                    | Flexible, reusable agents                   | Complex, new concept to learn                     |
| **D. Skill overrides in stacks** | Agents have defaults, stacks override specific skills       | Backwards compatible                        | Two sources of truth                              |

### Decision: Option A (Skills in Stacks) - APPROVED

**Date:** 2026-02-01

#### Architecture Overview

```
CLI Repo (templates)                    Consumer Project (instance)
─────────────────────                   ───────────────────────────
config/stacks.yaml                      .claude/config.yaml
  └── Agents with technologies            └── 'stack' property with
      organized by subcategory                agent→skill mapping (resolved)

src/agents/*/agent.yaml
  └── Just tools, model, description
      NO skills (remove them)
```

#### Data Flow

1. **stacks.yaml** defines agents with technologies by subcategory:

   ```yaml
   stacks:
     - id: nextjs-fullstack
       agents:
         web-developer:
           framework: react # subcategory: technology
           styling: scss-modules
           client-state: zustand
         api-developer:
           api-framework: hono
           database: drizzle

     - id: angular-stack
       agents:
         web-developer:
           framework: angular # Different tech, same subcategory
           styling: tailwind
   ```

2. **skill_aliases** (skills-matrix.yaml) maps technology → verified skill (1:1):

   ```yaml
   skill_aliases:
     react: web/framework/react (@vince)
     angular: web/framework/angular (@vince)
     tailwind: web/styling/tailwind (@vince)
   ```

3. **Community alternatives** come from skills.sh search at runtime (Refine step)

4. **config.yaml** (consumer) stores resolved skills with authors:
   ```yaml
   stack:
     web-developer:
       framework: web/framework/react (@vince)
       styling: web/styling/scss-modules (@vince)
     api-developer:
       api-framework: api/framework/hono (@vince)
   ```

#### Changes to skills-matrix.yaml

Add `domain` field to subcategories:

```yaml
categories:
  framework:
    id: framework
    name: Framework
    parent: frontend
    domain: web # NEW - maps to redesign's Domain concept
    exclusive: true
    required: true

  api-framework:
    id: api-framework
    name: API Framework
    parent: backend
    domain: api # NEW
    exclusive: true
```

#### Key Points

- **Agents have NO skills** - just tools, model, description
- **Stacks define technologies by subcategory** - not raw skill lists
- **Technology list is derived** - from skills that have each category
- **skill_aliases stays 1:1** - technology → verified skill only
- **Community skills from skills.sh** - searched dynamically during Refine step
- **Scratch path users** - must manually edit config.yaml's `stack` property (acceptable for power users, CLI can help later)

---

## Concern 2: Domain vs Category Naming in skills-matrix.yaml

**Status:** RESOLVED - Addressed by Concern 1 decision

The redesign introduces "Domain" as a top-level grouping (Web, API, CLI, Mobile), but `skills-matrix.yaml` uses:

- `frontend` (not "web")
- `backend` (not "api")
- No "cli" category exists

**Decision:** Option 1 - Add `domain` field to subcategories for UI display.

This was included in the Concern 1 decision (see P7-1-1 in TODO.md):

```yaml
categories:
  framework:
    domain: web # Maps frontend → Web in UI
  api-framework:
    domain: api # Maps backend → API in UI
```

Keep existing category names (`frontend`, `backend`) in code, use `domain` for UI display.

---

## Concern 3: Missing CLI Domain/Category

**Status:** RESOLVED - Will add CLI domain

The redesign shows CLI as a selectable domain (line 265):

```
✓ Web (frontend)
○ API (backend)
✓ CLI (command-line)  ← NEW
○ Mobile
```

**Decision:** Add CLI as a full domain to `skills-matrix.yaml`.

Required additions:

- New `cli` top-level category
- Subcategories with `domain: cli`:
  - `cli-framework` (commander, oclif, yargs)
  - `cli-prompts` (clack, inquirer, ink)
  - `cli-testing` (vitest for CLI)
- Skills for each technology
- Corresponding entries in `skill_aliases`

---

## Concern 4: Two Step 2 Labels (Stack vs Domain)

**Status:** RESOLVED - Always use "Stack"

The redesign shows different Step 2 labels based on path:

- Template path: `[2] Stack`
- Scratch path: `[2] Domain`

**Decision:** Always use "Stack" as the label.

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
```

Both paths involve selecting a stack - either a pre-built one or building your own.

---

## Concern 5: Refine Step & Skill Sources

**Status:** RESOLVED - Will use skills.sh, integration deferred

The redesign's "Refine" step lets users choose between skill sources:

```
react (1/8)
❯ ● react (@claude-collective)              ✓ Verified
  ○ react-complete (@skills.sh/dan)         ⬇ 12.4k
```

**Decision:**

- The Refine step concept is approved
- Will integrate with skills.sh for community skill alternatives
- skills.sh integration can be deferred - implement Refine step with verified skills only first
- Add skills.sh search later as an enhancement

---

## Concern 6: stacks-as-visual-hierarchy.md Conflicts

**Status:** RESOLVED - Hybrid approach, reuse existing code

`docs/stacks-as-visual-hierarchy.md` was **not fully implemented**. Phase 6 took a different path (skills in agents).

**Our decision (Concern 1) is a hybrid that:**

- Aligns with stacks-as-visual-hierarchy goal (stacks define skills, not agents)
- Keeps structure (technologies by subcategory per agent, not flat list)
- Works with the wizard UX redesign's Build grid

**Code to reuse/adapt:**

- `stackToResolvedStack()` - Modify to read from new stacks.yaml format
- `ResolvedStack` type - Keep, just populated differently
- Wizard flow - Already has approach/stack/category structure
- `skill_aliases` - Already maps technology → skill

**No need to implement stacks-as-visual-hierarchy.md separately** - our Concern 1 decision supersedes it.

---

## Concern 7: WizardState Type Changes

**Status:** RESOLVED - Create v2 store, migrate incrementally

The redesign proposes new WizardState fields (line 742-764):

```typescript
// New fields needed
approach: 'stack' | 'scratch'
selectedDomains: string[]           // ['web', 'api', 'cli']
currentDomainIndex: number          // Which domain in Build step
domainSelections: Record<string, Record<string, string>>  // {web: {framework: 'react'}}
currentRefineIndex: number          // Which skill in Refine step
skillSources: Record<string, string>  // {react: 'react (@claude-collective)'}
showDescriptions: boolean
expertMode: boolean                 // Already exists
installMode: 'plugin' | 'local'     // Already exists (v0.5.1) - PRESERVE
```

**Decision:** Create a new `wizard-store-v2.ts` with the new type.

Migration strategy:

1. Create `wizard-store-v2.ts` with new `WizardStateV2` type
2. Update components incrementally to use v2
3. Once all references migrated and tests pass, remove v1
4. Rename v2 to just `wizard-store.ts`

This follows the same pattern used for the `cli-v2` oclif migration - safe, incremental, testable.

---

## Concern 8: Build Step UI - Grid vs Linear

**Status:** RESOLVED - Grid is a priority

Current wizard flow:

```
category → subcategory → (select skills) → confirm
```

Redesign Build step shows all categories at once in a grid:

```
Framework *     ❯ ● react      ○ vue        ○ angular     ○ svelte
Styling *         ● scss-mod   ○ tailwind   ○ styled      ○ vanilla
Client State      ○ zustand    ○ jotai      ○ redux       ○ mobx
```

**Decision:** The grid UI is a priority - it's a big selling point of the redesign.

Required components:

- `CategoryGrid` component with 2D navigation (←/→ for options, ↑/↓ for categories)
- Multi-column layout with Ink's Box/Flexbox
- Toggle selection UX (SPACE to select/deselect)
- Visual states: selected (●), recommended (⭐), discouraged (⚠), disabled (✗)

---

## Concern 9: Multi-Domain Build Flow

**Status:** RESOLVED - Must-have, use single Zustand store

If user selects multiple domains (Web + API), the redesign shows:

- Build/Web → Build/API (with progress indicator)
- Section progress: `Domain: Web [1/2] Next: API`

**Decision:** Multi-domain is a must-have. Keep it simple:

- Single Zustand store for all wizard state (it's just a CLI app)
- Track `currentDomainIndex` and `selectedDomains` in the v2 store
- Store selections per domain in `domainSelections`
- Use SectionProgress component (P7-3-3) to show domain progress

---

## Concern 10: Progress Components

**Status:** RESOLVED - Priority, use Ink flexbox for responsive layout

The redesign introduces two progress components:

1. **WizardTabs** - Main wizard progress

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     ✓             ✓            ●            ○              ○
```

2. **SectionProgress** - Sub-step progress

```
  Domain: Web                                         [1/2] Next: API
```

**Decision:** Priority - these are not complex.

**Implementation approach:**

- Use Ink's `Box` component with flexbox (`justifyContent: 'space-between'`)
- Content on left, progress indicator on right
- Start WITHOUT top/bottom borders (avoid fixed-width character issues)
- Let flexbox handle responsive terminal width
- Add borders later if needed (Ink's `Box` has `borderStyle` prop)

This keeps the CLI responsive to different terminal widths.

---

## Summary: Prioritization Needed

| Concern                        | Impact       | Suggested Priority                              |
| ------------------------------ | ------------ | ----------------------------------------------- |
| 1. **Stacks get wrong skills** | **CRITICAL** | **RESOLVED** - See decision above               |
| 2. Domain naming               | Low          | **RESOLVED** - Use `domain` field               |
| 3. CLI domain                  | Medium       | **RESOLVED** - Add CLI to skills-matrix         |
| 4. Step 2 label                | Low          | **RESOLVED** - Always "Stack"                   |
| 5. Refine/skills.sh            | High         | **RESOLVED** - Use skills.sh, defer integration |
| 6. Reconcile docs              | Medium       | **RESOLVED** - Hybrid approach, reuse code      |
| 7. WizardState changes         | High         | **RESOLVED** - Create v2 store, migrate         |
| 8. Grid vs Linear              | High         | **RESOLVED** - Grid is priority                 |
| 9. Multi-domain                | Medium       | **RESOLVED** - Must-have, single store          |
| 10. Progress components        | Medium       | **RESOLVED** - Priority, use flexbox            |

---

## Next Steps

All concerns resolved! Ready for PM session.

1. ~~**FIX CRITICAL BUG:** Decide how stacks should define skills~~ **DONE**
2. ~~**Resolve remaining concerns**~~ **DONE** - All 10 concerns resolved
3. **PM Session:** Create exhaustive implementation plan for Phase 7
4. **Implementation:** Follow TODO.md Phase 7 tasks

---

## Revision History

| Date       | Author | Changes                                                     |
| ---------- | ------ | ----------------------------------------------------------- |
| 2026-02-01 | Claude | Initial document                                            |
| 2026-02-01 | Claude | Resolved Concern 1 - Decision: skills in stacks, not agents |
| 2026-02-01 | Claude | Resolved all 10 concerns - Ready for PM session             |
