# Test Assertion Change Taxonomy

Comprehensive catalog of every type of assertion issue found and fixed across 133 test files (5078 tests). Use this to improve the cli-tester sub-agent's assertion standards.

---

## Summary Statistics

| Category                         | Instances Fixed | Severity |
| -------------------------------- | --------------- | -------- |
| A. Existence-only assertions     | 305             | High     |
| B. Truthiness-only assertions    | 20              | High     |
| C. Vague count assertions        | 97              | High     |
| D. Partial array checks          | 189             | Medium   |
| E. Length-only array checks      | 76              | Medium   |
| F. Bare matcher calls            | 17              | Medium   |
| G. Hardcoded strings             | 41              | Medium   |
| H. Raw filesystem in test bodies | 79              | Medium   |
| I. Missing negative assertions   | 60 added        | High     |
| J. Missing content assertions    | 62 added        | High     |
| K. Exit code magic numbers       | 47              | Low      |
| L. Incorrect expected values     | ~30             | Critical |
| M. Wrong scope/directory         | ~10             | Critical |
| N. Overly broad negative checks  | ~5              | Critical |
| O. Misclassified tests           | 26 removed      | Medium   |
| P. Mock-only assertions          | ~15             | Medium   |
| Q. Missing matchers imports      | 9               | Low      |
| R. Duplicate local helpers       | 5               | Low      |

---

## Category A: Existence-Only Assertions (305 instances)

**Pattern:** `expect(x).toBeDefined()` — checks that a value exists but not WHAT it is.

**Why it's weak:** An empty object, wrong object, or partially-constructed object all pass. The test name says "should produce correct config" but the assertion only checks "config is not undefined."

**Fix:** Replace with specific value assertions.

### Subcategories:

**A1. Guard + property access chain (most common)**

```ts
// BEFORE: 2 assertions, one is just a guard
expect(result).toBeDefined();
expect(result!.name).toBe("test");

// AFTER: 1 assertion, checks full shape
expect(result).toStrictEqual({ name: "test", skills: [], agents: [] });
```

**A2. Error existence check**

```ts
// BEFORE: only checks error was thrown
expect(error).toBeDefined();

// AFTER: checks error TYPE and MESSAGE
expect(error).toBeInstanceOf(Error);
expect(error!.message).toContain("missing required SKILL.md file");
```

**A3. Exit code existence**

```ts
// BEFORE: checks exit code exists
expect(error?.oclif?.exit).toBeDefined();

// AFTER: checks exact exit code
expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
```

**A4. Redundant guard before specific assertion**

```ts
// BEFORE: toBeDefined is redundant — the next line already fails on undefined
expect(result).toBeDefined();
expect(result!.id).toBe("web-framework-react");

// AFTER: use optional chaining or just trust the next assertion
expect(result?.id).toBe("web-framework-react");
```

**Files most affected:** source-loader (43), multi-source-loader (21), stacks-loader (17), schema-validator (14), config-generator (14), init-flow.integration (14), local-installer (12)

---

## Category B: Truthiness-Only Assertions (20 instances)

**Pattern:** `expect(x).toBeTruthy()` — passes for ANY truthy value.

**Why it's weak:** `"wrong value"`, `42`, `{}`, `[]` all pass.

### Subcategories:

**B1. Boolean that should be exact**

```ts
// BEFORE
expect(result.valid).toBeTruthy();
// AFTER
expect(result.valid).toBe(true);
```

**B2. String that should match a pattern**

```ts
// BEFORE
expect(result.stdout.trim()).toBeTruthy();
// AFTER
expect(result.stdout.trim()).toMatch(/\d+\.\d+/);
```

**B3. Non-empty string check**

```ts
// BEFORE
expect(plugin.name.length).toBeTruthy();
// AFTER
expect(plugin.name).not.toBe("");
```

**Files affected:** compilation-pipeline (5), messages (4), default-stacks (3), default-categories (3), smoke tests (5)

---

## Category C: Vague Count Assertions (97 instances)

**Pattern:** `expect(x.length).toBeGreaterThan(0)` — "at least one" when exact count is known.

**Why it's weak:** Hides regressions where items are added/removed. A test expecting 9 agents could silently pass with 1.

