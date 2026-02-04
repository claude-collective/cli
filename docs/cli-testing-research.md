# CLI Testing Research: Integration Test Design

## 1. CLI Commands and User Journeys

### 1.1 Command Categories

#### **Initialization & Setup** (Interactive Commands)

- **`cc init`** - Initialize Claude Collective in a project
  - User journey: Select skills → Configure agents → Choose installation mode (plugin/local) → Write config
  - Key interactions: Wizard UI (Ink-based), source loading, skill selection
  - Outcomes: Create `.claude/config.yaml`, install plugin or copy skills locally

- **`cc edit`** - Edit skills in an existing installation
  - User journey: Interactive skill management, add/remove skills
  - Similar to init but modifies existing setup

#### **Configuration Management** (Read-Only)

- **`cc config`** (aliases: `cc config:show`) - Display effective configuration
  - User journey: Single command, no interaction
  - Outputs: All config layers (env, project, global, default)

- **`cc config:set`** - Set global config values
  - User journey: Single command with arguments
  - Sets: `source`, `author`, `marketplace`, `agents_source`

- **`cc config:get`** - Get specific config value
  - User journey: Query single value

- **`cc config:path`** - Show config file paths

- **`cc config:unset`** - Unset global config values

- **`cc config:set-project`** - Set project-specific config (stored in `.claude-collective/config.yaml`)

#### **Compilation & Build**

- **`cc compile`** - Compile agents from skills
  - Two modes:
    - **Plugin mode**: Compile to `~/.claude/plugins/claude-collective/`
    - **Custom output**: `--output` flag for custom directory
  - User journey: Discovery → Resolution → Compilation → Validation
  - Key files generated: Agent markdown files with skill references

- **`cc validate`** - Validate YAML files or plugins
  - Modes: Schema validation (default) or plugin validation (`--plugins`)
  - User journey: Single command, generates report

#### **Information Retrieval** (Read-Only)

- **`cc list`** (aliases: `ls`) - Show plugin information
  - Displays: Plugin manifest, version, agents, skills

- **`cc search <query>`** - Search available skills
  - Filters: By name, description, category, tags
  - Optional: `--category` flag for filtering
  - User journey: Enter query → View results table

- **`cc info <skill>`** - Show detailed skill information
  - Displays: Metadata, relationships, content preview
  - Optional: `--preview` flag to show SKILL.md content

- **`cc doctor`** - Diagnose configuration issues
  - Checks: Config valid, skills resolved, agents compiled, no orphans, source reachable
  - User journey: Single command, outputs checklist with pass/fail/warn

#### **Version Management**

- **`cc version:show`** - Show current version

- **`cc version:bump`** - Bump plugin version (major/minor/patch)
  - User journey: Automatic or manual selection

- **`cc version:set <version>`** - Set specific version

#### **Difference & Update Checking**

- **`cc diff [skill]`** - Show differences between local and source skills
  - For forked/modified skills only
  - User journey: Display unified diff with color coding

- **`cc outdated`** - Check for outdated skills
  - Compares local skills to source versions
  - Shows: Status (current/outdated/local-only)

#### **Advanced Operations**

- **`cc eject <type>`** - Extract bundled content for customization
  - Types: `templates`, `config`, `skills`, `agents`, `all`
  - User journey: Select type → Copy to project → Customize locally

- **`cc uninstall`** - Remove Claude Collective from project

- **`cc update`** - Update skills/agents/plugins

- **`cc build:plugins`** - Build marketplace plugins (for maintainers)

---

## 2. Stack/Skill Resolution Flow

### 2.1 Core Resolution Process

