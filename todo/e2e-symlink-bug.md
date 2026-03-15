# E2E Test Failures: macOS `/var` → `/private/var` Symlink Bug

## Problem

On macOS, `/var` is a symlink to `/private/var`. When e2e tests create temp directories via `mkdtemp`, the returned path uses `/var/folders/...` but `process.cwd()` resolves to `/private/var/folders/...`.

The `writeScopedConfigs()` function in `local-installer.ts` compares these paths using `path.resolve()`, which does NOT resolve symlinks:

```typescript
// local-installer.ts:433
const isProjectContext = path.resolve(projectDir) !== path.resolve(homeDir);
```

Result: `path.resolve("/private/var/.../tmp") !== path.resolve("/var/.../tmp")` → `true`, even though they're the same physical directory.

This causes the installer to treat a HOME-directory install as a dual-scope (project + global) install, splitting all skills into the global config. The project config ends up with just `...globalConfig.skills` and no inline skill entries.

## Proof

Debug output from e2e test:

```
Scope: 0 project, 10 global          ← all skills scoped as global
Install mode: Plugin (native install)
```

Generated config at `projectDir/.claude-src/config.ts`:

```typescript
import globalConfig from "/var/folders/.../config";

const skills: SkillConfig[] = [
  ...globalConfig.skills,            ← no inline entries
];
```

Tests then do `content.includes("web-framework-react")` on this file → fails because skill IDs only exist in the global config, not inline in the project config.

## Path comparison proof

```
child process.cwd():  /private/var/folders/84/.../ai-e2e-xxx   ← OS resolves symlink
child os.homedir():   /var/folders/84/.../ai-e2e-xxx            ← HOME env stays unresolved
path.resolve match:   false   ← BUG
fs.realpathSync match: true   ← CORRECT
```

## Affected locations

All three `path.resolve()` comparisons in `src/cli/lib/installation/local-installer.ts`:

- Line 433: `writeScopedConfigs` — decides standalone vs dual-scope config
- Line 552: `installPluginConfig` — decides directory creation
- Line 563: `installPluginConfig` — decides `projectInstallationExists`
- Line 647: `installLocal` — decides directory creation
- Line 675: `installLocal` — decides `projectInstallationExists`

Note: `init.tsx:223` already uses `fs.realpathSync()` correctly for a similar check.

## Fix

Replace `path.resolve()` with `fs.realpathSync()` in all five comparisons in `local-installer.ts`.

## Affected tests (11+)

- `e2e/lifecycle/local-lifecycle.e2e.test.ts`
- `e2e/lifecycle/plugin-lifecycle.e2e.test.ts`
- `e2e/lifecycle/cross-scope-lifecycle.e2e.test.ts`
- `e2e/lifecycle/re-edit-cycles.e2e.test.ts`
- `e2e/lifecycle/source-switching-modes.e2e.test.ts`
- `e2e/lifecycle/source-switching-per-skill.e2e.test.ts`
- `e2e/interactive/init-wizard-interactions.e2e.test.ts`
- `e2e/interactive/init-wizard-plugin.e2e.test.ts`
- `e2e/interactive/init-wizard-stack.e2e.test.ts`
- `e2e/interactive/init-wizard-ui.e2e.test.ts`
- Any other test using `HOME=tempDir` on macOS
