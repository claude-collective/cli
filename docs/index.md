# Agents Inc. CLI Documentation

## Documentation Index

### Standards

Rules and conventions for developers and content authors.

#### Code Standards (For CLI Developers)

| Document                                                            | Content                                     |
| ------------------------------------------------------------------- | ------------------------------------------- |
| [clean-code-standards.md](./standards/code/clean-code-standards.md) | Enforceable code quality rules              |
| [type-conventions.md](./standards/code/type-conventions.md)         | Type narrowing patterns and cast guidelines |

#### Content Standards (For Agent & Skill Authors)

| Document                                                                         | Content                                             |
| -------------------------------------------------------------------------------- | --------------------------------------------------- |
| [claude-architecture-bible.md](./standards/content/claude-architecture-bible.md) | Agent/skill compilation system and directory layout |
| [prompt-bible.md](./standards/content/prompt-bible.md)                           | Universal prompt engineering techniques for agents  |
| [skill-atomicity-bible.md](./standards/content/skill-atomicity-bible.md)         | Skill isolation and composability principles        |
| [agent-compliance-bible.md](./standards/content/agent-compliance-bible.md)       | Agent quality verification checklist                |
| [frontend-bible.md](./standards/content/frontend-bible.md)                       | Frontend standards extraction categories            |
| [loop-prompts-bible.md](./standards/content/loop-prompts-bible.md)               | Loop/orchestrator agent coordination patterns       |

### Reference

System documentation for understanding the codebase.

| Document                                       | Content                                              |
| ---------------------------------------------- | ---------------------------------------------------- |
| [architecture.md](./reference/architecture.md) | System architecture, data flow, module relationships |
| [commands.md](./reference/commands.md)         | CLI command reference with options and examples      |
| [data-models.md](./reference/data-models.md)   | Type definitions, schemas, data structures           |

### Guides

How-to documentation for common tasks.

| Document                                                        | Content                                           |
| --------------------------------------------------------------- | ------------------------------------------------- |
| [creating-a-marketplace.md](./guides/creating-a-marketplace.md) | Manual and automated marketplace creation         |
| [migrate-to-marketplace.md](./guides/migrate-to-marketplace.md) | Converting an existing CC repo into a marketplace |
| [commit-protocol.md](./guides/commit-protocol.md)               | AI commit and changelog conventions               |

### Features

Feature development documentation organized by lifecycle stage.

#### Active (In Development)

| Feature                | Documents                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Scroll Viewport        | [research](./features/active/scroll-viewport/research.md), [implementation](./features/active/scroll-viewport/implementation.md) |
| Stack Domain Filtering | [spec](./features/active/stack-domain-filtering/spec.md)                                                                         |

#### Proposed (Research Only)

| Document                                                 | Content                                                |
| -------------------------------------------------------- | ------------------------------------------------------ |
| [skill-consume.md](./features/proposed/skill-consume.md) | AI-assisted skill merging (`agentsinc consume`) design |
| [skill-search.md](./features/proposed/skill-search.md)   | Enhanced search with fuzzy matching design             |

#### Completed

| Document                                                                                      | Content                                |
| --------------------------------------------------------------------------------------------- | -------------------------------------- |
| [multi-skill-categories-findings.md](./features/completed/multi-skill-categories-findings.md) | Multi-skill category research findings |

### Archive

| Document                                                                 | Content                                |
| ------------------------------------------------------------------------ | -------------------------------------- |
| [recent-claude-code-updates.md](./archive/recent-claude-code-updates.md) | Historical Claude Code feature updates |

## Task Tracking

| Document                                       | Content                       |
| ---------------------------------------------- | ----------------------------- |
| [TODO.md](../todo/TODO.md)                     | Active tasks and blockers     |
| [TODO-completed.md](../todo/TODO-completed.md) | Archive of completed tasks    |
| [TODO-deferred.md](../todo/TODO-deferred.md)   | Deprioritized tasks for later |

## Quick Reference

### Installation Modes

1. **Plugin Mode** - Native Claude plugins via `claude plugin install`
2. **Local Mode** - Copies to `.claude/skills/` and `.claude/agents/`
3. **Eject Mode** - Export templates/config for full customization

### Key Commands

```bash
# Initialize in a project
agentsinc init --source /path/to/marketplace

# Build stack for distribution
agentsinc build stack --stack nextjs-fullstack

# Generate marketplace.json
agentsinc build marketplace --plugins-dir dist/stacks

# Install via Claude CLI
claude plugin marketplace add /path/to/dist
claude plugin install stackname --scope project
```

### Three Main Use Cases

1. **End User** - Install pre-built stacks via plugin mode
2. **Team/Enterprise** - Create private marketplace, install via plugin or local mode
3. **Contributor** - Eject templates, create custom skills/agents/stacks
