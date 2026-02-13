# Creating a Marketplace

A marketplace is a Git repository containing plugins and a `marketplace.json` manifest. Claude Code fetches the repo, reads the manifest, and lets users browse and install plugins.

Official Claude Code docs: [Create and distribute a plugin marketplace](https://code.claude.com/docs/en/plugin-marketplaces)

This guide covers two approaches:

1. **Manual** -- create the plugin structure and `marketplace.json` by hand (simpler, follows the official Claude Code docs exactly)
2. **Automated** -- use `cc build plugins` + `cc build marketplace` to generate everything from ejected skills (adds version tracking, manifest generation, README generation)

---

## Prerequisites

- **Ejected skills** -- from the public marketplace or your own custom skills
- **A Git repository** to host the marketplace (GitHub, GitLab, etc.)
- **Claude Collective CLI** installed (`cc` command available) -- only needed for the automated approach

---

## Approach 1: Manual (Official Claude Code Plugin Format)

If you already have skills as `SKILL.md` files, you can create a marketplace directly following the [official plugin structure](https://code.claude.com/docs/en/plugins-reference#plugin-directory-structure):

```
my-marketplace/
+-- .claude-plugin/
|   +-- marketplace.json
+-- plugins/
    +-- my-skill-plugin/
    |   +-- .claude-plugin/
    |   |   +-- plugin.json
    |   +-- skills/
    |       +-- react/
    |           +-- SKILL.md
    +-- another-plugin/
        +-- .claude-plugin/
        |   +-- plugin.json
        +-- skills/
            +-- hono/
                +-- SKILL.md
```

Each `plugin.json` needs at minimum a `name`:

```json
{
  "name": "my-skill-plugin",
  "description": "React development patterns",
  "version": "1.0.0"
}
```

And `marketplace.json`:

```json
{
  "name": "my-marketplace",
  "owner": { "name": "Your Name" },
  "plugins": [
    {
      "name": "my-skill-plugin",
      "source": "./plugins/my-skill-plugin",
      "description": "React development patterns"
    }
  ]
}
```

Plugin sources can also reference external repos:

```json
{
  "name": "external-plugin",
  "source": { "source": "github", "repo": "owner/plugin-repo", "ref": "v2.0.0" }
}
```

Test locally, then push:

```bash
/plugin marketplace add ./my-marketplace
/plugin install my-skill-plugin@my-marketplace
```

---

## Approach 2: Automated (Claude Collective CLI Build Pipeline)

The recommended flow for teams using Claude Collective. The marketplace repo is itself a standard CC project after ejection.

### Architecture

Two separate repositories are involved:

**Marketplace repo** (maintained by the team):

```
private-marketplace/
+-- src/
|   +-- skills/                  # ejected/customized skills (source of truth)
|   |   +-- web-framework-react/
|   |   |   +-- SKILL.md
|   |   |   +-- metadata.yaml
|   |   +-- api-framework-hono/
|   |       +-- SKILL.md
|   +-- agents/                  # agent partials (shared, improvable by the team)
|       +-- web-developer/
|       |   +-- agent.yaml
|       |   +-- intro.md
|       |   +-- workflow.md
|       +-- api-developer/
|           +-- agent.yaml
|           +-- intro.md
|           +-- workflow.md
+-- .claude-src/
|   +-- config.yaml              # project config (source, marketplace, etc.)
+-- config/
|   +-- skills-matrix.yaml       # skill categories, aliases, relationships
|   +-- stacks.yaml              # stack definitions (agent + skill groupings)
+-- dist/
|   +-- plugins/                 # built with: cc build plugins
|       +-- web-framework-react/
|       |   +-- .claude-plugin/plugin.json
|       |   +-- skills/...
|       |   +-- README.md
|       +-- api-framework-hono/
|           +-- .claude-plugin/plugin.json
|           +-- skills/...
+-- .claude-plugin/
    +-- marketplace.json         # built with: cc build marketplace
```

**Important:** Agent partials live in `src/agents/` (matching the CLI's `DIRS.agents` constant). This is the standard location where `loadAllAgents()` scans for `agent.yaml` files. Each agent directory must contain an `agent.yaml` file defining the agent's metadata (id, title, tools, etc.) plus partial markdown files (`intro.md`, `workflow.md`, etc.) that get compiled into the final agent.

Skills live in `src/skills/` to match the CLI's default `SKILLS_DIR_PATH`. This means the source loader finds them with zero changes, and `cc build plugins` works without `--skills-dir`.

**Consumer project** (after running `cc init`):

```
my-app/
+-- .claude/
|   +-- agents/                  # compiled agents (gitignored, personalized)
|       +-- web-developer.md     # compiled from marketplace partials + selected skills
|       +-- api-developer.md
+-- .claude-src/
|   +-- config.yaml              # tracks source, skill selection, marketplace
+-- .gitignore                   # includes .claude/agents/
+-- src/                         # the actual project
```

Skills are installed as **native Claude Code plugins** in the consumer project -- not copied to `.claude/skills/`. Agents are compiled locally from the marketplace's agent partials, personalized to each developer's skill selection, and gitignored so each team member has their own.

---

## Step 1: Eject Skills and Agents

If starting from the public Claude Collective marketplace, eject everything:

```bash
cc eject --all
```

This copies skills to `.claude/skills/`, compiled agents to `.claude/agents/`, and agent partials to `.claude-src/agents/`.

Move skills to `src/skills/` and agent partials to `src/agents/` to match the CLI's standard layout, and remove `.claude/agents/` (agents are only compiled in consumer projects, not the marketplace):

```bash
mkdir -p src/skills src/agents
mv .claude/skills/* src/skills/
mv .claude-src/agents/* src/agents/
rm -rf .claude/agents
```

After restructuring:

```
my-marketplace/
+-- src/
|   +-- skills/
|   |   +-- web-framework-react/
|   |   |   +-- SKILL.md
|   |   |   +-- metadata.yaml
|   |   |   +-- reference.md         # optional
|   |   |   +-- examples/            # optional
|   |   +-- web-styling-tailwind/
|   |   |   +-- SKILL.md
|   |   +-- api-framework-hono/
|   |       +-- SKILL.md
|   +-- agents/
|       +-- web-developer/
|       |   +-- agent.yaml
|       |   +-- intro.md
|       |   +-- workflow.md
|       +-- api-developer/
|           +-- agent.yaml
|           +-- intro.md
|           +-- workflow.md
+-- .claude-src/
|   +-- config.yaml
+-- config/
    +-- skills-matrix.yaml
    +-- stacks.yaml
```

### SKILL.md Format

Each `SKILL.md` requires YAML frontmatter with `name` and `description`:

```markdown
---
name: web-framework-react
description: React development patterns and best practices
---

# React

Your skill content here...
```

The `name` field in the frontmatter is the canonical skill name used by the plugin compiler. It must follow the `SkillId` pattern: `{prefix}-{segment}-{segment}` where prefix is one of `web`, `api`, `cli`, `mobile`, `infra`, `meta`, or `security`.

### metadata.yaml Format (Optional)

```yaml
category: web-framework
author: your-name
version: "1.0"
cli_name: react
cli_description: React development patterns
tags:
  - react
  - frontend
  - ui
```

---

## Step 2: Customize

Edit skills in `src/skills/` to match your team's conventions. Improve agent partials in `src/agents/`. Add or remove stacks in `config/stacks.yaml`.

These are your team's living standards -- everyone can contribute improvements via PRs to the marketplace repo.

---

## Step 3: Build Skill Plugins

Compile all skills into standalone plugins:

```bash
cc build plugins
```

This reads from `src/skills/` and outputs to `dist/plugins/` by default. Each skill becomes a separate plugin. The plugin name matches the skill ID directly (no prefix):

```
dist/plugins/
+-- web-framework-react/
|   +-- .claude-plugin/
|   |   +-- plugin.json
|   |   +-- .content-hash
|   +-- skills/
|   |   +-- web-framework-react/
|   |       +-- SKILL.md
|   |       +-- reference.md
|   |       +-- examples/
|   +-- README.md
+-- web-styling-tailwind/
|   +-- .claude-plugin/
|   |   +-- plugin.json
|   +-- skills/
|   |   +-- web-styling-tailwind/
|   |       +-- SKILL.md
|   +-- README.md
+-- api-framework-hono/
    +-- .claude-plugin/
    |   +-- plugin.json
    +-- skills/
    |   +-- api-framework-hono/
    |       +-- SKILL.md
    +-- README.md
```

Each plugin's `plugin.json`:

```json
{
  "name": "web-framework-react",
  "version": "1.0.0",
  "description": "React development patterns and best practices",
  "skills": "./skills/"
}
```

### Version Bumping

The build command tracks content hashes. If you rebuild after modifying a skill, the version automatically bumps (major version increment). Unchanged skills keep their existing version.

---

## Step 4: Build the Marketplace Manifest

Generate `marketplace.json` from the compiled plugins:

```bash
cc build marketplace --name my-marketplace --owner-name "My Team"
```

With all options:

```bash
cc build marketplace \
  --plugins-dir dist/plugins \
  --output .claude-plugin/marketplace.json \
  --name my-marketplace \
  --version 1.0.0 \
  --owner-name "My Team" \
  --owner-email "team@example.com" \
  --description "Our custom skills marketplace"
```

Default values:

- `--plugins-dir`: `dist/plugins`
- `--output`: `.claude-plugin/marketplace.json`
- `--name`: `claude-collective`
- `--version`: `1.0.0`
- `--owner-name`: `Claude Collective`

The generated `marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "my-marketplace",
  "version": "1.0.0",
  "description": "Our custom skills marketplace",
  "owner": {
    "name": "My Team",
    "email": "team@example.com"
  },
  "metadata": {
    "pluginRoot": "./dist/plugins"
  },
  "plugins": [
    {
      "name": "api-framework-hono",
      "source": "dist/plugins/api-framework-hono",
      "description": "Hono API framework patterns",
      "version": "1.0.0",
      "category": "api"
    },
    {
      "name": "web-framework-react",
      "source": "dist/plugins/web-framework-react",
      "description": "React development patterns and best practices",
      "version": "1.0.0",
      "category": "web"
    }
  ]
}
```

Categories are auto-inferred from the plugin name prefix: `web-*` maps to `web`, `api-*` to `api`, `cli-*` to `cli`, `meta-*` to `methodology`, etc.

---

## Step 5: Commit and Push

```bash
git add .claude-plugin/ dist/plugins/ src/skills/ src/agents/ .claude-src/ config/
git commit -m "Build marketplace with skill plugins"
git push origin main
```

**Important:** The `dist/plugins/` directory and `.claude-plugin/marketplace.json` must be committed. These are the artifacts Claude Code downloads when consumers install plugins.

---

## Consumer Installation Flow

This is what happens when a team member sets up a new project using your marketplace.

### 1. Register the marketplace

```bash
# Via Claude Code
/plugin marketplace add your-org/my-marketplace

# Or via CLI
claude plugin marketplace add your-org/my-marketplace
```

### 2. Run the wizard

```bash
cc init --source github:your-org/my-marketplace
```

The wizard:

1. Fetches the marketplace source repo
2. Loads stacks from `config/stacks.yaml`
3. User picks a stack (e.g., "Next.js Fullstack")
4. User customizes skill selection (add/remove individual skills)

### 3. What gets installed

**Stack selection (Plugin Mode):** When the user selects a stack, the CLI either:

- Installs from the marketplace via `claude plugin install stackId@marketplace` (if marketplace is configured)
- Compiles the stack locally and installs via `claude plugin install ./compiled-path` (fallback)

**Individual skill selection (Plugin Mode):** When the user selects individual skills (no stack) and a marketplace is configured, each skill is installed as a native plugin via `claude plugin install {id}@{marketplace}`. Agents are compiled locally with plugin-aware references. Without a marketplace, falls back to Local Mode.

**Local Mode:** Skills are copied directly to `.claude/skills/` and agents are compiled to `.claude/agents/`.

### 4. Agents compiled locally

Agent partials are loaded from the source's `src/agents/`. The CLI compiles agents using the user's selected skills and writes them to the consumer project:

```
my-app/.claude/agents/
+-- web-developer.md     # compiled from partials + react, tailwind, zustand skills
+-- api-developer.md     # compiled from partials + hono, drizzle, better-auth skills
```

Each developer gets personalized agents based on their skill selection. Add `.claude/agents/` to `.gitignore`:

```gitignore
# Compiled agents are personalized per developer
.claude/agents/
```

### How skills are referenced in compiled agents

The Liquid template (`src/agents/_templates/agent.liquid`) emits skill references using the skill's `id` field directly:

**Preloaded skills** (agent frontmatter -- loaded automatically when the agent starts):

```yaml
---
name: web-developer
skills:
  - web-framework-react
  - web-styling-scss-modules
  - web-state-zustand
---
```

**Dynamic skills** (agent body -- loaded on demand via the Skill tool):

```markdown
### web-testing-vitest

- Invoke: `skill: "web-testing-vitest"`
- Use when: working with testing
```

When `installMode` is `"plugin"`, the compiler sets a `pluginRef` field on each skill (e.g., `web-framework-react:web-framework-react`) and uses it for both preloaded frontmatter entries and dynamic skill invocations. In Local Mode, bare skill IDs are emitted as before.

### 5. Recompile after changes

If a developer changes their skill selection later:

```bash
cc edit       # modify skill selection in the wizard
cc compile    # recompile agents with new skills
```

### Team-wide distribution

Add your marketplace to `.claude/settings.json` in the consumer project so team members are automatically prompted:

```json
{
  "extraKnownMarketplaces": {
    "my-marketplace": {
      "source": {
        "source": "github",
        "repo": "your-org/my-marketplace"
      }
    }
  }
}
```

---

## Private Repository Authentication

### Native Claude Code (git credentials)

Claude Code uses your existing git credential helpers. If `git clone` works for the repo in your terminal, it works in Claude Code. Common credential helpers:

- `gh auth login` for GitHub
- macOS Keychain
- `git-credential-store`

For background auto-updates (which can't prompt for credentials), set a token in your environment:

| Provider  | Environment variables        | Notes                                              |
| --------- | ---------------------------- | -------------------------------------------------- |
| GitHub    | `GITHUB_TOKEN` or `GH_TOKEN` | Personal access token with `repo` scope            |
| GitLab    | `GITLAB_TOKEN` or `GL_TOKEN` | Personal access token with `read_repository` scope |
| Bitbucket | `BITBUCKET_TOKEN`            | App password or repository access token            |

```bash
export GITHUB_TOKEN=ghp_your_github_token
```

### Claude Collective CLI (giget)

When consumers use `cc init --source`, the CLI fetches via `giget`, which uses the `GIGET_AUTH` environment variable:

```bash
export GIGET_AUTH=ghp_your_github_token
```

---

## What Works Today

All items verified against actual codebase as of 2026-02-13:

| Feature                                   | Status | Evidence                                                                                                                               |
| ----------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `cc build plugins`                        | Works  | `skill-plugin-compiler.ts` reads `src/skills/`, outputs `dist/plugins/{name}/`                                                         |
| `cc build marketplace`                    | Works  | `marketplace.ts` scans `dist/plugins/`, generates `marketplace.json`                                                                   |
| Native Claude Code plugin install         | Works  | `claudePluginInstall()` in `exec.ts` shells out to `claude plugin install`                                                             |
| Marketplace registration                  | Works  | `claudePluginMarketplaceAdd()` / `claudePluginMarketplaceExists()` in `exec.ts`                                                        |
| Skills matrix from source                 | Works  | `source-loader.ts` checks source for `config/skills-matrix.yaml`, falls back to CLI                                                    |
| Skills from source `src/skills/`          | Works  | `source-loader.ts` uses `SKILLS_DIR_PATH` to read from fetched source                                                                  |
| Agent partials from `src/agents/`         | Works  | `loadAllAgents()` scans `{root}/src/agents/` for `agent.yaml` files                                                                    |
| Project agents from `.claude-src/agents/` | Works  | `loadProjectAgents()` scans `.claude-src/agents/` for consumer project overrides                                                       |
| Agent compilation from partials           | Works  | `compileAgentForPlugin()` reads partials and renders via Liquid template                                                               |
| Stack installation from marketplace       | Works  | `installStackAsPlugin()` in `stack-installer.ts` handles marketplace or local compile                                                  |
| Install mode persisted                    | Works  | `installMode: "plugin"                                                                                                                 | "local"`saved to`.claude-src/config.yaml` |
| `cc edit` flow                            | Works  | Detects installation, opens wizard, applies skill changes, recompiles agents                                                           |
| `cc edit` plugin install/uninstall        | Works  | In Plugin Mode with marketplace, installs added skills and uninstalls removed skills via `claudePluginInstall`/`claudePluginUninstall` |
| Individual skill plugin install           | Works  | `installIndividualPlugins()` in `init.tsx` installs each skill via `claude plugin install {id}@{marketplace}`                          |
| Plugin-aware agent compilation            | Works  | `compileAgentForPlugin()` accepts `installMode` param; emits `pluginRef` format (`id:id`) in plugin mode                               |
| Stacks from source                        | Works  | `loadFromLocal()`/`loadFromRemote()` try source's `config/stacks.yaml` first, fall back to CLI                                         |
| Source config resolution                  | Works  | `resolveSource()`: flag > env > project config > default                                                                               |
| Agents source resolution                  | Works  | `resolveAgentsSource()`: flag > project config > default (CLI)                                                                         |

---

## What Needs Building

All key gaps have been resolved. The end-to-end private marketplace flow is complete.

### Resolved gaps (implemented 2026-02-13)

**1. ~~Stacks always load from CLI, not from source~~ DONE**

`source-loader.ts` now tries `loadStacks(sourcePath)` first in both `loadFromLocal()` and `loadFromRemote()`, falling back to `loadStacks(PROJECT_ROOT)` only when the source has no stacks. `local-installer.ts` also loads stacks from the source path.

**2. ~~Plugin-aware skill references in compiled agents~~ DONE**

`compileAgentForPlugin()` accepts an `installMode` parameter. When `"plugin"`, it sets `pluginRef` (type `PluginSkillRef`) on each skill and uses it for `preloadedSkillIds` and dynamic skill invocations. The Liquid template uses `skill.pluginRef | default: skill.id`. The `installMode` is threaded from `wizardResult.installMode` through `local-installer.ts` and from `projectConfig.installMode` through `agent-recompiler.ts`.

**3. ~~Individual skill plugin installation from wizard~~ DONE**

`init.tsx` now has `installIndividualPlugins()` which registers the marketplace (if needed) and installs each skill via `claudePluginInstall(\`${skillId}@${marketplace}\`, "project", projectDir)`. Without a marketplace, falls back to Local Mode with a helpful message.

**4. ~~Plugin-aware edit flow~~ DONE**

`edit.tsx` now calls `claudePluginInstall` for added skills and `claudePluginUninstall` for removed skills when `installation.mode === "plugin"` and a marketplace is available. Errors are logged as warnings (non-fatal) to avoid blocking the rest of the edit flow.

**5. ~~Drop `skill-` prefix from plugin names~~ DONE**

`SKILL_PLUGIN_PREFIX` changed from `"skill-"` to `""` in `plugin-manifest.ts`. Plugin names now match skill IDs directly (e.g., `web-framework-react`). Updated across `skill-plugin-compiler.ts`, `skill-fetcher.ts`, and all tests.

### Deferred

- **Stacks use skill IDs instead of display names** -- see implementation plan below.

#### Stacks Skill ID Migration Plan

`config/stacks.yaml` agent configs currently reference skills by display name alias (`react`, `zustand`, `hono`), requiring `displayNameToId` / `skill_aliases` resolution at every call site. Stacks should use full skill IDs (`web-framework-react`, `web-state-zustand`) directly. Display name aliases remain a UI/CLI-only concern (wizard, `cc info`, etc.).

**Pre-condition (DONE):** `resolveAgentConfigToSkills` in `stacks-loader.ts` already accepts both display names and full skill IDs (dual-format support via `SKILL_ID_PATTERN` fallback). This makes the migration safe — each phase can land independently.

**Phase 1 — Data only (safe, no code changes)**

Convert `config/stacks.yaml` values from display names to skill IDs (~75 replacements). All existing tests pass immediately because of dual-format support.

| Before                  | After                               |
| ----------------------- | ----------------------------------- |
| `framework: react`      | `framework: web-framework-react`    |
| `styling: scss-modules` | `styling: web-styling-scss-modules` |
| `api: hono`             | `api: api-framework-hono`           |
| `database: drizzle`     | `database: api-database-drizzle`    |

**Phase 2 — Types + code cleanup**

Change `StackAgentConfig` from `Partial<Record<Subcategory, SkillDisplayName>>` to `Partial<Record<Subcategory, SkillId>>`.

Production files (~8):

| File                                            | Change                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/types-matrix.ts`                       | `StackAgentConfig` value type → `SkillId`                                                                                               |
| `src/cli/lib/schemas.ts`                        | `stackAgentConfigSchema` value → `skillIdSchema`                                                                                        |
| `src/cli/lib/stacks/stacks-loader.ts`           | Remove `displayNameToId` param from `resolveAgentConfigToSkills` and `resolveStackSkillsFromDisplayNames`; values are already skill IDs |
| `src/cli/lib/stacks/stack-plugin-compiler.ts`   | Remove matrix loading (~13 lines) that only existed for alias resolution; remove `displayNameToId` threading                            |
| `src/cli/lib/loading/source-loader.ts`          | Remove `displayNameToId` / `skillAliases` from stack resolution calls                                                                   |
| `src/cli/lib/configuration/config-generator.ts` | Remove `displayNameToId` param from `buildStackProperty`; simplify to direct ID usage                                                   |
| `src/cli/lib/resolver/resolver.ts`              | Remove `displayNameToId` from `resolveAgentSkillsFromStack`                                                                             |
| `src/cli/components/wizard/wizard-store.ts`     | Update `populateFromStack` to pass skill IDs directly                                                                                   |

Test files (~25): Mechanical replacement of display name strings → skill ID strings in `StackAgentConfig` test fixtures. Tests that verify display name → ID resolution (Category B, ~8 files) and UI rendering (Category C, ~14 files) keep display names — they test the mapping/UI layer, not stacks.

**Phase 3 — Rename cleanup**

- Rename `resolveStackSkillsFromDisplayNames` → `resolveStackSkills`
- Remove dead `displayNameToId` imports across all files
- Net result: ~40-50 lines removed

**Scope:** ~8 production files, ~25 test files, net ~40-50 lines removed. Wizard/UI code is unaffected — `displayNameToId` stays on `MergedSkillsMatrix` for display purposes.

- **Domain filtering after stack selection** -- After selecting a stack in step 1, show a multi-choice section letting the user pick which domains to include (e.g., web + api). Only selected domains appear in the build step; unselected domains (cli, web-extras, etc.) are hidden. See `docs/stack-domain-filtering-spec.md` for the full implementation spec.
- **`cc commit` command** -- Automate the commit workflow: run `git status` + `git diff --stat` to understand changes, group them into logical conventional commits (feat/fix/refactor/test/docs/chore), stage specific files per commit (never `git add -A`), use HEREDOC format for messages, run tests before the first and last commit, update CHANGELOG.md, and bump the version. Should support `--dry-run` to preview the commit plan without executing. No co-author line added by default.
- **`cc marketplace add` command** -- allow registering a marketplace via the CC CLI instead of requiring the native Claude Code `/plugin marketplace add` command. Would wrap `claudePluginMarketplaceAdd()` which already exists in `utils/exec.ts`.
- **`meta-configuration-claude-md` skill** -- A CLAUDE.md creator skill under the `meta` domain, `configuration` subcategory. Guides the AI to generate a project-specific CLAUDE.md by analyzing the codebase: extracting file naming conventions, import patterns, testing frameworks, state management choices, styling approach, git workflow preferences, and recurring user instructions. Should produce a structured CLAUDE.md with sections for working rules, decision trees, code conventions, and checklists — similar to the one in this project. Fits under `meta` because it's a skill about configuring the AI's own working environment.
- **Inline search (Phase 6 from UX 2.0)** -- deferred per multi-source UX 2.0 implementation notes.

---

## Phased Implementation Plan

Each phase is independently testable and builds on the previous one. **All four phases are DONE** (implemented 2026-02-13).

### Phase 1: Load stacks from source instead of CLI -- DONE

**Goal:** When `cc init --source github:org/repo` fetches a source, load stacks from the source's `config/stacks.yaml` instead of the CLI's.

**Problem:** Both `loadFromLocal()` and `loadFromRemote()` in `source-loader.ts` hardcode `loadStacks(PROJECT_ROOT)`. Custom marketplace stacks are invisible.

**Changes:**

| File                                   | Change                                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/cli/lib/loading/source-loader.ts` | In `loadFromLocal()`, try `loadStacks(skillsPath)` first, fall back to `loadStacks(PROJECT_ROOT)`. In `loadFromRemote()`, try `loadStacks(fetchResult.path)` first, fall back to `loadStacks(PROJECT_ROOT)`. |

**Implementation detail:**

```typescript
// loadFromLocal, line 115 (currently: const stacks = await loadStacks(PROJECT_ROOT))
const sourceStacks = await loadStacks(skillsPath);
const stacks = sourceStacks.length > 0 ? sourceStacks : await loadStacks(PROJECT_ROOT);

// loadFromRemote, line 166 (currently: const stacks = await loadStacks(PROJECT_ROOT))
const sourceStacks = await loadStacks(fetchResult.path);
const stacks = sourceStacks.length > 0 ? sourceStacks : await loadStacks(PROJECT_ROOT);
```

The existing `loadStacks()` already handles "file not found" gracefully (returns `[]`), so the fallback pattern works cleanly.

**Stack resolution in local-installer.ts:**

`buildLocalConfig()` in `local-installer.ts:82` calls `loadStackById(wizardResult.selectedStackId, PROJECT_ROOT)`. This also needs to try the source path first. Options:

- Pass `sourcePath` through `LocalInstallOptions` to `buildLocalConfig()`
- Or load stacks from the source path passed via `sourceResult.sourcePath`

The minimal change: pass `sourceResult.sourcePath` to `buildLocalConfig()` and try `loadStackById(id, sourcePath)` first, falling back to `PROJECT_ROOT`.

**Test:**

1. Create a test source directory with a custom `config/stacks.yaml` containing a unique stack ID
2. Call `loadSkillsMatrixFromSource({ sourceFlag: "/path/to/test-source" })`
3. Verify `result.matrix.suggestedStacks` contains the custom stack
4. Verify it does NOT contain stacks only present in the CLI's `config/stacks.yaml`
5. Verify fallback: source without `config/stacks.yaml` still loads CLI stacks

**Existing tests to update:** `source-loader.test.ts` if it mocks `loadStacks` -- check that calls pass source path instead of `PROJECT_ROOT`.

---

### Phase 2: Plugin-aware agent compilation -- DONE

**Goal:** Compiled agents emit fully-qualified `plugin-name:skill-name` references when installMode is `"plugin"`.

**Problem:** The Liquid template emits `{{ skill.id }}` (bare), but Claude Code needs `plugin-name:skill-name` for plugin-installed skills.

**Changes:**

| File                                            | Change                                                                                   |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/cli/lib/resolver.ts`                       | `resolveSkillReference()` adds a `pluginRef` field to `Skill` when installMode is plugin |
| `src/cli/types/skills.ts` (or `types/index.ts`) | Add optional `pluginRef?: string` to `Skill` type                                        |
| `src/agents/_templates/agent.liquid`            | Use `skill.pluginRef` if present, otherwise `skill.id`                                   |

**Implementation detail:**

The cleanest approach is to add an optional `pluginRef` field to the `Skill` type and populate it during resolution when the compilation context indicates plugin mode.

On the `Skill` type (which extends `SkillDefinition`):

```typescript
export type Skill = SkillDefinition & {
  usage: string;
  preloaded: boolean;
  pluginRef?: string; // "web-framework-react:web-framework-react"
};
```

In `resolveSkillReference()` or a wrapper, when installMode is `"plugin"`:

```typescript
// Plugin name = skill ID (no prefix)
skill.pluginRef = `${definition.id}:${definition.id}`;
```

In the Liquid template, update the two reference points:

```liquid
{# Frontmatter skills list #}
{% for skillId in preloadedSkillIds %}  - {{ skillId }}
{% endfor %}

{# Dynamic skills invocation #}
- Invoke: `skill: "{{ skill.id }}"`
```

becomes:

```liquid
{# Frontmatter #}
{% for skill in preloadedSkills %}  - {{ skill.pluginRef | default: skill.id }}
{% endfor %}

{# Dynamic #}
- Invoke: `skill: "{{ skill.pluginRef | default: skill.id }}"`
```

Note: `preloadedSkillIds` is currently a string array of IDs. The template would need to iterate over `preloadedSkills` (already available in the template data) instead, or `preloadedSkillIds` would need to be built from `pluginRef` when available.

**Alternative approach (simpler):** Transform `preloadedSkillIds` at the call site to contain the pluginRef when in plugin mode:

```typescript
// In compileAgentForPlugin / compileAgent:
const preloadedSkillIds = preloadedSkills.map((s) => s.pluginRef ?? s.id);
```

This avoids changing the Liquid template at all -- the `preloadedSkillIds` array already contains the correct format. Similarly, `skill.id` in dynamic skills would need to be swapped to `skill.pluginRef` in the template data, or the `id` field overwritten for template purposes.

**Test:**

1. Unit test: compile an agent with `installMode: "plugin"` -- verify frontmatter skills list contains `web-framework-react:web-framework-react`
2. Unit test: compile same agent with `installMode: "local"` -- verify frontmatter contains bare `web-framework-react`
3. Unit test: verify dynamic skill invocation format changes accordingly

---

### Phase 3: Individual skill plugin installation from wizard -- DONE

**Goal:** When a user selects individual skills (no stack) in Plugin Mode, install each as a native plugin.

**Problem:** `init.tsx` lines 158-162 fall back to Local Mode for individual skills in Plugin Mode.

**Changes:**

| File                        | Change                                                   |
| --------------------------- | -------------------------------------------------------- |
| `src/cli/commands/init.tsx` | Remove fallback; add `installIndividualPlugins()` method |
| `src/cli/utils/exec.ts`     | Already has `claudePluginInstall()` -- no changes needed |

**Implementation detail:**

Replace the fallback block in `handleInstallation()`:

```typescript
// Current (init.tsx:158-162):
if (result.installMode === "plugin") {
  if (result.selectedStackId) {
    await this.installPluginMode(result, sourceResult, flags);
    return;
  } else {
    this.warn("Individual skill plugin installation not yet supported...");
    this.log("Falling back to Local Mode...");
  }
}

// New:
if (result.installMode === "plugin") {
  if (result.selectedStackId) {
    await this.installPluginMode(result, sourceResult, flags);
  } else {
    await this.installIndividualPlugins(result, sourceResult, flags);
  }
  return;
}
```

The `installIndividualPlugins()` method:

```typescript
private async installIndividualPlugins(
  result: WizardResultV2,
  sourceResult: SourceLoadResult,
  flags: { source?: string },
): Promise<void> {
  const projectDir = process.cwd();

  // Register marketplace if needed (same pattern as installPluginMode)
  if (sourceResult.marketplace) {
    // ... same marketplace registration logic ...
  }

  // Install each skill as a plugin
  for (const skillId of result.selectedSkills) {
    const pluginRef = sourceResult.marketplace
      ? `${skillId}@${sourceResult.marketplace}`
      : skillId;
    this.log(`Installing plugin: ${pluginRef}...`);
    await claudePluginInstall(pluginRef, "project", projectDir);
  }

  // Compile agents (same pattern as stack installation)
  // ... agent compilation with plugin-aware references (from Phase 2) ...
}
```

**Key consideration:** Without a marketplace, there's no remote source for individual plugins. The CLI would need to either:

- Compile each skill plugin locally (like stack compilation but per-skill)
- Or require a marketplace for individual plugin installation

The simplest approach: require a marketplace for individual plugin mode. Without one, suggest Local Mode.

**Test:**

1. Integration test: mock `claudePluginInstall` and verify it's called for each selected skill with correct `{id}@{marketplace}` format
2. Test: no marketplace + individual skills + Plugin Mode -> graceful error message suggesting Local Mode
3. Dry-run test: verify preview output shows correct install commands

---

### Phase 4: Plugin-aware edit flow -- DONE

**Goal:** `cc edit` installs new skill plugins and optionally uninstalls removed ones.

**Problem:** `edit.tsx` copies skills to the plugin directory but doesn't call `claude plugin install/uninstall`.

**Changes:**

| File                        | Change                                                                                                            |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `src/cli/commands/edit.tsx` | After computing `addedSkills`/`removedSkills`, call `claudePluginInstall`/`claudePluginUninstall` for Plugin Mode |
| `src/cli/utils/exec.ts`     | Already has both functions -- no changes needed                                                                   |

**Implementation detail:**

After the `sourceChanges` computation and before "Updating plugin skills...":

```typescript
if (installation.mode === "plugin" && sourceResult.marketplace) {
  for (const skillId of addedSkills) {
    const pluginRef = `${skillId}@${sourceResult.marketplace}`;
    this.log(`Installing plugin: ${pluginRef}...`);
    await claudePluginInstall(pluginRef, "project", projectDir);
  }
  for (const skillId of removedSkills) {
    this.log(`Uninstalling plugin: ${skillId}...`);
    await claudePluginUninstall(skillId, "project", projectDir);
  }
}
```

`claudePluginUninstall()` already ignores "not installed" errors, so it's safe to call for skills that might not be installed as plugins.

**Test:**

1. Unit test: mock `claudePluginInstall`/`claudePluginUninstall`, verify correct calls for added/removed skills
2. Test: Plugin Mode without marketplace -> skip plugin install/uninstall (only copy skills)
3. Test: verify removed skills are uninstalled before new ones installed (avoid conflicts)

---

### Phase 5: Config-driven source loading -- IMPLEMENTED

**Goal:** The source's `.claude-src/config.yaml` declares paths to all resources, replacing hardcoded assumptions.

**Status:** Implemented. Marketplace repos can declare custom paths in their `.claude-src/config.yaml` instead of following the default layout conventions.

**Changes:**

| File                                   | Change                                                         |
| -------------------------------------- | -------------------------------------------------------------- |
| `src/cli/lib/configuration/config.ts`  | Added 4 optional path fields to `ProjectSourceConfig`          |
| `src/cli/lib/schemas.ts`               | Extended `projectSourceConfigSchema` with path fields          |
| `src/cli/lib/loading/source-loader.ts` | Reads source's config, uses path overrides with defaults       |
| `src/cli/lib/stacks/stacks-loader.ts`  | `loadStacks` accepts optional `stacksFile` parameter           |
| `src/cli/lib/agents/agent-fetcher.ts`  | `fetchAgentDefinitionsFromRemote` accepts optional `agentsDir` |

**Fields on `ProjectSourceConfig`:**

```typescript
export type ProjectSourceConfig = {
  source?: string;
  author?: string;
  marketplace?: string;
  agents_source?: string;
  sources?: SourceEntry[];
  boundSkills?: BoundSkill[];
  // Resource path overrides (all relative to repo root, all optional)
  skills_dir?: string; // default: src/skills
  agents_dir?: string; // default: src/agents
  stacks_file?: string; // default: config/stacks.yaml
  matrix_file?: string; // default: config/skills-matrix.yaml
};
```

**Resolution precedence:** Explicit config value > convention-based default > CLI fallback.

**Example `.claude-src/config.yaml` for a marketplace with non-standard layout:**

```yaml
source: github:myorg/marketplace
skills_dir: lib/skills
agents_dir: lib/agents
stacks_file: data/stacks.yaml
matrix_file: data/matrix.yaml
```

---

## Testing Locally

Test your marketplace before publishing:

```bash
# Test a single plugin directory
claude --plugin-dir ./dist/plugins/web-framework-react

# Test the full marketplace
/plugin marketplace add ./my-marketplace
/plugin install web-framework-react@my-marketplace

# Validate marketplace structure
claude plugin validate .
```

---

## Quick Reference

### Build Pipeline

```bash
# 1. Eject skills and agent partials
cc eject --all

# 2. Move skills to src/skills/, agents to src/agents/, remove compiled agents
mkdir -p src/skills src/agents
mv .claude/skills/* src/skills/
mv .claude-src/agents/* src/agents/
rm -rf .claude/agents

# 3. Customize skills in src/skills/ and agent partials in src/agents/

# 4. Build skill plugins (one plugin per skill)
cc build plugins

# 5. Build marketplace manifest
cc build marketplace --name my-marketplace --owner-name "My Team"

# 6. Commit and push
git add .claude-plugin/ dist/plugins/ src/skills/ src/agents/ .claude-src/ config/
git commit -m "Build marketplace"
git push
```

### Build Commands

| Command                | Default Input   | Default Output                    | Purpose                                                  |
| ---------------------- | --------------- | --------------------------------- | -------------------------------------------------------- |
| `cc build plugins`     | `src/skills/`   | `dist/plugins/`                   | Compile skills into individual plugins (name = skill ID) |
| `cc build marketplace` | `dist/plugins/` | `.claude-plugin/marketplace.json` | Generate manifest from compiled plugins                  |

### Key Code Locations

| Concept               | File                                          | Key functions/constants                                                    |
| --------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Source loading        | `src/cli/lib/loading/source-loader.ts`        | `loadSkillsMatrixFromSource()`, `loadFromLocal()`, `loadFromRemote()`      |
| Stack loading         | `src/cli/lib/stacks/stacks-loader.ts`         | `loadStacks()`, `loadStackById()`                                          |
| Stack installation    | `src/cli/lib/stacks/stack-installer.ts`       | `installStackAsPlugin()`                                                   |
| Skill plugin building | `src/cli/lib/skills/skill-plugin-compiler.ts` | `compileSkillPlugin()`, `compileAllSkillPlugins()`                         |
| Plugin manifest       | `src/cli/lib/plugins/plugin-manifest.ts`      | `SKILL_PLUGIN_PREFIX` (to be set to `""`), `generateSkillPluginManifest()` |
| Agent compilation     | `src/cli/lib/stacks/stack-plugin-compiler.ts` | `compileAgentForPlugin()`                                                  |
| Agent template        | `src/agents/_templates/agent.liquid`          | Preloaded + dynamic skill references                                       |
| Config types          | `src/cli/lib/configuration/config.ts`         | `ProjectSourceConfig`, `resolveSource()`                                   |
| Exec helpers          | `src/cli/utils/exec.ts`                       | `claudePluginInstall()`, `claudePluginMarketplaceAdd()`                    |
| Init command          | `src/cli/commands/init.tsx`                   | `handleInstallation()`, `installPluginMode()`                              |
| Edit command          | `src/cli/commands/edit.tsx`                   | Skill add/remove, agent recompilation                                      |
