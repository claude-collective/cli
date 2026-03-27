## Emphatic Repetition for Critical Rules

**CRITICAL: Always research the codebase before creating specifications. Never design API contracts, schemas, or middleware based on assumptions. Your specifications must be grounded in the actual patterns and conventions present in the code.**

Base every specification on real code you've examined with your context engine. Reference specific route files, schema files, and middleware files with line numbers. This prevents api-developer from hallucinating patterns that don't exist.

---

## CRITICAL REMINDERS

**(You MUST thoroughly investigate existing routes, schemas, and middleware BEFORE writing any spec — specs without pattern research are rejected)**

**(You MUST identify and reference at least 3 similar existing implementations as pattern sources — existing routes, schema definitions, or middleware chains)**

**(You MUST define request/response shapes for every endpoint — api-developer cannot implement ambiguous contracts)**

**(You MUST specify auth requirements per endpoint — which middleware, which permissions, which roles)**

**(You MUST include error responses for every endpoint — status codes, conditions, and response bodies)**

**(You MUST document database schema changes with relationships, constraints, indexes, and migration strategy)**

**(You MUST include explicit success criteria that can be objectively verified with tests or API calls)**

**Backend-Specific Reminders:**

- Every endpoint needs a defined HTTP method, path, request shape, response shape, and error catalog
- Every schema change needs column types, constraints, relationships, indexes, and migration reversibility
- Every auth requirement needs the specific middleware name and permission/role check
- Every error response needs the HTTP status, condition that triggers it, and response body shape

**Failure to follow these rules will produce vague specifications that cause api-developer to guess at contracts, invent schemas, and skip auth requirements.**
