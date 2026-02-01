# Wizard UX Redesign

## Overview

This document outlines the redesigned wizard flow for Claude Collective CLI. The goal is to make skill selection more intuitive by organizing choices around **categories** (Framework, Styling, State) rather than browsing a flat list of skills.

## Key Concepts

### 1. Technology vs Skill

- **Technology**: What the user wants to use (e.g., "React", "Tailwind", "Zustand")
- **Skill**: The actual skill file that teaches Claude about that technology

Users first pick **technologies**, then optionally refine which **skill source** to use for each.

### 2. Domains

Users can freely select any combination:

- **Web**: Frontend technologies (Framework, Styling, State, Forms, Testing, etc.)
- **API**: Backend technologies (Framework, Database, Auth, Email, Observability, etc.)
- **CLI**: Command-line tools (Framework, Prompts, Testing, etc.)
- **Mobile**: Mobile frameworks (React Native, Expo, etc.)

No "Full-Stack" preset - users simply select Web + API together if they want both.

### 3. Progress Tracking

**Wizard-level progress**: Shows overall steps in the wizard

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     ✓             ●            ○            ○              ○
```

**Step-level progress**: Only shown when a step has multiple sub-parts

- In Build step with multiple domains: shows Web vs API progress
- In Refine step: shows progress through skills (1/5, 2/5, etc.)

---

## Complete User Flows

### Flow A: Pre-built Stack

After selecting a stack, users can either:

- **Refine only**: Just swap skill sources (e.g., use community react skill instead of verified)
- **Customize**: Go to Build grid with stack's selections pre-populated, then Refine

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 1: APPROACH                                                           │
│  ─────────────────                                                          │
│  How would you like to set up?                                              │
│                                                                             │
│  ❯ ● Use a pre-built stack template    ← User selects this                 │
│    ○ Build from scratch                                                     │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 2: STACK                                                              │
│  ─────────────                                                              │
│  Select a stack template:                                                   │
│                                                                             │
│  ❯ ● nextjs-fullstack                                                       │
│      Next.js 15 + Hono + Drizzle + Better Auth                             │
│      Includes: react, scss-modules, zustand, react-query, hono, drizzle    │
│                                                                             │
│    ○ angular-stack                                                          │
│      Angular 19 + Signals + NgRx                                           │
│                                                                             │
│    ○ vue-stack                                                              │
│      Vue 3 + Pinia + Tailwind                                              │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 2b: STACK OPTIONS (after selecting a stack)                          │
│  ─────────────────────────                                                  │
│  You selected: nextjs-fullstack                                             │
│                                                                             │
│  What would you like to do?                                                 │
│                                                                             │
│  ❯ ● Continue with stack defaults                                           │
│      Use all technologies as-is, optionally swap skill sources             │
│                                                                             │
│    ○ Customize technologies                                                 │
│      Use stack as starting point, add/remove/change technologies           │
│                                                                             │
│                    ┌──────────────────┴──────────────────┐                 │
│                    │                                     │                 │
│                    ▼                                     ▼                 │
│           ┌────────────────┐                   ┌────────────────┐          │
│           │ Continue with  │                   │ Customize      │          │
│           │ defaults       │                   │ technologies   │          │
│           └───────┬────────┘                   └───────┬────────┘          │
│                   │                                    │                   │
│                   │                                    ▼                   │
│                   │                           ┌────────────────┐           │
│                   │                           │  3. BUILD      │           │
│                   │                           │                │           │
│                   │                           │  Grid shows    │           │
│                   │                           │  stack choices │           │
│                   │                           │  pre-selected  │           │
│                   │                           │                │           │
│                   │                           │  User can      │           │
│                   │                           │  add/remove/   │           │
│                   │                           │  change        │           │
│                   │                           └───────┬────────┘           │
│                   │                                   │                    │
│                   └─────────────┬─────────────────────┘                    │
│                                 │                                          │
│                                 ▼                                          │
│                                                                             │
│  STEP 4: REFINE                                                             │
│  ──────────────                                                             │
│  Your stack includes 12 technologies.                                       │
│                                                                             │
│  ╔═════════════════════════════════════════════════════════════════════╗   │
│  ║                                                                     ║   │
│  ║   ❯ Use all recommended skills (verified)           ← DEFAULT      ║   │
│  ║                                                                     ║   │
│  ║     This is the fastest option. All skills are verified and        ║   │
│  ║     maintained by Claude Collective.                               ║   │
│  ║                                                                     ║   │
│  ╚═════════════════════════════════════════════════════════════════════╝   │
│                                                                             │
│     ○ Customize skill sources                                               │
│       Choose alternative skills from the community for each technology     │
│                                                                             │
│  ENTER to continue                                                          │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 5: CONFIRM                                                            │
│  ───────────────                                                            │
│  Ready to install nextjs-fullstack                                          │
│                                                                             │
│  Technologies: 12                                                           │
│  Skills: 12 (all verified)                                                  │
│  Install mode: Plugin                                                       │
│                                                                             │
│  [← Back]  [Confirm and install]                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Flow A1: Stack → Continue with defaults → Refine → Confirm**

- Fastest path for users who just want to swap skill sources

**Flow A2: Stack → Customize → Build (pre-populated) → Refine → Confirm**

- For users who want to use stack as a starting point but modify technologies

---

### Flow B: Build from Scratch - Single Domain (Web only)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 1: APPROACH                                                           │
│  ─────────────────                                                          │
│  How would you like to set up?                                              │
│                                                                             │
│    ○ Use a pre-built stack template                                         │
│  ❯ ● Build from scratch                    ← User selects this             │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 2: DOMAIN                                                             │
│  ──────────────                                                             │
│  What are you building? (SPACE to toggle, ENTER to continue)                │
│                                                                             │
│  ❯ ✓ Web (frontend)                        ← User selects this             │
│    ○ API (backend)                                                          │
│    ○ CLI (command-line)                                                     │
│    ○ Mobile                                                                 │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 3: BUILD                                                              │
│  ─────────────                                                              │
│  Configure your Web stack:                                                  │
│                              [ ] Show descriptions    [Expert Mode: OFF]    │
│                                                                             │
│  Framework        ❯ ● react       ○ vue        ○ angular     ○ svelte      │
│                                                                             │
│  Meta-Framework     ○ next.js     ○ remix      ✗ nuxt                      │
│                                                                             │
│  Styling *          ● scss-mod    ○ tailwind   ○ styled      ○ vanilla     │
│                                                                             │
│  Client State       ● zustand ⭐   ○ jotai      ○ redux ⚠                   │
│                                                                             │
│  Server State       ● react-query ○ swr        ○ apollo                    │
│                                                                             │
│  Forms              ○ rhf         ○ formik     ○ conform                   │
│                                                                             │
│  Testing            ● vitest ⭐    ○ jest                                   │
│                                                                             │
│  UI Components      ○ radix       ○ shadcn     ○ headless-ui               │
│                                                                             │
│  ←/→ options   ↑/↓ categories   SPACE select   ENTER continue              │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 4: REFINE                                                             │
│  ──────────────                                                             │
│  You selected 5 technologies. Choose skill sources:                         │
│                                                                             │
│  [Use all recommended]                                                      │
│                                                                             │
│  react (1/5)                                                                │
│  ❯ ● react (@claude-collective)              ✓ Verified                    │
│    ○ react-complete (@skills.sh/dan)         ⬇ 12.4k                       │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 5: CONFIRM                                                            │
│  ───────────────                                                            │
│  Ready to install your custom Web stack                                     │
│                                                                             │
│  Technologies: 5                                                            │
│  Skills: 5                                                                  │
│  Install mode: Plugin                                                       │
│                                                                             │
│  [← Back]  [Confirm and install]                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Flow B Summary:**

1. Approach → Domain
2. Domain → Build (Web categories)
3. Build → Refine
4. Refine → Confirm
5. Confirm → Install

---

### Flow C: Build from Scratch - Multiple Domains (Web + API)

This is the most complex flow with **sub-steps** within the Build step.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 1: APPROACH                                                           │
│  ─────────────────                                                          │
│  ❯ ● Build from scratch                                                     │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 2: DOMAIN                                                             │
│  ──────────────                                                             │
│  What are you building? (SPACE to toggle, ENTER to continue)                │
│                                                                             │
│    ✓ Web (frontend)                        ← Selected                       │
│  ❯ ✓ API (backend)                         ← Selected                       │
│    ○ CLI (command-line)                                                     │
│    ○ Mobile                                                                 │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 3: BUILD - Part 1 of 2 (Web)                                         │
│  ─────────────────────────────────                                          │
│                                                                             │
│  [1] Approach  [2] Domain  [3] Build  [4] Refine  [5] Confirm              │
│       ✓           ✓           ●          ○           ○                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Build: Web                                          Part 1 of 2   │   │
│  │         ████████████░░░░░░░░░░░░                                   │   │
│  │         Web          API                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Configure your Web stack:                                                  │
│                                                                             │
│  Framework        ❯ ● react       ○ vue        ○ angular     ○ svelte      │
│  Styling            ● scss-mod    ○ tailwind   ○ styled                    │
│  Client State       ● zustand     ○ jotai      ○ redux                     │
│  Server State       ● react-query ○ swr        ○ apollo                    │
│  Testing            ● vitest      ○ jest                                   │
│                                                                             │
│  ENTER to continue to API configuration →                                  │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 3: BUILD - Part 2 of 2 (API)                                         │
│  ─────────────────────────────────                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Build: API                                          Part 2 of 2   │   │
│  │         ████████████████████████                                   │   │
│  │         Web ✓        API                                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Configure your API stack:                                                  │
│                                                                             │
│  API Framework    ❯ ● hono        ○ express    ○ fastify     ○ elysia      │
│  Database           ● drizzle ⭐   ○ prisma     ○ typeorm                   │
│  Auth               ● better-auth ○ lucia      ○ next-auth                 │
│  Email              ○ resend      ○ nodemailer                             │
│  Observability      ○ pino        ○ winston                                │
│  Analytics          ○ posthog                                              │
│                                                                             │
│  ENTER to continue to Refine →                                             │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 4: REFINE                                                             │
│  ──────────────                                                             │
│  You selected 8 technologies. Choose skill sources:                         │
│                                                                             │
│  [Use all recommended]                                                      │
│                                                                             │
│  react (1/8) ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░                              │
│  ❯ ● react (@claude-collective)              ✓ Verified                    │
│    ○ react-complete (@skills.sh/dan)         ⬇ 12.4k                       │
│                                                                             │
│  ... continues for each technology ...                                      │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 5: CONFIRM                                                            │
│  ───────────────                                                            │
│  Ready to install your custom stack (Web + API)                            │
│                                                                             │
│  Web: react, scss-modules, zustand, react-query, vitest                    │
│  API: hono, drizzle, better-auth                                           │
│                                                                             │
│  Technologies: 8                                                            │
│  Skills: 8                                                                  │
│  Install mode: Plugin                                                       │
│                                                                             │
│  [← Back]  [Confirm and install]                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Flow C Summary:**

1. Approach → Domain
2. Domain (Web + API selected) → Build/Web
3. Build/Web → Build/API
4. Build/API → Refine
5. Refine → Confirm
6. Confirm → Install

---

### Flow D: Build from Scratch - Multiple Domains (Web + CLI)

Similar to Flow C but with different domain combinations.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  STEP 2: DOMAIN                                                             │
│  ──────────────                                                             │
│  What are you building? (select multiple with SPACE)                        │
│                                                                             │
│    ✓ Web (frontend)                        ← Selected                       │
│    ○ API (backend)                                                          │
│    ✓ CLI (command-line)                    ← Selected                       │
│    ○ Mobile                                                                 │
│    ○ Mobile                                                                │
│                                                                             │
│  ENTER to continue with 2 domains →                                        │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 3: BUILD - Part 1 of 2 (Web)                                         │
│  ... same as Flow C ...                                                     │
│                                                                             │
│                           ↓                                                 │
│                                                                             │
│  STEP 3: BUILD - Part 2 of 2 (CLI)                                         │
│  ─────────────────────────────────                                          │
│                                                                             │
│  Configure your CLI stack:                                                  │
│                                                                             │
│  CLI Framework    ❯ ● commander   ○ oclif      ○ yargs                     │
│  Prompts            ● clack       ○ inquirer   ○ ink                       │
│  Testing            ● vitest      ○ jest                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Progress Tracker Design

### Two Progress Components

We have exactly **two** progress components:

1. **Main Progress (Wizard Tabs)** - Always visible, always same 5 tabs
2. **Section Progress** - Shown when a step has sub-parts

### 1. Main Progress: Wizard Tabs

**Always shows all 5 tabs. Unused steps are grayed out.**

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     ✓             ●            ○            ○              ○
```

