# Migrating Your Repo to a Private Marketplace

Step-by-step guide for converting an existing CC-managed repo into a publishable marketplace that consumers can install from.

## Starting State

```
my-marketplace/
+-- .claude/
|   +-- skills/                    # skills live here (need to move)
|   +-- agents/                    # compiled agents (will delete)
+-- .claude-src/
|   +-- agents/                    # agent partials + templates (need to move)
|   +-- config.yaml                # outdated config (will update)
+-- dist/                          # old build output (will rebuild)
```

## Target State

```
my-marketplace/
+-- src/
|   +-- skills/                    # source of truth for skills
|   |   +-- web-framework-react/
|   |   |   +-- SKILL.md
|   |   |   +-- metadata.yaml
|   |   +-- api-framework-hono/
|   |       +-- SKILL.md
|   +-- agents/                    # agent partials (agent.yaml + markdown)
|       +-- web-developer/
|       |   +-- agent.yaml
|       |   +-- intro.md
|       |   +-- workflow.md
|       +-- api-developer/
|           +-- agent.yaml
|           +-- intro.md
+-- config/
|   +-- skills-matrix.yaml         # skill categories, aliases, relationships
|   +-- stacks.yaml                # stack definitions (optional but recommended)
+-- dist/
|   +-- plugins/                   # built plugins (one per skill)
+-- .claude-plugin/
|   +-- marketplace.json           # marketplace manifest
+-- .claude-src/
    +-- config.yaml                # updated project config
```

**All paths are convention-based** -- the source loader expects these exact locations. There are no config keys to override them:

| Resource      | Required path               | Constant             |
| ------------- | --------------------------- | -------------------- |
| Skills        | `src/skills/`               | `SKILLS_DIR_PATH`    |
| Agents        | `src/agents/`               | `DIRS.agents`        |
| Skills matrix | `config/skills-matrix.yaml` | `SKILLS_MATRIX_PATH` |
| Stacks        | `config/stacks.yaml`        | `STACKS_FILE`        |

---

## Step 1: Move skills to `src/skills/`

The source loader expects skills at `src/skills/` (the `SKILLS_DIR_PATH` constant). The `cc build plugins` command also defaults to reading from `src/skills/`.

```bash
mkdir -p src/skills
cp -r .claude/skills/* src/skills/
```

Verify each skill has a `SKILL.md` with frontmatter:

```markdown
---
name: web-framework-react
description: React development patterns and best practices
---

# React

...
```

The `name` must follow the `SkillId` format: `{prefix}-{subcategory}-{name}` where prefix is `web`, `api`, `cli`, `mobile`, `infra`, `meta`, or `security`. At least 3 dash-separated segments.

Once verified, remove the old location:

```bash
rm -rf .claude/skills
```

---

## Step 2: Move agent partials to `src/agents/`

The agent loader (`loadAllAgents()`) scans `src/agents/` for `agent.yaml` files.

```bash
mkdir -p src/agents
cp -r .claude-src/agents/* src/agents/
```

Each agent directory must contain an `agent.yaml`:

```yaml
id: web-developer
title: Web Developer
description: Implements frontend features from detailed specs
model: sonnet
tools:
  - Read
  - Write
  - Edit
  - Grep
  - Glob
  - Bash
```

Plus partial markdown files (`intro.md`, `workflow.md`, `examples.md`, etc.) that get compiled into the final agent prompt via the Liquid template.

Once verified:

```bash
rm -rf .claude-src/agents
```

---

## Step 3: Delete compiled agents

Compiled agents (`.claude/agents/`) are generated per-consumer, not published in the marketplace. Delete them:

```bash
rm -rf .claude/agents
```

If `.claude/` is now empty, remove it:

```bash
rmdir .claude 2>/dev/null || true
```

---

## Step 4: Set up `config/skills-matrix.yaml`