```
User Input (command flags/config)
    ↓
[Source Resolution]
  ├─ Check: --source flag
  ├─ Check: CC_SOURCE env var
  ├─ Check: .claude-collective/config.yaml
  ├─ Check: ~/.claude-collective/config.yaml
  └─ Use: Default (github:claude-collective/skills)
    ↓
[Source Loading]
  ├─ Local source: Load from filesystem
  │   └─ Load skills-matrix.yaml → MergedSkillsMatrix
  ├─ Remote source: Fetch & cache
  │   ├─ Via giget (GitHub, npm, etc.)
  │   └─ Extract skills-matrix.yaml → MergedSkillsMatrix
  └─ Merge with local skills (.claude/skills/)
    ↓
[Skills Matrix]
  ├─ All available skills indexed by ID
  ├─ Aliases mapping (short name → full ID)
  ├─ Relationship metadata (conflicts, requires, recommends)
  └─ Categories and suggested stacks
    ↓
[Stack Loading] (if stack-based initialization)
  ├─ Load stack config.yaml
  ├─ Extract skill references
  ├─ Load agent definitions
  └─ Resolve agent-to-skill mappings
    ↓
[Compilation]
  ├─ Load SKILL.md for each skill
  ├─ Generate agent markdown files
  ├─ Embed preloaded skills
  ├─ Reference dynamic skills
  └─ Create plugin.json manifest
```

### 2.2 Key Files in Resolution

**Matrix Files:**

- Source: `skills-matrix.yaml` (defines all skills, categories, relationships)
- In memory: `MergedSkillsMatrix` (combined source + local skills)

**Stack Files:**

- Location: `src/stacks/{stack-id}/config.yaml` in source repo
- Contains: Skill assignments, agent list, philosophy, framework

**Local Skills:**

- Location: `.claude/skills/` (or `.claude-collective/skills/` in config)
- Structure: `{skill-name}/SKILL.md` + `metadata.yaml`
- Discovered by: `discoverLocalSkills()` function

**Agent Definitions:**

- Location: Agent partials in source (e.g., `src/agents/` in CLI repo)
- Contains: Agent title, description, tools, model, permission_mode
- Used for: Compilation templates

### 2.3 Skill ID Format

Skills use **canonical IDs** with author suffix:

```
Format: [category/]skill-name (@author)

Examples:
  - "react (@vince)"
  - "zustand (@vince)"
  - "frontend/react (@vince)"
  - "backend/api/hono (@vince)"
  - "better-auth+drizzle+hono (@vince)"  [composite skills]
```

**Alias mapping:**

- Short alias: `"react"` → Full ID: `"react (@vince)"`
- Used in: Config files, CLI arguments, search

---

## 3. What Needs to Be Mocked for Integration Testing

### 3.1 High-Level Dependencies to Mock

#### **1. Giget (Source Fetching)**

**Why mock:** Avoids network calls, guarantees consistent test data

```typescript
// Current: Uses giget to fetch from GitHub
// Mock: Return fixture data from test directory
// Impacts: All commands using --source flag

// Test scenarios:
- Local filesystem source (no mock needed)
- Remote GitHub source (mock giget)
- Invalid/unreachable source (mock rejection)
- Network timeout (mock delay/error)
```

#### **2. Ink Interactive UI**

**Why mock:** CLI rendering doesn't matter for logic, hard to test interactively

```typescript
// Current: Ink-based interactive UI for init/edit
// Mock: Simulate user inputs, capture output
// Commands: init, edit, uninstall, update

// Test scenarios:
- User selects skills (mock prompt responses)
- User confirms installation
- Cancel operation mid-way
```

#### **3. Claude CLI Integration**

**Why mock:** Avoid requiring Claude Code to be installed

```typescript
// Current: exec() calls to "claude plugin install"
// Mock: Capture command, verify arguments
// Impacts: init, update, uninstall (anything that installs plugins)

// Test scenarios:
- Successful installation
- Plugin already exists (error)
- Installation directory doesn't exist
- Permission denied
```

#### **4. File System (Partial)**

**Why mock:** Some tests, not all (some use real temp dirs)

```typescript
// Can use: os.tmpdir() + mkdtemp() for real FS
// But mock when:
- Testing permission errors
- Testing missing files
- Testing large directory structures (performance)
- Testing recovery from partial failures

// Current approach in integration.test.ts:
- Creates real temp directories
- Clean up in afterEach()
- Good for full E2E testing
```

