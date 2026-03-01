# PR Review Notes

Issues found during review of 0.50.0 → 0.51.0 changes.

---

## Crucial — Fix This Session

### Naming: remove "ts" from all public names

- [x] 1. **"ts" leaked into public names** — Functions like `loadTsConfig`, `parseTsConfigContent`, `createStacksTs`, etc. expose an implementation detail. Renamed to `loadConfig`, `parseConfigContent`, `createStacks`, etc. Grepped for all `ts` prefixes/suffixes in config-related names.
- [x] 3. **More "ts" in names: `stack-plugin-compiler.test.ts`** — e.g. `createStacksTs`. Renamed.
- [x] 21. **`tsConfig?: boolean` on `ValidationTarget` in `schema-validator.ts`** — Renamed to `isConfigFile?: boolean`.

### Silent failures in config loading

- [x] 15. **`loadTsConfig` silently returns null on malformed config** (`ts-config-loader.ts`) — Now `loadConfig` throws on malformed configs. Callers catch and degrade gracefully.
- [x] 16. **`loadProjectConfigFromDir` also silent on failure** (`project-config.ts`) — Added try/catch around `loadConfig` call, logs via `verbose()` and returns null.
- [x] 19. **`verbose()` used for real errors in `config.ts`** — Added try/catch in `loadProjectSourceConfig` and `loadGlobalSourceConfig`. `loadConfig` now throws; callers handle gracefully.

### Logic / code quality

- [x] 4. **Unnecessary branching in `stack-plugin-compiler.ts`** — Simplified stack lookup to single `const` with `||` chain, then one `if (!newStack) throw` branch.
- [x] 7. **Unnecessary alias in `source-loader.ts:196`** — Removed `cliCategories`/`cliRules` aliases, replaced all 14 usages with `defaultCategories`/`defaultRules` directly.
- [x] 12. **`normalizeStackRecord` needs rewrite** — `normalizeStackRecord` itself was already declarative (uses `mapValues`). Rewrote 6 related imperative functions to declarative: `resolveAgentConfigToSkills` (flatMap/filter/map), `buildStackProperty` (nested Object.fromEntries), `compactStackForYaml` (Object.fromEntries + extracted `compactAssignment` helper), `generateProjectConfigFromSkills` (filter pipeline + Object.fromEntries), `convertStackToCompileConfig` (one-liner Object.fromEntries), `resolveAgents` (Promise.all + Object.fromEntries).
- [x] 18. **Unnecessary `as SkillId` casts in `default-stacks.ts`** — Removed 6 unnecessary casts; string literals already satisfy the template literal type.
- [x] 20. **"should handle config with extra unknown fields" in `config-precedence.test.ts`** — Updated test description to clarify passthrough schema behavior (forward compatibility).

---

## Nice to Have — Follow-up Commit

### Test data centralization

- [x] 2. **Hardcoded paths in `plugin-info.test.ts`** — Replaced ~25 hardcoded path strings with `CLAUDE_DIR`, `CLAUDE_SRC_DIR`, `PLUGINS_SUBDIR`, `STANDARD_FILES.*` constants.
- [x] 8. **Hardcoded filenames in `local-installer.test.ts`** — Replaced ~12 hardcoded strings with constants.
- [x] 9. **Inline config construction in `installation.test.ts`** — Replaced ~14 hardcoded strings with constants.
- [x] 10. **Scattered test config definitions across test files** — Created `buildProjectConfig()` factory in `__tests__/helpers.ts`. Config variants now originate from one place.
- [x] 11. **Hardcoded import/config strings in tests** (e.g. `ts-config-writer.test.ts`) — Refactored `config-writer.test.ts` to use `buildProjectConfig()` factory. Input configs use factory; output assertions remain inline (asserting on generated format).
- [x] 13. **Inline configs in `ts-config-round-trip.test.ts`** — Refactored `config-round-trip.test.ts` to use `buildProjectConfig()` factory for all 6 inline config objects.
- [x] 17. **Inline configs in `project-config.test.ts`** — Reviewed; loading tests use `writeTestTsConfig` with raw objects (testing parser), validation tests use intentionally invalid data, round-trip tests use `generateProjectConfigFromSkills`. No inline `ProjectConfig` construction found — no changes needed.

### Test infrastructure

- [x] 5. **Fragile `vi.mock` paths in `matrix-loader.test.ts`** (pre-existing) — Investigated and addressed.
- [x] 6. **Duplicated mocks in `matrix-loader.test.ts`** (pre-existing) — Addressed.
- [x] 14. **Imperative for-loop assertion in `default-stacks.test.ts`** — Replaced with declarative `it.each()` and `.every()`, added `typedEntries` import.