**This path is a hardcoded convention** (`SKILLS_MATRIX_PATH = "config/skills-matrix.yaml"`). There is no config key to override it. The file must be at exactly `config/skills-matrix.yaml` relative to your repo root.

The source loader checks for this file in your repo. If it exists, consumers get YOUR matrix (categories, aliases, relationships). If not, they fall back to the CLI's built-in matrix.

```bash
mkdir -p config
```

If you want the default CC matrix as a starting point:

```bash
cp node_modules/claude-collective-cli/config/skills-matrix.yaml config/skills-matrix.yaml
```

Or if that path doesn't work, copy from the CLI source:

```bash
# From inside the cc CLI repo
cp config/skills-matrix.yaml /path/to/my-marketplace/config/
```

Edit it to match only the skills you're publishing. Remove categories for skills you don't have.

---

## Step 5: Set up `config/stacks.yaml` (recommended)

**This path is a hardcoded convention** (`STACKS_FILE = "config/stacks.yaml"`). There is no config key to override it. The file must be at exactly `config/stacks.yaml` relative to your repo root.

Stacks are curated bundles of skills + agents. The source loader loads stacks from your repo's `config/stacks.yaml` first, falling back to the CLI's built-in stacks. Without stacks, consumers can still pick individual skills.

```bash
# Create config/stacks.yaml
```

Example:

```yaml
stacks:
  - id: nextjs-fullstack
    name: "Next.js Fullstack"
    description: "Full-stack Next.js with React, Tailwind, Zustand, Hono, Drizzle"
    domains:
      - web
      - api
    agents:
      - web-developer
      - api-developer
      - web-tester
      - web-reviewer
      - api-reviewer
    skills:
      web-developer:
        framework: web-framework-react
        meta-framework: web-meta-nextjs-app-router
        styling: web-styling-tailwind
        client-state: web-state-zustand
        testing: web-testing-vitest
      api-developer:
        api-framework: api-framework-hono
        database: api-database-drizzle
        auth: api-auth-better-auth-drizzle-hono
```

The `skills` section maps `agent-name -> subcategory -> skill-id`. These become the `stack` field in the consumer's `config.yaml` and drive agent compilation.

---

## Step 6: Update `.claude-src/config.yaml`

Update your project config to reflect the new structure. This is the marketplace repo's own config (not the consumer's):

```yaml
name: my-marketplace
description: "Private skills marketplace for our team"
author: "@your-name"
source: "https://github.com/your-org/my-marketplace"
marketplace: my-marketplace
installMode: local
agents:
  - web-developer
  - api-developer
  - web-tester
  - web-reviewer
  - api-reviewer
skills:
  - web-framework-react
  - web-styling-tailwind
  - web-state-zustand
  - api-framework-hono
  - api-database-drizzle
  # ... list all skill IDs in your src/skills/
```

The `source` field accepts any format that giget understands:

- `https://github.com/your-org/my-marketplace` (full URL)
- `github:your-org/my-marketplace` (shorthand)
- `gh:your-org/my-marketplace` (alias)
- `gitlab:your-org/my-marketplace`
- `./local/path` or `/absolute/path` (local directories)

The `source` and `marketplace` fields are important -- they're what consumers inherit when they run `cc init --source`.

---

## Step 7: Clean old build output

```bash
rm -rf dist
```

---

## Step 8: Build skill plugins

```bash
cc build plugins
```

This reads from `src/skills/` (default) and outputs to `dist/plugins/`. Each skill becomes its own plugin directory:

```
dist/plugins/
+-- web-framework-react/
|   +-- .claude-plugin/
|   |   +-- plugin.json          # name, version, description
|   |   +-- .content-hash        # for version bumping on next build
|   +-- skills/
|   |   +-- web-framework-react/
|   |       +-- SKILL.md
|   +-- README.md
+-- api-framework-hono/
    +-- ...
```

Plugin names match skill IDs directly (no `skill-` prefix).

If you also want agents as standalone plugins (optional):