#### **5. Configuration Files**

**Why mock:** Avoid polluting real ~/.claude-collective/

```typescript
// Current: Reads from ~/.claude-collective/config.yaml
// Mock strategy:
- Set CC_SOURCE env var instead of writing config file
- Or use temporary config directory in test
- Restore env/files in afterEach()
```

---

## 4. Fixture Requirements (Minimal Test Source Structure)

### 4.1 Test Fixtures Directory Layout

```
test-fixtures/
├─ skills-matrix.yaml              # Single source of truth for skills
├─ src/
│  ├─ skills/
│  │  ├─ frontend/
│  │  │  ├─ react/
│  │  │  │  ├─ SKILL.md            # With: name, description frontmatter
│  │  │  │  └─ metadata.yaml       # author, category, tags
│  │  │  └─ zustand/
│  │  │     ├─ SKILL.md
│  │  │     └─ metadata.yaml
│  │  ├─ backend/
│  │  │  └─ hono/
│  │  │     ├─ SKILL.md
│  │  │     └─ metadata.yaml
│  │  └─ testing/
│  │     └─ vitest/
│  │        ├─ SKILL.md
│  │        └─ metadata.yaml
│  ├─ stacks/
│  │  └─ test-stack/
│  │     └─ config.yaml
│  └─ agents/                      # Agent partials/templates
│     ├─ web-developer/
│     │  ├─ intro.md
│     │  ├─ workflow.md
│     │  └─ agent.yaml
│     └─ api-developer/
│        ├─ intro.md
│        └─ agent.yaml
└─ .claude-collective/             # For config tests
   └─ config.yaml
```

### 4.2 Minimal SKILL.md Template

```markdown
---
name: react
description: React framework for building UIs
---

# React

## Overview

React is a JavaScript library for building user interfaces with components.

## Key Capabilities

- Component-based architecture
- Virtual DOM
- JSX syntax
```

### 4.3 Minimal metadata.yaml Template

```yaml
version: 1
author: "@test"
category: frontend/framework
tags:
  - react
  - frontend
  - ui
  - component
```

### 4.4 Minimal Stack Config Template

```yaml
name: test-stack
version: 1.0.0
description: A test stack for integration testing
author: "@test"

skills:
  - id: "react (@test)"
  - id: "zustand (@test)"
  - id: "vitest (@test)"

agents:
  - web-developer
  - api-developer

agent_skills:
  web-developer:
    default:
      - id: "react (@test)"
      - id: "zustand (@test)"
  api-developer:
    default:
      - id: "hono (@test)"
      - id: "vitest (@test)"
```

---

## 5. Verification Points (What to Check in Tests)

### 5.1 Compilation Verification

**After `cc compile`:**

1. **Output directory structure**
   - Agent markdown files exist: `.claude/agents/{agent-name}.md`
   - Plugin manifest exists: `.claude/plugins/claude-collective/.claude-plugin/plugin.json`
   - README exists (if in custom output mode)

2. **Agent file contents**
   - Frontmatter present and valid YAML
   - Skill references in markdown
   - Code blocks intact (no mangling by templating)

3. **Plugin manifest**
   - Version is semantic (X.Y.Z)
   - All agents listed (if `agents` field present)
   - Name matches convention

4. **Compiled agent structure**

   ```
   # Agent Name

   ---
   name: agent-id
   description: Agent description
   tools: Read, Write, Edit, Grep
   model: opus
   skills: [skill1, skill2]
   ---

   # [Critical Requirements]
   [Content]

   # [Skill Definitions]
   [Embedded skill content for preloaded skills]

   # [Critical Reminders]
   [Content]
   ```

### 5.2 Source Loading Verification

**After loading skills:**

1. **Matrix loaded correctly**
   - All skills present
   - Aliases resolve correctly
   - Categories parsed
   - Relationships loaded

