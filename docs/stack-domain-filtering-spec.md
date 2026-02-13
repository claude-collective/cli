# Stack-Based Domain Filtering — Research Findings

**Status:** RESEARCH COMPLETE — Ready for Implementation
**Date:** 2026-02-13
**Purpose:** Enable users to select which domains to configure after choosing a stack, hiding irrelevant domains from the build step.

---

## Current State Analysis

### Wizard Flow (5 Steps)

1. **Approach** (`step-approach.tsx`) — Choose stack template vs scratch
2. **Stack** (`step-stack.tsx`) — Select pre-built stack (template path) OR domains (scratch path)
3. **Build** (`step-build.tsx`) — Technology selection per domain via CategoryGrid
4. **Sources** (`step-sources.tsx`) — Choose skill sources
5. **Confirm** (`step-confirm.tsx`) — Review and install (currently unreachable)

### Current Stack Selection Behavior

**Stack Path (`approach === "stack"`):**

- User selects a stack from `matrix.suggestedStacks[]`
- `selectStack()` stores `selectedStackId`
- `populateFromSkillIds()` pre-fills `domainSelections` from stack's `allSkillIds`
- ALL domains are shown in build step (line 162: `selectedDomains: ALL_DOMAINS`)

**Scratch Path (`approach === "scratch"`):**

- User manually selects domains via `<DomainSelection>` component
- Uses `@inkjs/ui` `<Select>` with checkbox-style toggle
- `toggleDomain()` modifies `selectedDomains[]` array
- User clicks "→ Continue" when at least 1 domain selected
- ONLY selected domains shown in build step

**Gap:** Stack path shows all 6 domains; scratch path filters domains. User wants **stack path to also filter domains**.

---

## Stack → Domain Relationship

### How Stacks Define Agents

From `config/stacks.yaml`, each stack has an `agents` object mapping `AgentName` to `StackAgentConfig`:

```yaml
stacks:
  - id: nextjs-fullstack
    agents:
      web-developer:
        framework: web-framework-react
        styling: web-styling-scss-modules
      api-developer:
        api: api-framework-hono
        database: api-database-drizzle
      cli-developer:
        cli-framework: cli-framework-cli-commander
      web-reviewer:
        reviewing: meta-reviewing-reviewing
      # ... 11 more agents
```

### Agent → Domain Mapping

**Explicit Mappings (from `agent-mappings.yaml`):**

| Skill Pattern | Agents                                                   |
| ------------- | -------------------------------------------------------- |
| `web/*`       | web-developer, web-reviewer, web-researcher, web-pm, ... |
| `api/*`       | api-developer, api-reviewer, api-researcher, ...         |
| `cli/*`       | cli-developer, cli-reviewer, api-developer, ...          |
| `mobile/*`    | web-developer, web-reviewer, web-researcher, ...         |

**Inference Strategy:**

Since agent names follow a `{domain}-{role}` pattern, we can infer domains:

| Agent Name       | Inferred Domain |
| ---------------- | --------------- |
| web-developer    | web             |
| web-reviewer     | web             |
| api-developer    | api             |
| api-reviewer     | api             |
| cli-developer    | cli             |
| cli-reviewer     | cli             |
| web-architecture | web             |
| web-pm           | web             |
| web-researcher   | web             |
| api-researcher   | api             |

**Edge Cases:**

- `pattern-scout` → no domain (meta)
- `documentor` → no domain (meta)
- `agent-summoner`, `skill-summoner` → no domain (meta)
- `cli-tester`, `web-tester` → maps to cli/web respectively

**Domain `shared`** is never explicitly mapped — it's for methodology skills (preselected by default).

**Domain `web-extras`** is a UI-only grouping with `parent_domain: web` — inherits from web's framework selection.

---

## Proposed UX Flow

### Stack Path Enhancement

**Current Flow:**

1. User selects stack → sees ALL domains in build step

**New Flow:**

1. User selects stack → **domain selection appears below**
2. Stack's domains auto-selected (checkbox UI)
3. User can toggle domains on/off
4. Click "Continue" → proceeds to build step with ONLY selected domains

### Visual Mockup

```
┌─────────────────────────────────────────────────┐
│ Select a pre-built template                     │
├─────────────────────────────────────────────────┤
│ > Next.js Fullstack                             │
│   Modern Angular Stack                          │
│   Nuxt Full-Stack                               │
└─────────────────────────────────────────────────┘

Stack Selected: Next.js Fullstack ✓

┌─────────────────────────────────────────────────┐
│ Select domains to configure:                    │
├─────────────────────────────────────────────────┤
│   [✓] Web - Frontend web applications          │
│   [✓] API - Backend APIs and services          │
│   [✓] CLI - Command-line tools                 │
│   [ ] Mobile - Mobile applications              │
│   [ ] Web Extras - Animation, files, realtime  │
├─────────────────────────────────────────────────┤
│ ↑/↓ navigate  SPACE toggle  ENTER continue     │
└─────────────────────────────────────────────────┘
```