```bash
cc build plugins --agents-dir src/agents
```

---

## Step 9: Build the marketplace manifest

```bash
cc build marketplace \
  --name my-marketplace \
  --owner-name "Your Team" \
  --owner-email "team@example.com" \
  --description "Our private skills marketplace"
```

This scans `dist/plugins/` and writes `.claude-plugin/marketplace.json`:

```json
{
  "$schema": "https://anthropic.com/claude-code/marketplace.schema.json",
  "name": "my-marketplace",
  "version": "1.0.0",
  "owner": { "name": "Your Team", "email": "team@example.com" },
  "metadata": { "pluginRoot": "./dist/plugins" },
  "plugins": [
    {
      "name": "web-framework-react",
      "source": "dist/plugins/web-framework-react",
      "description": "React development patterns",
      "version": "1.0.0",
      "category": "web"
    }
  ]
}
```

---

## Step 10: Commit and push

```bash
git add src/ config/ dist/plugins/ .claude-plugin/ .claude-src/config.yaml
git commit -m "Restructure as marketplace"
git push origin main
```

**Important:** `dist/plugins/` and `.claude-plugin/marketplace.json` MUST be committed. These are the artifacts Claude Code downloads.

Optionally add to `.gitignore`:

```gitignore
# Compiled agents are consumer-side only
.claude/agents/
```

---

## Consumer Setup (in a different project repo)

### 1. Register the marketplace

In the consumer project, tell Claude Code about your marketplace:

```
/plugin marketplace add your-org/my-marketplace
```

Or via CLI:

```bash
claude plugin marketplace add your-org/my-marketplace
```

### 2. Run init with your source

```bash
cc init --source https://github.com/your-org/my-marketplace
# or shorthand:
cc init --source github:your-org/my-marketplace
```

What happens:

1. Fetches your marketplace repo via giget
2. Loads `config/skills-matrix.yaml` from YOUR repo (not the CLI's default)
3. Loads `config/stacks.yaml` from YOUR repo
4. Opens the wizard -- user picks a stack or selects individual skills
5. Based on install mode:
   - **Plugin Mode + stack**: installs stack plugin from marketplace
   - **Plugin Mode + individual skills**: installs each skill as a native plugin via `claude plugin install {skill-id}@my-marketplace`
   - **Local Mode**: copies skills to `.claude/skills/`
6. Compiles agents from your `src/agents/` partials, personalized to the user's skill selection
7. Writes `.claude-src/config.yaml` in the consumer project (tracks source, skills, agent mappings)

### 3. Verify

After init completes, the consumer project has:

```
my-app/
+-- .claude/
|   +-- agents/                    # compiled agents (personalized)
|       +-- web-developer.md
|       +-- api-developer.md
+-- .claude-src/
    +-- config.yaml                # tracks source + selections
```

If Plugin Mode was used, skills are also installed as native Claude Code plugins (visible in `/plugin list`).

### 4. Edit later

```bash
cc edit
```

Opens the wizard with current selections. In Plugin Mode, adding/removing skills also calls `claude plugin install`/`uninstall`.

---

## Private Repo Authentication

If your marketplace repo is private, consumers need git credentials:

```bash
# For giget (used by cc init --source)
export GIGET_AUTH=ghp_your_github_token

# For Claude Code (used by /plugin marketplace add)
export GITHUB_TOKEN=ghp_your_github_token
```

Or use `gh auth login` if GitHub CLI is available.

---

## Updating Skills

When you update a skill in `src/skills/`:

```bash
# Edit the skill
vim src/skills/web-framework-react/SKILL.md

# Rebuild (version auto-bumps if content changed)
cc build plugins
cc build marketplace --name my-marketplace --owner-name "Your Team"

# Push
git add dist/plugins/ .claude-plugin/
git commit -m "Update react skill"
git push
```

Consumers get the update next time they run `cc init` or `cc edit --refresh`.
