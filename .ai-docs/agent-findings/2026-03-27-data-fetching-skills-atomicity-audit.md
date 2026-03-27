---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/web-data-fetching-swr/examples/suspense.md
  - skills/src/skills/web-data-fetching-trpc/examples/subscriptions.md
  - skills/src/skills/web-data-fetching-trpc/examples/core.md
  - skills/src/skills/web-data-fetching-trpc/examples/infinite-queries.md
  - skills/src/skills/web-data-fetching-trpc/examples/middleware.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: web
root_cause: convention-undocumented
---

## What Was Wrong

Data fetching skills had several atomicity violations that survived previous iteration passes:

1. **Codebase-specific imports (`@/lib/trpc`)** in tRPC skill -- Category 7 violation. Path alias imports are not portable.
2. **Vendor-specific library imports (`@upstash/ratelimit`, `@upstash/redis`)** in tRPC middleware example -- prescribes specific rate limiting vendor instead of showing generic pattern.
3. **Third-party UI library import (`react-intersection-observer`)** in tRPC infinite queries -- couples to specific scroll detection library instead of using native IntersectionObserver.
4. **Third-party error boundary import (`react-error-boundary`)** in SWR suspense example -- prescribes specific error boundary library.
5. **Framework-specific `"use client"` directive** in tRPC core example -- Next.js/React Server Components specific. SWR skill already had the correct pattern: `// Mark as client component if using an SSR framework`.
6. **Content duplication** in SWR -- identical PrefetchList component appeared in both caching.md and suspense.md.

## Fix Applied

1. Replaced `@/lib/trpc` with `../lib/trpc` (generic relative import)
2. Replaced `@upstash` vendor imports with a generic in-memory rate limiter example
3. Replaced `react-intersection-observer` hook with native IntersectionObserver API
4. Replaced `react-error-boundary` import with a comment suggesting using your error boundary solution
5. Replaced `"use client"` with generic `// Mark as client component if using an SSR framework`
6. Replaced duplicated PrefetchList in suspense.md with cross-reference to caching.md

## Proposed Standard

Add to skill-atomicity-bible.md Keywords to Watch section:

- **Vendor-specific service imports** (e.g., `@upstash/*`, `@vercel/*`) should be replaced with generic implementations
- **UI helper library imports** (e.g., `react-intersection-observer`, `react-error-boundary`) should use native browser APIs or generic comments
- **Path alias imports** (`@/`, `~/`) are codebase-specific and should use relative paths
- **Framework directives** (`"use client"`, `"use server"`) should use generic comments

These are subtler violations than the standard cross-domain keywords but equally important for portability.
