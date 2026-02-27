# D-24: Configurable Documentation File Locations for Agent Compilation

**Status:** Deferred — convention-only, no code changes needed
**Priority:** S (Small)
**Depends on:** None

---

## Open Questions (All Resolved)

1. **Which config file does `documentation` belong in?**
   **RESOLVED:** N/A — no config needed. The convention is filename-based discovery, not configuration.

2. **How are documentation references detected in agent source files?**
   **RESOLVED:** They are NOT detected or scanned. Agents reference docs by filename only (e.g., "read `prompt-bible.md`"). It's up to the consuming app to include matching files in a standard location (e.g., `.ai-docs/`). No compilation-time injection.

3. **Where should injected documentation content appear?**
   **RESOLVED:** N/A — no injection. There is no concept of injected documentation. Agents find docs at runtime via their file tools.

4. **What if a doc file is referenced but not found?**
   **RESOLVED:** Doesn't matter. If the file isn't there, the agent simply doesn't find it. No error, no warning.

5. **Should the feature support glob patterns or directory scanning?**
   **RESOLVED:** No. No scanning at all. Pure filename-based convention.

---

## Convention (No Code Changes)

The approach is purely convention-based:

1. **Agents reference docs by filename only** — e.g., "read `prompt-bible.md`", "see `claude-architecture-bible.md`". They already do this today.
2. **Consuming apps put matching files in a standard location** — e.g., `.ai-docs/` or project root. The filenames must match what agents reference.
3. **If a referenced file isn't found, that's fine** — no error, no warning. The agent simply doesn't find it at runtime.
4. **No compilation-time injection** — docs are NOT scanned, parsed, or appended during compilation. Agents find docs at runtime via their file tools (Read, Glob).
5. **No config changes** — no `documentation` field in `ProjectSourceConfig`, no schema changes, no compiler wiring.

### What Already Works

Agent source files already reference docs by filename:

- `src/agents/meta/agent-summoner/critical-requirements.md:3` → `claude-architecture-bible.md`
- `src/agents/meta/skill-summoner/workflow.md:63` → `prompt-bible.md`
- `src/agents/meta/documentor/workflow.md:31` → `documentation-bible.md`

This project already has `.ai-docs/` with documentation files. The convention is already in place.

### No Files Changed

This task requires no code changes. The convention is already working. If anything, this is a documentation task to formalize the convention for consuming apps.

---

**This task is effectively complete as a convention. Deferred from active development since no implementation is needed.**
