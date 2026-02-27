# Commands Reference

**Last Updated:** 2026-02-25

## Command Architecture

All commands extend `BaseCommand` (`src/cli/base-command.ts`).

**Base flags available to all commands:**

| Flag      | Short | Type    | Description               |
| --------- | ----- | ------- | ------------------------- |
| --dry-run |       | boolean | Preview operations        |
| --source  | -s    | string  | Skills source path or URL |

## Commands Index

| Command                | File                                       | Type | Summary                                    |
| ---------------------- | ------------------------------------------ | ---- | ------------------------------------------ |
| `init`                 | `src/cli/commands/init.tsx`                | tsx  | Initialize project (interactive wizard)    |
| `edit`                 | `src/cli/commands/edit.tsx`                | tsx  | Edit installed skills via wizard           |
| `compile`              | `src/cli/commands/compile.ts`              | ts   | Compile agents from skills                 |
| `validate`             | `src/cli/commands/validate.ts`             | ts   | Validate installation                      |
| `info`                 | `src/cli/commands/info.ts`                 | ts   | Show installation info                     |
| `list`                 | `src/cli/commands/list.ts`                 | ts   | List installed skills                      |
| `diff`                 | `src/cli/commands/diff.ts`                 | ts   | Show skill differences                     |
| `doctor`               | `src/cli/commands/doctor.ts`               | ts   | Health check                               |
| `eject`                | `src/cli/commands/eject.ts`                | ts   | Eject skills, agent partials, or templates |
| `outdated`             | `src/cli/commands/outdated.ts`             | ts   | Check for skill updates                    |
| `search`               | `src/cli/commands/search.tsx`              | tsx  | Search skills across sources               |
| `uninstall`            | `src/cli/commands/uninstall.tsx`           | tsx  | Uninstall from project                     |
| `update`               | `src/cli/commands/update.tsx`              | tsx  | Update skills                              |
| `import skill`         | `src/cli/commands/import/skill.ts`         | ts   | Import a skill from source                 |
| `new skill`            | `src/cli/commands/new/skill.ts`            | ts   | Create a new skill                         |
| `new agent`            | `src/cli/commands/new/agent.tsx`           | tsx  | Create a new agent                         |
| `new marketplace`      | `src/cli/commands/new/marketplace.ts`      | ts   | Create a new marketplace                   |
| `build marketplace`    | `src/cli/commands/build/marketplace.ts`    | ts   | Build marketplace.json                     |
| `build plugins`        | `src/cli/commands/build/plugins.ts`        | ts   | Build skill/agent plugins                  |
| `build stack`          | `src/cli/commands/build/stack.tsx`         | tsx  | Build a stack plugin                       |
| `config`               | `src/cli/commands/config/index.ts`         | ts   | Show config overview                       |
| `config get`           | `src/cli/commands/config/get.ts`           | ts   | Get a config value                         |
| `config show`          | `src/cli/commands/config/show.ts`          | ts   | Show all config values                     |
| `config path`          | `src/cli/commands/config/path.ts`          | ts   | Show config file paths                     |
| `config set-project`   | `src/cli/commands/config/set-project.ts`   | ts   | Set project config value                   |
| `config unset-project` | `src/cli/commands/config/unset-project.ts` | ts   | Remove project config value                |

## Primary Commands (Detailed)

### `init` (src/cli/commands/init.tsx)

**Purpose:** Interactive wizard to set up skills and agents in a project.

**Flow:**

1. Detect if already initialized (warns and exits if so)
2. Load skills matrix from source (`loadSkillsMatrixFromSource()`)
3. Render `<Wizard>` component with matrix data
4. Process wizard result: `WizardResultV2`
5. Install based on mode:
   - Plugin mode with marketplace: `installIndividualPlugins()` (private method on Init class) installs each skill via `claude plugin install`
   - Plugin mode without marketplace: falls back to local mode with warning
   - Local mode: `installLocal()` from `src/cli/lib/installation/local-installer.ts`
6. Compile agents and save config

**Flags:** `--refresh` (force refresh from remote), `--source`, `--dry-run`

**Key dependencies:**

- `src/cli/components/wizard/wizard.tsx` - Wizard component
- `src/cli/lib/loading/source-loader.ts` - Matrix loading
- `src/cli/lib/installation/index.ts` - Re-exports `installLocal`, `installPluginConfig`, `detectInstallation`

### `edit` (src/cli/commands/edit.tsx)

**Purpose:** Modify installed skills via wizard re-entry.

**Flow:**

1. Detect existing installation (`detectInstallation()`)
2. Load matrix and current skills
3. Render `<Wizard>` with `initialStep="build"` and `installedSkillIds`
4. Compute diff: added/removed/source-changed skills
5. Apply changes: archive/restore for source switches, plugin install/uninstall
6. Recompile agents

**Flags:** `--refresh`, `--agent-source`, `--source`, `--dry-run`

### `compile` (src/cli/commands/compile.ts)

**Purpose:** Compile agents using installed skills and agent definitions.

**Flow:**

1. Auto-detect installation mode (local vs plugin)
2. Discover all skills (plugin + local)
3. Resolve source, load agent definitions
4. Call `recompileAgents()` from `lib/agents/agent-recompiler.ts`

**Modes:**

- Plugin mode: uses detected installation paths
- Custom output: `--output` flag specifies output directory

**Flags:** `--verbose`, `--agent-source`, `--output`, `--source`, `--dry-run`

## Build Subcommands

### `build marketplace` (src/cli/commands/build/marketplace.ts)

Generates `marketplace.json` from source skills for plugin distribution.

### `build plugins` (src/cli/commands/build/plugins.ts)

Compiles individual skill and agent plugins for Claude Code native installation.

### `build stack` (src/cli/commands/build/stack.tsx)

Compiles a stack (bundle of skills + agents) as a single plugin.

## Config Subcommands

Manage `.claude-src/config.yaml` project configuration.

| Subcommand             | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `config`               | Overview showing source resolution layers |
| `config get`           | Get single config value by key            |
| `config show`          | Display all resolved config values        |
| `config path`          | Show config file locations                |
| `config set-project`   | Set a key in project config               |
| `config unset-project` | Remove a key from project config          |

## Error Handling Pattern

All commands follow this pattern:

```typescript
try {
  // operation
} catch (error) {
  this.handleError(error); // from BaseCommand -> this.error(message, { exit: EXIT_CODES.ERROR })
}
```

For specific exit codes:

```typescript
this.error(message, { exit: EXIT_CODES.INVALID_ARGS });
```

Exit codes defined in `src/cli/lib/exit-codes.ts`:

- `SUCCESS: 0`
- `ERROR: 1`
- `INVALID_ARGS: 2`
- `NETWORK_ERROR: 3`
- `CANCELLED: 4`

## User-Facing Messages

All message constants centralized in `src/cli/utils/messages.ts`:

- `ERROR_MESSAGES` - Error strings (10 entries)
- `SUCCESS_MESSAGES` - Success strings (6 entries)
- `STATUS_MESSAGES` - Progress/status strings (12 entries)
- `INFO_MESSAGES` - Informational strings (7 entries)
- `DRY_RUN_MESSAGES` - Dry-run mode strings (5 entries)
