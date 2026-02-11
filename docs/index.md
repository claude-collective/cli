# Claude Collective CLI Documentation

## System Overview

Three directories work together:

| Directory                          | Purpose                                               |
| ---------------------------------- | ----------------------------------------------------- |
| `/home/vince/dev/cli`              | CLI tool (this repo) - entry point for all operations |
| `/home/vince/dev/claude-subagents` | Plugin marketplace - skills, agents, stacks           |
| `/home/vince/dev/cv-launch`        | Test project - install targets for testing            |

## Documentation Index

| Document                                                       | Content                                              |
| -------------------------------------------------------------- | ---------------------------------------------------- |
| [architecture.md](./architecture.md)                           | System architecture, data flow, module relationships |
| [commands.md](./commands.md)                                   | CLI command reference with options and examples      |
| [data-models.md](./data-models.md)                             | Type definitions, schemas, data structures           |
| [known-issues.md](./known-issues.md)                           | Incomplete features, TODOs, limitations              |
| [skill-extraction-criteria.md](./skill-extraction-criteria.md) | Guidelines for splitting skill examples into modules |

### Bibles (Agent & Skill Authoring Standards)

| Document                                                              | Content                                             |
| --------------------------------------------------------------------- | --------------------------------------------------- |
| [CLAUDE_ARCHITECTURE_BIBLE.md](./bibles/CLAUDE_ARCHITECTURE_BIBLE.md) | Agent/skill compilation system and directory layout |
| [PROMPT_BIBLE.md](./bibles/PROMPT_BIBLE.md)                           | Universal prompt engineering techniques for agents  |
| [SKILL-ATOMICITY-BIBLE.md](./bibles/SKILL-ATOMICITY-BIBLE.md)         | Skill isolation and composability principles        |
| [AGENT-COMPLIANCE-BIBLE.md](./bibles/AGENT-COMPLIANCE-BIBLE.md)       | Agent quality verification checklist                |
| [DOCUMENTATION_BIBLE.md](./bibles/DOCUMENTATION_BIBLE.md)             | AI-optimized documentation standards                |
| [FRONTEND_BIBLE.md](./bibles/FRONTEND_BIBLE.md)                       | Frontend standards extraction categories            |

### UX Research

| Document                                                               | Content                                         |
| ---------------------------------------------------------------------- | ----------------------------------------------- |
| [SKILL-CONSUME-UX-RESEARCH.md](./SKILL-CONSUME-UX-RESEARCH.md)         | AI-assisted skill merging (`cc consume`) design |
| [SKILL-SEARCH-UX-RESEARCH.md](./SKILL-SEARCH-UX-RESEARCH.md)           | Enhanced search with fuzzy matching design      |
| [cli-agent-invocation-research.md](./cli-agent-invocation-research.md) | Meta-agent invocation via `--agents` flag       |

## Task Tracking

| Document                                  | Content                       |
| ----------------------------------------- | ----------------------------- |
| [TODO.md](../TODO.md)                     | Active tasks and blockers     |
| [TODO-completed.md](../TODO-completed.md) | Archive of completed tasks    |
| [TODO-deferred.md](../TODO-deferred.md)   | Deprioritized tasks for later |

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
cc build stack --stack nextjs-fullstack

# Generate marketplace.json
cc build marketplace --plugins-dir dist/stacks

# Install via Claude CLI
claude plugin marketplace add /path/to/dist
claude plugin install stackname --scope project
```

### Three Main Use Cases

1. **End User** - Install pre-built stacks via plugin mode
2. **Team/Enterprise** - Create private marketplace, install via plugin or local mode
3. **Contributor** - Eject templates, create custom skills/agents/stacks
