# Clean Code Standards

Enforceable rules from 70+ refactoring tasks across 9 iterations. Each rule is reviewer-checkable.

---

## 1. View Components

**1.1 No business logic in components.** Components render JSX. Computations, data transforms, and side effects go in hooks or the store.

```tsx
// BAD: inline useCallback with store logic in a component
const onToggle = useCallback(
  (subcat, techId) => {
    /* store logic */
  },
  [store, matrix],
);

// GOOD: extracted hook returns the props object
const buildStepProps = useBuildStepProps({ store, matrix, installedSkillIds });
return <StepBuild {...buildStepProps} />;
```

**1.2 Extract hooks when a component has 3+ hooks (useCallback/useEffect/useInput) for one concern.** Name `use-{concern}.ts` in `components/hooks/`. Accept a typed options object, return a typed result object.

**1.3 Split components at 300 LOC or 2+ distinct UI sections.** The parent becomes a thin orchestrator.

**1.4 Sub-components used only within a single file stay in that file.** Do not create separate files for `Footer`, `LegendRow`, `SkillTag`, `SearchPill`, etc. when they are only rendered by their parent component.

---

## 2. Function Size & Decomposition

**2.1 Decompose functions over 50 LOC or with 2+ distinct phases (I/O + transform, fetch + process).** Sequential I/O operations (create dir, copy file, write manifest) can stay in one function. Name helpers for what they do, not when they run.

```ts
// BAD: 75-line function doing I/O + transform + render
async function compileAgent(name, agent, root, engine) {
  /* everything inline */
}

// GOOD: thin orchestrator calling focused helpers
async function compileAgent(name, agent, root, engine) {
  const files = await readAgentFiles(name, agent, root);
  const data = buildAgentTemplateContext(name, agent, files);
  return engine.renderFile("agent", sanitizeCompiledAgentData(data));
}
```

**2.2 Use a typed options object for 4+ parameters.**

```ts
// BAD
async function resolveAgentNames(specified, config, agents, outputDir, pluginDir) {}
// GOOD
async function resolveAgentNames(params: ResolveAgentNamesParams) {}
```

**2.3 Helpers that don't need instance state are module-level functions, not methods.**

---

## 3. Error Handling

**3.1 Use `getErrorMessage(error)` from `utils/errors.ts` for all unknown error values.** Never inline `error instanceof Error ? error.message : String(error)`.

```ts
// BAD
catch (error) { warn(`Failed: ${error instanceof Error ? error.message : String(error)}`); }
// GOOD
catch (error) { warn(`Failed: ${getErrorMessage(error)}`); }
```

**3.2 Use `this.handleError(error)` in oclif command catch blocks for general errors.** Defined in `base-command.ts` -- calls `getErrorMessage()` and exits with `EXIT_CODES.ERROR`. Use `this.error(message, { exit: EXIT_CODES.X })` directly when you need a specific exit code or custom message.

```ts
// BAD: inline error extraction
catch (error) { this.error(error instanceof Error ? error.message : "Unknown error", { exit: 1 }); }
// GOOD: general catch-all
catch (error) { this.handleError(error); }
// ALSO GOOD: specific exit code needed
catch (error) { this.error(getErrorMessage(error), { exit: EXIT_CODES.INVALID_ARGS }); }
```

**3.3 No silent catch blocks.** Log with `verbose()` at minimum. Bare `catch {}` is acceptable only for existence checks and optional feature detection (e.g., `fileExists`, `isClaudeCLIAvailable`).

```ts
// BAD
catch { return []; }
// GOOD
catch (error) { verbose(`Failed to load: ${getErrorMessage(error)}`); return []; }
```

**3.4 Logging level rules.** `warn()` for user-visible issues (always shown). `verbose()` for diagnostic info (gated by `--verbose`). `log()` for always-visible progress. In oclif commands, use `this.log()` / `this.warn()`. Follow the style guide in `logger.ts`: capital first letter, single-quoted dynamic values, no "Warning:" prefix, lowercase after colons.

---

## 4. Constants

**4.1 Use `CLI_COLORS.*` from `consts.ts` for all color strings in components.** Values: `PRIMARY` (cyan), `SUCCESS` (green), `ERROR` (red), `WARNING` (yellow), `INFO` (blue), `NEUTRAL` (gray), `FOCUS` (cyan), `UNFOCUSED` (white). Exceptions: `"#000"` (literal black on colored bg), `"blackBright"` (non-semantic border shade).

```tsx
// BAD                              // GOOD
<Text color="cyan">Selected</Text>  <Text color={CLI_COLORS.PRIMARY}>Selected</Text>
```

**4.2 Use `STANDARD_FILES.*` and `STANDARD_DIRS.*` from `consts.ts` for file/directory name strings.**

```ts
// BAD                                            // GOOD
path.join(dir, "metadata.yaml")                   path.join(dir, STANDARD_FILES.METADATA_YAML)
```

**4.3 No magic numbers.** Name all numeric constants `SCREAMING_SNAKE_CASE`.