### Subcategories:

**C1. Compiled agent count (most common)**

```ts
// BEFORE
expect(result.compiledAgents.length).toBeGreaterThan(0);
// AFTER
expect(result.compiledAgents).toHaveLength(9);
// BEST: verify exact names
expect([...result.compiledAgents].sort()).toStrictEqual(WEB_AND_API_AGENTS);
```

**C2. Config array length**

```ts
// BEFORE
expect(config.agents.length).toBeGreaterThan(0);
// AFTER
expect(config.agents).toHaveLength(9);
// BEST: verify full shape
expect(config.agents.map((a) => a.name).sort()).toStrictEqual(WEB_AND_API_AGENTS);
```

**C3. File content length**

```ts
// BEFORE
expect(content.length).toBeGreaterThan(0);
// AFTER (content length is inherently variable)
expect(content).toContain("---"); // verify has frontmatter
```

**C4. Replaced with custom matcher**

```ts
// BEFORE
const files = await listFiles(agentsDir);
expect(files.length).toBeGreaterThan(0);
// AFTER
await expect({ dir: projectDir }).toHaveCompiledAgents();
```

**Files most affected:** user-journeys.integration (13), compilation-pipeline (9), source-loader (8), init-end-to-end (7), init-flow (6)

---

## Category D: Partial Array Checks (189 instances)

**Pattern:** `expect(array).toContain(item)` — checks one item exists but doesn't verify the FULL array.

**Why it's weak:** Extra items sneak in undetected. If you add 5 skills but only `toContain` 2, 3 unexpected skills pass silently.

### Subcategories:

**D1. Multiple toContain → single toStrictEqual**

```ts
// BEFORE: 3 assertions, still doesn't catch extra items
expect(config.skills.map((s) => s.id)).toContain("web-framework-react");
expect(config.skills.map((s) => s.id)).toContain("web-state-zustand");
expect(config.skills.map((s) => s.id)).toContain("api-framework-hono");

// AFTER: 1 assertion, catches extra items too
expect(config.skills.map((s) => s.id).sort()).toStrictEqual([
  "api-framework-hono",
  "web-framework-react",
  "web-state-zustand",
]);
```

**D2. toContain on config content string → matcher**

```ts
// BEFORE
const content = await readTestFile(configPath);
expect(content).toContain("web-framework-react");
// AFTER
await expect({ dir }).toHaveConfig({ skillIds: ["web-framework-react"] });
```

**D3. toContain on agent file content → content matcher**

```ts
// BEFORE
const content = await readTestFile(agentPath);
expect(content).toContain("web-framework-react");
// AFTER
await expect({ dir }).toHaveCompiledAgentContent("web-developer", {
  contains: ["web-framework-react"],
});
```

**Files most affected:** user-journeys.integration, init-end-to-end, init-flow, consumer-stacks-matrix, cross-scope-lifecycle

---

## Category E: Length-Only Array Checks (76 instances)

**Pattern:** `expect(array).toHaveLength(N)` — checks count but not WHICH items.

**Why it's weak:** 3 wrong items pass the same as 3 right items.

```ts
// BEFORE
expect(result.compiledAgents).toHaveLength(2);
// AFTER
expect(result.compiledAgents.sort()).toStrictEqual(["api-developer", "web-developer"]);

// BEFORE
expect(config.skills).toHaveLength(3);
// AFTER
expect(config.skills).toStrictEqual([
  { id: "web-framework-react", scope: "global", source: "agents-inc" },
  { id: "web-state-zustand", scope: "global", source: "agents-inc" },
  { id: "api-framework-hono", scope: "global", source: "agents-inc" },
]);
```

---

## Category F: Bare Matcher Calls (17 instances)

**Pattern:** Custom matchers called without parameters — checks existence but not content.

**F1. Bare `toHaveConfig()` (8 instances)**

```ts
// BEFORE: only checks config.ts file exists
await expect(project).toHaveConfig();
// AFTER: checks config CONTENT
await expect(project).toHaveConfig({
  skillIds: ["web-framework-react"],
  agents: ["web-developer"],
  source: "agents-inc",
});
```

