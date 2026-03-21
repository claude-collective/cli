# D-134 Implementation Prompt

Use this prompt with clean context + Ralph Loop to iterate over the declarative E2E framework migration.

---

## Prompt

Read these files before doing anything else:
1. CLAUDE.md — project rules, delegation rules, conventions
2. .ai-docs/DOCUMENTATION_MAP.md — then read .ai-docs/test-infrastructure.md
3. todo/D-134-declarative-e2e-framework.md — the full spec for this task

This task implements D-134: replacing the imperative E2E test suite with a declarative Page Object Model framework. The spec defines 11 sequenced steps (Step 0 through Step 10). Each step introduces new code, migrates all consumers, and deletes the old code in the same step. There is no backwards compatibility period.

## How to work

1. Determine which step you are on. Check what exists:
   - Does `e2e/pages/constants.ts` exist? If not, you are on Step 0.
   - Does `e2e/helpers/plugin-assertions.ts` still exist? If yes and Step 0 is done, you are on Step 1.
   - Check each step's "File deleted" section against the filesystem to find where you are.

2. Execute the current step completely:
   - Delegate ALL implementation and test code to sub-agents (cli-developer for framework code, cli-tester for test migration). Tell them to read CLAUDE.md. Tell them: "Do NOT run any git commands."
   - Each step's scope is defined in the spec. Do not skip ahead.
   - After the sub-agent finishes, run `npm run test:e2e` to verify. If tests fail, fix them before moving on.

3. When tests fail after migration:
   - If the test has CORRECT assertions (testing real user-visible behavior) but the CLI produces wrong output — this is a **product bug**, not a test bug. Mark the test `it.fails("description", ...)` and move on. The code and tests were written by AI. Question everything.
   - If the test has WRONG assertions (testing implementation details, fragile text matching) — fix the assertion to match the declarative pattern.
   - If the migration introduced a regression — fix the page object or step code.

4. After each step completes (all tests pass or are correctly marked `it.fails`):
   - Verify the step's "File deleted" section — confirm the old code is gone.
   - Move to the next step.

## Critical rules

- Tests NEVER create, modify, or read files directly. Only setup fixtures and matchers touch the filesystem. Test bodies only launch, interact, and assert.
- No `session.waitForText()`, `session.enter()`, `delay()`, or `path.join` in test files.
- No imports from `src/cli/` in test files. Framework files may import from `src/cli/`.
- Navigate by name, never by index (no `arrowDown()` x N).
- The "a" key shortcut in the build step is being removed. All wizard flows go through every step: Stack → Domain → Build (domain-by-domain) → Sources → Agents → Confirm.
- SearchModal is buggy. Write tests using the page object but mark them `it.fails`.
- No `patchConfig`, no direct config mutation between test phases. State changes happen through wizard interactions.
- `ProjectHandle` is `{ dir: string }`. Nothing more.
- One abstraction, not two. When new code replaces old code, delete the old code immediately.

## Delegation instructions for sub-agents

When delegating to cli-developer for framework code:
- "Read CLAUDE.md before starting. Do NOT run any git commands."
- "Read todo/D-134-declarative-e2e-framework.md for the full spec."
- "Read e2e/helpers/terminal-session.ts to understand the session layer you are wrapping."
- "Read e2e/helpers/create-e2e-source.ts to understand the source fixture structure."
- Point them to the specific step's file list and type definitions in the spec.

When delegating to cli-tester for test migration:
- "Read CLAUDE.md before starting. Do NOT run any git commands."
- "Read todo/D-134-declarative-e2e-framework.md for the full spec, especially the API examples."
- "Read the existing test file you are migrating. Understand what it tests."
- "Rewrite the test using page objects. The test body should only launch, interact, and assert."
- "If a test with correct assertions fails, mark it `it.fails` — it's probably a product bug."
- "Question every assertion. The original tests were AI-written and many assert on implementation details rather than behavior."

## What "done" looks like

All 11 success criteria from the spec pass:
1. No writeFile/readFile/mkdir/path.join in test bodies
2. No session.waitForText() in test files
3. No delay() in test files
4. No src/cli/ imports in test files
5. No index-based navigation
6. No duplicated navigation flows
7. Tests read like user stories
8. UI text changes require editing 1 file
9. test-utils.ts and plugin-assertions.ts are deleted
10. Zero compatibility code
11. No direct config mutation between test phases
