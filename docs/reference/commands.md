# CLI Commands Reference

Every command available in the `agentsinc` CLI. Run `agentsinc <command> --help` for flag help; this doc is the fuller picture: purpose, invocation model, flag semantics, and current gaps.

> **Base flag (all commands unless noted):** `--source, -s <path|url>` — Skills source path or URL. Defined on `BaseCommand.baseFlags` and inherited by every command that spreads `...BaseCommand.baseFlags` into its `flags` object.

## Command matrix

| Command                  | Purpose                                                        | Interactive | Flags (excl. base)                                                                                         |
| ------------------------ | -------------------------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `init`                   | First-time wizard: pick a stack, skills, agents, compile       | Yes         | `--refresh`                                                                                                |
| `edit`                   | Modify an existing installation via the wizard                 | Yes         | `--refresh`, `--agent-source`                                                                              |
| `compile`                | Recompile agents from the current config                       | No          | `--verbose`                                                                                                |
| `update [skill]`         | Pull latest skill content from source (optionally one skill)   | Hybrid      | `--yes/-y`, `--no-recompile`                                                                               |
| `search [query]`         | Search or browse skills across sources                         | Hybrid      | `--interactive/-i`, `--category/-c`, `--refresh`, `--json`                                                 |
| `eject <type>`           | Export partials / templates / skills / all for customization   | No          | `--force/-f`, `--output/-o`, `--refresh`                                                                   |
| `new skill <name>`       | Scaffold a local skill                                         | No          | `--author/-a`, `--category/-c`, `--domain/-d`, `--force/-f`, `--output/-o`                                 |
| `new agent <name>`       | Scaffold a local agent (Claude assists via prompt)             | Yes         | `--purpose/-p`, `--force/-f`, `--non-interactive/-n`, `--refresh/-r`                                       |
| `new marketplace <name>` | Scaffold a new skill marketplace repo                          | No          | `--force/-f`, `--output/-o`                                                                                |
| `import skill <source>`  | Import skills from a third-party GitHub repo                   | No          | `--skill/-n`, `--all/-a`, `--list/-l`, `--subdir`, `--force/-f`, `--refresh`                               |
| `build plugins`          | Compile skills/agents into distributable plugin bundles        | No          | `--skills-dir/-s`, `--agents-dir/-a`, `--output-dir/-o`, `--skill`, `--verbose/-v`                         |
| `build marketplace`      | Generate `marketplace.json` from built plugins                 | No          | `--plugins-dir/-p`, `--output/-o`, `--name`, `--version`, `--description`, `--owner-name`, `--owner-email` |
| `doctor`                 | Diagnose installation, skills, agents, orphans                 | No          | `--verbose/-v` _(does NOT inherit base `--source`)_                                                        |
| `list`                   | Show installation mode, source, skills, agents                 | No          | (base only)                                                                                                |
| `validate`               | Validate registered sources, installed plugins, skills, agents | No          | `--verbose/-v`                                                                                             |
| `uninstall`              | Remove CLI-managed files, optionally including `.claude-src/`  | Yes         | `--yes/-y`, `--all`                                                                                        |

Interactive = renders an Ink UI. Hybrid = interactive only when a required arg is omitted (`search`) or when prompting for confirmation (`update`).

---

## Core

### `init`

**File:** `src/cli/commands/init.tsx`

Greenfield setup. Detects if already installed (shows dashboard), otherwise opens the wizard: stack → sources → build → agents → confirm. Writes config and compiles agents.

**Flags:** `--refresh` (force remote source re-fetch), `--source` (override skills source).

**When to use:** First run on a machine, or first run inside a project that needs a project-scoped config.

---

### `edit`

**File:** `src/cli/commands/edit.tsx`

Re-enters the wizard with the current selections pre-loaded. Diff is shown at the confirm step. On confirm: re-copies locals, installs/uninstalls plugins, re-writes config, recompiles agents.

**Flags:** `--refresh`, `--agent-source` (remote agent partials source — default local CLI), `--source`.

**When to use:** Change skills, agents, scope, or mode after `init`.

---

### `compile`

**File:** `src/cli/commands/compile.ts`

Re-runs the agent compiler using the persisted config. Non-interactive — safe in scripts and CI. Dual-pass (global + project) when both installations exist.

**Flags:** `--verbose`, `--source`.

**When to use:** After hand-editing `config.ts`, after a skill update, or when agents feel stale.

---

### `update [skill]`

**File:** `src/cli/commands/update.tsx`

Pulls the latest skill content from the configured source. With no argument, updates every out-of-date skill after showing a diff and prompting for confirmation. With an argument, updates that one skill only. By default, recompiles agents afterward.

