# UX 2.0: Multi-Source Skill Selection

## The Problem

Users can have skills from multiple sources:

1. **Public marketplace** — `github:claude-collective/skills` (default)
2. **Private/org marketplace** — `github:acme-corp/claude-skills`
3. **Local skills** — hand-written or ejected into `.claude/skills/`
4. **Plugin-installed skills** — in `.claude/plugins/`

Currently the wizard only distinguishes local skills (gray `L` badge). There's no way to see which marketplace a remote skill comes from, whether a local skill is a fork of a remote one, or whether a skill is installed as a plugin.

## Design Principle: Separate Selection from Sourcing

The Build step is already complex — framework-first locking, domain tabs, 2D navigation, expert mode, descriptions. Adding source indicators there overloads an already dense screen.

Instead: **Build picks _what_ you want. Sources picks _where_ it comes from.**

This maps cleanly to how users think:

1. "I want React, Zustand, Vitest" (Build)
2. "I want the org's React skill, public Zustand, my local Vitest fork" (Sources)

---

## Wizard Flow

```
[1] Intro → [2] Stack → [3] Build → [4] Sources → [5] Confirm
```

The existing `StepRefine` component (currently a placeholder with "Customize skill sources — coming soon") becomes the Sources step.

---

## Build Step (Unchanged)

The Build step stays exactly as it is, with one addition: a `✓` indicator for skills that are currently installed (distinct from the cyan "selected" highlight).

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [1] Intro  [2] Stack  [3] Build  [4] Sources  [5] Confirm      v0.25.0 │
└──────────────────────────────────────────────────────────────────────────┘

 ─────────────────────────────────────────────────────────────────
  Web   Web-extras   API   CLI   Mobile   Shared
                                                  active  recommended  discouraged  disabled
 ─────────────────────────────────────────────────────────────────

 Customise your Web stack

 Framework *
 ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐
 │ ✓ react  │ │ angular  │ │ solidjs │ │ vue      │
 └──────────┘ └──────────┘ └─────────┘ └──────────┘

 Styling
 ┌─────────────────┐ ┌───────────┐
 │ ✓ scss-modules  │ │ tailwind  │
 └─────────────────┘ └───────────┘

 Client State
 ┌────────────┐ ┌────────┐ ┌───────┐
 │ ✓ zustand  │ │ jotai  │ │ pinia │
 └────────────┘ └────────┘ └───────┘
```

- `✓` = currently installed (any source). Dimmed, not prominent.
- Cyan border = selected for this configuration.
- Both can overlap: installed AND selected.
- No source information shown here at all.

---

## Sources Step

After pressing Enter on Build, users land on the Sources step. This reuses the same visual language as the Build step — sections with selectable cards — but repurposed:

- **Section header** = skill name (instead of category name)
- **Cards** = available source variants (instead of skills)

### Default: All Recommended

For users who don't care about sources (the majority):

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [1] Intro  [2] Stack  [3] Build  [4] Sources  [5] Confirm      v0.25.0 │
└──────────────────────────────────────────────────────────────────────────┘

 Your stack includes 12 skills.

 ┌──────────────────────────────────────────────────────────────────────┐
 │ ▸ Use recommended sources                                           │
 │   All skills from the public Claude Collective marketplace          │
 └──────────────────────────────────────────────────────────────────────┘

   ○ Customise skill sources
     Choose alternative sources for specific skills

 E  Expert mode   P  Plugin mode
┌──────────────────────────────────────────────────────────────────────────┐
│ ↑/↓ navigate   ENTER continue   ESC back                                │
└──────────────────────────────────────────────────────────────────────────┘
```

Pressing Enter on "Use recommended" skips straight to Confirm. Only "Customise" opens the per-skill source picker.

### Customise View: Per-Skill Source Selection

The skill name is the section header. The source variants are the selectable cards. One variant per skill — selecting one deselects others (exclusive, like framework selection).