**4.4 Group related constants in `as const` objects.** See `YAML_FORMATTING`, `UI_SYMBOLS`, `UI_LAYOUT` in `consts.ts`.

**4.5 User-facing message strings go in `utils/messages.ts`.** Grouped by category: `ERROR_MESSAGES`, `SUCCESS_MESSAGES`, `STATUS_MESSAGES`, `INFO_MESSAGES`, `DRY_RUN_MESSAGES`. One-off messages used in a single location can remain inline.

---

## 5. Security

**5.1 Validate user-supplied values used in filesystem paths.** Check null bytes, path traversal (`..`), slashes, and format before any `fs` operation.

**5.2 Validate resolved paths stay within expected parent directories.**

```ts
const normalizedPath = path.resolve(resolvedPath);
return normalizedPath.startsWith(path.resolve(expectedParent) + path.sep);
```

**5.3 Validate CLI arguments passed to `spawn()`.** Each argument type gets its own validator with: (1) empty/whitespace rejection, (2) length limit, (3) control character rejection, (4) format pattern allowlist. See `validatePluginPath()`, `validateGithubRepo()`, `validateMarketplaceName()`, `validatePluginName()` in `exec.ts`.

**5.4 Sanitize user-controlled data before template rendering.** Strip Liquid syntax (`{{`, `}}`, `{%`, `%}`) before passing to the Liquid engine. See `sanitizeLiquidSyntax()` in `compiler.ts`.

**5.5 Use try-catch instead of check-then-use for security-critical filesystem operations.** When an untrusted path is involved (user input, skill IDs from YAML), attempt the operation and handle failure rather than checking first. Existence checks are fine for control flow with trusted paths (e.g., detecting optional template directories).

```ts
// BAD: race between check and operation on user-supplied path
if (await directoryExists(src)) await copy(src, dest);
// GOOD: attempt, handle failure
try {
  await copy(src, dest);
} catch (e) {
  warn(`Failed: ${getErrorMessage(e)}`);
}
```

**5.6 Enforce file size limits at parsing boundaries.** Use `readFileSafe(path, maxSizeBytes)` from `utils/fs.ts` for untrusted files. Named size constants in `consts.ts`: `MAX_MARKETPLACE_FILE_SIZE`, `MAX_PLUGIN_FILE_SIZE`, `MAX_CONFIG_FILE_SIZE`.

---

## 6. Testing

**6.1** Test file naming: `{module}.test.ts` next to the source, or `__tests__/` for shared test infrastructure and integration tests.

**6.2** Import shared utilities from these files -- never redefine locally:

| Utility                                              | Source                                                      |
| ---------------------------------------------------- | ----------------------------------------------------------- |
| `fileExists`, `directoryExists`                      | `__tests__/helpers.ts` (test) or `utils/fs.ts` (production) |
| `readTestYaml`                                       | `__tests__/helpers.ts`                                      |
| `buildWizardResult`, `buildSourceResult`             | `__tests__/helpers.ts`                                      |
| `parseTestFrontmatter`                               | `__tests__/helpers.ts`                                      |
| `getTestSkill(name, overrides?)`                     | `__tests__/test-fixtures.ts` (re-exported from helpers)     |
| `createMockSkill(id, category, overrides?)`          | `__tests__/helpers.ts`                                      |
| `createComprehensiveMatrix()`, `createBasicMatrix()` | `__tests__/helpers.ts`                                      |
| `createTestDirs()`, `cleanupTestDirs()`              | `__tests__/helpers.ts`                                      |

**6.3** Extract local test helpers when 3+ tests share identical setup/assertion logic.

```ts
async function expectFlagAccepted(args: string[]): Promise<void> {
  const { error } = await runCliCommand(args);
  const output = error?.message || "";
  expect(output.toLowerCase()).not.toContain("unknown flag");
}
```

**6.4** Use `getTestSkill(name, overrides?)` from `test-fixtures.ts` for standard skill fixtures. For custom skills not in the fixture list, use `createMockSkill(id, category, overrides?)` from `helpers.ts`. Do not define per-test skill factory functions. Available fixture names: `react`, `vue`, `zustand`, `hono`, `vitest`, `drizzle`, `scss-modules`, `auth-patterns`, `methodology`.

**6.5** Use named constants from `test-constants.ts` for keyboard input (`ARROW_UP`, `SPACE`, `ENTER`, `ESCAPE`) and timing (`RENDER_DELAY_MS`, `INPUT_DELAY_MS`, `STEP_TRANSITION_DELAY_MS`).

**6.6** Every exported utility function must have a test file.

---

## 7. Type Safety

**7.1** Use `typedEntries()` / `typedKeys()` from `utils/typed-object.ts`. No `Object.entries(obj) as [K, V][]`.

```ts
// BAD                                                    // GOOD
(Object.entries(obj) as [AgentName, AgentConfig][])       typedEntries<AgentName, AgentConfig>(obj)
```

**7.2** Boundary casts only at data entry points (JSON.parse, YAML parse, fs reads). Add a comment explaining why. No mid-pipeline casts. See `docs/type-conventions.md` for the full boundary cast taxonomy.

