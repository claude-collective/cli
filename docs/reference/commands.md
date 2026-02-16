# CLI Commands Reference

## `agentsinc init`

Initialize Agents Inc. in a project.

```bash
agentsinc init                                      # Start the setup wizard
agentsinc init --source github:org/marketplace      # Use a custom marketplace
agentsinc init --source /path/to/marketplace        # Use a local marketplace
agentsinc init --refresh                            # Force refresh remote source
agentsinc init --dry-run                            # Preview only
```

**Flags:**

| Flag                    | Description                                                       |
| ----------------------- | ----------------------------------------------------------------- |
| `-s, --source <source>` | Skills source path or URL (see [Source Formats](#source-formats)) |
| `--refresh`             | Force re-download of marketplace, even if cached                  |
| `--dry-run`             | Preview operations without creating files                         |

**Wizard Steps:**

1. **Approach** - Choose "Use a stack" or "Start from scratch"
2. **Stack / Domains** - If stack: select a pre-configured stack. If scratch: select one or more domains (Web, Web Extras, API, CLI, Mobile)
3. **Build** - Browse categories and toggle individual skills per domain
4. **Sources** - Review skill sources and optionally customize which source provides each skill (public marketplace, private sources, or local)
5. **Confirm** - Review selections and install

**Installation Modes:**

- **Plugin Mode** (default when marketplace is available): Installs via `claude plugin install`. Supports both stack-based installation and individual skill plugin installation from a marketplace.
- **Local Mode** (default when no marketplace): Copies skills to `.claude/skills/` and compiles agents to `.claude/agents/`.

**Keyboard Shortcuts (during wizard):**

| Key   | Action                                                     |
| ----- | ---------------------------------------------------------- |
| `E`   | Toggle expert mode                                         |
| `P`   | Toggle install mode (Plugin / Local)                       |
| `A`   | Accept stack defaults (stack path only, during build step) |
| `G`   | Manage extra sources (during sources step)                 |
| `?`   | Show help                                                  |
| `ESC` | Go back / cancel                                           |

---

## `agentsinc edit`

Modify skills in existing installation.

```bash
agentsinc edit
agentsinc edit --source /path/to/marketplace
agentsinc edit --refresh
```

**Flags:**

| Flag                    | Description                      |
| ----------------------- | -------------------------------- |
| `-s, --source <source>` | Skills source path or URL        |
| `--refresh`             | Force re-download of marketplace |

**Flow:**

1. Load current plugin skills
2. Run wizard with pre-selections
3. Calculate diff (added/removed)
4. Update skills and recompile agents
5. Bump patch version

---

## `agentsinc compile`

Recompile agents from discovered skills.

```bash
agentsinc compile
agentsinc compile -v                    # Verbose
agentsinc compile -o /custom/output     # Custom output dir (skips plugin mode)
agentsinc compile --agent-source github:org/repo  # Remote agent definitions
```

**Two Modes:**

- Plugin Mode (default): Requires existing plugin, updates in-place
- Custom Output: Outputs to specified directory

---

## `agentsinc eject`

Export bundled content for customization.

```bash
agentsinc eject agent-partials         # Export agent partial templates
agentsinc eject skills                 # Export skills from plugin
agentsinc eject all                    # Export everything
agentsinc eject agent-partials -o ./custom  # Custom output dir
agentsinc eject agent-partials -f           # Force overwrite
```

**Output locations:**

- `agent-partials` -> `.claude/agents/_partials/`
- `skills` -> `.claude/skills/`

---

## `agentsinc uninstall`

Remove Agents Inc. from a project.

```bash
agentsinc uninstall                    # Interactive, prompts for confirmation
agentsinc uninstall --yes              # Skip confirmation
agentsinc uninstall --keep-config      # Keep .claude/config.yaml
agentsinc uninstall --plugin           # Only remove plugin (not local files)
agentsinc uninstall --local            # Only remove local files (not plugin)
```

**Plugin Mode:** Calls `claude plugin uninstall`
**Local Mode:** Removes `.claude/skills/`, `.claude/agents/`, optionally `.claude/config.yaml`

---

## `agentsinc doctor`

Diagnose configuration issues and installation problems.

```bash
agentsinc doctor
```

**Checks:**

- Configuration file validity
- Plugin installation status
- Skills directory structure
- Agent compilation state

---

## `agentsinc search`

Search available skills by name, description, category, or tags.

```bash
agentsinc search <query>
agentsinc search react
agentsinc search "state management"
```

---

## `agentsinc outdated`

Check which local skills are outdated compared to source.

```bash
agentsinc outdated
agentsinc outdated --source /path/to/marketplace
```

---

## `agentsinc info`

Display detailed information about a specific skill.

```bash
agentsinc info <skill-id>
agentsinc info web/framework/react
```

---

## `agentsinc diff`

Show differences between local and source skills.

```bash
agentsinc diff
agentsinc diff <skill-id>
agentsinc diff --source /path/to/marketplace
```

---

## `agentsinc update`

Update local skills from source.

```bash
agentsinc update
agentsinc update <skill-id>
agentsinc update --source /path/to/marketplace
```

---

## `agentsinc build:plugins`

Build individual skills into standalone plugins. For marketplace maintainers.

```bash
agentsinc build:plugins
agentsinc build:plugins -s src/skills -o dist/plugins
agentsinc build:plugins --skill web/framework/react  # Single skill
agentsinc build:plugins -v  # Verbose
```

---

## `agentsinc build:stack`

Build a stack into a standalone plugin.

```bash
agentsinc build:stack --stack nextjs-fullstack
agentsinc build:stack --stack nextjs-fullstack -o dist/stacks
agentsinc build:stack --agent-source github:org/repo
agentsinc build:stack -v
```

**Output:** Complete plugin with agents, skills, manifest, README.

---

## `agentsinc build:marketplace`

Generate marketplace.json from built plugins.

```bash
agentsinc build:marketplace
agentsinc build:marketplace -p dist/stacks -o dist/.claude-plugin/marketplace.json
agentsinc build:marketplace --name my-marketplace --version 1.0.0
```

**Note:** Paths in marketplace.json must be relative to marketplace root.

---

## `agentsinc validate`

Validate YAML schemas or compiled plugins.

```bash
agentsinc validate                     # Validate all YAML in project
agentsinc validate /path/to/plugin     # Validate single plugin
agentsinc validate /path/to/plugins --all  # Validate all plugins in dir
agentsinc validate -v
```

---

## `agentsinc list` / `agentsinc ls`

Show current plugin information.

```bash
agentsinc list
```

---

## `agentsinc config`

Manage configuration.

```bash
agentsinc config show                  # Show effective config with precedence
agentsinc config get source            # Get specific value
agentsinc config set source /path      # Set global config
agentsinc config unset source          # Remove from global
agentsinc config set-project source /path  # Set project config
agentsinc config unset-project source
agentsinc config path                  # Show config file paths
```

**Valid keys:** `source`, `author`, `agents_source`, `marketplace_url`

---

## `agentsinc version`

Manage plugin version.

```bash
agentsinc version patch    # 1.0.0 -> 1.0.1
agentsinc version minor    # 1.0.0 -> 1.1.0
agentsinc version major    # 1.0.0 -> 2.0.0
agentsinc version set 2.0.0
```

---

## `agentsinc new agent`

Create a new custom agent using AI generation. Invokes the agent-summoner meta-agent to generate agent files.

```bash
agentsinc new agent <name>                      # Interactive mode
agentsinc new agent my-agent -p "Handles X"     # With purpose
agentsinc new agent my-agent -p "..." -n        # Non-interactive mode
agentsinc new agent my-agent -s /path/to/source # Custom source
agentsinc new agent my-agent -r                 # Force refresh source
```

**Options:**

- `-p, --purpose <purpose>` - Purpose/description of the agent
- `-s, --source <source>` - Skills repository source
- `-r, --refresh` - Force refresh remote source
- `-n, --non-interactive` - Run without user interaction

**Output:** Creates agent files in `.claude/agents/_custom/<name>/`

---

## `agentsinc new skill`

Create a new local skill with proper structure.

```bash
agentsinc new skill <name>
agentsinc new skill my-custom-skill
```

**Output:** Creates skill files in `.claude/skills/<name>/`

---

## Source Formats

The `--source` flag (and the `source` config key) accepts the following formats:

| Format              | Example                                              |
| ------------------- | ---------------------------------------------------- |
| GitHub shorthand    | `github:org/repo` or `gh:org/repo`                   |
| GitLab shorthand    | `gitlab:org/repo`                                    |
| Bitbucket shorthand | `bitbucket:org/repo`                                 |
| SourceHut shorthand | `sourcehut:org/repo`                                 |
| HTTPS URL           | `https://github.com/org/repo`                        |
| Local absolute path | `/home/user/my-marketplace`                          |
| Local relative path | `./my-marketplace` or `../other-project/marketplace` |

**Source resolution precedence:** `--source` flag > `CC_SOURCE` env var > project config (`.claude-src/config.yaml`) > default (`github:agents-inc/skills`)

**Private repositories:** Set the `GIGET_AUTH` environment variable with a GitHub token for private repo access:

```bash
export GIGET_AUTH=ghp_your_github_token
```

---

## Global Options

- `--dry-run` - Preview operations (init, compile)
- `-s, --source <source>` - Skills source path or URL
- `-h, --help` - Show help

## Exit Codes

| Code | Meaning       |
| ---- | ------------- |
| 0    | Success       |
| 1    | Error         |
| 2    | Invalid args  |
| 3    | Network error |
| 4    | Cancelled     |
