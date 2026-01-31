# CLI Commands Reference

## `cc init`

Initialize Claude Collective in a project.

```bash
cc init --source /path/to/marketplace
cc init --source github:org/repo
cc init --refresh  # Force refresh remote
cc init --dry-run  # Preview only
```

**Flow:**

1. Load skills matrix from source
2. Run wizard (approach -> stack/skills -> install mode)
3. Plugin Mode: Install stack via `claude plugin install`
4. Local Mode: Copy to `.claude/skills/`, compile agents to `.claude/agents/`

**Default Mode:** Local (plugin mode is opt-in)

**Limitation:** Individual skill plugin installation not supported (stacks only in plugin mode).

---

## `cc edit`

Modify skills in existing installation.

```bash
cc edit
cc edit --source /path/to/marketplace
cc edit --refresh
```

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
cc eject templates              # Export Liquid templates
cc eject config                 # Export starter config.yaml
cc eject skills                 # Export skills from plugin
cc eject agents                 # Export agent partials
cc eject all                    # Export everything
cc eject templates -o ./custom  # Custom output dir
cc eject templates -f           # Force overwrite
```

**Output locations:**

- `templates` -> `.claude/templates/`
- `config` -> `.claude/config.yaml`
- `skills` -> `.claude/skills/`
- `agents` -> `.claude/agents/_partials/`

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
cc build:stack -s nextjs-fullstack -o dist/stacks
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

## Global Options

- `--dry-run` - Preview operations (init, compile)
- `-h, --help` - Show help

## Exit Codes

| Code | Meaning           |
| ---- | ----------------- |
| 0    | Success           |
| 1    | Error             |
| 2    | Cancelled         |
| 3    | Invalid arguments |
