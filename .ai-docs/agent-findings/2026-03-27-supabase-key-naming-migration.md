---
type: convention-drift
severity: medium
affected_files:
  - /home/vince/dev/skills/src/skills/api-baas-supabase/SKILL.md
  - /home/vince/dev/skills/src/skills/api-baas-supabase/reference.md
  - /home/vince/dev/skills/src/skills/api-baas-supabase/examples/core.md
  - /home/vince/dev/skills/src/skills/api-baas-supabase/examples/auth.md
  - /home/vince/dev/skills/src/skills/api-baas-supabase/examples/edge-functions.md
  - /home/vince/dev/skills/src/skills/api-baas-supabase/examples/storage.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-primer.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

Supabase has renamed their API keys as part of a security improvement initiative:

- `SUPABASE_ANON_KEY` is now `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` is now `SUPABASE_SECRET_KEY`

The new keys are opaque short random keys with checksums, replacing the legacy JWT-based keys. Both old and new names work during the transition period, but official docs now use the new naming exclusively.

Additionally, the `createSignedUploadUrl()` expiry was documented as 2 hours but the current Supabase docs state 24 hours.

All references in the `api-baas-supabase` skill used the old naming convention.

## Fix Applied

Updated all 7 files in the skill to use the new key naming:

- All `SUPABASE_ANON_KEY` env vars and prose references replaced with `SUPABASE_PUBLISHABLE_KEY` / "publishable key"
- All `SUPABASE_SERVICE_ROLE_KEY` env vars and prose references replaced with `SUPABASE_SECRET_KEY` / "secret key"
- Added "(formerly ...)" transition notes in reference.md env var section and SKILL.md red flags
- Updated signed upload URL expiry from "2 hours" to "24 hours" in SKILL.md, reference.md, and examples/storage.md
- Preserved `anon` and `service_role` as Postgres role names in SQL policy examples (these are unchanged)

## Proposed Standard

Add a note to `.ai-docs/standards/skill-atomicity-primer.md` under "API verification" section:

> When verifying Supabase APIs, note the key rename: `SUPABASE_ANON_KEY` -> `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` -> `SUPABASE_SECRET_KEY`. The Postgres role names (`anon`, `service_role`, `authenticated`) are unchanged.

Other Supabase-adjacent skills (if any reference these env vars) should also be checked.
