# Rebrand Tracking File

## Rename Summary

- GitHub org: `claude-collective` → `agents-inc`
- npm package: `@claude-collective/cli` → `@agents-inc/cli`
- CLI binary: `cc` → `agentsinc`
- Skills source: `github:claude-collective/skills` → `github:agents-inc/skills`
- Schema URLs: `raw.githubusercontent.com/claude-collective/cli` → `raw.githubusercontent.com/agents-inc/cli`

---

## Status Key

- [ ] Not started
- [x] Done

---

## Production Code Changes

### package.json

- [ ] `bin.cc` → `bin.agentsinc` (line 13)
- [ ] `oclif.bin` → `"agentsinc"` (line 46)
- [ ] `scripts.cc` → `scripts.agentsinc` (line 68)
- [ ] `scripts.cc:dev` → `scripts.agentsinc:dev` (line 69)
- [ ] `repository.url` → `agents-inc/cli` (line 86)
- [ ] `bugs.url` → `agents-inc/cli` (line 91)
- [ ] `homepage` → `agents-inc/cli` (line 93)

### src/cli/consts.ts

- [ ] `SCHEMA_PKG_PREFIX` URL → `agents-inc/cli` (line 70)

### src/cli/lib/configuration/config.ts

- [ ] `DEFAULT_SOURCE` → `github:agents-inc/skills` (line 19)

### src/cli/lib/loading/source-loader.ts

- [ ] JSDoc comments referencing `claude-collective` (lines 223, 244)

### Lock files

- [ ] Regenerate `package-lock.json` after changes
- [ ] Regenerate `bun.lock` after changes

---

## Config Files

### .claude-src/config.yaml

- [ ] Schema URL comment (line 1)
- [ ] `name: claude-collective` → `name: agents-inc` (line 2)
- [ ] `source: github:claude-collective/skills` → `github:agents-inc/skills`

### config/stacks.yaml

- [ ] Schema URL comment (line 1)

### config/skills-matrix.yaml

- [ ] Schema URL comment (line 1)

---

## Agent YAML Files (18 files — all line 1 schema comments)

- [ ] src/agents/tester/web-tester/agent.yaml
- [ ] src/agents/tester/cli-tester/agent.yaml
- [ ] src/agents/pattern/web-pattern-critique/agent.yaml
- [ ] src/agents/pattern/pattern-scout/agent.yaml
- [ ] src/agents/reviewer/cli-reviewer/agent.yaml
- [ ] src/agents/reviewer/web-reviewer/agent.yaml
- [ ] src/agents/reviewer/api-reviewer/agent.yaml
- [ ] src/agents/migration/cli-migrator/agent.yaml
- [ ] src/agents/researcher/api-researcher/agent.yaml
- [ ] src/agents/researcher/web-researcher/agent.yaml
- [ ] src/agents/planning/web-pm/agent.yaml
- [ ] src/agents/meta/agent-summoner/agent.yaml
- [ ] src/agents/meta/skill-summoner/agent.yaml
- [ ] src/agents/meta/documentor/agent.yaml
- [ ] src/agents/developer/cli-developer/agent.yaml
- [ ] src/agents/developer/api-developer/agent.yaml
- [ ] src/agents/developer/web-developer/agent.yaml
- [ ] src/agents/developer/web-architecture/agent.yaml

---

## Agent Markdown Content (references to `cc <command>`)

- [ ] src/agents/meta/agent-summoner/critical-requirements.md
- [ ] src/agents/meta/agent-summoner/examples.md
- [ ] src/agents/meta/agent-summoner/critical-reminders.md
- [ ] src/agents/meta/agent-summoner/workflow.md
- [ ] src/agents/meta/skill-summoner/output-format.md (schema URL)

---

## Test Files

### Tests asserting `claude-collective`

- [ ] src/cli/lib/configuration/config.test.ts — DEFAULT_SOURCE assertion
- [ ] src/cli/lib/loading/multi-source-loader.test.ts — ~10 fixture references
- [ ] src/cli/components/wizard/step-settings.test.tsx — ~4 mock data references

### Tests referencing `cc` as CLI command

(research agent will populate)

---

## CLI Command References (`cc <command>` → `agentsinc <command>`)

### Production code (commands, messages, stores)

(research agent will populate with exact file:line references)

### Documentation

(research agent will populate)

### Changelogs

(research agent will populate — these are historical, may keep as-is)

---

## Research Agent Findings

(Research agents will append findings below this line)

---