Every row ends with a **search pill** — a navigable pill that triggers an immediate alias search when you press Space.

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [1] Intro  [2] Stack  [3] Build  [4] Sources  [5] Confirm      v0.25.0 │
└──────────────────────────────────────────────────────────────────────────┘

 Choose a source for each skill

 react
 ┌──────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ ┌─────────────────┐
 │ Public · v2      │ │ acme-corp · v1       │ │ Installed · v2     │ │ ⌕ Search     │
 └──────────────────┘ └──────────────────────┘ └────────────────────┘ └─────────────────┘

 scss-modules
 ┌──────────────────┐ ┌────────────────────┐ ┌─────────────────┐
 │ Installed · v2   │ │ Public · v2        │ │ ⌕ Search     │
 └──────────────────┘ └────────────────────┘ └─────────────────┘

 zustand
 ┌──────────────────┐ ┌─────────────────┐
 │ Public · v2      │ │ ⌕ Search     │
 └──────────────────┘ └─────────────────┘

 vitest
 ┌──────────────────┐ ┌────────────────────┐ ┌─────────────────┐
 │ Public · v2      │ │ acme-corp · v3     │ │ ⌕ Search     │
 └──────────────────┘ └────────────────────┘ └─────────────────┘

 react-query
 ┌──────────────────┐ ┌─────────────────┐
 │ Public · v2      │ │ ⌕ Search     │
 └──────────────────┘ └─────────────────┘

 E  Expert mode   P  Plugin mode
┌──────────────────────────────────────────────────────────────────────────┐
│ ←/→ ↑/↓ navigate   SPACE select   ENTER continue   ESC back            │
└──────────────────────────────────────────────────────────────────────────┘
```

### Bound Skill Search

The search pill at the end of each row triggers an immediate search across all configured extra marketplaces. There is no text input — pressing Space on the search pill searches using the subcategory's alias (e.g., "react" for the `web-framework` subcategory).

**Search pill (idle):**

```
 react
 ┌──────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ ┌───────────┐
 │ Public · v2      │ │ acme-corp · v1       │ │ ✓ Installed · v2   │ │ ⌕ Search  │
 └──────────────────┘ └──────────────────────┘ └────────────────────┘ └───────────┘
```

**After pressing Space on the search pill (modal overlay appears):**

```
 ┌──────────────────────────────────────────────────────────────────────────────┐
 │  Search results for "react"                                                  │
 │                                                                              │
 │  ▸ awesome-dev/react-pro          v3   Opinionated React with strict TS     │
 │    team-xyz/react-strict          v1   Strict mode, concurrent, suspense    │
 │    solo-dev/react-minimal         v2   Minimal — hooks only, no classes     │
 │    company/react-enterprise       v4   Enterprise with auth, RBAC, audit    │
 │                                                                              │
 │  ↑/↓ navigate   ENTER bind   ESC close                                      │
 └──────────────────────────────────────────────────────────────────────────────┘
```

The modal is a full overlay — it does not push content down or interact with the grid below. ↑/↓ navigates results within the modal, Enter binds the selected result to the subcategory, Escape closes without binding.

**After binding a result (modal closes, new variant card appears):**

```
 react
 ┌──────────────────┐ ┌──────────────────────┐ ┌────────────────────┐ ┌─────────────────────────────┐ ┌───────────┐
 │ Public · v2      │ │ acme-corp · v1       │ │ ✓ Installed · v2   │ │ awesome-dev/react-pro · v3  │ │ ⌕ Search  │
 └──────────────────┘ └──────────────────────┘ └────────────────────┘ └─────────────────────────────┘ └───────────┘
```

The bound result becomes a permanent variant card. You can select it with Space like any other variant.

### Search Interaction Flow

1. Navigate to `⌕ Search` pill with ←/→ arrows
2. Press Space — immediately searches all configured extra marketplaces for the subcategory alias
3. Modal overlay appears with results from all extra sources
4. ↑/↓ navigates results within the modal
5. Enter on a result binds it to the subcategory, closes modal, adds as variant card
6. Escape closes modal without binding
7. Search pill remains ready for next use

The distinction: **cards are selectable sources** you've committed to evaluating. The **modal is a discovery overlay** — a focused view where you can scan many candidates before binding one as a card.

### Visual States for Source Cards

| State     | Appearance                | Meaning                                  |
| --------- | ------------------------- | ---------------------------------------- |
| Selected  | Cyan border + bold        | This source will be used                 |
| Installed | `✓` prefix, white         | Already on disk from a previous install  |
| Available | Normal                    | Can be fetched/installed                 |
| Focused   | White border              | Currently focused for navigation         |
| Search    | `⌕` prefix, dimmed border | Pill that triggers alias search on Space |

### Example with States

```
 react
 ┌──────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐ ┌─────────────────┐
 │ Public · v2      │ │ acme-corp · v1       │ │ ✓ Installed · v2     │ │ ⌕ Search     │
 └──────────────────┘ └──────────────────────┘ └──────────────────────┘ └─────────────────┘
   ↑ selected (cyan)                              ↑ currently on disk      ↑ search pill

 scss-modules
 ┌──────────────────────┐ ┌──────────────────┐ ┌─────────────────┐
 │ ✓ Installed · v2     │ │ Public · v2      │ │ ⌕ Search     │
 └──────────────────────┘ └──────────────────┘ └─────────────────┘
   ↑ selected + installed
