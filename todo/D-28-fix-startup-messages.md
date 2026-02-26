# D-28: Fix Startup Warning/Error Messages

**Status:** Deferred — refinement complete, ready for implementation
**Research doc:** [docs/research/startup-message-persistence.md](../docs/research/startup-message-persistence.md)

---

## Open Questions

1. **Which pre-Ink messages are worth preserving?** Some warnings (e.g., "Invalid SKILL.md frontmatter in 'foo'") are diagnostic noise that belongs in verbose mode. Others (e.g., "already initialized at .claude/settings.json") are genuinely user-facing. The message audit below proposes a disposition for each one — review before implementing.

2. **Buffer approach vs moving loading into Ink?** The research doc evaluated three approaches. The buffer + `<Static>` approach is recommended because it preserves the current architecture (loading happens in the oclif `run()` method, not inside React). Moving loading into Ink via `useEffect` would be a much larger refactor and would move business logic into the React component tree.

3. **Should the logger buffer be global mutable state or passed explicitly?** The simplest approach is a module-level collector in `utils/logger.ts` (enable buffering, drain the buffer, disable). The alternative is a dependency-injected collector passed through every loading function — this is over-engineered for the problem. The module-level approach matches how `setVerbose()` already works.

4. **Should the `<Static>` block go in `WizardLayout` or `Wizard`?** It should go in `WizardLayout` since that component owns the full-height `<Box>` that triggers `clearTerminal`. The `<Static>` items must be siblings of that `<Box>`, not children of it, so they get accumulated in Ink's `fullStaticOutput` and survive the clear.

---

## Current State Analysis

### Pre-Ink messages in `init.tsx`

All of these run **before** `render(<Wizard ...>)` on line 110:

| Line | Call | Message | Timing |
|------|------|---------|--------|
| 78 | `this.log()` | Dry-run preview header | Before loading |
| 88 | `this.warn()` | "Already initialized at {location}" | Before loading |
| 89 | `this.log()` | "Use 'cc edit' to modify skills" | Before loading |
| 90 | `this.log()` | "No changes made" | Before loading |

Lines 88-90 cause an early return, so they are not affected by Ink clearing. Lines 77-78 are the only pre-Ink message that is followed by Ink rendering — but the `init` command only enters the wizard path when there is no existing installation, so the dry-run message on line 78 is also followed by the wizard.

### Pre-Ink messages in `edit.tsx`

All of these run **before** `render(<Wizard ...>)` on line 120:

| Line | Call | Message | Timing |
|------|------|---------|--------|
| 74 | `this.log()` | "Edit {mode} Skills" | Before loading |
| 76 | `this.log()` | "Loading marketplace source..." | Before loading |
| 86-87 | `this.log()` | "Loaded {N} skills ({source})" | After source load |
| 95 | `this.log()` | "Reading current skills..." | After source load |
| 105 | `this.log()` | "Found {N} skills from project config" | After plugin discovery |
| 107 | `this.log()` | "Current plugin has {N} skills" | After plugin discovery |

These are the primary messages affected. They are printed to the terminal, then Ink's first render cycle clears them.

### Library-level warnings (via `utils/logger.ts` `warn()`)

During `loadSkillsMatrixFromSource()` and related loading calls, these modules call `warn()` from `utils/logger.ts`, which uses `console.warn()`:

| Module | Messages |
|--------|----------|
| `loader.ts` | Invalid SKILL.md frontmatter, unknown skill references, missing skills, invalid frontmatter, load failures, invalid files |
| `multi-source-loader.ts` | Failed to load public source, source loading errors |
| `source-fetcher.ts` | Missing marketplace plugin name, unsafe plugin name characters |
| `skill-metadata.ts` | Invalid metadata.yaml (3 call sites) |
| `matrix-health-check.ts` | Matrix health issues |
| `local-skill-loader.ts` | Unrecognized local skill dirs, missing SKILL.md, invalid frontmatter |
| `skill-copier.ts` | Copy warnings |
| `source-switcher.ts` | Archive/restore warnings |
| `stacks-loader.ts` | Stack loading warnings |

All of these go directly to stderr via `console.warn()` and are wiped by Ink's `clearTerminal`.

---

## Root Cause

Two mechanisms combine:

1. **Pre-Ink output goes to stdout/stderr directly.** Both `this.log()` (oclif, writes to stdout) and `warn()` (logger.ts, writes to stderr via `console.warn`) print text before Ink takes control of the terminal.