---

## Data Flow Design

### 1. Extract Domains from Stack

**Function:** `getDomainsFromStack(stack: ResolvedStack, categories: CategoryMap): Domain[]`

**Logic:**

1. Iterate over `stack.skills` (agents object)
2. For each agent's subcategory selections, lookup category domain via `categories[subcat]?.domain`
3. Collect unique domains
4. Return sorted array

**Example:**

```typescript
// nextjs-fullstack stack has:
// - web-developer (framework, styling) → "web"
// - api-developer (api, database) → "api"
// - cli-developer (cli-framework) → "cli"

const domains = getDomainsFromStack(stack, categories);
// => ["web", "api", "cli"]
```

### 2. State Management

**Add to `wizard-store.ts`:**

```typescript
type WizardState = {
  // ... existing
  availableDomains: Domain[]; // domains extracted from stack

  // Actions
  setAvailableDomains: (domains: Domain[]) => void;
};
```

**When stack selected:**

```typescript
const handleStackSelect = (stackId: string) => {
  const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
  const domains = getDomainsFromStack(stack, matrix.categories);

  store.selectStack(stackId);
  store.setAvailableDomains(domains);
  store.setSelectedDomains(domains); // auto-select all by default
  store.populateFromSkillIds(stack.allSkillIds, matrix.skills, matrix.categories);
};
```

### 3. UI Component Modification

**File:** `src/cli/components/wizard/step-stack.tsx`

**Current Structure:**

- `approach === "stack"` → `<StackSelection>` (renders stack list)
- `approach === "scratch"` → `<DomainSelection>` (renders domain checkboxes)

**New Structure:**

- `approach === "stack"` → `<StackSelection>` + conditional `<DomainSelection>` below
- Show domain selection **after** stack is chosen (`selectedStackId !== null`)
- Reuse existing `<DomainSelection>` component (already has checkbox UI)

**Pseudo-code:**

```typescript
const StackSelection = ({ matrix }) => {
  const { selectedStackId, availableDomains } = useWizardStore();

  // Stack list rendering (existing code)
  if (!selectedStackId) {
    return <StackListUI />;
  }

  // Domain selection (NEW)
  return (
    <Box flexDirection="column">
      <Text color="green">Stack Selected: {stackName} ✓</Text>
      <Box marginTop={1}>
        <DomainSelection availableDomains={availableDomains} />
      </Box>
    </Box>
  );
};
```

### 4. Build Step Filtering

**File:** `src/cli/components/wizard/step-build.tsx`

**Current Logic (line 174-176):**

```typescript
const defaultDomains: Domain[] = ["web"];
const effectiveDomains = store.selectedDomains.length > 0 ? store.selectedDomains : defaultDomains;
```

**Already handles filtering!** No changes needed.

Build step iterates `selectedDomains` via Tab key (lines 287-292). Unselected domains never rendered.

---

## Implementation Plan

### Phase 1: Domain Extraction Utility

**File:** `src/cli/components/wizard/utils.ts`

**New Export:**

```typescript
export function getDomainsFromStack(stack: ResolvedStack, categories: CategoryMap): Domain[] {
  const domains = new Set<Domain>();

  for (const agentConfig of Object.values(stack.skills)) {
    for (const subcat of Object.keys(agentConfig) as Subcategory[]) {
      const domain = categories[subcat]?.domain;
      if (domain) domains.add(domain);
    }
  }

  return Array.from(domains).sort();
}
```

**Test Cases:**

- `nextjs-fullstack` → `["api", "cli", "web"]`
- `meta-stack` → `["meta"]` (methodology domain becomes "shared"?)
- Stack with only web-developer → `["web"]`

### Phase 2: Store State

**File:** `src/cli/stores/wizard-store.ts`

**Add:**

```typescript
type WizardState = {
  // ... existing
  availableDomains: Domain[];

  setAvailableDomains: (domains: Domain[]) => void;
};

// Implementation
setAvailableDomains: (domains) => set({ availableDomains: domains }),
```

**Initial State:**

```typescript
availableDomains: [] as Domain[],
```

### Phase 3: Stack Selection Logic

**File:** `src/cli/components/wizard/step-stack.tsx`

**Modify `StackSelection` component:**

**Current (lines 33-86):**

- Renders stack list
- On Enter: `selectStack()`, `populateFromSkillIds()`, `setStep("build")`

**New:**

- On Enter: `selectStack()`, `setAvailableDomains()`, **stay on stack step**
- Show domain selection UI below
- Domain selection "Continue" button → `setStep("build")`

**Implementation:**