```

Default selection: if a skill is already installed, pre-select that source. Otherwise, pre-select public.

### Card Labels

Source cards show:

```
┌───────────────────────────┐
│ [✓] Source name · vN      │
└───────────────────────────┘
```

Where source name is one of:

- `Public` — the default claude-collective marketplace
- `{marketplace-name}` — a configured private source (from `config.sources[]`)
- `Installed` — already on disk (local or plugin)
- `Local` — a hand-crafted local skill (not forked from any source)
- `{owner/repo}` — a search result that was added (from `config.sources[]` after adding)

The search card shows:

```
┌───────────────────────────┐
│ ⌕ Search                  │   ← press Space to search
└───────────────────────────┘
```

---

## One Skill Per Slot

Only one version of each skill can be active at a time. The Sources step enforces this naturally — it's exclusive selection per row (like framework selection in Build).

This avoids naming collisions (`web-framework-react` can only exist once) and matches the stack config model where each subcategory maps to a single skill ID.

---

## Bound Skills

### What Are Bound Skills?

Bound skills are foreign skills deliberately associated with a subcategory through search. Unlike configured marketplace sources (which are automatically matched by skill ID), bound skills are discovered through the search pill and explicitly linked to a subcategory slot.

### Why They Exist

Extra marketplace sources only show skills that share the same skill ID as the primary source's skill. But a foreign marketplace might publish a React skill under a different ID (e.g., `web-framework-react-pro` instead of `web-framework-react`). Bound skills solve this: the user searches, finds `react-pro` from `awesome-dev`, and binds it to the `web-framework` subcategory. It now appears as a selectable variant alongside `Public` and `Local`.

### BoundSkill Type

```typescript
type BoundSkill = {
  id: SkillId; // the foreign skill's actual ID
  sourceUrl: string; // source URL (e.g., "github:awesome-dev/skills")
  sourceName: string; // display name (e.g., "awesome-dev")
  boundTo: SkillAlias; // subcategory alias this is bound to (e.g., "react")
  description?: string; // skill description from the source
};
```

### Config Persistence

Bound skills are stored in `.claude-src/config.yaml` alongside `sources`:

```yaml
sources:
  - name: acme-corp
    url: github:acme-corp/claude-skills

boundSkills:
  - id: web-framework-react-pro
    sourceUrl: github:awesome-dev/skills
    sourceName: awesome-dev
    boundTo: react
    description: Opinionated React with strict TypeScript
```

### Integration with the Matrix

Bound skills appear as `SkillSource` entries on the parent `ResolvedSkill`:

- When loading the matrix, `boundSkills` from config are resolved into additional `availableSources` entries on the `ResolvedSkill` matching the `boundTo` alias
- The bound skill's source gets `type: "private"` since it comes from a configured external source
- If the user selects the bound variant, the installation pipeline fetches from `sourceUrl` using the bound skill's `id`

---

## What Happens When Switching Sources

| From               | To             | Action                                                                |
| ------------------ | -------------- | --------------------------------------------------------------------- |
| Installed (local)  | Public/Private | Archive local to `.claude/skills/_archived/{skill-id}/`, fetch remote |
| Public             | Private        | Update source reference in config, re-fetch on install                |
| Public/Private     | Local (eject)  | Copy skill to `.claude/skills/` with `forked_from` metadata           |
| Installed (plugin) | Local          | Copy from plugin dir to `.claude/skills/`, mark as local              |

The `_archived/` folder preserves the user's work without cluttering the active skills directory. If they switch back, the archived version can be restored.

---

## Edit Flow

```
cc edit
  → Detects existing installation, loads current config
  → Jumps to Build step (pre-populated with current selections)
  → ✓ indicators show what's currently installed
  → User modifies selections (add/remove skills)
  → Sources step pre-selects current source for each skill
  → User changes sources if desired
  → Confirm → recompile + install
