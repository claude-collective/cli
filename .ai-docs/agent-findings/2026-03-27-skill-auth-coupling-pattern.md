---
type: anti-pattern
severity: medium
affected_files:
  - skills/src/skills/api-analytics-posthog-analytics/examples/core.md
  - skills/src/skills/api-analytics-posthog-analytics/examples/group-analytics.md
standards_docs:
  - .ai-docs/standards/skill-atomicity-bible.md
date: 2026-03-27
reporting_agent: skill-summoner
category: architecture
domain: api
root_cause: convention-undocumented
---

## What Was Wrong

Skills that demonstrate auth-adjacent patterns (identify on login, reset on logout, associate groups with organizations) were importing a specific auth library (`authClient` from `../lib/auth-client`) and using its specific API (`authClient.useSession()`, `authClient.useActiveOrganization()`). This couples the skill to a particular auth solution, violating atomicity. The atomicity bible covers `@repo/*` and framework-specific imports but does not explicitly call out auth library coupling, which is a common pattern in analytics, authorization, and session-related skills.

## Fix Applied

Replaced `authClient` imports with generic interfaces passed as parameters:

- `useAnalyticsIdentify(user: SessionUser | null)` instead of internally calling `authClient.useSession()`
- `useOrganizationAnalytics(activeOrg: ActiveOrg | null)` instead of internally calling `authClient.useActiveOrganization()`
- `useLogout(signOut: () => Promise<void>)` instead of internally calling `authClient.signOut()`

## Proposed Standard

Add to `skill-atomicity-bible.md` Section 4 "Keywords to Watch" a new subsection:

### Auth Libraries

```
authClient, auth-client, useSession, useActiveOrganization
better-auth, next-auth, NextAuth, lucia, clerk
signIn, signOut, signUp (when imported from auth library)
```

The fix pattern: accept auth data as function parameters (props, hook args) with a generic interface, rather than importing a specific auth library. Add a comment like `// Use your auth solution's session hook` to guide the developer.