2. **Ink clears the entire terminal when output fills the screen.** `wizard-layout.tsx` line 96 sets `height={terminalHeight}`, making the Ink output as tall as the terminal. In `ink.js` line 121-124, when `outputHeight >= stdout.rows`, Ink writes `ansiEscapes.clearTerminal` which sends `\x1b[2J\x1b[3J\x1b[H` — erasing the screen **and** scrollback buffer. Everything printed before Ink rendered is destroyed.

**Exception:** Ink preserves its own `fullStaticOutput` — content rendered via the `<Static>` component is accumulated and re-written after every `clearTerminal` call (line 122: `clearTerminal + this.fullStaticOutput + output`).

---

## Solution Design

### Approach: Buffer pre-Ink messages, render via Ink `<Static>`

```
 oclif command run()          Ink render
 =====================       ====================
 1. Enable buffering          4. <Static> renders
 2. Load sources                 buffered messages
    (warnings go to buffer)   5. <Box height={terminalHeight}>
 3. Drain buffer,                (main wizard UI)
    pass to <Wizard>
```

### Message buffer type

```typescript
type StartupMessage = {
  level: "info" | "warn" | "error";
  text: string;
};
```

### Changes overview

1. **`utils/logger.ts`** — Add buffer mode: `enableBuffering()`, `drainBuffer()`, `disableBuffering()`. When buffering is enabled, `warn()` pushes to the buffer instead of calling `console.warn()`. The `verbose()` function is unaffected (verbose messages should not be shown to users).

2. **`init.tsx`** and **`edit.tsx`** — Enable buffering before loading. After loading completes, drain the buffer. Pass the messages array as a prop to `<Wizard>`.

3. **`wizard.tsx`** — Accept a new `startupMessages?: StartupMessage[]` prop, pass through to `<WizardLayout>`.

4. **`wizard-layout.tsx`** — Accept `startupMessages?: StartupMessage[]` prop. Render them via `<Static>` above the main `<Box>`. Use yellow for warnings, red for errors, default for info.

---

## Step-by-Step Implementation Plan

### Step 1: Add buffering to `utils/logger.ts`

Add three functions alongside the existing `setVerbose()` pattern:

```typescript
let bufferMode = false;
let messageBuffer: StartupMessage[] = [];

export function enableBuffering(): void {
  bufferMode = true;
  messageBuffer = [];
}

export function drainBuffer(): StartupMessage[] {
  const messages = [...messageBuffer];
  messageBuffer = [];
  return messages;
}

export function disableBuffering(): void {
  bufferMode = false;
  messageBuffer = [];
}
```

Modify `warn()` to check buffer mode:

```typescript
export function warn(msg: string): void {
  if (bufferMode) {
    messageBuffer.push({ level: "warn", text: msg });
    return;
  }
  console.warn(`  Warning: ${msg}`);
}
```

Export the `StartupMessage` type.

**Files changed:** `src/cli/utils/logger.ts`

### Step 2: Update command files to use buffering

In `edit.tsx`:
- Call `enableBuffering()` before `loadSkillsMatrixFromSource()`
- Call `drainBuffer()` after all loading is complete
- Replace pre-Ink `this.log()` calls with buffer pushes (or remove status messages that are purely diagnostic)
- Pass the drained messages to `<Wizard startupMessages={messages}>`
- Call `disableBuffering()` after draining (so post-Ink `this.log()` calls work normally)

In `init.tsx`:
- Same pattern, but there are fewer pre-Ink messages
- The dry-run header (line 78) is informational — could be buffered or kept as-is since it appears before the wizard renders and the user might want to see it
- The "already initialized" path (lines 84-91) returns early and never starts Ink, so it is unaffected

**Files changed:** `src/cli/commands/init.tsx`, `src/cli/commands/edit.tsx`

### Step 3: Thread `startupMessages` through Wizard components

In `wizard.tsx`:
- Add `startupMessages?: StartupMessage[]` to `WizardProps`
- Pass through to `<WizardLayout startupMessages={startupMessages}>`

In `wizard-layout.tsx`:
- Add `startupMessages?: StartupMessage[]` to `WizardLayoutProps`
- Import `Static` from `ink`
- Render `<Static>` block above the main `<Box>`

