# Documentation Bible -- Agents Inc. CLI

> Standards for creating and maintaining AI-optimized documentation in `.ai-docs/`.
> Only consult this file when creating or updating documentation.

---

## Core Principles

**1. Investigation First** - Never document code you haven't read. Base all claims on actual file contents.

**2. AI-Centric Focus** - Structure for AI parsing: tables, explicit paths, code blocks. No tutorials or explanations of general concepts.

**3. Path Verification** - Every file path MUST be verified to exist before documenting. Every line number MUST be checked against source.

**4. Write Verification** - Re-read every file after editing. Never report success without verification.

**5. Progressive Loading** - Load only what you need. Start with `DOCUMENTATION_MAP.md`, then load specific docs as needed.

---

## Document Hierarchy

### The Actual Structure

```
.ai-docs/
  DOCUMENTATION_MAP.md          # THE INDEX - load this first
  architecture-overview.md      # System architecture, data flow, directory structure
  commands.md                   # All CLI commands, flags, exit codes
  component-patterns.md         # Ink component conventions, hooks, styling constants
  store-map.md                  # Zustand wizard store state, actions, consumers
  test-infrastructure.md        # Test helpers, factories, fixtures, E2E infrastructure
  type-system.md                # Union types, branded types, Zod schemas, typed helpers
  utilities.md                  # Shared utilities, constants, logger, fs helpers
  features/
    compilation-pipeline.md     # Liquid templates, agent assembly, output validation
    configuration.md            # Config loading, resolution hierarchy, config writer
    plugin-system.md            # Plugin discovery, manifest generation, installation
    skills-and-matrix.md        # Skills matrix, categories, resolution, source loading
    wizard-flow.md              # Wizard steps, state transitions, keyboard navigation
```

### Loading Decision Tree

```
Need to work on any area of the codebase?
|
+-> Load DOCUMENTATION_MAP.md FIRST (quick orientation, status of all docs)
|
+-> Need specific feature understanding?
|     +-> Load the relevant .ai-docs/ file for that area
|
+-> Need to add/update documentation?
      +-> Load this file (documentation-bible.md)
```

### What Each Document Covers

| Document                           | Covers                                                                            | Load When                   |
| ---------------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| `DOCUMENTATION_MAP.md`             | Index of all docs, validation history, staleness tracking                         | Always first                |
| `architecture-overview.md`         | Directory structure, data flow, technology stack, entry points                    | Understanding system design |
| `commands.md`                      | `init`, `edit`, `compile`, `config` commands with flags and exit codes            | Working on commands         |
| `component-patterns.md`            | Ink components, hooks, `CLI_COLORS`, `UI_SYMBOLS`, `CategoryOption` types         | Working on wizard UI        |
| `store-map.md`                     | `WizardState` shape, all actions, store consumers, initial state                  | Modifying wizard state      |
| `test-infrastructure.md`           | Factory functions, fixtures, `SKILLS.*` registry, E2E test structure              | Writing or updating tests   |
| `type-system.md`                   | `SkillId`, `Domain`, `AgentName` unions, Zod schemas, typed helpers               | Working with types          |
| `utilities.md`                     | `consts.ts`, `messages.ts`, `logger.ts`, `fs.ts`, `exec.ts`                       | Using shared utilities      |
| `features/compilation-pipeline.md` | Compiler stages, template resolution, output validation                           | Modifying compilation       |
| `features/configuration.md`        | Config resolution (flag > env > project > global > default), config writer        | Working on config system    |
| `features/plugin-system.md`        | Plugin discovery, manifest, installation, marketplace integration                 | Working on plugins          |
| `features/skills-and-matrix.md`    | Skills matrix loading, category resolution, source switching                      | Working on skills/matrix    |
| `features/wizard-flow.md`          | Wizard steps (stack -> skills -> sources -> agents -> confirm), state transitions | Modifying wizard flow       |

---

## Documentation Standards

### Format Rules