2. **Local skills merged**
   - Local skills appear in matrix
   - Local skills override remote (if duplicate ID)
   - Count matches expected

3. **Metadata validated**
   - Required fields present
   - No corrupted YAML
   - Author field accessible

### 5.3 Configuration Verification

**After config operations:**

1. **Config files written**
   - `.claude-collective/config.yaml` exists (if set)
   - Format is valid YAML
   - Contains expected keys

2. **Config layers respected**
   - Flag overrides env
   - Env overrides project
   - Project overrides global
   - Global overrides default

### 5.4 File I/O Verification

**Check files created/modified:**

1. **Skill files**
   - SKILL.md readable and parseable
   - metadata.yaml has required keys
   - File permissions allow read/write

2. **Config files**
   - Valid YAML syntax
   - No BOM or encoding issues
   - Backup created (if overwriting)

3. **Agent files**
   - No corrupt markdown
   - Links resolve (if relative)
   - Code blocks formatted correctly

---

## 6. Test Execution Strategy

### 6.1 Test Isolation

**Per-test setup:**

```typescript
beforeEach(async () => {
  // Create isolated temp directories
  testDirs = await createTestDirs();

  // Set up minimal fixtures
  await setupTestFixtures(testDirs);

  // Override env vars to point to test sources
  process.env.CC_SOURCE = path.join(testDirs.tempDir, "fixtures");
  process.env.HOME = testDirs.tempDir; // Isolate global config
});

afterEach(async () => {
  // Clean up all side effects
  await cleanupTestDirs(testDirs);
  delete process.env.CC_SOURCE;
  delete process.env.CC_PLUGINS;
});
```

**Per-test isolation:**

- Each test gets fresh temp directory
- Each test uses isolated `HOME` (no global config pollution)
- Each test starts with known fixture state
- No shared state between tests

### 6.2 Mock Injection Strategy

**Mock file system (when needed):**

```typescript
import { vi } from "vitest";

// Mock specific FS operations
vi.mock("../utils/fs", async () => {
  const actual = await vi.importActual("../utils/fs");
  return {
    ...actual,
    fileExists: vi.fn(actualFileExists),
    readFile: vi.fn(actualReadFile),
  };
});
```

**Mock external commands:**

```typescript
// Mock Claude CLI invocation
vi.mock("../utils/exec", () => ({
  claudePluginInstall: vi.fn(() => Promise.resolve({ success: true })),
}));
```

**Mock network (giget):**

```typescript
vi.mock("giget", () => ({
  downloadTemplate: vi.fn(async (source, dir) => {
    // Copy from test fixtures instead
    await copy(fixturesDir, dir);
  }),
}));
```

---

## 7. Potential Blockers and Concerns

### 7.1 Technical Blockers

#### **1. Ink-based Interactive UI (init, edit commands)**

- **Issue:** Difficult to test programmatically
- **Current approach in codebase:** Commands use Ink for interactive prompts
- **Testing challenge:** Can't simulate user input to Ink components easily
- **Solution options:**
  - A) Refactor UI logic into separate `getWizardChoices()` function
  - B) Mock Ink and capture render calls
  - C) Create separate testable `processSelection()` function
  - D) Skip UI testing, test business logic separately

#### **2. Claude CLI Integration**

- **Issue:** Tests require `claude` CLI installed to test plugin installation
- **Concern:** Not all environments have Claude Code installed
- **Solution:** Mock `claudePluginInstall()` function, test command arguments, not actual installation

#### **3. Skill Matrix Loading from Remote Sources**

- **Issue:** Tests rely on downloading from GitHub
- **Concern:** Network dependency, rate limiting, slow tests
- **Solution:** Use local fixtures + mock giget, accept one "real" remote test as integration test

### 7.2 Testing Concerns

#### **1. Test Data Consistency**

- **Issue:** Tests need specific skill/agent combinations
- **Concern:** Fixture data must stay in sync with code expectations
- **Solution:** Version fixtures, document required fields, validate in setup

