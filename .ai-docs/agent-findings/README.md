# Standards Feedback Loop

Sub-agents capture anti-pattern findings during refactoring and review work. A `convention-keeper` agent synthesizes them into documentation updates.

## Pipeline

```
Sub-Agent Work → Structured Findings → Convention Keeper → Doc Updates
     (capture)      (accumulate)         (synthesize)        (apply)
```

### Stage 1: Capture

When a sub-agent (cli-developer, cli-tester, cli-reviewer, etc.) fixes an anti-pattern or discovers a gap in documented standards, it writes a finding here.

**Who writes findings:**

- Sub-agents write raw findings during work (they have the full context)
- The orchestrator writes findings when synthesizing across multiple agent results

**When to write a finding:**

- You fixed duplicated code/constants that should have been shared
- You found a missing or weak assertion pattern
- You discovered a convention that isn't documented
- You noticed drift between documented standards and actual practice
- You applied a fix that would benefit from a preventive rule

### Stage 2: Accumulate

Findings pile up in this directory across sessions. Each review/refactor session typically produces 3-8 findings. No processing needed — they're just markdown files.

### Stage 3: Synthesize

Invoke the `convention-keeper` agent to:

1. Read unprocessed findings (`.md` files, excluding `done/`)
2. Group by theme (DRY, typescript, testing, complexity)
3. Cross-reference against `.ai-docs/standards/` and `CLAUDE.md`
4. Determine: existing rule violated (enforcement gap) or missing rule (documentation gap)?
5. Propose targeted additions to specific docs
6. Move processed findings to `done/`

## Finding Format

See `TEMPLATE.md` for the structure. Each finding is a small markdown file (~15-25 lines) with YAML frontmatter containing: `type` (anti-pattern, standard-gap, convention-drift), `severity`, `affected_files`, `standards_docs`, `date`, `reporting_agent` (which sub-agent discovered the issue -- tells us whose instructions may need updating to prevent recurrence), `category` (dry, typescript, testing, complexity, performance, architecture), `domain` (e2e, cli, web, api, shared, infra), and `root_cause` (missing-rule, rule-not-visible, rule-not-specific-enough, convention-undocumented, enforcement-gap). Findings start here, get processed by the convention-keeper, then move to `done/`. The directory location IS the status.

## File Naming

Use descriptive kebab-case names with date prefix:

- `2026-03-21-duplicated-skillspath-helper.md`
- `2026-03-21-toequal-vs-tostrictequal.md`
- `2026-03-21-missing-cleanup-in-smoke-tests.md`
