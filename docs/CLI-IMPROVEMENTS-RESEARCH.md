# CLI Improvements Research

> This document tracks planned UX/UI improvements to the CLI wizard and compiles research findings from subagents.

---

## 1. Progress Navigation Bar

### Current State
- Uses circles to indicate step progress
- Steps: Approach, Stack, Build, Refine, Confirm

### Desired State
```
─────────────────────────────────────────────────────────────────────────
 [1] Approach  [2] Stack  [3] Build  [4] Refine  [5] Confirm
─────────────────────────────────────────────────────────────────────────
```

**Styling Rules:**
- **Active step**: Green background around `[N] Name` with 1-char padding on each side
- **Completed steps**: White background, dark text
- **Pending steps**: Default text, no background

### Implementation Notes
_Awaiting research findings..._

---

## 2. Header Improvements

### Current Issues
- Version not displayed in header
- Skill count shows 169 (no deduplication between marketplace and local skills)

### Desired State
- Show CLI version in header
- Deduplicate skill count (unique skills only)

### Implementation Notes

#### Current Header Structure

The wizard does NOT have a dedicated header component. The layout is in:
- **File:** `/home/vince/dev/cli/src/cli/components/wizard/wizard.tsx:357-372`

```tsx
return (
  <ThemeProvider theme={cliTheme}>
    <Box flexDirection="column" padding={1}>
      <WizardTabs
        steps={WIZARD_STEPS}
        currentStep={store.step}
        completedSteps={completedSteps}
        skippedSteps={skippedSteps}
      />
      {renderStep()}
      <Box marginTop={1}>
        <Text dimColor>ESC to go back, Ctrl+C to cancel</Text>
      </Box>
    </Box>
  </ThemeProvider>
);
```

The `WizardTabs` component (`/home/vince/dev/cli/src/cli/components/wizard/wizard-tabs.tsx`) serves as the visual header showing step progress.

#### How to Access CLI Version

**Pattern:** oclif commands can access version via `this.config.version`

**Source:** The version comes from `package.json:3`:
```json
"version": "0.12.0"
```

**Problem:** The `Wizard` React component doesn't have access to oclif's `this.config`. Need to pass version as a prop from the command.

**Solution:** Modify the `Init` command (`/home/vince/dev/cli/src/cli/commands/init.tsx`) to pass version to Wizard:

```tsx
// In Init command, line ~119
<Wizard
  matrix={sourceResult.matrix}
  version={this.config.version}  // Add this
  onComplete={...}
  onCancel={...}
/>
```

Then update `WizardProps` interface and pass to a new header component.

#### Skill Count: Understanding the Duplication Issue

**Where skill count is displayed:**
- **File:** `/home/vince/dev/cli/src/cli/commands/init.tsx:106`
```tsx
this.log(
  `Loaded ${Object.keys(sourceResult.matrix.skills).length} skills (${sourceInfo})\n`,
);
```

**Why 169 might show duplicates:**
The `MergedSkillsMatrix.skills` dictionary is keyed by **full skill ID** (e.g., `web-framework-react`). Local skills are added with their own IDs in:
- **File:** `/home/vince/dev/cli/src/cli/lib/source-loader.ts:263-294`

```tsx
matrix.skills[metadata.id] = resolvedSkill;
```

**Deduplication is NOT the issue** - the dictionary uses unique IDs as keys. The 169 count is the actual unique skill count.

**To verify:** Check if local skills have the same ID as marketplace skills:
```tsx
// In source-loader.ts:263
for (const metadata of localResult.skills) {
  // If metadata.id matches an existing skill ID, it would overwrite
  matrix.skills[metadata.id] = resolvedSkill;
}
```

**The 169 count is likely correct** - marketplace + local skills. To show meaningful counts:
1. Count marketplace skills: `Object.values(matrix.skills).filter(s => !s.local).length`
2. Count local skills: `Object.values(matrix.skills).filter(s => s.local).length`

**Files to modify:**
| File | Change |
|------|--------|
| `/home/vince/dev/cli/src/cli/components/wizard/wizard.tsx` | Add `version` prop, create header component |
| `/home/vince/dev/cli/src/cli/commands/init.tsx` | Pass `this.config.version` to Wizard |