#### **2. Plugin Directory Location**

- **Issue:** Plugin dir is `~/.claude/plugins/claude-collective/`
- **Concern:** Can't test actual installation in isolated environment
- **Solution:** Mock Claude CLI calls, test path construction, verify command arguments

---

## 8. CLI Command User Journey Test Scenarios

### 8.1 Happy Path Scenarios

**Scenario 1: Full Init → Compile → Deploy**

```
1. cc init --source test-fixtures/
   - Select React + Zustand + Vitest
   - Choose Local Mode (for testing)
   → Creates .claude/config.yaml
   → Copies skills to .claude/skills/

2. cc compile
   → Discovers skills from local
   → Generates agent markdown files
   → Outputs to .claude/agents/

3. cc list
   → Shows installed plugin and agent count

Verify:
- Config file exists with selected skills
- Agent files compiled
- Skill files copied
```

**Scenario 2: Search → Info → Add Local Skill**

```
1. cc search react
   → Shows React skill with description

2. cc info react
   → Shows full metadata, relationships, preview

Verify:
- Search results accurate
- Info output complete
```

**Scenario 3: Source Management**

```
1. cc config set source=/custom/path
   → Saves to ~/.claude-collective/config.yaml

2. cc compile --source /other/path
   → Uses flag source, not saved config

3. cc config show
   → Shows all config layers with precedence

Verify:
- Config file created
- Flag overrides saved config
- Effective config accurate
```

### 8.2 Error Path Scenarios

**Scenario 1: Invalid Skill Selection**

```
1. cc init --source test-fixtures/
2. Manually edit config to add non-existent skill "fake-skill"
3. cc compile
   → Error: "Skill 'fake-skill' not found"
   → Doctor identifies missing skill

Verify:
- Clear error message
- Doctor check fails with helpful message
- Config file remains intact
```

**Scenario 2: Missing Source**

```
1. CC_SOURCE=/nonexistent/path cc compile
   → Error: "Source not found"
   → Doctor suggests checking source config

Verify:
- Error clear
- Doctor diagnoses source issue
- No partial files created
```

---

## 9. Summary: What to Test

### Priority 1 (Core Workflows)

- [ ] `cc compile` - Agent generation from skills
- [ ] `cc validate` - Plugin and schema validation
- [ ] `cc search` - Skill discovery
- [ ] Source resolution and loading
- [ ] Skills matrix loading and merging

### Priority 2 (Configuration)

- [ ] `cc config` commands (get, set, show, path)
- [ ] Configuration precedence (flag, env, project, global, default)
- [ ] Local skills merged with source skills

### Priority 3 (Information)

- [ ] `cc info` - Skill details and preview
- [ ] `cc doctor` - Configuration diagnosis
- [ ] `cc list` - Plugin information
- [ ] `cc diff` - Local vs source comparison
- [ ] `cc outdated` - Update checking

### Priority 4 (Advanced)

- [ ] `cc eject` - Content extraction
- [ ] `cc compile --output` - Custom output directory
- [ ] Stack compilation (`cc build:stack`)
- [ ] Error recovery and partial failures

### Priority 5 (Interactive - More Complex)

- [ ] `cc init` - Full wizard flow (requires Ink testing)
- [ ] `cc edit` - Wizard with pre-selections
- [ ] `cc uninstall` - Confirmation dialog
- [ ] `cc update` - Update workflow

---

## 10. Recommended Test File Organization