```

### Source Switching in Edit

After the wizard completes, `edit.tsx` reads `result.sourceSelections` and applies source changes:

1. **Detect source changes** — compare `sourceSelections[skillId]` against `skill.activeSource.name` for each skill
2. **Local → Public/Private** — call `archiveLocalSkill(projectDir, skillId)` to preserve the local version, then copy from the selected remote source
3. **Public/Private → Local** — call `restoreArchivedSkill(projectDir, skillId)` to bring back the archived local version
4. **Source-only changes** — when no skills are added or removed but sources changed, the edit flow detects this and applies the switches (avoiding a false "No changes made" message)

Change log output for source switches:

```
~ web-framework-react (Local → Public)
~ web-testing-vitest (Public → acme-corp)
```

`edit.tsx` passes `sourceSelections` to the skill copier, which overrides local-skip logic when the user has explicitly selected a remote source for a skill that has a local version.

`cc init` on an already-initialized project refuses and points to `cc edit` (existing behavior).

---

## Settings (Source Management)

The Sources step lets you pick variants for individual skills, but you need a place to manage your configured marketplaces — add new ones, see what's already configured, remove old ones. This lives behind a `⚙` Settings hotkey accessible from the Sources step.

### Access

From the Sources step, press `G` (for settings) to open the settings view:

```
 E  Expert mode   G  Settings   P  Plugin mode
```

### Settings View

```
┌──────────────────────────────────────────────────────────────────────────┐
│ [1] Intro  [2] Stack  [3] Build  [4] Sources  [5] Confirm      v0.25.0 │
└──────────────────────────────────────────────────────────────────────────┘

 Skill Sources

 Configured marketplaces:

 ┌────────────────────────────────────────────────────────────────────────┐
 │  ✓ Public                  github:claude-collective/skills  (default) │
 │  ✓ acme-corp               github:acme-corp/claude-skills             │
 │    team-experiments         github:team/experimental-skills            │
 └────────────────────────────────────────────────────────────────────────┘

 ┌─────────────────────────────────────────────────────────┐
 │ + Add source: █                                         │
 └─────────────────────────────────────────────────────────┘

 Local skills:  3 in .claude/skills/
 Plugins:       1 in .claude/plugins/

┌──────────────────────────────────────────────────────────────────────────┐
│ ↑/↓ navigate   ENTER toggle   DEL remove   ESC back to sources          │
└──────────────────────────────────────────────────────────────────────────┘
```

### What You Can Do

- **View all sources** — see every configured marketplace with its URL
- **Toggle sources on/off** — `✓` means active (its skills appear in the Sources step). Toggling off hides its skills without removing the config.
- **Add a source** — type a GitHub URL or path into the `+ Add source` input. It gets fetched, validated, and added to `config.sources[]`.
- **Remove a source** — DEL on a source removes it from config (with confirmation if skills from it are currently selected)
- **See local/plugin counts** — quick summary of non-marketplace sources

### Adding a Source

When you type into the `+ Add source` input and press Enter:

```
 ┌─────────────────────────────────────────────────────────┐
 │ + Add source: github:new-org/skills█                    │
 └─────────────────────────────────────────────────────────┘
   Fetching... ⠋

   ───────────────────────────────────────────────
   ✓ Found: new-org Skills Marketplace
     14 skills across 5 categories
     Name: new-org
   ───────────────────────────────────────────────
   Press ENTER to add, ESC to cancel
```

After confirming, the source appears in the list and its skills become available as variants in the Sources step.

### Config Persistence

Sources are stored in `.claude-src/config.yaml` under the existing `sources` field:

```yaml
sources:
  - name: acme-corp
    url: github:acme-corp/claude-skills
  - name: team-experiments
    url: github:team/experimental-skills
```

The public marketplace (`github:claude-collective/skills`) is always present as the default and cannot be removed — only toggled off.

---

## Data Model Changes

### SkillSource Type

```typescript
type SkillSourceType = "public" | "private" | "local" | "plugin";

type SkillSource = {
  name: string; // "public", "acme-corp", "local"
  type: SkillSourceType;
  url?: string; // source URL for remote sources
  version?: number; // skill content version
  installed?: boolean; // currently on disk
};
```

### ResolvedSkill Extension

```typescript
// Add to ResolvedSkill
type ResolvedSkill = {
  // ... existing fields ...
  availableSources: SkillSource[]; // all known sources for this skill
  activeSource?: SkillSource; // currently installed source (if any)
};
```

### Source Variant in CategoryOption

The Sources step reuses `CategoryGrid` with a new option type:

```typescript
type SourceOption = {
  id: string; // source identifier (e.g., "public", "acme-corp", "local")
  label: string; // display label (e.g., "Public · v2")
  selected: boolean; // is this the active source?
  installed: boolean; // is this version on disk?
  state: OptionState; // reuse existing state system
};