**Flags:** `--yes/-y` (skip confirmation), `--no-recompile` (update files only, don't rebuild agents), `--source`.

**When to use:** Source marketplace has newer skill revisions than what's on disk.

> **TODO:** Exercise end-to-end against a modified source — confirm the diff view, confirmation prompt, `--yes` bypass, `--no-recompile` skip, and the single-skill `update <name>` path all behave correctly and that the post-update recompile produces the expected agent output.

---

### `search [query]`

**File:** `src/cli/commands/search.tsx`

Non-interactive when `--json` or `query` is supplied; interactive (multi-select + preview) otherwise.

**Flags:** `--interactive/-i`, `--category/-c` (filter), `--refresh`, `--json`, `--source`.

**When to use:** Explore what's in the current source(s) without opening the wizard.

---

## Customization

### `eject <type>`

**File:** `src/cli/commands/eject.ts`

Exports source material for user modification. Types: `agent-partials`, `templates`, `skills`, `all`.

**Flags:** `--force/-f`, `--output/-o` (default: `.claude/` in cwd), `--refresh`, `--source`.

---

### `new skill <name>`

**File:** `src/cli/commands/new/skill.ts`

Scaffolds a `SKILL.md` + `metadata.yaml` in the detected local marketplace (or `--output`).

**Flags:** `--author/-a`, `--category/-c`, `--domain/-d`, `--force/-f`, `--output/-o`, `--source`.

> **TODO:** Verify the generated `metadata.yaml` satisfies every field the CLI's skill loader expects (`parseFrontmatter`, `skillMetadataSchema`, matrix registration). After scaffolding, the new skill must appear in `agentsinc search`, `agentsinc list`, and in the wizard's skill grid — round-trip test required.

---

### `new agent <name>`

**File:** `src/cli/commands/new/agent.tsx`

Interactive scaffolder. Prompts for purpose, then drives Claude (via the `claude` CLI) to draft the agent's identity/playbook/output partials.

**Flags:** `--purpose/-p`, `--force/-f`, `--non-interactive/-n`, `--refresh/-r`, `--source`.

**Requires:** Anthropic's `claude` CLI on `$PATH`.

> **TODO:** Same as `new skill` — verify the scaffolded agent produces a valid `metadata.yaml` (agent schema, not skill schema) and that the new agent is picked up by the agent loader, appears in `agentsinc list`, and is selectable in the wizard's agents step. Round-trip test from scaffold → visible in CLI surfaces.

---

### `new marketplace <name>`

**File:** `src/cli/commands/new/marketplace.ts`

Creates a fresh marketplace directory with `skills-matrix.yaml`, default categories, and starter skills.

**Flags:** `--force/-f`, `--output/-o`, `--source`.

---

### `import skill <source>`

**File:** `src/cli/commands/import/skill.ts`

Imports skills from a GitHub repo (`github:owner/repo`, `owner/repo`, or URL).

**Flags:** `--skill/-n`, `--all/-a`, `--list/-l`, `--subdir` (default: `skills`), `--force/-f`, `--refresh`, `--source`.

**Modes:** `--list` prints available skills; `--skill <name>` imports one; `--all` imports every skill in the repo. At least one must be provided.

> **TODO:** Exercise end-to-end against a real third-party GitHub repo (e.g. `github:vercel-labs/agent-skills`). Confirm `--list`, `--skill`, and `--all` modes, non-standard `--subdir` layouts, and that imported skills land in `.claude/skills/` with `metadata.yaml` that the CLI's loader accepts.

---

## Build (distribution / authoring)

### `build plugins`

**File:** `src/cli/commands/build/plugins.ts`

Compiles skills (and optionally agents) from a source tree into standalone Claude Code plugins. Used by marketplace authors.

**Flags:** `--skills-dir/-s`, `--agents-dir/-a`, `--output-dir/-o`, `--skill` (single-skill mode), `--verbose/-v`, `--source`.

---

### `build marketplace`

**File:** `src/cli/commands/build/marketplace.ts`

Walks `--plugins-dir` and writes a `marketplace.json` describing every plugin.

**Flags:** `--plugins-dir/-p`, `--output/-o`, `--name`, `--version`, `--description`, `--owner-name`, `--owner-email`, `--source`.

---

## Diagnostics

### `doctor`

**File:** `src/cli/commands/doctor.ts`

Runs health checks: config parse, skills present, agents compiled, orphans, etc. Exits non-zero if any check fails.

**Flags:** `--verbose/-v`.

**Note:** `doctor` does **not** spread `BaseCommand.baseFlags`, so it does not accept `--source`. Every other command does.

---

### `list`

**File:** `src/cli/commands/list.tsx`

Prints the installation's mode, source, and a scope-grouped skill/agent summary. Ink component when TTY; plain text fallback otherwise.

**Flags:** `--source` (base only).

---

### `validate`

**File:** `src/cli/commands/validate.ts`

Takes no arguments. Runs four validation passes over everything the CLI knows about, aggregates the results into one summary line, and exits non-zero if any pass produced an error.

**Passes (in order):**

1. **Sources** — every source from `resolveAllSources(projectDir)` (primary + extras). Uses `validateSource`, which internally runs six sub-passes over a source tree:
   - **Skills** (`src/skills/**/metadata.yaml` + `SKILL.md`) — schema + pairing + displayName/dirname consistency + snake_case detection
   - **Matrix cross-references** — `checkMatrixHealth` confirms `requires` / `conflictsWith` IDs resolve
   - **Stacks** — `src/stacks/*/config.yaml` against `stackConfigValidationSchema`, plus `src/stacks/**/skills/**/metadata.yaml` against `metadataValidationSchema`
   - **Source-side agents** — `src/agents/**/metadata.yaml` against `agentYamlGenerationSchema`
   - **TS config exports** — runtime-loads `config/skill-categories.ts`, `skill-rules.ts`, `stacks.ts` via `loadConfig` and Zod-checks each default export
   - Each sub-pass skips absent targets without error (source shape is flexible — a skills-only source is valid).

   **Remote sources** (`github:owner/repo`, `http(s)://…`, etc.) are skipped with a `— skipped (remote source)` row; only local paths are walked, since the user isn't the author of remote ones.

2. **Plugins** — `~/.claude/plugins/` and `<project>/.claude/plugins/`. Uses `validatePlugin` / `validateAllPlugins`.
3. **Installed skills** — `~/.claude/skills/` and `<project>/.claude/skills/`. Checks each skill has `SKILL.md` + valid `metadata.yaml` against the strict schema (`customMetadataValidationSchema` for `custom: true` entries).
4. **Installed agents** — `~/.claude/agents/*.md` and `<project>/.claude/agents/*.md`. Checks frontmatter parses and required fields are present; enforces kebab-case on `name`.

**Dedup:** when `cwd === $HOME`, the global and project paths for skills/agents resolve to the same directory; the project pass is skipped to avoid double-validation (matches `doctor`). The plugins pass does **not** dedupe today — known, deferred.

**Flags:** `--verbose/-v`. `--source` is inherited from `BaseCommand.baseFlags` but ignored.

**Exit codes:** `EXIT_CODES.ERROR` if any pass produced an error; `EXIT_CODES.SUCCESS` otherwise. Warnings are reported but non-fatal.

**Sample output:**

```
Validating sources
  primary                        github:agents-inc/skills                 — skipped (remote source)
  extras/local-marketplace       /home/me/my-skills                       152 skill(s), 0 error(s), 0 warning(s)

Validating plugins
  ~/.claude/plugins                                                       4 plugin(s), 0 invalid
  ~/project/.claude/plugins                                               — not present

Validating skills
  ~/.claude/skills                                                        12 skill(s), 0 invalid
  ~/project/.claude/skills                                                — none

Validating agents
  ~/.claude/agents                                                        4 agent(s), 0 invalid
  ~/project/.claude/agents                                                — not present

Result: 0 error(s), 0 warning(s)
```

**Constants (file-local, in `validate.ts`):** `COL_NAME_WIDTH`, `COL_URL_WIDTH`, `COL_PATH_WIDTH` for row alignment; `VALIDATE_STATUS.{SKIPPED_REMOTE, NOT_PRESENT, EMPTY, NO_PLUGINS}` for the dashed status markers. `displayDir()` renders absolute paths as `~/...` uniformly across all three installed-directory passes.

> Not to be confused with `doctor`, which validates the **installed state** coherence (orphans, config parse). `validate` is for checking content — sources, plugin bundles, and installed skill/agent files the CLI already knows about.

---

### `uninstall`

**File:** `src/cli/commands/uninstall.tsx`

Removes CLI-managed plugins and compiled agents. With `--all`, also removes `.claude-src/` (the config directory).

**Flags:** `--yes/-y` (skip confirm), `--all` (also remove `.claude-src/`), `--source` (base).

---

## Conventions across commands

- **Exit codes** from `EXIT_CODES`: `SUCCESS = 0`, `ERROR = 1`, `CANCELLED = 2`, etc. Every `this.error()` call passes an explicit code.
- **Base flag `--source`** is accepted by every command except `doctor`.
- **Interactive vs non-interactive TTY handling** — `update`, `list`, `search`, `new agent` all degrade to non-interactive output when `process.stdin.isTTY` is false.
- **`--refresh`** consistently means "ignore cache and fetch from remote". Used by commands that read from a source.
- **`--force/-f`** consistently means "overwrite existing files" for scaffolding and eject commands.

---

## TODOs (per command)

| Command        | TODO                                                                                                                |
| -------------- | ------------------------------------------------------------------------------------------------------------------- |
| `update`       | Exercise end-to-end against a modified source — confirmation, `--yes`, `--no-recompile`, single-skill path.         |
| `new skill`    | Verify generated `metadata.yaml` passes the skill loader and makes the new skill visible in `search`/`list`/wizard. |
| `new agent`    | Same as `new skill` but for the agent schema — scaffolded agent must show up in `list` and the wizard agents step.  |
| `import skill` | Exercise end-to-end against a real GitHub repo; cover `--list`, `--skill`, `--all`, `--subdir`.                     |

## Known gaps / audit items

Updated 2026-04-14. Tracked here rather than in inline comments.

1. **`edit --agent-source` still exists.** The flag was recently removed from `compile` and `build stack` (the latter via command removal). If the user wants the same cleanup on `edit`, audit it — otherwise document the use case.
2. **`doctor` does not inherit `BaseCommand.baseFlags`.** Likely an oversight from when `--source` was removed from `doctor`. Either intentionally exclude it going forward or add the spread back with deliberate scope.
3. **Scaffolding commands (`new skill`, `new agent`, `new marketplace`) have ~1 E2E test each.** Edge cases (kebab-case validation, existing dirs without `--force`, metadata defaults) are under-covered.
4. **`import skill --subdir`** is a string flag with a default, but the use case (non-`skills/` layouts) isn't documented in the README or guides.
5. **`update` and `search` non-TTY behavior** — limited E2E coverage for CI / piped execution.
6. **`validate` plugins pass double-lists when `cwd === $HOME`.** The dedup that skills and agents passes use isn't applied to plugins. Minor cosmetic issue, deferred.

---

## AI-docs drift log

Running list of internal `.ai-docs/` references that lag behind the CLI's actual behavior. Tick items off as they're brought up to date. Commands are the primary surface that mutates — every time a command is added, removed, or has its flags changed, the internal map references need a pass.

**Why this exists:** agents rely on these maps to locate code. Stale pointers send them to non-existent files or removed flags and produce broken work. Keep this list fresh — append as drift is discovered.

- [ ] `.ai-docs/DOCUMENTATION_MAP.md` — mentions `doctor --source` and `compile --agent-source` (both removed 2026-04-14). Two `build stack` mentions at lines 606 and 955 are inside historical validation-round log entries; leave those as period-correct records.
- [x] `.ai-docs/reference/boundary-map.md` — `build stack` row removed 2026-04-14. Still verify `doctor --source` / `compile --agent-source` references are stripped.
- [ ] `.ai-docs/reference/commands.md` — two `build stack` entries (table row + per-command detail section at ~line 448).
- [ ] `.ai-docs/reference/dependency-graph.md` — three `build stack` rows (~lines 97, 123, 141).
- [ ] `.ai-docs/reference/testing/e2e-infrastructure.md` — references the deleted `e2e/interactive/build-stack.e2e.test.ts` (~line 102).
- [ ] `.ai-docs/reference/test-infrastructure.md` — same deleted test file (~line 315).
- [ ] `.ai-docs/standards/e2e/page-objects.md` — prose example mentions a "build stack selector" (~line 289).
- [ ] `e2e/TODO-E2E.md` — historical task-tracking log entries for the removed `build stack` (~lines 93–95, 140, 360, 400). Decide whether to prune or leave as history.
- [ ] `.ai-docs/DOCUMENTATION_MAP.md` (~lines 386–387) — references `schema-validator.ts:200` / `:156` with line numbers; `validateAllSchemas` deleted, surviving `formatZodErrors` is now at a different line. Drop line numbers per the "no source code line numbers in .ai-docs" rule and update the symbol list.
- [ ] `.ai-docs/reference/commands.md` (~line 203) — mentions the deleted `validateAllSchemas()`.
- [ ] `.ai-docs/reference/dependency-graph.md` (~line 117) — lists `validateAllSchemas, printValidationResults` under `validate`; both deleted.
- [ ] **When `new skill` / `new agent` metadata generation is hardened** (see TODOs) — update any skill-loading or agent-loading reference docs that describe the current schema expectations.