```
src/cli/lib/__tests__/
├─ fixtures/
│  ├─ create-test-source.ts       # Helper to create temp source
│  ├─ mock-matrix.ts              # Matrix fixture data
│  └─ mock-skills.ts              # Skill fixture data
├─ helpers.ts                     # Existing helpers
├─ test-fixtures.ts               # Existing fixture helpers
├─ integration.test.ts            # Existing (skill/stack pipeline)
├─ commands/
│  ├─ compile.test.ts             # cc compile tests
│  ├─ validate.test.ts            # cc validate tests
│  ├─ search.test.ts              # cc search tests
│  ├─ info.test.ts                # cc info tests
│  ├─ doctor.test.ts              # cc doctor tests
│  ├─ list.test.ts                # cc list tests
│  ├─ diff.test.ts                # cc diff tests
│  ├─ outdated.test.ts            # cc outdated tests
│  ├─ eject.test.ts               # cc eject tests
│  ├─ config/
│  │  ├─ get.test.ts              # cc config get tests
│  │  ├─ set.test.ts              # cc config set tests
│  │  ├─ show.test.ts             # cc config show tests
│  │  └─ path.test.ts             # cc config path tests
│  ├─ version/
│  │  ├─ bump.test.ts             # cc version bump tests
│  │  ├─ set.test.ts              # cc version set tests
│  │  └─ show.test.ts             # cc version show tests
│  └─ build/
│     ├─ stack.test.ts            # cc build:stack tests
│     ├─ plugins.test.ts          # cc build:plugins tests
│     └─ marketplace.test.ts      # cc build:marketplace tests
└─ user-journeys/
   ├─ init-compile-flow.test.ts   # Full init → compile → verify
   ├─ config-precedence.test.ts   # Config layer tests
   └─ error-recovery.test.ts      # Error path tests
```

---

## 11. Test Code Sharing Patterns

### 11.1 Page Object Model (POM) Equivalent for CLI Tests

The Page Object Model from UI testing (Playwright, Selenium) does not have a direct equivalent in CLI testing. However, there are analogous patterns:

**Command Object Pattern:**
Instead of page objects that encapsulate page interactions, CLI tests use **command helpers** that encapsulate command execution and response parsing.

```typescript
// Example: Command helper (equivalent to Page Object)
export class ConfigCommands {
  constructor(private cliRoot: string) {}

  async get(key: string) {
    const { stdout, error } = await runCommand(["config:get", key], {
      root: this.cliRoot,
    });
    return { value: stdout.trim(), error };
  }

  async set(key: string, value: string) {
    const { stdout, error } = await runCommand(["config:set", key, value], {
      root: this.cliRoot,
    });
    return { success: !error, output: stdout };
  }

  async show() {
    const { stdout } = await runCommand(["config:show"], {
      root: this.cliRoot,
    });
    return this.parseConfigOutput(stdout);
  }

  private parseConfigOutput(stdout: string): Record<string, string> {
    // Parse structured output into object
    // ...
  }
}
```

**Why oclif projects typically don't use this:**

1. Commands are already encapsulated by oclif's command structure
2. `runCommand()` provides a consistent interface
3. CLI output is usually simple enough to assert directly

**Recommendation for this codebase:** Keep using `runCliCommand()` wrapper function but extract response parsing into shared helpers when patterns emerge.

### 11.2 Reusable Test Fixtures

**Current State in This Codebase:**

The codebase already has good fixture patterns in place:

| File                             | Purpose                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| `helpers.ts`                     | Mock data creators (`createMockSkill`, `createMockMatrix`, etc.) |
| `test-fixtures.ts`               | Pre-defined skill/category constants and specialized creators    |
| `fixtures/create-test-source.ts` | Full test source directory creation                              |

**Factory Functions Pattern:**

The existing `createMockSkill()`, `createMockMatrix()`, etc. are factory functions - this is the correct pattern.

```typescript
// Existing pattern (good)
export function createMockSkill(
  id: string,
  category: string,
  overrides?: Partial<ResolvedSkill>,
): ResolvedSkill {
  return {
    id,
    name: id.replace(/ \(@.*\)$/, ""),
    // ... defaults
    ...overrides,
  };
}
```

**Builder Pattern Alternative:**

For more complex objects, a builder pattern can improve readability:

