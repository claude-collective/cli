# Workflows

## 1. Install Stack as Plugin (End User)

```bash
# From target project directory
cd /path/to/my-project

# If marketplace not registered
claude plugin marketplace add /path/to/claude-subagents/dist

# Install stack
claude plugin install nextjs-fullstack --scope project

# Verify
claude plugin list
```

Result: `.claude/settings.json` updated with `enabledPlugins`.

---

## 2. Install Stack via Local Mode (Recommended)

```bash
cd /path/to/my-project

cc init --source /path/to/claude-subagents

# In wizard:
# 1. Select "Start from a stack template"
# 2. Choose stack
# 3. Select "Local" install mode (default)
```

Result:

- `.claude/skills/` - copied skill files
- `.claude/agents/` - compiled agent markdown
- `.claude/config.yaml` - stack configuration

---

## 3. Build and Distribute Marketplace

```bash
# From skills repo
cd /path/to/claude-subagents

# Build a stack
cc build:stack --stack nextjs-fullstack -v

# Generate marketplace.json
cc build:marketplace --plugins-dir dist/stacks -o dist/.claude-plugin/marketplace.json

# Fix paths if needed (source paths must be relative to marketplace root)
# e.g., "./stacks/nextjs-fullstack" not "./dist/stacks/nextjs-fullstack"

# Register marketplace
claude plugin marketplace add /path/to/dist

# Install from marketplace
cd /path/to/target-project
claude plugin install nextjs-fullstack --scope project
```

---

## 4. Create Custom Stack

```bash
# From skills repo
cd /path/to/claude-subagents

# Create stack directory
mkdir -p src/stacks/my-stack

# Create config.yaml
cat > src/stacks/my-stack/config.yaml << 'EOF'
name: "My Custom Stack"
version: "1.0.0"
author: "@myhandle"

skills:
  - id: web/framework/react (@vince)
    preloaded: true
  - id: web/state/zustand (@vince)

agents:
  - web-developer
  - web-reviewer

agent_skills:
  web-developer:
    framework:
      - id: web/framework/react (@vince)
        preloaded: true
EOF

# Build it
cc build:stack --stack my-stack -v
```

---

## 5. Create Custom Skill

```bash
cd /path/to/claude-subagents

# Create skill directory
mkdir -p "src/skills/web/framework/my-framework (@myhandle)"

# Create metadata.yaml
cat > "src/skills/web/framework/my-framework (@myhandle)/metadata.yaml" << 'EOF'
category: framework
author: "@myhandle"
cli_name: My Framework
cli_description: Custom framework patterns
usage_guidance: Use when building with My Framework
compatible_with:
  - "vitest (@vince)"
EOF

# Create SKILL.md
cat > "src/skills/web/framework/my-framework (@myhandle)/SKILL.md" << 'EOF'
---
name: web/framework/my-framework (@myhandle)
description: Custom framework patterns
---

# My Framework Skill

<critical_requirements>
- Always use X pattern
- Never do Y
</critical_requirements>

## Patterns

...
EOF
```

---

## 6. Eject and Customize Templates

```bash
cd /path/to/my-project

# Eject Liquid templates
cc eject templates

# Edit templates in .claude/templates/
# Recompile with customizations
cc compile
```

---

## 7. Eject Skills for Customization

```bash
cd /path/to/my-project

# Eject all skills from plugin
cc eject skills

# Edit skills in .claude/skills/
# Recompile
cc compile
```

Result: Skills copied to `.claude/skills/` where they can be customized.

---

## 8. Eject Agent Partials

```bash
cd /path/to/my-project

# Eject agent partials for customization
cc eject agents

# Edit partials in .claude/agents/_partials/
# Recompile
cc compile
```

Result: Agent partials copied to `.claude/agents/_partials/` for customization.

---

## 9. Full Eject (Templates + Skills + Agents + Config)

```bash
cd /path/to/my-project

# Eject everything
cc eject all

# Result:
# - .claude/templates/
# - .claude/skills/
# - .claude/agents/_partials/
# - .claude/config.yaml
```

---

## 10. Recompile After Changes

```bash
cd /path/to/my-project

# After editing skills, agent partials, or config
cc compile -v
```

---

## 11. Uninstall Plugin

```bash
cd /path/to/my-project

# Interactive uninstall (prompts for confirmation)
cc uninstall

# Non-interactive
cc uninstall --yes

# Keep config file
cc uninstall --keep-config

# Only remove plugin (keep local files)
cc uninstall --plugin

# Only remove local files (keep plugin)
cc uninstall --local
```

---

## 12. Validate Before Publishing

```bash
# Validate YAML schemas
cc validate

# Validate built plugins
cc validate dist/stacks --all -v
```

---

## 13. Update Installed Plugin

```bash
cd /path/to/my-project

# Edit skill selections
cc edit

# Or manually edit and recompile
# 1. Edit .claude/config.yaml
# 2. Run cc compile
```

---

## 14. Use Different Source

```bash
# Via flag (highest priority)
cc init --source /local/path
cc init --source github:myorg/myrepo

# Via environment variable
export CC_SOURCE=/local/path
cc init

# Via project config
cc config set-project source /local/path

# Via global config
cc config set source /local/path

# Check effective config
cc config show
```

---

## 15. Create Custom Agent (Manual)

```bash
cd /path/to/my-project

# Edit .claude/config.yaml
cat >> .claude/config.yaml << 'EOF'

custom_agents:
  my-developer:
    title: My Custom Developer
    description: Specialized for our codebase
    extends: web-developer
    model: opus
    skills:
      - react
      - our-custom-skill
EOF

# Recompile to generate agent
cc compile
```

Result: New agent `my-developer.md` created in `.claude/agents/`.

---

## 16. Create Custom Agent (AI-Generated)

```bash
cd /path/to/my-project

# Interactive mode - prompts for purpose
cc new agent my-agent --source /path/to/skills-repo

# Non-interactive with all options
cc new agent migration-manager \
  --purpose "Manages database migrations with rollback support" \
  --source /path/to/skills-repo \
  --non-interactive
```

The command:

1. Fetches the `agent-summoner` meta-agent from the source repository
2. Invokes Claude with the agent-summoner to generate agent files
3. Creates the agent in `.claude/agents/_custom/<name>/`

Result: Complete agent structure with `agent.yaml`, `intro.md`, `workflow.md`, etc.

---

## 17. Use Remote Agent Definitions

```bash
# Set remote agent source
cc config set agents_source github:myorg/agents

# Or per-project
cc config set-project agents_source /path/to/custom/agents

# Compile uses remote agents
cc compile --agent-source github:myorg/agents
```