---

## 3. Footer Navigation Hints

### Current State
- Navigation hints (up/down arrows, escape to cancel) shown inline

### Desired State
- Navigation hints in footer
- Left side: navigation controls (arrows)
- Right side: cancel/escape hint

### Implementation Notes

#### Current Footer Pattern

Navigation hints are rendered inline in each step component AND in the main wizard:

**Main wizard footer** - `/home/vince/dev/cli/src/cli/components/wizard/wizard.tsx:367-369`:
```tsx
<Box marginTop={1}>
  <Text dimColor>ESC to go back, Ctrl+C to cancel</Text>
</Box>
```

**Step-specific footers** - Each step has its own navigation hints:

1. **step-approach.tsx:87-91**:
```tsx
<Box marginTop={1}>
  <Text dimColor>↑/↓ navigate ENTER select ESC cancel</Text>
</Box>
```

2. **step-build.tsx:281-284** (Footer component):
```tsx
<Text dimColor>
  ←/→ options ↑/↓ categories SPACE select TAB descriptions E expert ENTER continue ESC back
</Text>
```

3. **step-refine.tsx:108-110**:
```tsx
<Text dimColor>↑/↓ navigate ENTER continue ESC back</Text>
```

4. **step-confirm.tsx:115**:
```tsx
<Text dimColor>ENTER confirm ESC back</Text>
```

#### How to Create Split Footer in Ink

**Pattern from codebase** - `/home/vince/dev/cli/src/cli/components/wizard/section-progress.tsx:27-44`:

```tsx
<Box
  flexDirection="row"
  justifyContent="space-between"  // Key: splits left and right
  paddingX={2}
  marginBottom={1}
>
  <Text>Left content</Text>
  <Text>Right content</Text>
</Box>
```

**Also used in step-build.tsx:246**:
```tsx
<Box justifyContent="space-between" marginBottom={1}>
```

#### Proposed Footer Component

Create a shared `WizardFooter` component:

```tsx
// /home/vince/dev/cli/src/cli/components/wizard/wizard-footer.tsx
interface WizardFooterProps {
  navigation: string;  // e.g., "↑/↓ navigate"
  action: string;      // e.g., "ESC cancel"
}

export const WizardFooter: React.FC<WizardFooterProps> = ({ navigation, action }) => {
  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      marginTop={1}
    >
      <Text dimColor>{navigation}</Text>
      <Text dimColor>{action}</Text>
    </Box>
  );
};
```

#### Files to Modify

| File | Current Footer | Proposed Change |
|------|----------------|-----------------|
| `/home/vince/dev/cli/src/cli/components/wizard/wizard.tsx` | Generic ESC/Ctrl+C hint | Remove (steps handle their own) |
| `/home/vince/dev/cli/src/cli/components/wizard/step-approach.tsx` | Line 87-91 | Use `<WizardFooter navigation="↑/↓ navigate  ENTER select" action="ESC cancel" />` |
| `/home/vince/dev/cli/src/cli/components/wizard/step-build.tsx` | Line 281-284 | Use `<WizardFooter navigation="←/→ ↑/↓ SPACE TAB E ENTER" action="ESC back" />` |
| `/home/vince/dev/cli/src/cli/components/wizard/step-refine.tsx` | Line 108-110 | Use `<WizardFooter navigation="↑/↓ navigate  ENTER continue" action="ESC back" />` |
| `/home/vince/dev/cli/src/cli/components/wizard/step-confirm.tsx` | Line 115 | Use `<WizardFooter navigation="ENTER confirm" action="ESC back" />` |

**Create new file:**
- `/home/vince/dev/cli/src/cli/components/wizard/wizard-footer.tsx`

---

## 4. Build Step - Skill Selection UI

### Current Issues
- Strikethrough on disabled items
- Circles before each option
- All skills shown at once (overwhelming)

### Desired State
- **No strikethrough** on disabled - just disabled color
- **No circles** - text only with background color on selection
- Active skills get active color background
- Hover/arrow-over gets background highlight

