# cli

Private marketplace for custom skills and stacks.

## Directory Structure

```
config/stacks.ts         # Stack definitions (agent groupings with skill mappings)
src/skills/                # Custom skill definitions
```

## Creating Skills

```bash
agentsinc new skill <name> --category <category-name>
```

Each skill lives in `src/skills/<skill-name>/` with:
- `SKILL.md` -- Skill content (what the skill teaches)
- `metadata.yaml` -- Skill metadata (category, author, description, custom: true)

## Using This Marketplace

Point the CLI at this marketplace as a source:

```bash
# Local development
agentsinc init --source /path/to/cli

# From a git repository
agentsinc init --source github:your-org/cli
```

## How It Works

The CLI auto-discovers skills from the `src/skills/` directory
and stacks from `config/stacks.ts`.
Custom categories are discovered from skill `metadata.yaml` files with `custom: true`.
Custom skills appear alongside built-in ones in the wizard. No manual registration needed.