**7.3** Use Zod schemas at JSON/YAML parse boundaries. No `JSON.parse(...) as T` in production code. For YAML files, prefer `safeLoadYamlFile(path, schema)` from `utils/yaml.ts` -- it combines `readFileSafe()` (size limit), YAML parsing, and Zod validation in one call. For JSON, parse then validate with `schema.safeParse()`.

**7.4** Use `formatZodErrors(issues)` from `schemas.ts` for Zod error display. Pass `result.error.issues` (not the full error object). No inline `issues.map(...)`. Note: `plugin-validator.ts` has a local `formatZodErrors(error)` variant that takes the full `z.ZodError` for multi-error validation output.

**7.5** Post-safeParse `as T` is acceptable when `.passthrough()` widens Zod output. Add a comment.

---

## 8. DRY

**8.1** Extract a shared helper when the same 5+ lines appear in 3+ locations. Place in nearest shared scope.

**8.2** Three similar lines is acceptable. Do not prematurely abstract.

```ts
// OK: no abstraction needed
const intro = await readFile(path.join(dir, STANDARD_FILES.INTRO_MD));
const workflow = await readFile(path.join(dir, STANDARD_FILES.WORKFLOW_MD));
const examples = await readFileOptional(path.join(dir, STANDARD_FILES.EXAMPLES_MD), "");
```

**8.3** Compose existing functions before creating new ones.

**8.4** Prefer Remeda utilities over hand-rolled loops when they improve clarity. Production: `unique`, `uniqueBy`, `sortBy`, `groupBy`, `mapValues`, `pipe`, `flatMap`, `filter`, `countBy`, `sumBy`, `difference`, `last`, `zip`. Used across 20+ files.

---

## 9. Dead Code

**9.1** Remove exported functions with zero imports outside their file. Search first, then remove tests.

**9.2** Un-export symbols only used within their own file. If a module-level constant is only consumed to derive an exported value, keep it un-exported (e.g., `CLI_ROOT` -> `PROJECT_ROOT` in `consts.ts`).

**9.3** Delete skipped tests or fix them. No `it.skip` without a linked issue.

**9.4** Remove commented-out code. Git history is the archive.

**9.5** Delete barrel files (`index.ts`) that only re-export from 1-2 modules. Import directly from the source file. Barrel files are justified when they aggregate 5+ exports from multiple modules (see `lib/configuration/index.ts`, `lib/matrix/index.ts`).

---

## 10. Store Design

**10.1** Computed values depending only on store state go in the store as getters, not in components as `useMemo`. See `getStepProgress()` in `wizard-store.ts`.

```ts
// BAD: 20-line useMemo in component
const completedSteps = useMemo(() => {
  /* business logic */
}, [store]);
// GOOD: store getter
getStepProgress: () => {
  return { completedSteps, skippedSteps };
};
```

**10.2** Store actions extract pure business logic into module-level helpers. The action calls helpers + `set()`. Helpers receive data as arguments (no store dependency).

```ts
// Module-level (no store dependency)
function resolveSkillForPopulation(skillId, skills, categories) { ... }
// Store action: thin orchestrator
populateFromSkillIds: (ids, skills, cats) => set(() => {
  for (const id of ids) { const r = resolveSkillForPopulation(id, skills, cats); ... }
})
```

**10.3** Use `useRef` for one-time initialization guards, not `useState` (avoids unnecessary re-render). See `use-wizard-initialization.ts`.

**10.4** When a store or component has substantial pure logic (validation, filtering, option building), extract it into a `lib/{concern}/` module with an `index.ts` barrel. See `lib/wizard/build-step-logic.ts`.

---

## 11. Documentation

**11.1** Add JSDoc to exported functions over 20 LOC or with non-obvious behavior. Include `@param` and `@returns` for complex signatures.

**11.2** Add field-level comments on type/interface fields with non-obvious semantics (e.g., `needsAny?: boolean` needs a comment explaining AND vs OR).

**11.3** When production behavior changes, update relevant docs. `docs/architecture.md` for pipeline, data flow, or system design changes. `docs/commands.md` for new flags, wizard steps, or keyboard shortcuts. `README.md` for user-facing setup instructions.

---

## 12. Console Output

**12.1** No `console.log` / `console.warn` / `console.error` in production code. Use `log()`, `warn()`, `verbose()` from `utils/logger.ts`. In oclif commands, use `this.log()` / `this.warn()`.

**12.2** Use named exit codes from `lib/exit-codes.ts`: `SUCCESS` (0), `ERROR` (1), `INVALID_ARGS` (2), `NETWORK_ERROR` (3), `CANCELLED` (4). No magic numbers in `process.exit()` or `this.error(..., { exit: })` calls.

**12.3** Follow the message style guide in `logger.ts` for all warning and log messages: capital first letter, single-quoted dynamic values (`'value'`), no "Warning:" prefix (added by `warn()`), lowercase after colons.

---

## 13. Imports

**13.1** New files use `.js` extensions on relative imports. Existing files keep their current style. Do not mix styles within a single file.

**13.2** No default exports. Use named exports only.