```tsx
import { Static, Box, Text } from "ink";

// Before the main <Box flexDirection="column" paddingX={1} height={terminalHeight}>
{startupMessages && startupMessages.length > 0 && (
  <Static items={startupMessages}>
    {(msg, index) => (
      <Box key={index}>
        <Text color={msg.level === "warn" ? "yellow" : msg.level === "error" ? "red" : undefined}>
          {msg.level === "warn" ? `  Warning: ${msg.text}` : msg.text}
        </Text>
      </Box>
    )}
  </Static>
)}
```

**Files changed:** `src/cli/components/wizard/wizard.tsx`, `src/cli/components/wizard/wizard-layout.tsx`

### Step 4: Audit and downgrade messages

See the Message Audit section below. Some messages should be downgraded to `verbose()` instead of being shown to users.

**Files changed:** Various loading modules (only changing `warn()` to `verbose()` where appropriate)

---

## Message Audit

### Pre-Ink messages in `edit.tsx` (this.log calls)

| Line | Message | Disposition | Rationale |
|------|---------|-------------|-----------|
| 74 | "Edit {mode} Skills" | **Remove** | The wizard header already shows context. This flashes and disappears. |
| 76 | "Loading marketplace source..." | **Remove** | Loading is fast enough that this status line adds no value. The wizard appears immediately after. |
| 86-87 | "Loaded {N} skills ({source})" | **Buffer as info** | Useful confirmation of what was loaded, especially for multi-source setups. |
| 95 | "Reading current skills..." | **Remove** | Status flicker with no user value. |
| 105 | "Found {N} skills from project config" | **Buffer as info** | Useful confirmation. |
| 107 | "Current plugin has {N} skills" | **Buffer as info** | Useful confirmation. |

### Pre-Ink messages in `init.tsx` (this.log/warn calls)

| Line | Message | Disposition | Rationale |
|------|---------|-------------|-----------|
| 78 | Dry-run preview header | **Buffer as info** | User needs to know they are in dry-run mode. |
| 88 | "Already initialized at {location}" | **Keep as-is** | This path returns early; Ink never starts. |
| 89-90 | Edit suggestion + no changes | **Keep as-is** | Same early-return path. |

### Library `warn()` calls during loading

| Module | Message pattern | Disposition | Rationale |
|--------|----------------|-------------|-----------|
| `loader.ts` | "Invalid SKILL.md frontmatter in '{location}'" | **Downgrade to verbose** | Diagnostic; not actionable by end users |
| `loader.ts` | "Skipping invalid agent.yaml at '{path}'" | **Downgrade to verbose** | Diagnostic |
| `loader.ts` | "Unknown skill reference '{skillId}'" | **Keep as warn (buffered)** | May indicate a config problem the user should fix |
| `loader.ts` | "Could not find skill '{skillId}'" | **Keep as warn (buffered)** | Actionable — skill may be misconfigured |
| `loader.ts` | "Skipping '{skillId}': missing or invalid frontmatter" | **Downgrade to verbose** | Diagnostic noise during normal operation |
| `loader.ts` | "Could not load skill '{skillId}'" | **Keep as warn (buffered)** | Indicates a real loading failure |
| `loader.ts` | "Skipping '{file}': missing or invalid frontmatter" | **Downgrade to verbose** | Diagnostic |
| `multi-source-loader.ts` | "Failed to load public source for alternative tagging" | **Downgrade to verbose** | Fallback behavior, not user-facing |
| `multi-source-loader.ts` | Source loading errors | **Keep as warn (buffered)** | User should know if a source failed to load |
| `source-fetcher.ts` | "Missing plugin name" / "unsafe characters" | **Keep as warn (buffered)** | Indicates marketplace data quality issue |
| `skill-metadata.ts` | "Invalid metadata.yaml at {path}" | **Downgrade to verbose** | Diagnostic; metadata falls back gracefully |
| `skill-metadata.ts` | "Malformed metadata.yaml — existing fields may be lost" | **Keep as warn (buffered)** | Risk of data loss |
| `matrix-health-check.ts` | "[matrix] {issue}" | **Downgrade to verbose** | Matrix health issues are diagnostic |
| `local-skill-loader.ts` | Unrecognized dirs, missing SKILL.md, invalid frontmatter | **Downgrade to verbose** | Diagnostic noise |

### Summary of dispositions

- **Remove (no buffer):** 3 messages in `edit.tsx` that are pure status flicker
- **Buffer as info:** 4 messages (edit.tsx skill counts + init.tsx dry-run header)
- **Keep as-is:** 2 messages in init.tsx early-return path (not affected by Ink)
- **Downgrade to verbose:** ~10 library warnings that are diagnostic noise
- **Keep as warn (buffered):** ~6 library warnings that indicate real problems

