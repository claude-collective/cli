---
type: convention-drift
severity: low
affected_files:
  - src/agents/reviewer/infra-reviewer/critical-requirements.md
  - src/agents/reviewer/infra-reviewer/critical-reminders.md
standards_docs:
  - src/agents/reviewer/infra-reviewer/workflow.md
date: 2026-03-27
reporting_agent: agent-summoner
category: architecture
domain: infra
root_cause: rule-not-specific-enough
---

## What Was Wrong

The infra-reviewer agent's critical-requirements.md and critical-reminders.md used `@latest` as an example of a mutable GitHub Actions tag:

```
not mutable tags like `@v3` or `@latest`
```

`@latest` is not a GitHub Actions tag convention. GitHub Actions use version tags like `@v3`, `@v4`, `@main`, `@master`. The `latest` tag convention belongs to Docker Hub images and npm packages. Using `@latest` as a GitHub Actions example could cause the agent to grep for a pattern that doesn't exist in Actions workflows while missing real patterns like `@main`.

## Fix Applied

Changed both files from `@latest` to `@main`:

```
not mutable tags like `@v3` or `@main`
```

Also made the self-correction trigger more specific about what "pinned" means (full SHA hash) and which mutable tags to watch for (`@v4`, `@main`).

## Proposed Standard

When writing domain-specific examples in agent prompts, use terminology and patterns accurate to the specific technology. Docker has `latest` tags, GitHub Actions have version tags (`@v3`, `@main`). Mixing conventions from adjacent domains creates false pattern-matching in reviews.
