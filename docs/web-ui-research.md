# Web UI for Private Marketplace Visualization

> **Status**: Research Complete
> **Date**: 2026-01-31
> **Task**: P4-19

---

## Executive Summary

Companies with private marketplaces need a way to visualize their stacks, skills, and agents in a web interface. The CLI has access to this private data, but sharing it with external web services raises security concerns. The recommended approach is a **local HTML file export** that generates a self-contained HTML file with embedded data and styling, which can be opened in the user's default browser. This keeps private data on the user's machine while providing a rich visual experience.

---

## Current Architecture Context

### Data Loading Infrastructure

The CLI has robust data loading via `source-loader.ts`:

- Local filesystem paths
- GitHub repositories (`github:org/repo`)
- Custom URLs
- Cached remote sources

### Available Data Structures

From `types-matrix.ts` and `types.ts`:

- **Skills**: ID, name, description, category, dependencies, conflicts, recommendations
- **Agents**: Name, description, tools, model, permission mode
- **Stacks**: Bundled skill collections with philosophy and principles
- **Categories**: Hierarchical organization of skills

### Current Terminal UI

Uses `@clack/prompts` for:

- Spinners and progress indicators
- Multi-select lists
- Confirmation prompts

No existing web/HTML generation.

---

## Options Analysis

### Option 1: Local HTML File Export (Recommended)

**Command**: `cc show --html` or `cc export html`

**How it works**:

1. CLI loads marketplace data using existing `loadSkillsMatrixFromSource()`
2. Generates a self-contained `.html` file with:
   - Inline CSS (Tailwind or similar)
   - Inline JavaScript (vanilla JS for interactivity)
   - Embedded JSON data
3. Opens file in default browser via `open` (macOS) / `xdg-open` (Linux) / `start` (Windows)

**Pros**:

- Private data never leaves user's machine
- No server required
- Works offline
- Simple implementation
- Can be shared via file (user controls sharing)

**Cons**:

- Static snapshot (must regenerate for updates)
- Limited interactivity without complex JS
- File can grow large with many skills

**Estimated Effort**: 1-2 days

---

### Option 2: Local Dev Server

**Command**: `cc show --serve` or `cc ui`

**How it works**:

1. CLI starts local HTTP server (port 3000)
2. Serves a web app that fetches data from CLI endpoints
3. Opens browser to `http://localhost:3000`

**Pros**:

- Real-time data (no regeneration needed)
- Rich interactivity
- Can include search, filter, navigation
- Familiar dev experience (like Vite/Next dev server)

**Cons**:

- More complex implementation
- Requires bundled web assets
- Port conflicts possible
- Must keep CLI running

**Estimated Effort**: 3-5 days

---

### Option 3: Cloud Service with Data Push

**Command**: `cc show --cloud` (with explicit consent)

**How it works**:

1. User confirms: "Data will be uploaded to X. Continue?"
2. CLI pushes marketplace data to hosted service
3. Returns URL to view visualization

**Pros**:

- Professional hosted UI
- Shareable links
- No local setup
- Can include collaboration features

**Cons**:

- **Security risk for private data**
- Requires external service
- Compliance concerns (GDPR, SOC2, etc.)
- Network dependency

**Not recommended for private marketplaces.**

---

## Recommended Approach: Phased Implementation

### Phase 1: Local HTML Export (MVP)

```bash
cc show --html              # Generate and open in browser
cc show --html -o view.html # Generate to specific file
cc show --html --no-open    # Generate without opening
```

**Implementation**:

1. Create `/home/vince/dev/cli/src/cli/commands/show.ts`
2. Add HTML template with embedded Tailwind CSS
3. Serialize marketplace data as JSON in `<script>` tag
4. Use vanilla JS for basic interactivity (expand/collapse, search)
5. Open with system command

**HTML Template Structure**:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Claude Collective Marketplace</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      /* Custom styles */
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script>
      const DATA = /* JSON DATA */;
      // Render logic
    </script>
  </body>
</html>
```

### Phase 2: Enhanced Interactivity (Optional)

- Dependency graph visualization (Mermaid.js)
- Skill comparison view
- Export to JSON/CSV
- Print-friendly view

### Phase 3: Local Dev Server (Optional)

- Only if users need real-time updates
- Consider using existing tools (Vite) vs custom server

---

## Security Considerations

### For Local HTML Export

1. **No external requests**: All assets should be inlined or use CDN with SRI
2. **No analytics**: Don't include tracking scripts
3. **Clear file location**: Tell user where file is saved
4. **Optional encryption**: Could password-protect sensitive views

### For Any Cloud Option

1. **Explicit consent required**: Never send data without confirmation
2. **Clear warning**: "Your marketplace data will be uploaded to [service]"
3. **Data retention policy**: Clear communication on how long data is stored
4. **Option to delete**: Provide way to remove uploaded data

### Recommended UX for Cloud (if implemented)

```
$ cc show --cloud

⚠️  Warning: This will upload your marketplace data to cloud.claudecollective.com

Data includes:
- 45 skills
- 12 agents
- 3 stacks
- Category structure

Continue? (y/N) >
```

---

## Technical Implementation Notes

### Opening Browser Cross-Platform

```typescript
import { exec } from "child_process";

function openBrowser(url: string) {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  exec(`${cmd} "${url}"`);
}
```

### Existing Patterns to Leverage

- `loadSkillsMatrixFromSource()` for data loading
- `resolveSource()` for source resolution
- `EXIT_CODES` for consistent exit handling
- `@clack/prompts` for confirmation dialogs

---

## Open Questions

1. **Branding**: Should the HTML include Claude Collective branding or be white-label?
2. **Theming**: Support dark/light mode?
3. **Skill Content**: Include full SKILL.md content or just metadata?
4. **Agent Prompts**: Should agent prompts be visible (potentially sensitive)?
5. **Update Frequency**: Cache busting for CDN assets?

---

## Implementation Checklist (Phase 1)

- [ ] Create `show.ts` command
- [ ] Design HTML template with Tailwind
- [ ] Implement data serialization
- [ ] Add cross-platform browser opening
- [ ] Write tests
- [ ] Update docs/commands.md
- [ ] Update TODO.md

---

## Related Documents

- [Architecture](./architecture.md) - Data flow overview
- [Commands](./commands.md) - CLI command reference
- [Data Models](./data-models.md) - Type definitions
