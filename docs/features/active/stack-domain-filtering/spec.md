# Unified Wizard First Step — Spec

**Status:** SPEC — Ready for Review
**Date:** 2026-02-13
**Purpose:** Merge the "approach" and "stack" steps into a single unified first step. Stacks and "Start from scratch" are peers in the same list. Domain selection always follows as the second step.

---

## Current Flow (Before)

```
Step 1: Approach
  ├─ "Use a pre-built template" → Step 2a: Stack Selection → Step 3: Build (ALL domains)
  └─ "Start from scratch"       → Step 2b: Domain Selection → Step 3: Build (selected domains)
```

Two separate paths with different behavior. Stack path shows all domains; scratch path filters.

---

## New Flow (After)

```
Step 1: Choose Stack or Scratch
  ┌───────────────────────────────────┐
  │  Next.js Fullstack                │  ← stacks listed directly
  │  Modern Angular Stack             │
  │  Nuxt Full-Stack                  │
  │  Vue SPA                          │
  │  Meta Stack                       │
  │─────────────────────────────────── │  ← divider
  │  Start from scratch               │  ← always last
  └───────────────────────────────────┘

Step 2: Select Domains (same screen for both paths)
  ┌───────────────────────────────────┐
  │  Select domains to configure:     │
  │  [✓] Web                          │
  │  [✓] API                          │
  │  [ ] CLI                          │
  │  [ ] Mobile                       │
  │  [✓] Web Extras                   │
  │─────────────────────────────────── │
  │  → Continue                       │
  └───────────────────────────────────┘

Step 3: Build (only selected domains)
```

**Key insight:** Both paths converge on the same domain selection screen. The only difference is what gets pre-selected:

| Choice             | Pre-selected domains                     |
| ------------------ | ---------------------------------------- |
| Stack selected     | Domains inferred from the stack's agents |
| Start from scratch | All domains except CLI                   |

---

## Step 1: Unified Stack/Scratch Selection

**Replaces:** `step-approach.tsx` + the stack list portion of `step-stack.tsx`

The approach chooser ("Use a pre-built template" / "Start from scratch") is removed. Instead, the first screen directly lists:

1. All available stacks from `matrix.suggestedStacks[]`
2. A visual divider
3. "Start from scratch" as the last option

This is a single `<Select>` list. When the user picks an item:

- **Stack selected:** Store `selectedStackId`, call `populateFromStack()` to pre-fill skills, infer domains from stack agents, advance to step 2
- **Start from scratch:** Clear any stack state, advance to step 2 with default domain pre-selection (all except CLI)

---

## Step 2: Domain Selection (Unified)

**Reuses:** The existing `<DomainSelection>` component from the current scratch path

This screen is identical for both paths. The only difference is the initial checkbox state:

**From a stack:**

- Extract domains from stack's agent configs (see "Domain Extraction" below)
- Pre-check those domains
- Pre-check those domains

**From scratch:**

- Pre-check all domains except `cli`
- User toggles freely

The user toggles domains on/off and clicks "Continue" to proceed to the build step.

---

## Domain Extraction from Stack

Given a stack's agents, extract which domains are relevant:

```typescript
function getDomainsFromStack(stack: Stack, categories: CategoryMap): Domain[] {
  const domains = new Set<Domain>();

  for (const agentConfig of Object.values(stack.agents)) {
    for (const subcategory of Object.keys(agentConfig)) {
      const domain = categories[subcategory]?.domain;
      if (domain) domains.add(domain);
    }
  }

  return Array.from(domains).sort();
}
```

Example: `nextjs-fullstack` has `web-developer` (framework, styling) + `api-developer` (api, database) + `cli-developer` (cli-framework) → domains `["api", "cli", "web"]`.

---

## Files to Change

| File                                          | Change                                                                                                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/components/wizard/step-stack.tsx`    | Merge approach selection into this step. List stacks + divider + "Start from scratch" in a single `<Select>`. Remove the two-path conditional. |
| `src/cli/components/wizard/step-approach.tsx` | **Delete** — no longer needed, its role is absorbed into step-stack                                                                            |
| `src/cli/components/wizard/wizard.tsx`        | Remove the "approach" step from the step sequence. First step is now "stack" (which includes the scratch option).                              |
| `src/cli/stores/wizard-store.ts`              | Remove `approach` state if it exists. Add `getDomainsFromStack()` action or utility. Adjust `selectedDomains` default pre-selection logic.     |
| `src/cli/components/wizard/utils.ts`          | Add `getDomainsFromStack()` utility function                                                                                                   |

**Domain selection component (`<DomainSelection>`):** Already exists in step-stack.tsx for the scratch path. Reuse as-is — it reads `selectedDomains` from the store and renders checkboxes. Only change: accept an optional `initialDomains` prop to set what's pre-checked.

**Build step (`step-build.tsx`):** No changes needed. It already reads `selectedDomains` from the store and only renders those domains.

---

## Edge Cases

| Case                                          | Behavior                                                                                        |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Stack with one domain (e.g. mobile-only)      | Domain selection shows all domains, only that one pre-checked. User can add more if they want.  |
| Meta-stack (methodology only, no web/api/cli) | No domains pre-checked from stack. User must select at least one to continue.                   |
| Web-extras                                    | Shown in domain selection. Pre-checked if `web` is in the stack's domains, otherwise unchecked. |
| User deselects all domains                    | "Continue" button disabled. Hint: "Select at least one domain."                                 |
| Back from domain selection                    | Returns to stack/scratch list. Stack selection is cleared.                                      |

---

## Success Criteria

- Single first step listing stacks + scratch (no approach chooser)
- Domain selection always appears as step 2 regardless of path
- Stack path pre-selects inferred domains
- Scratch path pre-selects all except CLI
- Build step shows only selected domains
- No regressions in existing wizard behavior
- `<DomainSelection>` component reused, not duplicated
