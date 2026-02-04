## Example Documentation Sessions

### Example 1: Initial Session (No Map Exists)

**User Request:** "Document the codebase for other agents"

**Action:**

1. Use Glob to find major areas (features, stores, components)
2. Create initial DOCUMENTATION_MAP.md with all areas marked "not started"
3. Recommend starting with most critical area
4. Update map with initial structure

---

### Example 2: Documenting Stores

**User Request:** "Document the state management"

**Action:**

1. Glob to find all stores: `**/*Store.ts`
2. Read each store file completely
3. Identify patterns (MobX? Redux? Context?)
4. Map relationships between stores
5. Create `store-map.md` using template
6. Update `DOCUMENTATION_MAP.md` marking stores as complete

---

### Example 3: Validating Documentation

**User Request:** "Validate the component patterns documentation"

**Action:**

1. Read `component-patterns.md`
2. Extract all file path claims
3. Verify each path exists
4. Use Glob/Grep to verify pattern claims
5. Check for new patterns since doc was created
6. Update doc with findings and report drift

---

## Example Output: Store/State Map

```markdown
# Store/State Map

**Last Updated:** 2025-01-24

## State Management Library

**Library:** MobX
**Pattern:** Root store with individual stores

## Stores

| Store       | File Path                    | Purpose        | Key Actions               |
| ----------- | ---------------------------- | -------------- | ------------------------- |
| EditorStore | `/src/stores/EditorStore.ts` | Editor state   | `addLayer()`, `undo()`    |
| UserStore   | `/src/stores/UserStore.ts`   | User session   | `login()`, `logout()`     |

## Store Relationships

- RootStore: `/src/stores/RootStore.ts` - Initializes all stores
- EditorStore imports LayerStore for layer management

## Usage Pattern

```typescript
import { useStore } from "@/contexts/StoreContext";
const { editorStore } = useStore();
```

**Example files:** `/src/components/Editor/EditorCanvas.tsx:15`
```

---

## Example Output: Anti-Patterns

```markdown
# Anti-Patterns

**Last Updated:** 2025-01-24

## State Management

### Direct Store Mutation

**What:** Mutating store state directly without actions

**Where:** `/src/legacy/OldEditor.tsx:123`

**Why wrong:** Breaks MobX reactivity, no undo support

**Do instead:**
```typescript
editorStore.addLayer(newLayer)  // Use store actions
```

**Correct pattern:** `/src/components/Editor/EditorCanvas.tsx`
```

---

## Example Output: Feature Map

```markdown
# Feature: Editor

**Last Updated:** 2025-01-24

## Overview

**Purpose:** Image editing with layers, tools, and export
**Route:** `/editor/:imageId`
**Main Component:** `/src/features/editor/EditorPage.tsx`

## File Structure

```
src/features/editor/
├── components/
│   ├── EditorCanvas.tsx    # Main canvas
│   └── Toolbar.tsx         # Tool selection
├── hooks/
│   └── useEditorState.ts   # State management
└── stores/
    └── EditorStore.ts      # MobX store
```

## Key Files

| File               | Lines | Purpose          |
| ------------------ | ----- | ---------------- |
| `EditorPage.tsx`   | 234   | Main page        |
| `EditorCanvas.tsx` | 456   | Rendering engine |
| `EditorStore.ts`   | 189   | State management |
```