**F2. Bare `toHaveCompiledAgents()` (9 instances)**

```ts
// BEFORE: only checks agents/ dir has .md files
await expect(project).toHaveCompiledAgents();
// AFTER: checks specific agent with content
await expect(project).toHaveCompiledAgent("web-developer");
await expect(project).toHaveCompiledAgentContent("web-developer", {
  contains: ["name: web-developer", "web-framework-react"],
});
```

---

## Category G: Hardcoded Strings (41 instances)

**Pattern:** Inline strings that should use shared constants.

### Subcategories:

**G1. UI text**

```ts
// BEFORE
expect(output).toContain("Uninstall complete!");
// AFTER
expect(output).toContain(STEP_TEXT.UNINSTALL_SUCCESS);
```

**G2. File names**

```ts
// BEFORE
path.join(dir, "settings.json");
// AFTER
path.join(dir, FILES.SETTINGS_JSON);
```

**G3. Directory segments**

```ts
// BEFORE
path.join(dir, ".claude", "agents");
// AFTER
path.join(dir, DIRS.CLAUDE, DIRS.AGENTS);
```

**G4. Path segment in source paths**

```ts
// BEFORE
const PLUGIN_MANIFEST_DIR = ".claude-plugin";
// AFTER
import { SOURCE_PATHS } from "../pages/constants.js";
// use SOURCE_PATHS.PLUGIN_MANIFEST_DIR
```

---

## Category H: Raw Filesystem in Test Bodies (79 instances)

**Pattern:** `readTestFile`, `fileExists`, `readFile` called directly in `it()` blocks instead of using matchers.

**Why it's wrong (in E2E):** Couples the test to file paths/formats. When the format changes, every test breaks. Matchers centralize the change.

```ts
// BEFORE: raw filesystem access
const configPath = path.join(dir, DIRS.CLAUDE_SRC, FILES.CONFIG_TS);
const content = await readTestFile(configPath);
expect(content).toContain("web-framework-react");
expect(content).toMatch(/"source":\s*"agents-inc"/);

// AFTER: matcher encapsulates filesystem access
await expect({ dir }).toHaveConfig({
  skillIds: ["web-framework-react"],
  source: "agents-inc",
});
```

```ts
// BEFORE: raw existence check + content read
const agentPath = path.join(dir, DIRS.CLAUDE, "agents", "web-developer.md");
expect(await fileExists(agentPath)).toBe(true);
const content = await readTestFile(agentPath);
expect(content).toContain("name: web-developer");

// AFTER: content matcher
await expect({ dir }).toHaveCompiledAgentContent("web-developer", {
  contains: ["name: web-developer"],
});
```

**Note:** Lifecycle tests reading config for complex analysis (duplicate detection, scope-specific checks) are an accepted exception per the E2E standards.

---

## Category I: Missing Negative Assertions (60 added)

**Pattern:** Tests verify what EXISTS but not what was REMOVED.

**Why it's critical:** A test that checks "skill A is in config" after removing skill B passes even if skill B is ALSO still in config.

```ts
// BEFORE: only checks what remains
expect(exitCode).toBe(EXIT_CODES.SUCCESS);
await expect({ dir }).toHaveConfig();

// AFTER: also checks what was removed
expect(exitCode).toBe(EXIT_CODES.SUCCESS);
await expect({ dir }).toHaveNoLocalSkills();
expect(await directoryExists(agentsDir)).toBe(false);
```

```ts
// BEFORE: only checks active skills
await expect({ dir }).toHaveConfig({ skillIds: ["web-framework-react"] });

// AFTER: also checks excluded skills not in agents
await expect({ dir }).toHaveCompiledAgentContent("web-developer", {
  contains: ["web-framework-react"],
  notContains: ["api-framework-hono"],
});
```

---

## Category J: Missing Content Assertions (62 `toHaveCompiledAgentContent` added)

**Pattern:** Tests check that agent files EXIST but not what they CONTAIN.

```ts
// BEFORE: existence only
await expect(project).toHaveCompiledAgent("web-developer");

// AFTER: existence + content
await expect(project).toHaveCompiledAgentContent("web-developer", {
  contains: ["name: web-developer", "web-framework-react"],
  notContains: ["api-framework-hono"], // excluded skill
});
```