### Framework-First Flow (Clarified Requirements)

**Scope:** Web domain only (for now)

**Two-Tier Visibility System:**

| Tier | Trigger | Effect | Based On |
|------|---------|--------|----------|
| 1 | No framework selected | HIDE all non-framework skills | - |
| 2 | Framework selected | SHOW skills with `compatible_with` containing the framework | `metadata.yaml:compatible_with` |
| 3 | Additional skill selected | DISABLE conflicting skills (keep visible, grayed) | `metadata.yaml:conflicts_with` |

**Flow:**
1. **Initial state:** Only show "framework" subcategory options (React, Vue, Angular, etc.)
2. **After framework selection (e.g., React):** Show all skills where `compatible_with` includes "react" (or the selected framework ID)
3. **After selecting additional skills (e.g., Zustand):** Skills with `conflicts_with: ["zustand"]` become DISABLED but stay visible
4. **Order remains FIXED** - no reordering on any selection

**Key distinction:**
- Framework compatibility → HIDE (skill not shown at all)
- Skill conflicts → DISABLE (skill shown but grayed out, not selectable)

### Visual Styling (No Circles, No Strikethrough)

| State | Visual |
|-------|--------|
| Normal | Plain text |
| Focused (arrow hover) | Background highlight (gray) |
| Selected | Active color background (green) |
| Disabled | Dimmed text color (gray), NO strikethrough |
| Recommended | Star icon ⭐ |
| Discouraged | Warning icon ⚠ |

### Implementation Notes

**Metadata fields used:**
- `compatible_with: string[]` - List of framework IDs this skill works with
- `conflicts_with: string[]` - List of skill IDs that conflict with this skill

**Files to modify:**
- `src/cli/components/wizard/step-build.tsx` - Framework-first filtering logic
- `src/cli/components/wizard/category-grid.tsx` - Option styling (remove circles, strikethrough)
- `src/cli/lib/matrix-resolver.ts` - May need to expose compatibility checking

---

## 5. Third-Party Skills Integration

### Goal
Enable learning/importing third-party skills in the Refine step.

### Questions to Research
- How to discover third-party skill sources?
- How to validate/trust third-party skills?
- UI for browsing/searching third-party skills
- Integration with existing skill compilation pipeline

### Implementation Notes
_Awaiting research findings..._

---

## Research Findings

### A. Ink Terminal UI Patterns

**Layout patterns found in codebase:**

| Pattern | Usage | File:Line |
|---------|-------|-----------|
| `justifyContent="space-between"` | Split left/right content | `/home/vince/dev/cli/src/cli/components/wizard/section-progress.tsx:30` |
| `justifyContent="space-around"` | Even spacing for tabs | `/home/vince/dev/cli/src/cli/components/wizard/wizard-tabs.tsx:102` |
| `flexDirection="column"` | Vertical stacking | Most components |
| `flexDirection="row"` | Horizontal layout | `/home/vince/dev/cli/src/cli/components/wizard/category-grid.tsx:350` |

**Text styling patterns:**

| Style | Usage | Example |
|-------|-------|---------|
| `dimColor` | De-emphasized text | Navigation hints, secondary info |
| `bold` | Emphasis | Current step, selected items |
| `color="cyan"` | Current/active | Domain names, current selections |
| `color="green"` | Success/selected | Completed steps, checkmarks |
| `color="gray"` | Disabled | Skipped steps, disabled options |

### B. Framework-First Selection UX

**Implementation approach (clarified by user):**

#### 1. Detecting Framework Selection

```typescript
// In step-build.tsx
const frameworkSubcategoryId = "framework"; // Web domain's framework subcategory

function isFrameworkSelected(selections: Record<string, string[]>): boolean {
  return (selections[frameworkSubcategoryId]?.length ?? 0) > 0;
}

function getSelectedFramework(selections: Record<string, string[]>): string | null {
  return selections[frameworkSubcategoryId]?.[0] ?? null;
}
```

#### 2. Filtering Skills by Framework Compatibility