**Tables over prose** - AI agents extract structured data more reliably from tables.

```markdown
GOOD:
| File | Purpose |
|------|---------|
| `src/cli/lib/compiler.ts` | Main compilation: Liquid templates, agent assembly |

BAD:
The compiler is located in the lib directory and handles Liquid templates.
```

**Absolute paths** - Always use paths from project root, never relative references.

```markdown
GOOD: `src/cli/lib/compiler.ts`
BAD: "the compiler file"
BAD: `./lib/compiler.ts`
```

**Code blocks over descriptions** - Show the actual pattern, not an explanation of it.

**Consistent terminology** - Use one term for each concept throughout all docs.

### Line Numbers and Staleness

Line numbers in documentation go stale as code changes. The validation process handles this:

- **Line numbers are approximate** - They indicate where to look, not exact positions
- **Validated dates** track when line numbers were last confirmed against source
- **DOCUMENTATION_MAP.md** tracks validation status for every document
- **Volatile areas** (store-map, wizard-flow) need validation every 7-14 days
- **Stable areas** (architecture, utilities) can go 30 days between validations

### Validation Process

The project uses adversarial audits to keep documentation accurate. See the Validation History section of `DOCUMENTATION_MAP.md` for examples.

**Validation steps:**

1. Read every claim in the document (file paths, line numbers, function signatures, counts)
2. Verify each claim against actual source code using Read/Grep/Glob tools
3. Fix errors, add omissions
4. Update the "Last Validated" date in `DOCUMENTATION_MAP.md`

**What to verify:**

| Claim Type                 | How to Verify                                         |
| -------------------------- | ----------------------------------------------------- |
| File path                  | Read the file -- does it exist?                       |
| Line number                | Read the file at that line -- does the content match? |
| Function signature         | Read the source -- does the signature match exactly?  |
| Count (e.g., "10 entries") | Grep/count the actual entries                         |
| Type definition            | Read the type file -- do fields match?                |
| Data flow description      | Trace through the actual code path                    |

---

## Progressive Loading

### The Principle

AI agents have limited context windows. Load documentation progressively -- start with the index, then load specific docs as needed.

### Loading Tiers

| Tier    | What to Load             | When                                                               |
| ------- | ------------------------ | ------------------------------------------------------------------ |
| **1st** | `DOCUMENTATION_MAP.md`   | Always first -- shows what exists and its validation status        |
| **2nd** | Relevant root-level doc  | When working on that area (e.g., `commands.md` for command work)   |
| **3rd** | Relevant feature doc     | When working on that subsystem (e.g., `features/configuration.md`) |
| **4th** | `documentation-bible.md` | Only when creating or updating documentation                       |

### Cross-Reference Instead of Duplicate

If information exists in `.claude/skills/`, reference it -- don't duplicate it.

| Should be in `.ai-docs/`   | Should be in `.claude/skills/`        |
| -------------------------- | ------------------------------------- |
| File locations and paths   | Coding patterns and conventions       |
| State shape and actions    | Best practices (React, Zustand, etc.) |
| Data flow through codebase | Anti-patterns to avoid                |
| Component relationships    | Testing patterns                      |

---

## Creating New Documentation

### When to Create Documentation

- New feature or subsystem added to the codebase
- Existing feature significantly restructured
- Validation audit reveals undocumented area

### When NOT to Create Documentation

- Information is derivable from reading the code directly
- Information duplicates what's in `.claude/skills/`
- Information is general knowledge (how TypeScript works, how Zustand works)
- The area is small enough that a comment in CLAUDE.md suffices

### Template: New Feature Doc

For a new feature doc in `.ai-docs/features/`:

