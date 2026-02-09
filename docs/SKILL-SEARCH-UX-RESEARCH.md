# Skill Search & Discovery UX Research

**Research Date:** 2025-02-04
**Research Type:** UX Pattern Discovery
**Confidence:** High

---

## Executive Summary

This document researches UX patterns for skill search and discovery in the Claude Collective CLI. With 150+ skills in the marketplace and third-party import capabilities, users need an effective way to discover and select skills.

**Key Recommendations:**

1. Dual-mode search: static results for scripting, interactive for discovery
2. Searchable fields: name, alias, description, tags, category
3. Grouped results by category with compatibility indicators
4. Fuzzy matching for typo tolerance

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [CLI Search UX Patterns](#2-cli-search-ux-patterns)
3. [Recommended Search Architecture](#3-recommended-search-architecture)
4. [Command Interface Design](#4-command-interface-design)
5. [Output Format Specifications](#5-output-format-specifications)
6. [Interactive Mode Design](#6-interactive-mode-design)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Current State Analysis

### 1.1 Existing Search Command

**Location:** `/home/vince/dev/cli/src/cli/commands/search.ts`

```typescript
// Current search implementation (lines 22-47)
function matchesQuery(skill: ResolvedSkill, query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Match against name
  if (skill.name.toLowerCase().includes(lowerQuery)) return true;
  // Match against ID
  if (skill.id.toLowerCase().includes(lowerQuery)) return true;
  // Match against alias
  if (skill.alias?.toLowerCase().includes(lowerQuery)) return true;
  // Match against description
  if (skill.description.toLowerCase().includes(lowerQuery)) return true;
  // Match against category
  if (skill.category.toLowerCase().includes(lowerQuery)) return true;
  // Match against tags
  if (skill.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))) {
    return true;
  }
  return false;
}
```

**Current Features:**

- Case-insensitive substring matching
- Searches: name, id, alias, description, category, tags
- Category filter via `--category` flag
- Table output via `@oclif/table`

**Current Limitations:**

- No fuzzy matching (typos not tolerated)
- No interactive mode
- No relevance ranking
- No rich display (compatibility, author, etc.)
- No JSON output for scripting

### 1.2 Existing Skill Data Model

**Location:** `/home/vince/dev/cli/src/cli/types-matrix.ts:332-412`

```typescript
interface ResolvedSkill {
  id: string; // Full ID: "web-state-zustand"
  alias?: string; // Short name: "zustand"
  name: string; // Display: "Zustand"
  description: string;
  category: string; // Category ID
  tags: string[];
  author: string;
  conflictsWith: SkillRelation[];
  recommends: SkillRelation[];
  requires: SkillRequirement[];
  compatibleWith: string[]; // Framework compatibility
  // ... more fields
}
```

### 1.3 Existing Interactive Components

**Location:** `/home/vince/dev/cli/src/cli/components/wizard/`

The CLI already has Ink-based interactive components:

- `CategoryGrid` - 2D keyboard navigation grid
- `WizardTabs` - Step-based navigation
- Keyboard support: arrows, vim keys (h/j/k/l), space, enter

**Dependencies available:**

- `ink` v5.0.0 - Terminal UI framework
- `@inkjs/ui` v2.0.0 - UI component library
- `@oclif/table` v0.5.0 - Table formatting

---

## 2. CLI Search UX Patterns

### 2.1 Pattern Analysis: Popular CLI Tools

#### GitHub CLI (`gh extension search`)

```bash
$ gh extension search react

NAME                    DESCRIPTION                          STARS
owner/gh-react          React components for GH CLI          1234
other/react-helper      Helper utilities                     567
```

**Strengths:**

- Clean table output
- Star count as quality signal
- Pagination support

**Weaknesses:**

- No interactive mode
- No filtering in results

#### npm search (`npm search`)

```bash
$ npm search zustand

NAME      DESCRIPTION                    AUTHOR      DATE        VERSION
zustand   Bear necessities for state     pmndrs      2024-01-15  4.5.0
```

**Strengths:**

- Shows metadata (author, date, version)
- Relevance-ranked results

**Weaknesses:**

- Slow (API-based)
- No interactive mode

#### Homebrew (`brew search`)

```bash
$ brew search node

==> Formulae
node          node@18       node@20       nodejs

==> Casks
node-red      nodebox
```

**Strengths:**

- Grouped results by type
- Fast local search

**Weaknesses:**

- No descriptions inline
- No interactive selection

#### fzf (Fuzzy Finder)

```bash
$ cc list | fzf --preview 'cc info {}'
```

**Strengths:**

- Real-time fuzzy filtering
- Preview pane
- Vim-style navigation
- Highly composable

**Pattern:** Best for discovery workflows where user doesn't know exact name

### 2.2 Key UX Principles

| Principle                  | Description                     | Implementation            |
| -------------------------- | ------------------------------- | ------------------------- |
| **Fast feedback**          | Results should appear instantly | Local search, no network  |
| **Typo tolerance**         | Minor errors shouldn't block    | Fuzzy matching            |
| **Context visibility**     | Show why a result matched       | Highlight match location  |
| **Progressive disclosure** | Basic → detailed info           | Table → detail view       |
| **Composability**          | Work with pipes/scripts         | JSON output, clean stdout |

---

## 3. Recommended Search Architecture

### 3.1 Dual-Mode Design

```
cc search <query>
├── Query provided → Static mode (scripting-friendly)
└── No query → Interactive mode (discovery-friendly)

cc search react         → Static table output
cc search               → Interactive fuzzy finder
cc search -i react      → Interactive with pre-filled query
```

### 3.2 Searchable Fields Priority

| Priority | Field         | Weight | Rationale                  |
| -------- | ------------- | ------ | -------------------------- |
| 1        | `alias`       | 3x     | Most common user input     |
| 2        | `name`        | 2x     | Human-readable identifier  |
| 3        | `tags`        | 2x     | Curated search terms       |
| 4        | `category`    | 1.5x   | Structural grouping        |
| 5        | `description` | 1x     | Full-text fallback         |
| 6        | `id`          | 0.5x   | Technical, rarely searched |

### 3.3 Fuzzy Matching Algorithm

Recommended: **Levenshtein distance with prefix boost**

```typescript
// Pseudo-code for scoring
function scoreMatch(query: string, target: string): number {
  const exactMatch = target.toLowerCase() === query.toLowerCase();
  if (exactMatch) return 100;

  const prefixMatch = target.toLowerCase().startsWith(query.toLowerCase());
  if (prefixMatch) return 80;

  const containsMatch = target.toLowerCase().includes(query.toLowerCase());
  if (containsMatch) return 60;

  const fuzzyDistance = levenshtein(query, target);
  const fuzzyScore = Math.max(0, 40 - fuzzyDistance * 5);

  return fuzzyScore;
}
```

**Libraries to consider:**

- `fuse.js` - Lightweight fuzzy search
- `match-sorter` - Sorting by match quality
- Native implementation (no deps, simpler)

---

## 4. Command Interface Design

### 4.1 Static Mode (Default with Query)

```bash
# Basic search
cc search react

# Category filter
cc search react --category frontend
cc search react -c frontend

# Output formats
cc search react --json
cc search react --format wide

# Pagination
cc search state --limit 10
cc search state --offset 10

# Compatibility filter
cc search --compatible-with react
cc search --compatible-with zustand,react-query
```

### 4.2 Interactive Mode

```bash
# Interactive fuzzy finder
cc search
cc search -i
cc search --interactive

# Interactive with pre-filled query
cc search -i react
cc search --interactive react

# Interactive with category pre-filter
cc search -i --category backend
```

### 4.3 Proposed Flag Structure

```typescript
static flags = {
  // Mode control
  interactive: Flags.boolean({
    char: 'i',
    description: 'Launch interactive fuzzy finder',
    default: false,
  }),

  // Filtering
  category: Flags.string({
    char: 'c',
    description: 'Filter by category (frontend, backend, cli, etc.)',
  }),
  'compatible-with': Flags.string({
    description: 'Filter to skills compatible with given skill(s)',
    multiple: true,
  }),
  local: Flags.boolean({
    description: 'Show only locally installed skills',
    default: false,
  }),

  // Output control
  json: Flags.boolean({
    description: 'Output results as JSON',
    default: false,
  }),
  format: Flags.string({
    options: ['table', 'wide', 'list'],
    default: 'table',
    description: 'Output format',
  }),
  limit: Flags.integer({
    char: 'n',
    description: 'Maximum results to show',
    default: 20,
  }),

  // Sorting
  sort: Flags.string({
    options: ['relevance', 'name', 'category'],
    default: 'relevance',
    description: 'Sort order for results',
  }),
};
```

---

## 5. Output Format Specifications

### 5.1 Table Format (Default)

```
$ cc search zustand

Found 3 skills matching "zustand"

ID                  CATEGORY     TAGS                    DESCRIPTION
zustand             client-state react, state, hooks     Bear necessities for state...
redux-toolkit       client-state react, state, redux     Official Redux toolkit...
jotai               client-state react, state, atomic    Primitive and flexible state

Tip: Use -c <category> to filter, --format wide for more details
```

### 5.2 Wide Format

```
$ cc search zustand --format wide

Found 3 skills matching "zustand"

ID              CATEGORY      AUTHOR    COMPAT         TAGS                     DESCRIPTION
zustand         client-state  @vince    react, react-  react, state, hooks,     Bear necessities for
                                        native         minimal, lightweight     state management...
redux-toolkit   client-state  @vince    react, react-  react, state, redux,     Official Redux toolkit
                                        native         thunk, devtools          with best practices...

Legend: COMPAT = compatible frameworks
```

### 5.3 JSON Format

```json
{
  "query": "zustand",
  "total": 3,
  "results": [
    {
      "id": "web-state-zustand",
      "alias": "zustand",
      "name": "Zustand",
      "description": "Bear necessities for state management",
      "category": "client-state",
      "author": "@vince",
      "tags": ["react", "state", "hooks", "minimal"],
      "compatibleWith": ["react", "react-native"],
      "score": 100
    }
  ]
}
```

### 5.4 List Format (for Piping)

```
$ cc search zustand --format list
zustand
redux-toolkit
jotai

$ cc search zustand --format list | xargs -I {} cc info {}
```

---

## 6. Interactive Mode Design

### 6.1 UI Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  Skill Search                                            150 skills │
├─────────────────────────────────────────────────────────────────────┤
│  > react_                                                           │
├─────────────────────────────────────────────────────────────────────┤
│    react             Framework     React 18+ with TypeScript        │
│  > zustand           State         Bear necessities for state ⭐     │
│    react-query       Server State  Powerful async state management  │
│    react-hook-form   Forms         Performant forms with hooks      │
│    react-testing-    Testing       Testing utilities for React      │
├─────────────────────────────────────────────────────────────────────┤
│  5 matches │ ↑↓ Navigate │ Enter Select │ Tab Details │ Esc Cancel  │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Detail Preview (Tab Toggle)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Skill Search                                            150 skills │
├─────────────────────────────────────────────────────────────────────┤
│  > react_                                                           │
├────────────────────────────────┬────────────────────────────────────┤
│    react             Framework │  zustand                           │
│  > zustand           State     │  ─────────────────────────────     │
│    react-query       Server St │  Bear necessities for state        │
│    react-hook-form   Forms     │                                    │
│    react-testing-    Testing   │  Category: client-state            │
│                                │  Author:   @vince                  │
│                                │  Tags:     react, state, hooks     │
│                                │                                    │
│                                │  Requires: react OR react-native   │
│                                │  Recommends: react-query, vitest   │
│                                │                                    │
│                                │  ⭐ Recommended with react          │
├────────────────────────────────┴────────────────────────────────────┤
│  5 matches │ ↑↓ Navigate │ Enter Select │ Tab Details │ Esc Cancel  │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.3 Keyboard Controls

| Key         | Action                          |
| ----------- | ------------------------------- |
| `↑`/`k`     | Move selection up               |
| `↓`/`j`     | Move selection down             |
| `Enter`     | Select skill (output to stdout) |
| `Tab`       | Toggle detail preview           |
| `Esc`       | Cancel/exit                     |
| `Ctrl+C`    | Force quit                      |
| Type        | Filter results                  |
| `Backspace` | Delete character                |

### 6.4 Ink Component Structure

```tsx
// Proposed component hierarchy
<SearchApp>
  <Header skillCount={150} />
  <SearchInput value={query} onChange={setQuery} />
  <ResultsList results={filteredResults} selectedIndex={selected} onSelect={handleSelect} />
  {showPreview && <SkillPreview skill={selectedSkill} />}
  <Footer shortcuts={KEYBOARD_SHORTCUTS} matchCount={filteredResults.length} />
</SearchApp>
```

---

## 7. Implementation Roadmap

### Phase 1: Enhanced Static Search (Low Effort)

**Scope:** Improve existing `cc search` command

**Tasks:**

1. Add `--json` output flag
2. Add `--format list|table|wide` flag
3. Add `--compatible-with` filter
4. Add `--limit` and `--offset` pagination
5. Implement basic relevance scoring
6. Add match highlighting in output

**Files to modify:**

- `/home/vince/dev/cli/src/cli/commands/search.ts`

**Estimated effort:** 1-2 days

### Phase 2: Fuzzy Matching (Medium Effort)

**Scope:** Add typo-tolerant search

**Tasks:**

1. Implement fuzzy matching algorithm (or add `fuse.js`)
2. Weight fields by priority
3. Score and rank results
4. Show "Did you mean...?" suggestions

**Files to modify:**

- `/home/vince/dev/cli/src/cli/commands/search.ts`
- New: `/home/vince/dev/cli/src/cli/lib/fuzzy-search.ts`

**Estimated effort:** 2-3 days

### Phase 3: Interactive Mode (Higher Effort)

**Scope:** Add `cc search -i` fuzzy finder

**Tasks:**

1. Create `SearchApp` Ink component
2. Create `ResultsList` with keyboard nav
3. Create `SkillPreview` panel
4. Integrate with existing search logic
5. Add real-time filtering

**New files:**

- `/home/vince/dev/cli/src/cli/components/search/search-app.tsx`
- `/home/vince/dev/cli/src/cli/components/search/results-list.tsx`
- `/home/vince/dev/cli/src/cli/components/search/skill-preview.tsx`
- `/home/vince/dev/cli/src/cli/components/search/search-input.tsx`

**Estimated effort:** 3-5 days

### Phase 4: Integration & Polish (Low Effort)

**Scope:** Integrate with other commands

**Tasks:**

1. `cc import skill <source> --search` - search before importing
2. `cc add <skill>` - search + add workflow
3. `cc init --search` - search during wizard

**Estimated effort:** 1-2 days

---

## Appendix A: Example Command Flows

### Discovery Flow (New User)

```bash
# User wants to find state management options
$ cc search state
Found 8 skills matching "state"

# User narrows to frontend
$ cc search state -c frontend
Found 5 skills matching "state" in category "frontend"

# User wants interactive exploration
$ cc search -i state
# ... interactive fuzzy finder opens ...

# User selects zustand, sees details
# User presses Enter to get skill ID

zustand

# Can pipe directly to add
$ cc search -i state | xargs cc add
```

### Scripting Flow (Automation)

```bash
# List all React-compatible skills as JSON
$ cc search --compatible-with react --json | jq '.results[].alias'

# Find skills by tag
$ cc search --json | jq '.results[] | select(.tags | contains(["testing"]))'

# Generate report
$ cc search --format list > available-skills.txt
```

### Import Flow (Third-Party)

```bash
# Search third-party repo before importing
$ cc import skill github:vercel-labs/skills --list | cc search -i

# Or integrated search
$ cc import skill github:vercel-labs/skills --search
# ... interactive search of that repo's skills ...
```

---

## Appendix B: Technical Constraints

### Performance Targets

| Metric             | Target | Rationale                    |
| ------------------ | ------ | ---------------------------- |
| Search latency     | < 50ms | Local data, instant feedback |
| Interactive render | 60fps  | Smooth typing experience     |
| Memory usage       | < 50MB | Reasonable for CLI tool      |

### Compatibility Requirements

- Node.js 18+ (per `package.json`)
- Works in raw TTY and IDE terminals
- Degrades gracefully without color support
- Non-interactive fallback when stdin is not TTY

### Testing Strategy

**Unit tests:**

- Fuzzy matching algorithm
- Scoring/ranking logic
- Field weighting

**Integration tests:**

- Command flag parsing
- Output format validation
- JSON schema compliance

**E2E tests (if interactive):**

- ink-testing-library for Ink components
- Keyboard navigation
- Selection behavior

---

## Appendix C: Related Files Reference

| Purpose                 | File Path                                                         |
| ----------------------- | ----------------------------------------------------------------- |
| Current search command  | `/home/vince/dev/cli/src/cli/commands/search.ts`                  |
| Skill types             | `/home/vince/dev/cli/src/cli/types-matrix.ts`                     |
| Skills matrix           | `/home/vince/dev/cli/config/skills-matrix.yaml`                   |
| Wizard grid (reference) | `/home/vince/dev/cli/src/cli/components/wizard/category-grid.tsx` |
| Ink theme               | `/home/vince/dev/cli/src/cli/components/themes/default.ts`        |
| Table output            | `@oclif/table` (already used in search.ts)                        |
| Import command          | `/home/vince/dev/cli/src/cli/commands/import/skill.ts`            |

---

## Decision Summary

| Question                        | Recommendation                                           |
| ------------------------------- | -------------------------------------------------------- |
| Interactive vs non-interactive? | **Both** - Static by default, `-i` for interactive       |
| Fuzzy matching library?         | **Native implementation** - Keep deps minimal            |
| Search fields?                  | **All 6** - name, alias, tags, category, description, id |
| Grouping strategy?              | **By category** with flat list option                    |
| Output default?                 | **Table** with JSON and list alternatives                |
| Compatibility indicators?       | **Yes** - Show framework compatibility                   |
