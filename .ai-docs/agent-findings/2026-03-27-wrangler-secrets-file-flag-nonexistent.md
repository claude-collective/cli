---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/infra-platform-cloudflare-workers/reference.md
  - skills/src/skills/infra-platform-cloudflare-workers/examples/core.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: infra
root_cause: convention-undocumented
---

## What Was Wrong

The Cloudflare Workers skill referenced a non-existent Wrangler CLI flag: `wrangler deploy --secrets-file .env.production`. This flag does not exist in any version of Wrangler. The correct command for bulk secret upload is `wrangler secret bulk <filename>` where the file is a JSON object of key-value pairs.

This is an example of AI-generated content fabricating a plausible-sounding CLI flag that does not exist. The skill atomicity primer warns about "wrong API signatures" but this extends to CLI commands as well.

## Fix Applied

Replaced `npx wrangler deploy --secrets-file .env.production` with `npx wrangler secret bulk secrets.json` in both reference.md and examples/core.md.

## Proposed Standard

Add to skill-atomicity-primer.md under "API verification": CLI commands and flags must be verified against official documentation, not just function/method signatures. AI-generated skills frequently invent plausible CLI flags (e.g., `--secrets-file`, `--output`, `--format`) that do not exist.
