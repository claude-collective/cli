---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/web-data-fetching-graphql-apollo/SKILL.md
  - skills/src/skills/web-data-fetching-graphql-apollo/reference.md
  - skills/src/skills/web-data-fetching-graphql-apollo/examples/core.md
  - skills/src/skills/web-data-fetching-graphql-apollo/examples/fragments.md
  - skills/src/skills/web-data-fetching-graphql-apollo/examples/testing.md
  - skills/src/skills/web-data-fetching-graphql-apollo/examples/suspense.md
  - skills/src/skills/web-data-fetching-graphql-urql/SKILL.md
  - skills/src/skills/web-data-fetching-graphql-urql/reference.md
  - skills/src/skills/web-data-fetching-graphql-urql/examples/core.md
  - skills/src/skills/web-data-fetching-graphql-urql/examples/v6-features.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
  - .ai-docs/standards/prompt-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

Two patterns found across both GraphQL skills:

1. **Codebase-specific path aliases (`@/`)**: Apollo skill used `@/generated/graphql`, `@/graphql/fragments`, `@/test/apollo-test-utils`, `@/lib/apollo-preloader` in 6 import locations across 4 example files. These assume a specific project path alias configuration and violate Cat 7 (Codebase-Specific Imports).

2. **Cross-domain tool naming**: URQL reference.md had an "URQL vs Apollo Quick Comparison" table and "Hook Comparison: URQL vs Apollo" section that named Apollo Client explicitly. URQL SKILL.md named "Apollo Client" in the "When NOT to use" section. Apollo reference.md had a "Works with" integration guide naming GraphQL Codegen, graphql-ws, React, and Testing libraries by name.

3. **Framework-specific references**: Apollo suspense.md named "React Router" and "TanStack Router" explicitly and used `useLoaderData()` (React Router API). URQL core.md included `"use client"` (Next.js directive). URQL v6-features.md had explicit `import { describe, expect, it, vi } from "vitest"`.

4. **Template contamination**: Apollo SKILL.md included "(You MUST use named exports only - NO default exports)" in critical requirements/reminders -- this is a generic CLAUDE.md rule, not an Apollo-specific requirement.

## Fix Applied

- Removed "named exports" template contamination from Apollo critical_requirements and critical_reminders
- Replaced Apollo "Works with" integration guide with domain-boundary-only guidance
- Changed all `@/` imports to relative `../` imports across Apollo example files
- Genericized React Router/TanStack Router references to "any router that supports loaders"
- Replaced URQL "Apollo Client" reference with "another GraphQL client"
- Rewrote URQL comparison table and hook section to be URQL-only (no Apollo naming)
- Removed Hasura comparison article link from URQL sources
- Removed `"use client"` Next.js directive from URQL provider example
- Replaced explicit vitest import with generic test runner comment

## Proposed Standard

Add to `skill-atomicity-bible.md` Section 4 (Keywords to Watch):

**Path Aliases**: `@/` imports (codebase-specific path aliases like `@/lib/`, `@/generated/`, `@/test/`) should be replaced with relative imports (`../lib/`, `../generated/`). Path aliases assume specific project configuration and reduce portability.

**Same-Domain Tool Comparisons**: Skills should not include comparison tables or sections that name other GraphQL clients (or equivalent tools). The skill should stand alone describing its own API, not position itself against competitors. Comparison belongs at the stack/decision level, not skill level.