```typescript
// Builder pattern for complex objects
export class SkillBuilder {
  private skill: Partial<ResolvedSkill> = {};

  withId(id: string): this {
    this.skill.id = id;
    this.skill.name = id.replace(/ \(@.*\)$/, "");
    return this;
  }

  inCategory(category: string): this {
    this.skill.category = category;
    return this;
  }

  withTags(...tags: string[]): this {
    this.skill.tags = tags;
    return this;
  }

  conflictsWith(...skills: string[]): this {
    this.skill.conflictsWith = skills;
    return this;
  }

  build(): ResolvedSkill {
    return createMockSkill(this.skill.id!, this.skill.category!, this.skill);
  }
}

// Usage
const skill = new SkillBuilder()
  .withId("react (@vince)")
  .inCategory("frontend/framework")
  .withTags("react", "ui")
  .conflictsWith("vue (@vince)")
  .build();
```

**Recommendation:** Factory functions are sufficient for current needs. Consider builders only if test setup becomes complex with many relationships.

### 11.3 Fixture Data Management

**Shared vs Isolated Fixtures:**

| Approach                | Use Case                                     | Current Usage                    |
| ----------------------- | -------------------------------------------- | -------------------------------- |
| **beforeAll shared**    | Expensive setup (e.g., compiling all skills) | `integration.test.ts`            |
| **beforeEach isolated** | Tests that modify state                      | Command tests                    |
| **Constants**           | IDs and values that never change             | `TEST_SKILLS`, `TEST_CATEGORIES` |

**Current Implementation (good):**

```typescript
// test-fixtures.ts - Constants for IDs
export const TEST_SKILLS = {
  REACT: "react (@vince)",
  ZUSTAND: "zustand (@vince)",
  // ...
} as const;

// Pre-built factory functions for common skills
export function createTestReactSkill(overrides?: Partial<ResolvedSkill>) {
  return createMockSkill(TEST_SKILLS.REACT, TEST_CATEGORIES.FRAMEWORK, {
    alias: "react",
    name: "React",
    // ...
    ...overrides,
  });
}
```

**Recommendation:** The current pattern is good. Keep constants centralized and use factory functions for creation.

### 11.4 Constant Management

**Problem:** Hardcoded IDs, paths, and magic strings scattered across tests.

**Current Solution (already implemented):**

```typescript
// test-fixtures.ts
export const TEST_SKILLS = {
  REACT: "react (@vince)",
  ZUSTAND: "zustand (@vince)",
  // ...
} as const;

export const TEST_CATEGORIES = {
  FRAMEWORK: "frontend/framework",
  STATE: "frontend/state",
  // ...
} as const;

// helpers.ts
export const TEST_AUTHOR = "@test";
```

**Gaps to Address:**

1. **CLI_ROOT path** - Duplicated in each test file:

   ```typescript
   // Current (duplicated)
   const CLI_ROOT = path.resolve(__dirname, "../../../../..");
   ```

2. **Expected output strings** - Hardcoded in assertions:
   ```typescript
   // Current
   expect(stdout).toContain("Configuration File Paths");
   ```

**Proposed Additional Constants:**

```typescript
// test-constants.ts (new file or add to helpers.ts)
export const CLI_ROOT = path.resolve(__dirname, "../../../../..");

export const OUTPUT_STRINGS = {
  CONFIG_TITLE: "Claude Collective Configuration",
  CONFIG_PATHS_TITLE: "Configuration File Paths",
  LOADING: "Loading",
  // ...
} as const;

export const TEMP_DIR_PREFIX = "cc-test-";
```

### 11.5 Test Helper Organization

**Current Structure:**

```
src/cli/lib/__tests__/
├── fixtures/
│   └── create-test-source.ts    # Full source directory creation
├── helpers.ts                    # Mock creators + FS helpers
├── test-fixtures.ts              # Constants + specialized creators
└── commands/                     # Test files
```

**Pattern from oclif Projects:**

oclif projects typically use:

1. **`test/helpers/` directory** - Shared test utilities
2. **`test/fixtures/` directory** - Static test data (YAML files, etc.)
3. **`test/commands/` directory** - Command tests

