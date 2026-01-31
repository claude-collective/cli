# CLI Integration Testing Research

## Overview

This document captures the research findings for implementing comprehensive CLI integration tests. The goal is to test user journeys end-to-end, ensuring correct folder/file creation and proper skill references in compiled agents.

---

## Key User Journeys to Test

### 1. Init Command Flows

**Stack Approach:**

```
cc init --source ./test-source
  → Select "Start from a stack template"
  → Choose stack (e.g., nextjs-fullstack)
  → Confirm
  → Verify: .claude/config.yaml, .claude/skills/, .claude/agents/
```

**Browse Approach:**

```
cc init --source ./test-source
  → Select "Browse skills by category"
  → Navigate categories, select skills
  → Confirm
  → Verify: .claude/config.yaml, .claude/skills/, .claude/agents/
```

### 2. Compile Command

```
cc compile
  → Read .claude/config.yaml
  → Load skills from .claude/skills/
  → Compile agents with Liquid templates
  → Verify: agents have correct frontmatter (preloaded skills)
```

### 3. Build:Stack Command

```
cc build:stack --stack nextjs-fullstack
  → Load stack config
  → Compile all agents
  → Copy all skills
  → Generate plugin manifest
  → Verify: dist/ structure correct
```

---

## What Needs Mocking

### File System

- Use temp directories for test isolation
- Mock `~/.cache/claude-collective/` with temp directory
- Create fixture files programmatically

### Network (giget)

- Mock `downloadTemplate` from giget package
- Return pre-populated temp directory
- Test both cached and fresh fetch scenarios

### Environment

```typescript
process.env.CC_SOURCE; // Source override
process.env.HOME; // For config/cache paths
```

---

## Fixture Structure

### Minimal Test Source

```
test-fixtures/
├── skills-matrix.yaml
└── src/
    ├── skills/
    │   └── web/
    │       └── framework/
    │           └── react (@vince)/
    │               ├── metadata.yaml
    │               └── SKILL.md
    └── stacks/
        └── test-stack/
            └── config.yaml
```

### Mock skills-matrix.yaml

```yaml
version: "1.0.0"
generatedAt: "2025-01-01T00:00:00Z"
categories:
  web:
    id: web
    name: Web
    description: Web development
    exclusive: false
    required: false
    order: 1
  web/framework:
    id: web/framework
    name: Framework
    parent: web
    description: UI frameworks
    exclusive: true
    required: true
    order: 1
relationships:
  conflicts: []
  recommends: []
  requires: []
  alternatives: []
  discourages: []
suggested_stacks:
  - id: test-stack
    name: Test Stack
    skills:
      web/framework: react (@vince)
skill_aliases:
  react: react (@vince)
```

### Mock Skill metadata.yaml

```yaml
category: web/framework
category_exclusive: true
author: "@vince"
version: "1.0.0"
cli_name: "React"
cli_description: "React framework"
usage_guidance: "Use for React apps"
tags: ["frontend"]
```

### Mock SKILL.md

```markdown
---
name: react (@vince)
description: React framework patterns
---

# React Skill

Test content for integration tests.
```

---

## Verification Points

### Config Generation

- `config.yaml` has correct `skills` array
- `config.yaml` has correct `agents` array
- Preloaded skills marked with `preloaded: true`

### Skill Installation

- Skill directories created in `.claude/skills/`
- SKILL.md files copied correctly
- metadata.yaml preserved

### Agent Compilation

- Agent markdown files created in `.claude/agents/`
- Frontmatter contains `skills:` array with preloaded skills
- Agent body references non-preloaded skills via Skill tool

### Plugin Structure (for build:stack)

- `.claude-plugin/plugin.json` manifest valid
- `agents/` directory has compiled agents
- `skills/` directory has all stack skills

---

## Test Organization

```
src/cli-v2/lib/__tests__/
├── fixtures/
│   ├── create-test-source.ts    # Helper to create temp source
│   ├── mock-matrix.ts           # Matrix fixture data
│   └── mock-skills.ts           # Skill fixture data
├── integration.test.ts          # Main integration tests
├── init-journeys.test.ts        # Init command user flows
├── compile.test.ts              # Compile command tests
└── build-stack.test.ts          # Build:stack tests
```

---

## Implementation Notes

1. **Use runCommand from @oclif/test** for command testing
2. **Use ink-testing-library** for Ink component tests (wizard)
3. **Always cleanup temp directories** in afterEach
4. **Reset Zustand stores** between tests
5. **Use vitest with disableConsoleIntercept: true**

---

## Related Files

- `src/cli-v2/lib/source-loader.ts` - Source loading logic
- `src/cli-v2/lib/matrix-loader.ts` - Matrix merging
- `src/cli-v2/lib/compiler.ts` - Agent compilation
- `src/cli-v2/lib/config-generator.ts` - Config generation
- `src/cli-v2/commands/init.tsx` - Init command
- `src/cli-v2/commands/compile.ts` - Compile command
