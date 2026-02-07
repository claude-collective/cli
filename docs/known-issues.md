# Known Issues and Limitations

## Resolved Issues (Kept for Reference)

The following issues have been fixed:

| Issue                                      | Status | Resolution                                          |
| ------------------------------------------ | ------ | --------------------------------------------------- |
| `cc eject skills` not implemented          | Fixed  | Implemented in P2-10                                |
| `cc eject agents` not implemented          | Fixed  | Implemented in P2-11                                |
| Local skill `test-` prefix filter          | Fixed  | Removed in P1-00                                    |
| No uninstall command                       | Fixed  | `cc uninstall` added in P3-06/P3-07                 |
| Build step skips uncovered domains (UX-11) | Fixed  | `populateFromStack()` now uses ALL_DOMAINS (0.16.0) |

---

## Current Limitations

### Individual Skill Plugin Installation

Plugin mode only supports full stacks, not individual skills.

**Workaround:** Use Local mode to install individual skills, or create a single-skill stack.

**Status:** Deferred (P3-14)

---

### Stack Selection Editing

When selecting a stack in the wizard, skills are pre-populated but the wizard doesn't provide a streamlined way to remove skills.

**Workaround:** Use Local mode, then manually edit `.claude/config.yaml` and run `cc compile`.

**Status:** Deferred (P2-18, P2-19 - simplify stack handling)

---

### Marketplace Path Generation

`build:marketplace` generates paths relative to where command runs, not relative to marketplace.json location.

**Example bug:**

```json
// Generated (wrong)
"source": "./dist/stacks/nextjs-fullstack"

// Should be (from dist/.claude-plugin/)
"source": "./stacks/nextjs-fullstack"
```

**Workaround:** Manually fix paths in marketplace.json after generation.

---

## Configuration

### Config Keys

Supported config keys:

- `source` - Skills source URL
- `author` - Author name
- `agents_source` - Remote agent definitions URL
- `marketplace_url` - Custom marketplace URL

Project-level config (`.claude/config.yaml`) supports:

- `skills` - Selected skill IDs
- `agents` - Agent IDs to compile
- `agent_skills` - Custom agent-skill mappings
- `custom_agents` - Custom agent definitions with `extends` support
- `preload_patterns` - Override default preloading rules

---

## Wizard Behavior

### Expert Mode

Expert mode (disables conflict/dependency checking) is automatically enabled when local skills are detected. This is by design to allow full customization.

---

### Default Mode

The wizard defaults to **Local Mode** (not Plugin Mode). This gives users ownership of their configuration.

---

### Missing Subcategories After Stack Selection (UX-12)

When selecting a stack (e.g., "Next.js Fullstack") with local skills present, many subcategories (client state management, server state, etc.) may not appear in the build view's CategoryGrid.

**Root cause:** Multiple factors: skill ID resolution mismatches between `allSkillIds` and `matrix.skills` keys; local skills placed in `local/custom` category which has no `domain` field; stack agent configs referencing subcategory IDs not defined in `skills-matrix.yaml`.

**Workaround:** Use "Build from scratch" approach where all categories for selected domains are shown.

**Status:** Tracked as UX-12. See investigation notes in [TODO-cli-ux.md](../TODO-cli-ux.md).

---

## Plugin Installation

### Scope

`--scope project` installs to current working directory's `.claude/settings.json`. Ensure you're in the correct directory.

---

## Build Issues

### Agent Source Resolution

When building, agent definitions are loaded from (in order):

1. Project's `.claude/agents/_partials/` (if ejected)
2. Plugin's `src/agents/`
3. CLI's bundled agents

---

### Hooks.json Generation

Hooks are only generated if defined in config. Empty hooks object doesn't create hooks.json.

---

## Deferred Features

| Feature                  | Task ID | Notes                            |
| ------------------------ | ------- | -------------------------------- |
| Individual skill plugins | P3-14   | Plugin mode only supports stacks |

See [TODO.md](../TODO.md) for full implementation tracking.