---

## Category K: Exit Code Magic Numbers (47 instances)

**Pattern:** `expect(exitCode).toBe(0)` instead of `expect(exitCode).toBe(EXIT_CODES.SUCCESS)`.

```ts
// BEFORE
expect(result.exitCode).toBe(0);
// AFTER
expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
```

---

## Category L: Incorrect Expected Values (~30 instances, CRITICAL)

**Pattern:** Assertions with wrong expected values that pass because they're too loose, or that are made stricter and break because the expected value was guessed wrong.

### Subcategories:

**L1. Wrong agent list from mock data**

```ts
// AGENT WROTE (wrong — mock doesn't select agents):
expect(config).toStrictEqual({ agents: ["web-developer"], ... });
// ACTUAL:
expect(config).toStrictEqual({ agents: [], ... });
```

**Root cause:** The agent assumed `installEject` always produces agents, but the mock `generateProjectConfigFromSkills` returns `agents: []` when no agents are selected in the wizard.

**L2. Wrong scope**

```ts
// AGENT WROTE (wrong — agents default to global):
agents: [{ name: "web-developer", scope: "project" }];
// ACTUAL:
agents: [{ name: "web-developer", scope: "global" }];
```

**Root cause:** `preselectAgentsFromDomains` creates agents with `scope: "global"`. The agent assumed project scope.

**L3. Wrong ordering**

```ts
// AGENT WROTE (wrong — alphabetically sorted):
skills: ["api-framework-hono", "web-framework-react", "web-state-zustand"];
// ACTUAL (domain iteration order):
skills: ["web-framework-react", "web-state-zustand", "api-framework-hono"];
```

**Root cause:** Config preserves skills in domain iteration order, not alphabetical.

**L4. Wrong object shape (compacted vs expanded)**

```ts
// AGENT WROTE (wrong — expanded form):
stack: { "web-developer": { "web-framework": [{ id: "web-framework-react", preloaded: false }] } }
// ACTUAL (compacted form):
stack: { "web-developer": { "web-framework": ["web-framework-react"] } }
```

**Root cause:** `compactStackAssignments` compacts `{ id, preloaded: false }` to bare string IDs when writing config. Tests reading the config back get compacted form.

**L5. Extra undefined property**

```ts
// AGENT WROTE (wrong — included property that doesn't exist):
{ name: "web-developer", scope: "global", excluded: undefined }
// ACTUAL:
{ name: "web-developer", scope: "global" }
```

**Root cause:** `toStrictEqual` treats `excluded: undefined` as different from a missing `excluded` property. The production code doesn't set `excluded` at all for non-excluded agents.

---

## Category M: Wrong Scope/Directory (~10 instances, CRITICAL)

**Pattern:** Assertions check the wrong directory for files that exist at a different scope.

```ts
// AGENT WROTE (wrong — checked project dir):
await expect({ dir: projectDir }).toHaveCompiledAgent("web-developer");
// ACTUAL (agents compile to global home):
await expect({ dir: fakeHome }).toHaveCompiledAgent("web-developer");
```

**Root cause:** In dual-scope setups, agents default to global scope. The compiled agent .md files go to `~/.claude/agents/`, not `<project>/.claude/agents/`. The agent didn't trace through the scope routing logic.

---

## Category N: Overly Broad Negative Checks (~5 instances, CRITICAL)

**Pattern:** Negative assertions that match MORE than intended, causing false failures.

```ts
// AGENT WROTE (too broad — matches excluded global entry):
expect(projectConfig).not.toContain('"source":"eject"');

// FIX (targeted — only checks project-scoped entry):
const projectHonoSource = projectConfig.match(
  /"api-framework-hono","scope":"project","source":"([^"]+)"/,
);
expect(projectHonoSource).not.toBeNull();
expect(projectHonoSource![1]).not.toBe("eject");
```

**Root cause:** The merged config contains BOTH project-scoped AND global-scoped entries. An excluded global entry legitimately retains `"source":"eject"` as a tombstone. The agent checked the entire config string instead of targeting the project-scoped entry.

---