```typescript
const StackSelection: React.FC<StackSelectionProps> = ({ matrix }) => {
  const { selectedStackId, availableDomains, setAvailableDomains, populateFromSkillIds } = useWizardStore();
  const [focusedIndex, setFocusedIndex] = useState(0);

  const handleStackSelect = (stackId: string) => {
    const stack = matrix.suggestedStacks.find(s => s.id === stackId);
    if (!stack) return;

    const domains = getDomainsFromStack(stack, matrix.categories);

    selectStack(stackId);
    setAvailableDomains(domains);
    setSelectedDomains(domains); // auto-select all
    populateFromSkillIds(stack.allSkillIds, matrix.skills, matrix.categories);
  };

  if (!selectedStackId) {
    // Render stack list (existing code)
    return <StackListUI onSelect={handleStackSelect} />;
  }

  // Render domain selection (NEW)
  const stackName = matrix.suggestedStacks.find(s => s.id === selectedStackId)?.name;
  return (
    <Box flexDirection="column">
      <Text color="green">Stack Selected: {stackName} ✓</Text>
      <Box marginTop={1}>
        <DomainSelection
          availableDomains={availableDomains}
          onContinue={() => setStep("build")}
        />
      </Box>
    </Box>
  );
};
```

### Phase 4: Domain Selection Component Refactor

**File:** `src/cli/components/wizard/step-stack.tsx`

**Current `<DomainSelection>`:**

- Uses ALL_DOMAINS constant (lines 13-23)
- Hardcoded domain list
- Shows all 5 domains

**New `<DomainSelection>` (generic, reusable):**

- Accept `availableDomains?: Domain[]` prop
- Default to ALL_DOMAINS if not provided (scratch path)
- Filter displayed options by `availableDomains`

**Implementation:**

```typescript
type DomainSelectionProps = {
  availableDomains?: Domain[];
  onContinue?: () => void;
};

const DomainSelection: React.FC<DomainSelectionProps> = ({
  availableDomains = ALL_DOMAINS,
  onContinue,
}) => {
  const { selectedDomains, toggleDomain, setStep, goBack } = useWizardStore();

  const visibleDomains = AVAILABLE_DOMAINS.filter((d) => availableDomains.includes(d.id));

  // ... rest of implementation (checkbox UI)

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      setStep("build");
    }
  };
};
```

### Phase 5: Testing

**Test Files:**

- `step-stack.test.tsx` (component test)
- `wizard-store.test.ts` (store test)
- `utils.test.ts` (domain extraction test)

**Test Cases:**

1. **Domain Extraction:**
   - Stack with web + api → returns `["api", "web"]`
   - Stack with only cli → returns `["cli"]`
   - Stack with no domains (meta-only) → returns `[]`

2. **Stack Selection Flow:**
   - Select stack → domain selection appears
   - Domains auto-selected from stack
   - User can toggle domains off
   - Continue button disabled if no domains selected
   - Back button returns to stack list

3. **Build Step Integration:**
   - Only selected domains appear in build step
   - Tab navigation cycles selected domains only
   - Unselected domains skipped entirely

---

## Edge Cases

### 1. Stack with Only One Domain

**Example:** React Native stack (only `mobile` domain)

**Behavior:**

- Domain selection shows 1 checkbox pre-selected
- User can uncheck (validation prevents continue with 0 domains)
- Or auto-skip domain selection if only 1 domain?

**Decision:** Show domain selection even for 1 domain (consistency).

### 2. Stack with No Domains (Meta Stack)

**Example:** `meta-stack` has only methodology skills → no `web/api/cli` domains

**Behavior:**

- `getDomainsFromStack()` returns `[]`
- Domain selection shows "No domains available"
- Auto-proceed to build step?

**Decision:** Meta skills use `shared` domain. Extract `shared` if methodology subcategory found.

### 3. Web-Extras Domain Inheritance

**Current:** `web-extras` has `parent_domain: web` and inherits framework filtering.

**Question:** Should web-extras appear in domain selection?

**Answer:** YES. If stack has web-developer with styling/framework, offer web-extras as optional add-on.

**Implementation:** Include `web-extras` in available domains if `web` is available.

```typescript
const domains = getDomainsFromStack(stack, categories);
if (domains.includes("web")) {
  domains.push("web-extras");
}
```

### 4. User Deselects All Domains

**Validation:** Continue button disabled unless `selectedDomains.length > 0`

**UI Feedback:**

```tsx
{
  selectedDomains.length === 0 && <Text color="yellow">Please select at least one domain</Text>;
}
```

### 5. Scratch Path Unchanged

**Requirement:** Scratch path behavior stays exactly the same.

**Implementation:** `<DomainSelection>` with `availableDomains={ALL_DOMAINS}` (default).

---

## Alternative Approaches Considered

### Option A: Auto-Filter Without UI

**Approach:** After stack selection, immediately filter domains and skip domain selection step.

**Pros:**