```typescript
// Filter skills to only show those compatible with selected framework
function filterByFrameworkCompatibility(
  skills: ResolvedSkill[],
  selectedFramework: string | null
): ResolvedSkill[] {
  if (!selectedFramework) return skills;

  return skills.filter(skill => {
    // Framework skills themselves are always shown
    if (skill.category === "framework") return true;

    // Check compatible_with field in metadata
    const compatibleWith = skill.metadata?.compatible_with ?? [];
    return compatibleWith.includes(selectedFramework);
  });
}
```

#### 3. Disabling Conflicting Skills

```typescript
// Disable skills that conflict with any selected skill
function getDisabledByConflicts(
  skills: ResolvedSkill[],
  selectedSkillIds: string[]
): Set<string> {
  const disabled = new Set<string>();

  for (const skill of skills) {
    const conflictsWith = skill.metadata?.conflicts_with ?? [];
    // If this skill conflicts with any selected skill, disable it
    if (conflictsWith.some(id => selectedSkillIds.includes(id))) {
      disabled.add(skill.id);
    }
    // Also check reverse: if any selected skill conflicts with this one
    for (const selectedId of selectedSkillIds) {
      const selectedSkill = skills.find(s => s.id === selectedId);
      if (selectedSkill?.metadata?.conflicts_with?.includes(skill.id)) {
        disabled.add(skill.id);
      }
    }
  }

  return disabled;
}
```

#### 4. Category Row Visibility

```typescript
// In buildCategoriesForDomain() or equivalent
function shouldShowSubcategory(
  subcategoryId: string,
  frameworkSelected: boolean
): boolean {
  // Always show framework subcategory
  if (subcategoryId === "framework") return true;

  // Hide all other subcategories until framework is selected
  return frameworkSelected;
}
```

#### 5. Option Cell Styling Changes

**Remove from category-grid.tsx:**
- Circle symbols (●/○/✗)
- `strikethrough` prop on disabled items

**Add:**
- `backgroundColor` based on state (focused, selected)
- Keep `dimColor` for disabled state

### C. Third-Party Skill Architecture
_Subagent research pending..._

---

## Files to Modify

Based on research, these files need changes:

### Header/Footer Layout
- `/home/vince/dev/cli/src/cli/components/wizard/wizard.tsx` - Add version prop, remove global footer
- `/home/vince/dev/cli/src/cli/commands/init.tsx` - Pass CLI version to wizard
- `/home/vince/dev/cli/src/cli/components/wizard/wizard-footer.tsx` - **NEW FILE** - Shared footer component

### Step-Specific Updates
- `/home/vince/dev/cli/src/cli/components/wizard/step-approach.tsx` - Use WizardFooter
- `/home/vince/dev/cli/src/cli/components/wizard/step-build.tsx` - Use WizardFooter
- `/home/vince/dev/cli/src/cli/components/wizard/step-refine.tsx` - Use WizardFooter
- `/home/vince/dev/cli/src/cli/components/wizard/step-confirm.tsx` - Use WizardFooter

### Skill Selection UI (Section 4)
- `/home/vince/dev/cli/src/cli/components/wizard/category-grid.tsx` - Option styling changes

---

## Quick Reference: Key Code Locations

| Concept | File | Lines |
|---------|------|-------|
| Wizard main layout | `/home/vince/dev/cli/src/cli/components/wizard/wizard.tsx` | 357-372 |
| WizardTabs (header) | `/home/vince/dev/cli/src/cli/components/wizard/wizard-tabs.tsx` | 95-127 |
| Skill count display | `/home/vince/dev/cli/src/cli/commands/init.tsx` | 106 |
| Skills matrix type | `/home/vince/dev/cli/src/cli/types-matrix.ts` | 300-330 |
| Local skill merge | `/home/vince/dev/cli/src/cli/lib/source-loader.ts` | 252-298 |
| Split layout example | `/home/vince/dev/cli/src/cli/components/wizard/section-progress.tsx` | 27-44 |
| Step-build footer | `/home/vince/dev/cli/src/cli/components/wizard/step-build.tsx` | 267-287 |
| CLI version source | `/home/vince/dev/cli/package.json` | 3 |