```markdown
# [Feature Name]

**Last Updated:** [YYYY-MM-DD]

## Overview

**Purpose:** [One sentence]
**Entry Point:** `src/cli/[path]`
**Key Files:** [count]

## File Structure

| File                    | Purpose     | Line Range     |
| ----------------------- | ----------- | -------------- |
| `src/cli/lib/[file].ts` | Description | Relevant lines |

## Data Flow

1. **Step 1** -- `file.ts` does X
2. **Step 2** -- `other-file.ts` does Y

## Key Types

| Type       | File            | Line | Purpose     |
| ---------- | --------------- | ---- | ----------- |
| `TypeName` | `types/file.ts` | :XX  | Description |

## Key Functions

| Function       | File          | Line | Signature                     |
| -------------- | ------------- | ---- | ----------------------------- |
| `functionName` | `lib/file.ts` | :XX  | `(param: Type) => ReturnType` |
```

### Template: New Reference Doc

For a new root-level reference doc in `.ai-docs/`:

```markdown
# [Area Name]

**Last Updated:** [YYYY-MM-DD]

## Overview

[Brief description of what this documents]

## [Main Section]

| Item   | Location       | Purpose     |
| ------ | -------------- | ----------- |
| `item` | `src/cli/path` | Description |

## [Additional Sections as needed]
```

### After Creating a New Doc

1. Add an entry to `DOCUMENTATION_MAP.md` with status `[DONE]` and current date
2. Update the Coverage Metrics section if source file count changed
3. Set a validation schedule (7 days for volatile, 14-30 days for stable)

---

## Quality Standards

### What Makes Good AI Documentation

- **Specific** -- every claim has a file path and line reference
- **Verifiable** -- every claim can be checked against source code
- **Structured** -- tables and code blocks, not prose
- **Current** -- validation dates are recent, line numbers match source
- **Minimal** -- documents WHERE things are and WHAT they do, not WHY or HOW in general

### What to Avoid

| Anti-Pattern       | Example                                           | Fix                                                                                         |
| ------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Vague claims       | "The codebase uses Zustand"                       | "Wizard state: `src/cli/stores/wizard-store.ts`, accessed via `useWizardStore()` selectors" |
| Tutorial content   | "Zustand is a lightweight state library..."       | Remove -- agents already know what Zustand is                                               |
| Missing paths      | "Exit codes are defined as constants"             | "`EXIT_CODES` in `src/cli/lib/exit-codes.ts`"                                               |
| Invented examples  | Code not from actual source                       | Use actual code with file:line references                                                   |
| General knowledge  | "oclif is a framework for building CLIs..."       | Document THIS project's oclif patterns only                                                 |
| Duplicating skills | Repeating Zustand patterns from `.claude/skills/` | Cross-reference: "See skill: web-state-zustand"                                             |

### Self-Correction Triggers

If you notice yourself doing any of these, stop and correct:

| Trigger                                              | Correction                                             |
| ---------------------------------------------------- | ------------------------------------------------------ |
| Documenting without reading code first               | Stop. Read the actual source files.                    |
| Using generic descriptions instead of file paths     | Stop. Replace with specific paths and line numbers.    |
| Describing patterns based on assumptions             | Stop. Verify with Grep/Glob/Read.                      |
| Writing tutorial-style content                       | Stop. Focus on WHERE things are and WHAT they do.      |
| Duplicating content from `.claude/skills/`           | Stop. Add a cross-reference instead.                   |
| Reporting success without re-reading the file        | Stop. Use Read tool to confirm changes were written.   |
| Documenting store methods without reading the source | Stop. Read actual source to get accurate signatures.   |
| Skipping validation date updates                     | Stop. Update "Last Validated" in DOCUMENTATION_MAP.md. |

---

## Critical Reminders

**(You MUST read actual code files before documenting -- never document based on assumptions)**

**(You MUST verify every file path and line number against actual source code)**

**(You MUST re-read files after editing to verify changes were written)**

**(You MUST update DOCUMENTATION_MAP.md when creating or modifying docs)**

**(You MUST NOT duplicate HOW patterns from .claude/skills/ -- cross-reference instead)**

**(You MUST load DOCUMENTATION_MAP.md first, not this file, unless you are updating documentation)**
