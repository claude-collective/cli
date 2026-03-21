# Anti-Patterns

Every "never do this" rule with rationale. Organized by category.

---

## Session and Keystroke Leakage

### Never import `TerminalSession` in test files

**What:** `import { TerminalSession } from "../helpers/terminal-session.js"` in a `.e2e.test.ts` file.

**Why:** `TerminalSession` is the raw PTY layer. Tests must use page objects (wizards and steps) to interact with the terminal. Direct session access bypasses all the framework's timing, text matching, and navigation logic.

**Instead:** Use `InitWizard.launch()`, `EditWizard.launch()`, `InteractivePrompt`, or `DashboardSession`.

### Never call session methods in test files

**What:** `session.waitForText()`, `session.enter()`, `session.arrowDown()`, `session.space()`, `session.write()` in test code.

**Why:** These are low-level terminal operations. Every keystroke needs a delay after it, and every text check needs a timeout. The framework handles this internally.

**Instead:** Use step methods: `wizard.stack.selectFirstStack()`, `build.toggleSkill("react")`, `agents.toggleAgent("API Developer")`.

---

## Timing Leakage

### Never use `delay()` in test files

**What:** `await delay(500)` or `await delay(STEP_TRANSITION_DELAY_MS)` in an `it()` block.

**Why:** The framework encapsulates all timing in `BaseStep` methods. Delays in tests are a sign that the test is working at the wrong abstraction level.

**Instead:** All step methods include appropriate delays internally. If you need to wait for something, use a step method or `waitForText` through a page object.

### Never use `setTimeout` in test files

**What:** `await new Promise(r => setTimeout(r, 1000))` or similar.

**Why:** Same as above. Manual timing is fragile and makes tests flaky.

**Instead:** The framework handles all timing. Use `{ timeout: TIMEOUTS.LIFECYCLE }` for tests that need more time.

### Never reference `INTERNAL_DELAYS` in test files

**What:** `import { INTERNAL_DELAYS } from "../pages/constants.js"` or using `INTERNAL_DELAYS.STEP_TRANSITION`.

**Why:** `INTERNAL_DELAYS` is exported only for the framework's internal use (BaseStep, DashboardSession, InteractivePrompt). Tests should not know about keystroke timing.

**Instead:** Use `TIMEOUTS` for per-test timeout overrides. The framework handles all internal delays.

---

## Filesystem in Tests

### Never use `writeFile`/`mkdir` in `it()` blocks

**What:** `await writeFile(path.join(projectDir, ".claude-src", "config.ts"), content)` inside a test.

**Why:** This couples the test to the config file format. When the format changes, the test breaks even though the CLI behavior didn't change.

**Instead:** Use `ProjectBuilder` methods in `beforeEach` or as inline fixture calls. See [test-data.md](./test-data.md).

### Never use `readFile`/`readdir` in `it()` blocks for assertions

**What:** `const content = await readFile(configPath, "utf-8"); expect(content).toContain(...)`.

**Why:** This couples the test to the file's path and format. The assertion should describe what the user sees, not how the CLI stores it.

**Instead:** Use matchers: `await expect(project).toHaveConfig({ skillIds: [...] })`. See [assertions.md](./assertions.md).

**Exception:** Lifecycle tests sometimes read specific file content for detailed assertions that no matcher covers (e.g., checking YAML frontmatter fields). This is acceptable in lifecycle tests where the assertion is about compilation output, not implementation details. If you find yourself doing this in 3+ places, add a matcher.

### Never construct paths with `path.join` in test assertions

**What:** `const configPath = path.join(dir, ".claude-src", "config.ts"); expect(await fileExists(configPath)).toBe(true)`.

**Why:** Testing file existence without checking content is weak (an empty file passes). And the path construction couples to directory structure.

**Instead:** Use content-aware matchers: `await expect({ dir }).toHaveConfig()`.

---

## Production Imports

### Never import from `src/cli/` in test files

**What:** `import { CLAUDE_DIR } from "../../src/cli/consts.js"` in a `.e2e.test.ts` file.

**Why:** E2E tests exercise the CLI as a black box. Importing production code breaks this boundary. It also means the test may silently depend on production behavior that changes.

**Instead:** Use `e2e/pages/constants.ts` for paths (`DIRS.CLAUDE`), files (`FILES.CONFIG_TS`), text (`STEP_TEXT`), timeouts (`TIMEOUTS`), and exit codes (`EXIT_CODES`).

**Acceptable:** `import type { SkillId } from "../../src/cli/types/index.js"` -- type-only imports have no runtime effect.

---

## Index-Based Navigation

### Never use counted arrow presses to reach items

**What:** `for (let i = 0; i < 7; i++) { await step.navigateDown(); }` to reach a specific item.

**Why:** Adding or reordering items breaks these tests silently. The test passes but selects the wrong item.

**Instead:** Navigate by name: `await agents.toggleAgent("API Developer")`, `await wizard.stack.selectStack("E2E Test Stack")`.

**Exception:** `InteractivePrompt` (non-wizard prompts like uninstall confirmation) may need index-based navigation because prompt items lack unique text. Document the assumption:

