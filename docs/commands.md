# CLI Commands Reference

## `cc init`

Initialize Claude Collective in a project.

```bash
cc init                                      # Start the setup wizard
cc init --source github:org/marketplace      # Use a custom marketplace
cc init --source /path/to/marketplace        # Use a local marketplace
cc init --refresh                            # Force refresh remote source
cc init --dry-run                            # Preview only
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

## `cc edit`

Modify skills in existing installation.

```bash
cc edit
cc edit --source /path/to/marketplace
cc edit --refresh
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

## `cc compile`

Recompile agents from discovered skills.

```bash
cc compile
cc compile -v                    # Verbose
cc compile -o /custom/output     # Custom output dir (skips plugin mode)
cc compile --agent-source github:org/repo  # Remote agent definitions
```

**Two Modes:**

- Plugin Mode (default): Requires existing plugin, updates in-place
- Custom Output: Outputs to specified directory

---

## `cc eject`

Export bundled content for customization.

```bash
cc eject agent-partials         # Export agent partial templates
cc eject skills                 # Export skills from plugin
cc eject all                    # Export everything
cc eject agent-partials -o ./custom  # Custom output dir
cc eject agent-partials -f           # Force overwrite
```

**Output locations:**

- `agent-partials` -> `.claude/agents/_partials/`
- `skills` -> `.claude/skills/`

---

## `cc uninstall`

Remove Claude Collective from a project.

```bash
cc uninstall                    # Interactive, prompts for confirmation
cc uninstall --yes              # Skip confirmation
cc uninstall --keep-config      # Keep .claude/config.yaml
cc uninstall --plugin           # Only remove plugin (not local files)
cc uninstall --local            # Only remove local files (not plugin)
```

**Plugin Mode:** Calls `claude plugin uninstall`
**Local Mode:** Removes `.claude/skills/`, `.claude/agents/`, optionally `.claude/config.yaml`

---

## `cc doctor`

Diagnose configuration issues and installation problems.

```bash
cc doctor
```

**Checks:**

- Configuration file validity
- Plugin installation status
- Skills directory structure
- Agent compilation state

---

## `cc search`

Search available skills by name, description, category, or tags.

```bash
cc search <query>
cc search react
cc search "state management"
```

---

## `cc outdated`

Check which local skills are outdated compared to source.

```bash
cc outdated
cc outdated --source /path/to/marketplace
```

---

## `cc info`

Display detailed information about a specific skill.

```bash
cc info <skill-id>
cc info web/framework/react
```

---

## `cc diff`

Show differences between local and source skills.

```bash
cc diff
cc diff <skill-id>
cc diff --source /path/to/marketplace
```

---

## `cc update`

Update local skills from source.

```bash
cc update
cc update <skill-id>
cc update --source /path/to/marketplace
```

---

## `cc build:plugins`

Build individual skills into standalone plugins. For marketplace maintainers.

```bash
cc build:plugins
cc build:plugins -s src/skills -o dist/plugins
cc build:plugins --skill web/framework/react  # Single skill
cc build:plugins -v  # Verbose
```

---

## `cc build:stack`

Build a stack into a standalone plugin.

```bash
cc build:stack --stack nextjs-fullstack
cc build:stack --stack nextjs-fullstack -o dist/stacks
cc build:stack --agent-source github:org/repo
cc build:stack -v
```

**Output:** Complete plugin with agents, skills, manifest, README.

---

## `cc build:marketplace`

Generate marketplace.json from built plugins.

```bash
cc build:marketplace
cc build:marketplace -p dist/stacks -o dist/.claude-plugin/marketplace.json
cc build:marketplace --name my-marketplace --version 1.0.0
```

**Note:** Paths in marketplace.json must be relative to marketplace root.

---

## `cc validate`

Validate YAML schemas or compiled plugins.

```bash
cc validate                     # Validate all YAML in project
cc validate /path/to/plugin     # Validate single plugin
cc validate /path/to/plugins --all  # Validate all plugins in dir
cc validate -v
```

---

## `cc list` / `cc ls`

Show current plugin information.

```bash
cc list
```

---

## `cc config`

Manage configuration.

```bash
cc config show                  # Show effective config with precedence
cc config get source            # Get specific value
cc config set source /path      # Set global config
cc config unset source          # Remove from global
cc config set-project source /path  # Set project config
cc config unset-project source
cc config path                  # Show config file paths
```

**Valid keys:** `source`, `author`, `agents_source`, `marketplace_url`

---

## `cc version`

Manage plugin version.

```bash
cc version patch    # 1.0.0 -> 1.0.1
cc version minor    # 1.0.0 -> 1.1.0
cc version major    # 1.0.0 -> 2.0.0
cc version set 2.0.0
```

---

## `cc new agent`

Create a new custom agent using AI generation. Invokes the agent-summoner meta-agent to generate agent files.

```bash
cc new agent <name>                      # Interactive mode
cc new agent my-agent -p "Handles X"     # With purpose
cc new agent my-agent -p "..." -n        # Non-interactive mode
cc new agent my-agent -s /path/to/source # Custom source
cc new agent my-agent -r                 # Force refresh source
```

**Options:**

- `-p, --purpose <purpose>` - Purpose/description of the agent
- `-s, --source <source>` - Skills repository source
- `-r, --refresh` - Force refresh remote source
- `-n, --non-interactive` - Run without user interaction

**Output:** Creates agent files in `.claude/agents/_custom/<name>/`

---

## `cc new skill`

Create a new local skill with proper structure.

```bash
cc new skill <name>
cc new skill my-custom-skill
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

**Source resolution precedence:** `--source` flag > `CC_SOURCE` env var > project config (`.claude-src/config.yaml`) > default (`github:claude-collective/skills`)

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