**Recommended Organization (minor refinement):**

```
src/cli/lib/__tests__/
├── helpers/                      # (rename from just helpers.ts)
│   ├── index.ts                  # Re-export all helpers
│   ├── mock-creators.ts          # createMock* functions
│   ├── test-constants.ts         # CLI_ROOT, OUTPUT_STRINGS, etc.
│   ├── command-helpers.ts        # runCliCommand, parseOutput
│   └── fs-helpers.ts             # createTestDirs, cleanup, etc.
├── fixtures/
│   ├── create-test-source.ts     # Dynamic fixture creation
│   ├── test-fixtures.ts          # Static constants (TEST_SKILLS, etc.)
│   └── static/                   # (optional) Static YAML files
└── commands/
```

**Trade-off:** Current flat structure is simpler and works fine for 20-30 test files. Reorganization adds overhead but improves discoverability.

### 11.6 What oclif Projects Actually Do

Based on examination of oclif ecosystem projects:

**Pattern 1: Simple Helper Function**
Most oclif projects use a simple `runCommand` wrapper:

```typescript
// Common pattern in oclif projects
async function runCliCommand(args: string[]) {
  return runCommand(args, { root: CLI_ROOT });
}
```

**Pattern 2: Test Fixtures as Code**
Fixtures are typically generated programmatically, not stored as static files:

```typescript
// Dynamic fixture creation (preferred)
beforeEach(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "test-"));
  await writeFile(
    path.join(tempDir, "config.yaml"),
    stringifyYaml({
      skills: [TEST_SKILLS.REACT],
    }),
  );
});
```

**Pattern 3: Environment Isolation**
Tests manipulate environment variables and restore them:

```typescript
let originalEnv: NodeJS.ProcessEnv;
beforeEach(() => {
  originalEnv = { ...process.env };
});
afterEach(() => {
  process.env = originalEnv;
});
```

### 11.7 Summary: Current State vs Recommendations

| Area                  | Current State                  | Recommendation                                |
| --------------------- | ------------------------------ | --------------------------------------------- |
| **Mock creators**     | Good (`createMockSkill`, etc.) | Keep as-is                                    |
| **Constants**         | Partial (`TEST_SKILLS`)        | Add `CLI_ROOT`, `OUTPUT_STRINGS`              |
| **Command helper**    | Duplicated `runCliCommand`     | Extract to shared file                        |
| **Fixtures**          | Good (`create-test-source.ts`) | Keep as-is                                    |
| **File organization** | Flat                           | Consider helpers/ subdirectory (low priority) |

---

## 12. Recommended Follow-up Tasks

Based on this research, the following tasks should be added to the backlog:

### High Priority

**T1: Extract shared CLI_ROOT constant**

- Move `CLI_ROOT` definition from individual test files to `helpers.ts`
- Update all command tests to import from helpers
- Estimated effort: 30 minutes

**T2: Create shared runCliCommand helper**

- Currently duplicated in each test file
- Create `helpers/command-helpers.ts` with `runCliCommand()`
- Update all command tests to use shared helper
- Estimated effort: 1 hour

### Medium Priority

**T3: Add output string constants**

- Create `OUTPUT_STRINGS` constant for common expected outputs
- Reduces magic strings in assertions
- Estimated effort: 1 hour

**T4: Document test helper usage**

- Add JSDoc comments to helpers.ts functions
- Create example test showing all available helpers
- Estimated effort: 1 hour

### Low Priority

**T5: Consider helpers/ subdirectory**

- Only if test file count grows significantly
- Current flat structure is manageable
- Estimated effort: 2 hours (if needed)

**T6: Add builder pattern for skills with relationships**

- Only if tests need complex skill relationship setup
- Factory functions sufficient for current needs
- Estimated effort: 2 hours (if needed)

---

_Document created: January 2026_
_Based on CLI Migration Research and Codebase Investigation_
_Updated: January 2026 with Test Code Sharing Patterns_