## Category O: Misclassified/Untestable Tests (26 removed)

**Pattern:** Tests in the wrong category or tests that can't be meaningfully executed.

**O1. Unit tests in integration suite**
`install-mode.integration.test.ts` contained 12 pure unit tests (Zustand store + `detectMigrations` function tests) that were already covered by dedicated unit test files. Removed as duplicates.

**O2. Tests with silent pass-through on error**

```ts
// BEFORE: silently returns on error, executing 0 assertions
const { error } = await runCliCommand(["compile"]);
if (error?.oclif?.exit && error.oclif.exit !== 0) {
  return; // test passes with no assertions!
}
// assertions below never reached...
```

**O3. Tests that couldn't be meaningfully mocked**
`compile-flow.test.ts` had tests calling `runCliCommand(["compile"])` which always failed because test skill IDs don't resolve. Restructured to call `recompileAgents()` directly.

---

## Category P: Mock-Only Assertions (~15 instances)

**Pattern:** Tests only verify mocks were called, not the actual output.

```ts
// BEFORE: only checks mock was called
expect(mockCompile).toHaveBeenCalled();

// AFTER: checks mock was called with correct args AND verifies output
expect(mockCompile).toHaveBeenCalledWith(
  "/path/to/project",
  expect.objectContaining({ source: "agents-inc" }),
);
// Also verify what was produced:
const content = await readFile(outputPath, "utf-8");
expect(content).toContain("expected content");
```

---

## Category Q: Missing Matchers Imports (9 instances)

**Pattern:** Test files that use custom matchers but don't import the setup file.

```ts
// MISSING:
import "../matchers/setup.js";
```

Without this import, `toHaveConfig`, `toHaveCompiledAgents`, etc. are not available and TypeScript won't type-check them.

---

## Category R: Duplicate Local Helpers (5 instances)

**Pattern:** Test files define local helper functions that already exist in shared utilities.

```ts
// BEFORE: local function duplicating shared utility
function agentsPath(dir: string) {
  return path.join(dir, DIRS.CLAUDE, "agents");
}

// AFTER: import from shared utilities
import { agentsPath } from "../helpers/test-utils.js";
```

---

## Lessons for the CLI Tester Sub-Agent

### When tightening assertions:

1. **Read the production source** to understand exact return types and shapes. Don't guess values.
2. **Read the test's mock setup** to understand what data is actually provided. Mock data often differs from production data (e.g., empty agents, different sources).
3. **Run the test first** to see actual values before writing expected values.
4. **`toStrictEqual` catches `undefined` properties.** Don't include `excluded: undefined` — omit the property entirely if the production code doesn't set it.
5. **Config compaction matters.** Written configs compact `{ id, preloaded: false }` to bare strings. Tests reading config back get compacted form.
6. **Scope routing matters.** Global-scoped agents compile to `$HOME/.claude/agents/`, not `<project>/.claude/agents/`.
7. **Merged configs have both scopes.** A `not.toContain` on the full config catches entries from BOTH scopes. Target specific scope entries when checking for absence.
8. **Skill ordering is NOT alphabetical.** Skills are stored in domain iteration order, not sorted.

### When adding negative assertions:

1. **Scope the check.** Don't `not.toContain("eject")` on a merged config — check the specific scope's entries.
2. **Use matchers.** `toHaveNoLocalSkills()` is better than `directoryExists(skillsDir) === false`.
3. **Check both directions.** After edit: verify new skills ARE present AND old deselected skills are NOT.

### Priority order for tightening:

1. **Replace `toBeDefined`/`toBeTruthy`** with specific values (eliminates false positives)
2. **Replace `toBeGreaterThan(0)`** with exact counts (catches regressions)
3. **Replace `toContain` loops** with `toStrictEqual` on full arrays (catches extras)
4. **Add `toHaveConfig({ skillIds, agents, source })`** parameters (verifies config content)
5. **Add `toHaveCompiledAgentContent`** with `contains`/`notContains` (verifies compilation output)
6. **Add negative assertions** for removals/exclusions (catches incomplete cleanup)
7. **Replace hardcoded strings** with constants (single source of truth)
8. **Replace raw filesystem** with matchers (decouples from implementation)
