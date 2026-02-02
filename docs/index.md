# Claude Collective CLI Documentation

## System Overview

Three directories work together:

| Directory                          | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `/home/vince/dev/cli`              | CLI tool (this repo) - entry point for all operations |
| `/home/vince/dev/claude-subagents` | Plugin marketplace - skills, agents, stacks           |
| `/home/vince/dev/cv-launch`        | Test project - install targets for testing            |

## Documentation Index

| Document                             | Content                                              |
| ------------------------------------ | ---------------------------------------------------- |
| [architecture.md](./architecture.md) | System architecture, data flow, module relationships |
| [commands.md](./commands.md)         | CLI command reference with options and examples      |
| [data-models.md](./data-models.md)   | Type definitions, schemas, data structures           |
| [workflows.md](./workflows.md)       | Common workflows and use cases                       |
| [known-issues.md](./known-issues.md) | Incomplete features, TODOs, limitations              |
| [wizard-index.md](./wizard-index.md) | **Phase 7 Wizard UX** - architecture, components, flows |

## Quick Reference

### Installation Modes

1. **Plugin Mode** - Native Claude plugins via `claude plugin install`
2. **Local Mode** - Copies to `.claude/skills/` and `.claude/agents/`
3. **Eject Mode** - Export templates/config for full customization

### Key Commands

```bash
# Initialize in a project
cc init --source /path/to/marketplace

# Build stack for distribution
cc build:stack --stack nextjs-fullstack

# Generate marketplace.json
cc build:marketplace --plugins-dir dist/stacks

# Install via Claude CLI
claude plugin marketplace add /path/to/dist
claude plugin install stackname --scope project
```

### Three Main Use Cases

1. **End User** - Install pre-built stacks via plugin mode
2. **Team/Enterprise** - Create private marketplace, install via plugin or local mode
3. **Contributor** - Eject templates, create custom skills/agents/stacks