type SourceRow = {
  id: SkillId; // the skill this row is for
  displayName: string; // skill display name (e.g., "react")
  options: SourceOption[];
  exclusive: true; // always exclusive — one source per skill
};
```

### Pipeline Changes

`loadSkillsMatrixFromSource()` needs to:

1. Load skills from primary source → tag with `{ name: "public", type: "public" }`
2. Load skills from each `config.sources[]` entry → tag with `{ name: entry.name, type: "private" }`
3. Discover local skills → tag with `{ name: "local", type: "local" }`
4. Detect plugin-installed skills → tag with `{ name: "plugin", type: "plugin" }`
5. For each skill ID, collect all sources into `availableSources[]`
6. Merge into matrix as before (local wins for the active skill data)

---

## Implementation Phases

### Phase 1: Sources Step UI (no multi-source loading)

- Wire `StepRefine` into the wizard flow as step 4
- Add `sources` step to `WizardStep` type and `WIZARD_STEPS`
- Implement "Use recommended" / "Customise" choice (already built)
- Build the per-skill source picker using `CategoryGrid` pattern
- For now, only show "Public" and "Installed" variants (data already available)

### Phase 2: Multi-Source Loading

- Implement `loadSkillsFromAllSources()` that iterates `config.sources[]`
- Tag each skill with `SkillSource`
- Merge multiple source results into unified matrix
- Private marketplace skills appear as additional source variants

### Phase 3: Source Switching

- Implement archive-on-switch for local skills
- Handle fetch-on-switch for remote skills not yet on disk
- Update `config.yaml` with active source references

### Phase 4: Installed Indicator in Build Step

- Add `installed?: boolean` to `CategoryOption`
- Show `✓` in `SkillTag` for installed skills
- Load installation state from `detectInstallation()` + disk scan

### Phase 5: Settings View (Source Management)

- Add settings view accessible from Sources step via `G` hotkey
- Show configured marketplaces with toggle on/off
- Add source input with fetch + validation
- Remove source with confirmation
- Persist to `config.sources[]` in `.claude-src/config.yaml`

### Phase 6: Bound Skill Search

- Add search pill to the end of every source row — Space triggers immediate alias search
- Search modal overlay shows results from all configured extra marketplaces
- On result selection: bind as new `SkillSource` variant card in the row
- `BoundSkill` type for config persistence in `.claude-src/config.yaml`
- See [ux-2.0-multi-source-implementation.md](./ux-2.0-multi-source-implementation.md) Phase 6 for full spec

---

## Key Files

| File                                          | Change                                                   |
| --------------------------------------------- | -------------------------------------------------------- |
| `src/cli/stores/wizard-store.ts`              | Add `"sources"` to `WizardStep`, source selections state |
| `src/cli/components/wizard/wizard.tsx`        | Wire Sources step into flow                              |
| `src/cli/components/wizard/wizard-tabs.tsx`   | Add step 4 to `WIZARD_STEPS`                             |
| `src/cli/components/wizard/step-refine.tsx`   | Expand into full source picker                           |
| `src/cli/components/wizard/category-grid.tsx` | May need `exclusive` mode per row                        |
| `src/cli/lib/loading/source-loader.ts`        | Multi-source loading                                     |
| `src/cli/types/matrix.ts`                     | `SkillSource`, `availableSources` on `ResolvedSkill`     |
| `src/cli/lib/installation/local-installer.ts` | Archive-on-switch logic                                  |
| `src/cli/components/wizard/search-modal.tsx`  | Modal overlay for bound skill search results             |
| `src/cli/lib/skills/skill-search.ts`          | Search backend (registry/GitHub lookup)                  |
| `src/cli/components/wizard/step-settings.tsx` | Settings view for source management                      |
| `src/cli/lib/configuration/source-manager.ts` | Add/remove/toggle sources, fetch + validate              |

---

## Rejected Approaches

Approaches A through E from earlier exploration attempted to solve source indication within the Build step itself (badges, lanes, dots, filter tabs, suffixes). These were rejected in favour of the two-step approach because:

1. **Build is already at capacity** — adding source info overloads the densest screen
2. **Users think in two stages** — "what do I want" then "where from"
3. **The Sources step reuses the same component** — no new interaction patterns to learn
4. **Most users skip it** — "Use recommended" fast-paths to Confirm
