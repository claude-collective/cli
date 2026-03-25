# Assertions

How to verify outcomes after a test runs.

---

## Matchers Are the Standard

All file-based assertions go through custom Vitest matchers. Tests never call `readFile`, `readdir`, or `fileExists` directly in `it()` blocks. The matcher encapsulates the file reading.

**Why:** If the config file format changes from `config.ts` to `config.yaml`, a matcher-based test needs zero changes -- only the matcher implementation updates. A test that calls `readFile(path.join(dir, ".claude-src", "config.ts"))` breaks everywhere.

---

## Registering Matchers

Every test file that uses project matchers must include this side-effect import:

```typescript
import "../matchers/setup.js";
```

This registers the matchers with Vitest's `expect.extend()` and augments the TypeScript types. Without it, `toHaveConfig` and friends are not available.

---

## Available Matchers

All matchers accept a `ProjectHandle` (`{ dir: string }`) as the first argument via `expect()`.

### `toHaveConfig(expectations?)`

Checks that `.claude-src/config.ts` exists. Optionally validates content.

```typescript
// Config exists (any content)
await expect(project).toHaveConfig();

// Config contains specific skill IDs, source, and agents
await expect(project).toHaveConfig({
  skillIds: ["web-framework-react"],
  source: "agents-inc",
  agents: ["web-developer"],
});
```

### `toHaveCompiledAgents()`

Checks that `.claude/agents/` contains at least one `.md` file.

```typescript
await expect(project).toHaveCompiledAgents();
```

### `toHaveCompiledAgent(name)`

Checks that a specific agent file exists and starts with YAML frontmatter (`---`).

```typescript
await expect(project).toHaveCompiledAgent("web-developer");
```

### `toHaveCompiledAgentContent(name, { contains?, notContains? })`

Checks that a compiled agent's content includes or excludes specific strings.

```typescript
await expect({ dir: projectDir }).toHaveCompiledAgentContent("web-developer", {
  contains: ["web-framework-react", "name: web-developer"],
  notContains: ["api-framework-hono"],
});
```

### `toHaveSkillCopied(skillId)`

Checks that `SKILL.md` exists at `.claude/skills/<skillId>/SKILL.md`.

```typescript
await expect(result.project).toHaveSkillCopied("web-framework-react");
```

### `toHaveLocalSkills(ids?)`

Checks that `.claude/skills/` exists and optionally contains specific skill directories.

```typescript
// Any skills directory with entries
await expect(project).toHaveLocalSkills();

// Specific skill IDs present
await expect(project).toHaveLocalSkills(["web-framework-react", "api-framework-hono"]);
```

### `toHaveNoLocalSkills()`

Checks that `.claude/skills/` is empty or does not exist.

```typescript
await expect(project).toHaveNoLocalSkills();
```

### `toHavePlugin(key)`

Checks that a plugin is enabled in `.claude/settings.json`.

```typescript
await expect(project).toHavePlugin("plugin-key-here");
```

### `toHavePluginInRegistry(key, scope?)`

Checks that a plugin's installation record exists in `.claude/plugins/installed_plugins.json`. Optionally filters by scope (`"project"` or `"user"`).

```typescript
await expect({ dir: globalHome }).toHavePluginInRegistry("plugin-key", "user");
```

### `toHaveNoPlugins()`

Checks that no plugins are enabled in `settings.json`.

```typescript
await expect(project).toHaveNoPlugins();
```

### `toHaveEjectedTemplate()`

Checks that the ejected `agent.liquid` template exists at `.claude-src/agents/_templates/agent.liquid`.

```typescript
await expect(project).toHaveEjectedTemplate();
```

### `toHaveSettings(expectations?)`

Checks that `settings.json` exists. Optionally validates a nested key path and value.

```typescript
// Settings file exists
await expect(project).toHaveSettings();

// Specific key has specific value
await expect(project).toHaveSettings({
  hasKey: "permissions.allow",
  keyValue: ["Read(*)"],
});
```

---

## Exit Code Assertions

Always use named constants from `EXIT_CODES`. Never use bare numbers.

```typescript
expect(exitCode).toBe(EXIT_CODES.SUCCESS); // 0
expect(exitCode).toBe(EXIT_CODES.ERROR); // 1
expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS); // 2
```

**Why:** `expect(exitCode).toBe(0)` is opaque. Named constants document the intent and provide a single source of truth if values change.

---

## Object Equality

Use `toStrictEqual` for object and array comparisons. Never use `toEqual` for objects.

- `toStrictEqual` catches extra properties and class instance mismatches
- `toEqual` silently ignores these, masking bugs

```typescript
// Good
expect(result).toStrictEqual({ valid: true });
expect(parsed.skills).toStrictEqual([]);

// Bad -- extra properties pass silently
expect(result).toEqual({ valid: true });
```

`toBe` is fine for primitives (strings, numbers, booleans) where strict equality is the same.

---

## Output Text Assertions

**Use `toContain` for substrings.** UI text evolves, so assert on distinctive fragments rather than exact strings:

```typescript
expect(output).toContain("Discovered 1 local skills");
```

**Use `toMatch` with regex for dynamic content:**

```typescript
expect(output).toMatch(/Recompiled \d+ global agents/);
```

**Use `STEP_TEXT` constants** for wizard step text, not raw strings:

```typescript
expect(output).toContain(STEP_TEXT.COMPILE_SUCCESS);
```

**Never assert on single characters or whitespace.** `toContain("+")` matches skill IDs, not change indicators. `toContain("G ")` matches any word starting with G. Use distinctive substrings.

---

## Negative Assertions

Assert specific absence, not generic "no error."

```typescript
// Bad: too broad, matches skill IDs containing "error"
expect(output).not.toContain("error");

// Good: asserts a specific skill was not included
expect(configContent).not.toContain("web-styling-tailwind");

// Good: asserts no archive warnings
expect(output).not.toContain("Failed to archive");
expect(output).not.toContain("ENOENT");
```

---

## When to Add a New Matcher

If you find yourself calling `readFile` in a test to check a file's content, that is a sign a new matcher is needed. Add it to `e2e/matchers/project-matchers.ts`, register it in `e2e/matchers/setup.ts` (both the `expect.extend` call and the TypeScript type augmentation), and use it in your test.

A good matcher:

- Takes a `{ dir: string }` as the receiver
- Reads files internally (the test never sees `readFile`)
- Returns clear error messages that include what was expected and what was found
- Supports both positive and negative assertions (the `message` function)

---

## Related

- [test-structure.md](./test-structure.md) -- Three-phase pattern (setup, interaction, assertion)
- [anti-patterns.md](./anti-patterns.md) -- Weak assertion anti-patterns
- [patterns.md](./patterns.md) -- Complete examples showing assertions in context
