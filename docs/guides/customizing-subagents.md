# Customizing Subagents

Subagents are composed from three layers: partials, templates, and skills. Each layer can be ejected and modified independently.

## Ejecting

```bash
agentsinc eject agent-partials   # Role-specific partials (intro, workflow, output)
agentsinc eject templates        # Global Liquid templates shared across all subagents
agentsinc eject skills           # Fork skills for local editing
agentsinc eject all              # Everything at once
```

Run `agentsinc compile` after editing any ejected files to rebuild your subagents.

## Partials

Each subagent has six partials that can be customized:

- `intro.md` — Role description and identity
- `workflow.md` — Step-by-step process the agent follows
- `examples.md` — Example interactions
- `critical-requirements.md` — Hard rules the agent must follow
- `critical-reminders.md` — Repeated emphasis on key behaviors
- `output-format.md` — How the agent structures its responses

**Partials** apply to specific roles. Use these to customize how a particular subagent behaves.

## Templates

**Templates** apply globally across all subagents. Use these for shared conventions like coding style, commit formats, or project-wide rules.

## Configuration

Skill-to-subagent mappings and load behavior (preloaded vs dynamic) are configured in `.claude-src/config.ts`. Use `agentsinc edit` to modify selections interactively, or edit the config file directly.

After making changes, run `agentsinc compile` to rebuild your subagents.
