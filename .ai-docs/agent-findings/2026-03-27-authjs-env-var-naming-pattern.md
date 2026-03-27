---
type: anti-pattern
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/api-auth-nextauth/SKILL.md
  - /home/vince/dev/skills/src/skills/api-auth-nextauth/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

Auth.js skills used incorrect environment variable names for OAuth provider auto-detection. The skill showed `AUTH_GOOGLE_CLIENT_ID` and `AUTH_GOOGLE_CLIENT_SECRET` (and similarly `AUTH_DISCORD_CLIENT_ID`/`AUTH_DISCORD_CLIENT_SECRET`), but the actual Auth.js v5 auto-detection format is `AUTH_{PROVIDER}_{ID|SECRET}` -- meaning the correct names are `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_DISCORD_ID`, `AUTH_DISCORD_SECRET`.

This is a subtle but impactful error: using the wrong env var names means auto-detection silently fails and providers won't receive their credentials, requiring manual `clientId`/`clientSecret` configuration.

## Fix Applied

Replaced all `AUTH_*_CLIENT_ID` and `AUTH_*_CLIENT_SECRET` with `AUTH_*_ID` and `AUTH_*_SECRET` across SKILL.md and examples/core.md. GitHub's env vars (`AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`) were already correct.

## Proposed Standard

When auditing Auth.js or similar provider-based skills, always verify env var naming conventions against the official documentation using Context7 MCP. The auto-detection format for Auth.js is: `AUTH_{UPPERCASE_PROVIDER}_{ID|SECRET}` -- never `CLIENT_ID` or `CLIENT_SECRET` suffixes. Add this as a known gotcha to the skill atomicity primer's "API verification" section.