- Simpler UX (one less interaction)
- Faster wizard completion

**Cons:**

- User can't customize domains (e.g., skip CLI if not needed)
- Less control

**Verdict:** REJECTED. User wants control over domains.

### Option B: Domain Selection as Separate Step

**Approach:** Add a new step between "stack" and "build" for domain selection.

**Pros:**

- Clear separation of concerns
- Easier to test

**Cons:**

- More steps in wizard
- Breaks flow (stack → domains → build feels slower)

**Verdict:** REJECTED. Inline domain selection after stack is more fluid.

### Option C: Agent-Based Filtering (No Domain Concept)

**Approach:** Let user select agents, infer domains from agents.

**Pros:**

- More granular control

**Cons:**

- Complex UX (18+ agent checkboxes)
- Misaligned with existing wizard structure

**Verdict:** REJECTED. Domain abstraction already works well.

---

## Estimated Scope

### Complexity: **MEDIUM**

**Why Medium:**

- New utility function (simple)
- Store state addition (trivial)
- Component refactor (moderate — reuse existing DomainSelection)
- UI state management (conditional rendering)
- Edge case handling (5-6 cases)

### Files Modified: **3-4 files**

1. `src/cli/components/wizard/utils.ts` — NEW `getDomainsFromStack()`
2. `src/cli/stores/wizard-store.ts` — ADD `availableDomains` state
3. `src/cli/components/wizard/step-stack.tsx` — REFACTOR `StackSelection` + `DomainSelection`
4. (Optional) Test files for coverage

### Lines Changed: **~120-150 lines**

- Utils: +20 lines
- Store: +5 lines
- Component: +80 lines (refactor + new logic)
- Tests: +40 lines

### Time Estimate: **4-6 hours**

- Implementation: 2-3 hours
- Testing: 1-2 hours
- Edge case handling: 1 hour

---

## Implementation Checklist

### Phase 1: Foundation

- [ ] Add `getDomainsFromStack()` to `utils.ts`
- [ ] Add tests for domain extraction
- [ ] Add `availableDomains` to wizard store
- [ ] Add `setAvailableDomains()` action

### Phase 2: UI Components

- [ ] Refactor `<DomainSelection>` to accept `availableDomains` prop
- [ ] Modify `<StackSelection>` to show domains after stack select
- [ ] Add stack confirmation message ("Stack Selected: X ✓")
- [ ] Wire up continue flow (domain selection → build step)

### Phase 3: Edge Cases

- [ ] Handle web-extras inclusion when web domain present
- [ ] Validate at least 1 domain selected
- [ ] Handle meta-stack (no domains → shared domain)
- [ ] Add back button to return to stack list

### Phase 4: Testing

- [ ] Unit tests for `getDomainsFromStack()`
- [ ] Component tests for `<StackSelection>` with domain selection
- [ ] Store tests for `availableDomains` state
- [ ] Integration test: stack select → domain filter → build step

### Phase 5: Polish

- [ ] Keyboard navigation (arrows, space, enter)
- [ ] Visual feedback for selected/deselected domains
- [ ] Help text ("↑/↓ navigate SPACE toggle ENTER continue")
- [ ] Ensure scratch path still works (no regressions)

---

## Open Questions for User

1. **Auto-include web-extras?**
   When stack has `web` domain, should `web-extras` automatically appear as an option (pre-selected or not)?

   **Recommendation:** Show as option, NOT pre-selected (user opts in).

2. **Single-domain stacks:**
   If stack has only 1 domain, should domain selection step be skipped?

   **Recommendation:** Still show for consistency (user can confirm/proceed quickly).

3. **Meta-stack domains:**
   `meta-stack` has no web/api/cli skills. Should it use `shared` domain or skip build step?

   **Recommendation:** Map methodology skills to `shared` domain and show in build step.

---

## Success Criteria

✅ **User can select domains after choosing a stack**
✅ **Stack path and scratch path both filter domains correctly**
✅ **Build step shows ONLY selected domains**
✅ **No regressions in scratch path flow**
✅ **Edge cases handled (1 domain, no domains, web-extras)**
✅ **Keyboard navigation works (arrows, space, enter, escape)**
✅ **Visual feedback clear (checkboxes, focused state)**

---

## Next Steps

1. **Review this spec** with user/stakeholder
2. **Confirm design decisions** (edge cases, auto-inclusion rules)
3. **Implement Phase 1-2** (foundation + basic UI)
4. **Test with real stacks** (nextjs-fullstack, meta-stack, etc.)
5. **Polish & finalize** (Phase 3-5)

---

## References

- [Multi-Source UX 2.0 Spec](./ux-2.0-multi-source-implementation.md)
- [Architecture Doc](./architecture.md)
- [Type Conventions](../.claude/projects/-home-vince-dev-cli/memory/type-conventions.md)