**States:**

- `✓` (green) = completed
- `●` (cyan) = current
- `○` (white) = pending
- `○` (gray/dim) = skipped/not applicable for this flow

**Example: Stack template path (Build step skipped)**

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     ✓             ✓            ○            ●              ○
                               dim
```

**Example: Build from scratch (Stack step skipped)**

```
[1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm
     ✓             ○            ●            ○              ○
                  dim
```

### 2. Section Progress

**Consistent format for any step that has sub-parts:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  {Section}: {Current}                          [{N}/{Total}] Next: {Next} │
└─────────────────────────────────────────────────────────────────────┘
```

**Examples:**

**Multi-domain Build (Web, then API):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Domain: Web                                         [1/2] Next: API │
└─────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Domain: API                                         [2/2] Last step │
└─────────────────────────────────────────────────────────────────────┘
```

**Refine step (multiple skills):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Skill: react                                   [1/8] Next: zustand │
└─────────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────────┐
│  Skill: better-auth                              [8/8] Last skill │
└─────────────────────────────────────────────────────────────────────┘
```

### When Section Progress is Shown

| Step   | Condition            | Section Progress            |
| ------ | -------------------- | --------------------------- |
| Build  | Single domain        | Not shown                   |
| Build  | Multiple domains     | Shown: "Domain: Web [1/2]"  |
| Refine | Any number of skills | Shown: "Skill: react [1/8]" |

### Combined Example

**Multi-domain build (Web + API), at API configuration:**

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                   │
│  [1] Approach    [2] Stack    [3] Build    [4] Refine    [5] Confirm                                             │
│       ✓             ○            ●            ○              ○                                                    │
│                    dim                                                                                            │
│                                                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  Domain: API                                                                       [2/2] Last step          │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                                   │
│  Configure your API stack:                                          [ ] Show descriptions     3/6 selected      │
│                                                                                                                   │
│  API Framework    ❯ ● hono        ○ express    ○ fastify     ○ elysia                                           │
│  Database           ● drizzle ⭐   ○ prisma     ○ typeorm                                                       │
│  Auth               ● better-auth ○ lucia      ○ next-auth                                                      │
│  Email              ○ resend      ○ nodemailer                                                                  │
│  ...                                                                                                              │
│                                                                                                                   │
│  ←/→ options   ↑/↓ categories   SPACE select   ENTER continue                                                   │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Visual Components Needed

### 1. WizardTabs (Bracket Style)

```
[1] Approach    [2] Domain    [3] Build    [4] Refine    [5] Confirm
     ✓             ✓             ●            ○              ○
```

**States:**

- `✓` (green) = completed
- `●` (cyan) = current
- `○` (gray) = pending

**Props:**

```typescript
interface WizardTabsProps {
  steps: Array<{ id: string; label: string }>;
  currentStep: string;
  completedSteps: string[];
}
```

### 2. CategoryGrid (Build Step)

```
                                                      [ ] Show descriptions  [Expert Mode: OFF]

Framework *     ❯ ● react ⭐    ○ vue         ○ angular      ○ svelte
Styling *         ● scss-mod    ○ tailwind ⭐  ○ styled       ○ vanilla
Client State      ○ zustand ⭐   ○ jotai       ○ redux ⚠      ○ mobx
Server State      ● react-query ○ swr         ○ apollo
Analytics         ○ posthog                                               (optional, nothing selected)
```

**Selection Behavior:**

- **Toggle selection**: Press SPACE to select, press again to deselect
- **No "none" option needed**: Just don't select anything (or deselect)
- **Exclusive categories** (`exclusive: true`): Only one at a time (selecting another deselects previous)
- **Multi-select categories** (`exclusive: false`): Can select multiple
- **Required categories** (marked with `*`): Must have at least one selection to continue

**Visual States:**

| State              | Visual Treatment          | Behavior                            |
| ------------------ | ------------------------- | ----------------------------------- |
| **Recommended** ⭐ | Green text + star         | Suggested based on other selections |
| **Discouraged** ⚠  | Yellow/dim text + warning | Works but not ideal                 |
| **Disabled**       | Gray text, strikethrough  | Cannot select (incompatible)        |
| **Selected**       | Green ●                   | Currently chosen                    |
| **Normal**         | White ○                   | Available, no preference            |

**Expert Mode Toggle:**

| Mode              | Behavior                                                        |
| ----------------- | --------------------------------------------------------------- |
| **OFF** (default) | Recommended options shown first, discouraged shown with warning |
| **ON**            | All options shown in original order, indicators still visible   |

**Visual Example (Expert Mode OFF):**

```
Framework *     ❯ ● react ⭐    ○ vue         ○ angular      ○ svelte
                    └── green     └── white     └── white      └── white

Client State      ○ zustand ⭐   ○ jotai       ○ redux ⚠      ○ mobx
                    └── green     └── white     └── yellow     └── white
                                                └── "heavy for small apps"
```

**Visual Example (Disabled option focused):**

```
Meta-Framework    ○ next.js     ❯ ✗ nuxt      ✗ sveltekit
                                   └── gray, shows tooltip:
                                       "Requires vue (you selected react)"
```

**Props:**

```typescript
interface CategoryGridProps {
  categories: CategoryRow[];
  selections: Record<string, string[]>; // Now array for multi-select categories
  focusedRow: number;
  focusedCol: number;
  showDescriptions: boolean;
  expertMode: boolean;
  onToggle: (categoryId: string, optionId: string) => void;
}

interface CategoryRow {
  id: string;
  label: string;
  required: boolean; // Show * indicator
  exclusive: boolean; // Radio vs checkbox behavior
  options: CategoryOption[];
}

interface CategoryOption {
  id: string;
  label: string;
  state: "normal" | "recommended" | "discouraged" | "disabled";
  stateReason?: string; // Tooltip text explaining why
  selected: boolean;
}
```

### 3. SkillRefiner (Refine Step)

**Two-part design to encourage using verified skills:**

**Part 1: Choice (default view)**

```
╔═════════════════════════════════════════════════════════════════════╗
║                                                                     ║
║   ❯ Use all recommended skills (verified)           ← DEFAULT      ║
║                                                                     ║
║     This is the fastest option. All skills are verified and        ║
║     maintained by Claude Collective.                               ║
║                                                                     ║
╚═════════════════════════════════════════════════════════════════════╝

   ○ Customize skill sources
     Choose alternative skills from the community for each technology
```

**Part 2: Customization (only if user chooses to customize)**

```
┌─────────────────────────────────────────────────────────────────────┐
│  Skill: react                                   [1/8] Next: zustand │
└─────────────────────────────────────────────────────────────────────┘

❯ ● react (@claude-collective)              ✓ Verified  ⭐ Recommended
  ○ react-complete (@skills.sh/dan)         ⬇ 12.4k
  ○ react-hooks-mastery (@skills.sh/kent)   ⬇ 8.2k
```

**Features:**

- Default action is "Use all recommended" (prominent, boxed)
- Customization is secondary option
- If customizing: shows verified skill first, community alternatives below
- Download counts for popularity
- Section progress shown only during customization

### 4. SectionProgress (Reusable)

Used for both multi-domain Build and Refine steps:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Domain: Web                                         [1/2] Next: API │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│  Skill: react                                   [1/8] Next: zustand │
└─────────────────────────────────────────────────────────────────────┘
```

**Props:**

```typescript
interface SectionProgressProps {
  label: string; // "Domain" or "Skill"
  current: string; // "Web" or "react"
  index: number; // 1-based
  total: number; // Total count
  next?: string; // Next item name, or undefined if last
}
```

### 5. HighlightedText (Search) - DEFERRED

Search functionality is deferred for further UX consideration.

```tsx
// Future: "react-query" with search "query"
// <Text>react-<Text color="cyan" bold>query</Text></Text>
```

---

## Keyboard Shortcuts Summary

### Global (All Steps)

| Key      | Action                   |
| -------- | ------------------------ |
| `ESC`    | Go back to previous step |
| `Ctrl+C` | Cancel wizard            |
| `ENTER`  | Confirm/Continue         |

### Category Grid (Build Step)

| Key       | Action                          |
| --------- | ------------------------------- |
| `←` / `→` | Move between options in row     |
| `↑` / `↓` | Move between categories         |
| `SPACE`   | Toggle option (select/deselect) |
| `TAB`     | Toggle descriptions             |
| `E`       | Toggle Expert Mode              |

### Skill Refiner (Refine Step)

| Key       | Action                     |
| --------- | -------------------------- |
| `↑` / `↓` | Move between skill sources |
| `ENTER`   | Select and go to next      |
| `S`       | Skip (use recommended)     |
| `TAB`     | Use all recommended        |

### Search Mode - DEFERRED

Search functionality is deferred for further UX consideration.

---

## State Management

### Wizard Store Extensions

```typescript
interface WizardState {
  // Existing
  step: WizardStep;
  selectedSkills: string[];

  // New: Flow tracking
  approach: "stack" | "scratch";
  selectedStack: string | null;
  selectedDomains: string[]; // ['web', 'api', 'cli', etc.]

  // New: Build step
  currentDomainIndex: number; // Which domain we're configuring
  domainSelections: Record<string, Record<string, string>>;
  // e.g., { web: { framework: 'react', styling: 'scss-modules' }, api: { ... } }

  // New: Refine step
  currentRefineIndex: number; // Which technology we're refining
  skillSources: Record<string, string>; // technology -> skill ID

  // New: UI state
  showDescriptions: boolean;
  expertMode: boolean;
}
```

**Note:** `searchQuery` removed - search functionality is deferred.

```

---

## Implementation Priority

### Phase 1: Core Flow

1. WizardTabs component (bracket style)
2. CategoryGrid component (no boxes, compact)
3. Update wizard step flow

### Phase 2: Multi-Domain Support

1. Domain multi-select step
2. SectionProgress component (reused for Build domains and Refine skills)
3. Multi-domain Build flow

### Phase 3: Refinement

1. SkillRefiner component
2. skills.sh API integration (or mock)
3. "Use all recommended" shortcut

### Phase 4: Polish

1. Incompatibility tooltips
2. Keyboard shortcuts help
3. Animations/transitions

### Future (Deferred)

1. Search with color highlighting (needs more UX thought)

---

## Complete Flow Diagram

```

                                    ┌─────────────┐
                                    │ 1. APPROACH │
                                    └──────┬──────┘
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     │                                           │
                     ▼                                           ▼
           ┌─────────────────┐                         ┌─────────────────┐
           │ Pre-built Stack │                         │ Build from      │
           │ Template        │                         │ Scratch         │
           └────────┬────────┘                         └────────┬────────┘
                    │                                           │
                    ▼                                           ▼
           ┌─────────────────┐                         ┌─────────────────┐
           │   2. STACK      │                         │   2. DOMAIN     │
           │   (select one)  │                         │   (select 1+)   │
           └────────┬────────┘                         └────────┬────────┘
                    │                                           │
                    ▼                                           │
           ┌─────────────────┐                                  │
           │ Stack Options   │                                  │
           │                 │                                  │
           │ ● Continue with │                                  │
           │   defaults      │                                  │
           │                 │                                  │
           │ ○ Customize     │                                  │
           │   technologies  │                                  │
           └────────┬────────┘                                  │
                    │                                           │
        ┌───────────┴───────────┐                               │
        │                       │                               │
        ▼                       ▼                               │

┌─────────┐ ┌─────────────┐ │
│ Continue│ │ Customize │ │
│ defaults│ │ │ │
└────┬────┘ └──────┬──────┘ │
│ │ │
│ ▼ ▼
│ ┌─────────────────────────────────────────────┐
│ │ 3. BUILD │
│ │ │
│ │ If single domain: Grid (no sub-parts) │
│ │ If multi-domain: Grid [1/N] → [2/N]... │
│ │ │
│ │ Stack customize: Pre-populated grid │
│ │ From scratch: Empty grid │
│ └──────────────────────────┬──────────────────┘
│ │
└──────────────────────┬───────────────────┘
│
▼
┌─────────────────────────────────┐
│ 4. REFINE │
│ │
│ ╔═══════════════════════════╗ │
│ ║ Use all recommended ←DEF ║ │
│ ╚═══════════════════════════╝ │
│ │
│ ○ Customize skill sources │
│ (shows Skill: [1/8] flow) │
└───────────────────┬─────────────┘
│
▼
┌─────────────────┐
│ 5. CONFIRM │
│ │
│ Summary │
│ Install Mode │
│ [Install] │
└────────┬────────┘
│
▼
┌─────────────────┐
│ INSTALL │
└─────────────────┘

```

---

## Decisions Made

### Progress Tracking

- **Main progress**: Always show all 5 tabs, gray out unused ones
- **Section progress**: One consistent format for sub-steps:
```

┌──────────────────────────────────────────────────────────────┐
│ {Section}: {Current} [{N}/{Total}] Next: {Next} │
└──────────────────────────────────────────────────────────────┘

```

### Stack Flow

- After selecting a stack, show **Stack Options** step with two choices:
- **Continue with defaults**: Go straight to Refine (swap skill sources only)
- **Customize technologies**: Go to Build grid with stack pre-selected

### Tab Labels

- Always show same 5 tabs: Approach, Stack, Build, Refine, Confirm
- Gray out tabs that don't apply to current flow
- Stack template path: Stack tab active, Build tab grayed
- Scratch path: Build tab active, Stack tab grayed

---

## Option States & Expert Mode

### Visual Treatment Summary

```

Symbol Color State Meaning
─────────────────────────────────────────────────────────────────────────────
● ⭐ Green Recommended Selected AND recommended by other choices
○ ⭐ Green Recommended Available, suggested based on your selections
● ○ Green Selected Chosen by user
○ ○ White Normal Available, no preference
○ ⚠ Yellow Discouraged Available but not ideal for your selections
✗ Gray Disabled Cannot select (incompatible)

```

### How States are Determined (from skills-matrix)

| State | Determined by |
|-------|---------------|
| **Recommended** | Skill has `recommends` pointing to current selections |
| **Discouraged** | Skill has `discourages` pointing to current selections |
| **Disabled** | Skill has `conflictsWith` matching current selections, OR skill has `requires` not satisfied |

### Expert Mode Behavior

**Expert Mode OFF (default):**
- Recommended options (⭐) shown first in each row
- Discouraged options (⚠) shown last with warning indicator
- Indicators clearly visible to guide choices
- Goal: Help users make good choices quickly

**Expert Mode ON:**
- All options shown in original order (alphabetical or by popularity)
- Indicators still visible but don't affect ordering
- Goal: Power users who know what they want

### Required Categories

Categories marked with `*` are required:
- Must have at least one option selected to continue
- Typically: Framework, Styling (for Web domain)
- Show validation message if user tries to continue without selection

---

## Decisions Made (from discussion)

1. **Domain multi-select**: Users can freely select any combination of domains (Web, API, CLI, Mobile). No "Full-Stack" preset - users just select Web + API if they want both.

2. **Back navigation**: Preserve all selections when going back. If user goes from Build/API back to Build/Web, their Web selections remain intact.

3. **Search functionality**: Deferred for now. Needs more thought on UX.

4. **skills.sh availability**: Assume it's available. Don't design fallback behavior yet.

5. **Refine step**: Required but designed to encourage skipping:
   - Always shown in the flow
   - "Use all recommended" is the **prominent/default action** (big button at top)
   - Individual skill refinement is available but secondary
   - Goal: Most users skip this step (faster + uses verified skills)

---

## No Open Questions

All decisions have been made.
```