```typescript
// Navigate to "Remove plugins only" -- second option in prompt
await prompt.arrowDown();
```

---

## Hardcoded Strings

### Never use raw UI text in tests

**What:** `await expect(output).toContain("Choose a stack")` or `await expect(output).toContain("initialized successfully")`.

**Why:** When UI text changes, every test that hardcodes the old text breaks. Constants centralize the change to one file.

**Instead:** Use `STEP_TEXT` constants: `expect(output).toContain(STEP_TEXT.STACK)`, `expect(output).toContain(STEP_TEXT.INIT_SUCCESS)`.

### Never use inline timeout numbers

**What:** `it("test", { timeout: 180000 }, async () => {})` or `await wizard.waitForExit(60000)`.

**Why:** Magic numbers are impossible to grep for and easy to miscalibrate.

**Instead:** Use `TIMEOUTS` constants: `{ timeout: TIMEOUTS.LIFECYCLE }`.

### Never use hardcoded path segments

**What:** `".claude"`, `".claude-src"`, `"config.ts"`, `"SKILL.md"`.

**Instead:** Use `DIRS.CLAUDE`, `DIRS.CLAUDE_SRC`, `FILES.CONFIG_TS`, `FILES.SKILL_MD` from constants.

---

## Inline Test Data

### Never create project fixtures inline in tests

**What:** `await mkdir(path.join(tempDir, ".claude-src"), { recursive: true }); await writeFile(...)` inside a test file.

**Why:** Duplicates setup logic. When the config format changes, every inline fixture breaks.

**Instead:** Use `ProjectBuilder` methods or `writeProjectConfig()` from test-utils. See [test-data.md](./test-data.md).

---

## Duplicated Helpers

### Extract shared patterns when 3+ files share them

**What:** Three test files each implement the same navigation sequence, setup pattern, or assertion logic.

**Why:** Duplication drifts. When one copy is updated, the others silently become incorrect.

**Instead:**

- Navigation flows -> step methods on page objects
- Setup patterns -> new `ProjectBuilder` method or fixture helper
- Assertion patterns -> new custom matcher in `project-matchers.ts`

---

## Creating New Helpers

### Always check existing shared helpers before writing local ones

**What:** Defining a local function in a test file (e.g., `function skillsPath(...)`, `function addForkedFromMetadata(...)`) without first checking `test-utils.ts`, `dual-scope-helpers.ts`, and `constants.ts`.

**Why:** The shared utilities grow over time. A helper you need likely already exists. Duplicating it means two copies that drift apart.

**Before writing any helper function in a test file:**

1. Grep `e2e/helpers/test-utils.ts` for the function name or a similar name
2. Grep `e2e/fixtures/` for related helpers
3. Grep `e2e/pages/constants.ts` for the constant value

**Where new helpers belong:**

- Path helpers (like `skillsPath`, `agentsPath`) -> `test-utils.ts`
- Dual-scope lifecycle helpers -> `dual-scope-helpers.ts`
- Constants (paths, timeouts, text) -> `constants.ts`
- Project creation patterns -> new `ProjectBuilder` method

---

## Weak Assertions

### Never assert generic absence

**What:** `expect(output).not.toContain("error")`.

**Why:** Matches any text containing "error", including legitimate content like skill IDs or help text.

**Instead:** Assert specific absence: `expect(output).not.toContain("Failed to archive")`.

### Never assert existence without content

**What:** `expect(await fileExists(configPath)).toBe(true)`.

**Why:** An empty or corrupted file passes this check.

**Instead:** Use content-aware matchers: `await expect(project).toHaveConfig({ skillIds: [...] })`.

---

## Type Casts

### Never use `as SkillId` on valid union members

**What:** `"web-framework-react" as SkillId` in test code.

**Why:** The literal string `"web-framework-react"` is already a valid `SkillId`. The cast adds noise.

**Instead:** Use the literal string directly. Only cast at parse boundaries (YAML/JSON) or for deliberately invalid test-only IDs.

---

## Rules Carried Forward from the Old Bible

These rules from the original `e2e-testing-bible.md` remain valid:

- **No task IDs in `describe()` blocks.** Task IDs may appear in file-level JSDoc comments only.
- **`ensureBinaryExists()` in `beforeAll`.** Every test file must verify the CLI binary exists.
- **`describe.skipIf()` for external dependencies.** Plugin tests use `describe.skipIf(!claudeAvailable)`. Marketplace tests use `describe.skipIf(!hasSkillsSource)`.
- **Split files at 300 LOC** or when covering 2+ unrelated concerns.
- **Never test the Claude CLI binary from E2E tests.** Testing `claude plugin install` directly is a smoke test. Place in `smoke/` with `.smoke.test.ts` extension.
- **`it.fails()` for known bugs.** Document the bug with a comment. When fixed, removing `it.fails()` makes the test pass.
- **Use `createTempDir()` / `cleanupTempDir()`.** Never import `mkdtemp` or `os.tmpdir()` directly.

---

## Related

- [test-structure.md](./test-structure.md) -- The golden rule and cleanup conventions
- [assertions.md](./assertions.md) -- Matcher patterns
- [patterns.md](./patterns.md) -- Correct patterns for each test type