---

## Edge Cases

1. **No messages to show.** When the buffer is empty, the `<Static>` block renders nothing. Ink handles an empty `items` array gracefully (no output).

2. **Many messages.** If there are 10+ warnings (e.g., a broken marketplace with many invalid skills), the `<Static>` block will push the main wizard content down. Since `<Static>` is above the full-height `<Box>`, this could cause the wizard to be pushed partially offscreen. **Mitigation:** Cap the displayed messages (e.g., show the first 5 and "... and N more warnings. Run with --verbose for details."). This is a secondary concern — most users will see 0-2 messages.

3. **Terminal resize.** Ink re-renders on resize. `<Static>` content is persistent and unaffected by resize. The main `<Box>` recalculates `terminalHeight` via the `useTerminalDimensions` hook, which is the current behavior.

4. **Buffering left enabled.** If an error occurs between `enableBuffering()` and `disableBuffering()`, post-Ink messages could silently be swallowed. **Mitigation:** Call `disableBuffering()` in a `finally` block around the loading phase, or ensure `disableBuffering()` is called immediately after `drainBuffer()` before the `render()` call.

5. **CI environment.** Ink has a special CI code path (line 111-116 in `ink.js`) that writes `staticOutput` directly without clearing. The `<Static>` approach works correctly in CI because Ink handles it natively.

---

## Test Plan

### Unit tests for `utils/logger.ts`

- `enableBuffering()` causes `warn()` to push to buffer instead of console.warn
- `drainBuffer()` returns all buffered messages and empties the buffer
- `disableBuffering()` restores `warn()` to console.warn behavior
- `verbose()` is never affected by buffer mode
- `log()` is never affected by buffer mode
- Multiple `warn()` calls accumulate in order
- Draining twice returns empty array on second call

### Component tests for `wizard-layout.tsx`

- When `startupMessages` is undefined, no `<Static>` block renders
- When `startupMessages` is empty array, no `<Static>` block renders
- When `startupMessages` has warn items, they render with yellow color
- When `startupMessages` has error items, they render with red color
- When `startupMessages` has info items, they render with default color

### Integration behavior (manual verification)

- Run `cc edit` in a project — verify no messages flash and disappear
- Run `cc edit` with a source that generates warnings — verify warnings appear above the wizard and persist
- Run `cc init --dry-run` — verify "Preview" message appears above the wizard
- Run `cc init` in already-initialized project — verify message appears (this path is unaffected)
- Run `cc edit --verbose` — verify verbose messages still go to console
- Ctrl+C during loading — verify buffer is properly cleaned up

---

## Files Changed Summary

| File | Change | Scope |
|------|--------|-------|
| `src/cli/utils/logger.ts` | Add `StartupMessage` type, `enableBuffering()`, `drainBuffer()`, `disableBuffering()`. Modify `warn()` to check buffer mode. | Small (~20 lines added) |
| `src/cli/commands/edit.tsx` | Enable buffering before loading, drain after, pass messages to Wizard. Remove 3 status-flicker log calls. | Medium (~15 lines changed) |
| `src/cli/commands/init.tsx` | Enable buffering around `loadSkillsMatrixFromSource`, drain and pass to Wizard. | Small (~10 lines changed) |
| `src/cli/components/wizard/wizard.tsx` | Add `startupMessages` prop, thread to WizardLayout. | Small (~3 lines) |
| `src/cli/components/wizard/wizard-layout.tsx` | Import `Static`, add `startupMessages` prop, render `<Static>` block. | Small (~15 lines added) |
| `src/cli/lib/loading/loader.ts` | Downgrade ~5 `warn()` calls to `verbose()` | Small (~5 lines changed) |
| `src/cli/lib/loading/multi-source-loader.ts` | Downgrade 1 `warn()` call to `verbose()` | Trivial |
| `src/cli/lib/skills/skill-metadata.ts` | Downgrade 2 `warn()` calls to `verbose()` | Trivial |
| `src/cli/lib/matrix/matrix-health-check.ts` | Downgrade `warn()` to `verbose()` | Trivial |
| `src/cli/lib/skills/local-skill-loader.ts` | Downgrade `warn()` calls to `verbose()` | Trivial |

**Estimated total:** ~70 lines changed across 10 files. No new files. No new dependencies.
