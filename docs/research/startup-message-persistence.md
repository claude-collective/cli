# D-28: Startup Warning/Error Messages — Investigation

## Problem

When the CLI starts (`agentsinc init` or `agentsinc edit`), warning/error messages and the ASCII logo flash briefly then disappear. Ink's rendering wipes all previous terminal output.

## Root Cause

Two mechanisms combine to cause this:

### 1. Pre-Ink output is printed via `console.log`/`console.warn`

Before `render()` is called, the commands and loading modules print directly to the terminal:

- **`init.tsx`** (lines 78-106): dry-run messages, existing installation warnings, loading output
- **`edit.tsx`** (lines 73-101): loading status, skill counts, plugin discovery messages
- **`utils/logger.ts`** (line 33-35): `warn()` uses `console.warn()` — called from `multi-source-loader.ts`, `source-fetcher.ts`, `loader.ts`, `skill-metadata.ts`, `local-skill-loader.ts`, `matrix-health-check.ts`

### 2. Ink calls `clearTerminal` when output fills the screen

`wizard-layout.tsx:96` uses `height={terminalHeight}`, making the Ink output fill the entire terminal. This triggers a code path in Ink's renderer:

```javascript
// node_modules/ink/build/ink.js:121-125
if (outputHeight >= this.options.stdout.rows) {
    this.options.stdout.write(
        ansiEscapes.clearTerminal + this.fullStaticOutput + output
    );
}
```

`clearTerminal` sends `\x1b[2J\x1b[3J\x1b[H` — erasing the entire screen **and** scrollback buffer. This destroys all pre-Ink output on every render cycle.

### Logo

The logo is rendered inside the Ink component tree (`wizard-layout.tsx:97-101`) so it isn't lost permanently, but it flashes during initial render cycles as Ink clears and rewrites.

## Key Files

| File | Role |
|------|------|
| `src/cli/commands/init.tsx:67-143` | Init command — logo string (71-76), pre-Ink logs, `render()` (111-128) |
| `src/cli/commands/edit.tsx:58-131` | Edit command — pre-Ink logs (73-101), `render()` (111-128) |
| `src/cli/components/wizard/wizard-layout.tsx:96` | `height={terminalHeight}` triggers full-screen clear |
| `src/cli/utils/logger.ts:33-35` | `warn()` writes to stderr via `console.warn()` |
| `src/cli/lib/loading/multi-source-loader.ts` | Source loading warnings (lines 221, 272, 345) |
| `src/cli/lib/loading/source-fetcher.ts` | Marketplace validation warnings (lines 314, 319) |
| `src/cli/lib/skills/skill-metadata.ts` | Metadata warnings (lines 99, 126, 330) |
| `src/cli/lib/matrix/matrix-health-check.ts` | Matrix health warnings (line 28) |
| `node_modules/ink/build/ink.js:121-125` | The `clearTerminal` code path |
| `node_modules/ink/build/log-update.js` | Ink's `eraseLines` output management |

## Recommended Fix: Buffer + Ink `<Static>`

### Approach

1. **Buffer pre-Ink messages** — During the loading phase, collect warnings/errors into an array instead of printing them
2. **Pass buffer to Wizard** — The command passes the collected messages as a prop
3. **Render via Ink's `<Static>` component** — `<Static>` output is persistent and survives `clearTerminal` (Ink prepends `fullStaticOutput` after clearing)

### Why `<Static>` works

Even in the full-clear code path, Ink preserves static output:

```javascript
// ink.js:122-125
this.options.stdout.write(
    ansiEscapes.clearTerminal + this.fullStaticOutput + output
);
```

`this.fullStaticOutput` accumulates everything rendered via `<Static>` and is always re-written after a clear.

### Changes Required

**Command files (`init.tsx`, `edit.tsx`):**
- Replace `this.log()` / `this.warn()` calls during the pre-Ink phase with pushes to a message buffer
- Pass the buffer as a prop to `<Wizard>`

**`WizardLayout` (`wizard-layout.tsx`):**
- Add a `<Static>` block above the main layout that renders buffered messages

```tsx
import { Static, Box, Text } from "ink";

// Above the main layout Box
<Static items={startupMessages}>
  {(msg, index) => (
    <Box key={index}>
      <Text color={msg.level === "warn" ? "yellow" : msg.level === "error" ? "red" : undefined}>
        {msg.text}
      </Text>
    </Box>
  )}
</Static>
```

**Loading modules (`utils/logger.ts`, loading/ modules):**
- Support a buffered output mode so `warn()` can push to a collector instead of `console.warn()`
- One approach: a module-level message collector that can be enabled/drained

### Alternatives Considered

| Approach | Pros | Cons |
|----------|------|------|
| **Remove `height={terminalHeight}`** | Simplest change | Breaks full-screen wizard layout |
| **Move loading into Ink (async useEffect)** | No pre-Ink output at all | Largest refactor; moves business logic into React |
| **Custom Ink output wrapper** | Preserves architecture | Fights Ink internals; fragile |
