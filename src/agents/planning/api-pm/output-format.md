## Output Format

<output_format>
Provide your specification in this structure:

<goal>
[Clear, concise description of the backend capability being specified — one sentence]

**User Story:** As a [consumer type — frontend, service, external client], I need [API capability] so that [benefit].
</goal>

<context>

## Why This Matters

**Business Problem:** [What backend capability is missing]
**Consumer Impact:** [How downstream consumers — frontend, other services — are affected]
**Priority:** [Critical | High | Medium | Low]

## Current State

- [What exists now — with file references to existing routes, schemas, middleware]
- [Current technical limitation or gap]

## Desired State

- [What will exist after implementation]
- [How the API surface changes]

</context>

<existing_patterns>

## Pattern Files to Reference

**Before implementing, api-developer MUST read these files:**

| Priority | File                         | Lines | Pattern Demonstrated                |
| -------- | ---------------------------- | ----- | ----------------------------------- |
| 1        | [/path/to/similar/route.ts]  | [X-Y] | [Route structure, middleware chain] |
| 2        | [/path/to/similar/schema.ts] | [X-Y] | [Table definition, relationships]   |
| 3        | [/path/to/middleware.ts]     | [X-Y] | [Auth/validation pattern to reuse]  |

**Why these patterns:**

- [Pattern 1]: [Why this is the right route reference]
- [Pattern 2]: [Why this schema matches our needs]

</existing_patterns>

<api_contract>

## API Contract

### [METHOD] [/api/path]

**Auth:** [middleware name + permission/role | public]
**Rate Limit:** [limit | none]

**Request:**

| Parameter | Location          | Type   | Required | Description  |
| --------- | ----------------- | ------ | -------- | ------------ |
| [name]    | [path/query/body] | [type] | [yes/no] | [what it is] |

**Success Response:** [status code]

```
{
  // Response shape with field types and descriptions
}
```

**Error Responses:**

| Status | Condition            | Response Body                       |
| ------ | -------------------- | ----------------------------------- |
| 400    | [Validation failure] | `{ error: string, details: [...] }` |
| 401    | [Auth failure]       | `{ error: string }`                 |
| 403    | [Permission failure] | `{ error: string }`                 |
| 404    | [Resource not found] | `{ error: string }`                 |

### [Next endpoint...]

</api_contract>

<database_schema>

## Database Schema

### Table: [table_name]

**Pattern Source:** [/path/to/similar/schema.ts:lines]

| Column    | Type      | Constraints                   | Purpose            |
| --------- | --------- | ----------------------------- | ------------------ |
| id        | uuid      | PK, default gen_random_uuid() | Primary identifier |
| [name]    | [type]    | [nullable, unique, FK, etc.]  | [Why needed]       |
| createdAt | timestamp | NOT NULL, default now()       | Audit trail        |
| updatedAt | timestamp | NOT NULL, default now()       | Audit trail        |
| deletedAt | timestamp | nullable                      | Soft delete        |

**Relationships:**

- [one-to-many / many-to-many] with [other_table] via [FK / join table]

**Indexes:**

| Columns      | Type               | Purpose                     |
| ------------ | ------------------ | --------------------------- |
| [col1, col2] | [btree/unique/gin] | [Query optimization reason] |

**Migration Strategy:**

- Reversible: [Yes / No — why not]
- Data migration needed: [Yes — describe / No]
- Downtime required: [Yes — why / No]

</database_schema>

<middleware_requirements>

## Middleware Requirements

**Request Pipeline Order:**

1. [Rate limiting — if applicable]
2. [Auth middleware — which one]
3. [Input validation — schema reference]
4. [Business logic handler]
5. [Response serialization]

**New Middleware Needed:** [None — reuse existing | Description of what's needed and why existing won't work]

**Existing Middleware to Reuse:**

- [middleware name] from [/path:lines] — [purpose]

</middleware_requirements>

<technical_requirements>

## Requirements

### Must Have (MVP)

1. [Requirement — specific and measurable]
2. [Requirement — specific and measurable]

### Should Have (If Time Permits)

1. [Enhancement]

### Must NOT Have (Explicitly Out of Scope)

1. [Feature excluded] — [Why excluded]
2. [Feature excluded] — [Why excluded]

</technical_requirements>

<constraints>

## Constraints

### Scope Boundaries

**Files to Modify:**

- [/path/to/route.ts] — [What changes]
- [/path/to/schema.ts] — [What changes]

**Files to Create:**

- [/path/to/new-route.ts] — [Purpose]

**Files NOT to Touch:**

- [/path/to/file.ts] — [Why off-limits]

### Technical Constraints

- [Constraint — e.g., "Must use existing validation middleware"]
- [Constraint — e.g., "Must maintain backward compatibility with v1 API"]
- [Constraint — e.g., "No new ORM dependencies"]

### Dependencies

- **Requires:** [Other features/services this depends on]
- **Blocks:** [Features/services waiting on this]

</constraints>

<success_criteria>

## Success Criteria

### Functional Requirements

| Criterion                          | How to Verify                |
| ---------------------------------- | ---------------------------- |
| [Endpoint returns X when Y]        | [curl command / test name]   |
| [Schema constraint enforced]       | [SQL check / migration test] |
| [Auth rejects unauthorized access] | [401/403 test scenario]      |

### Technical Requirements

| Criterion                        | How to Verify                  |
| -------------------------------- | ------------------------------ |
| [Tests pass]                     | [test command]                 |
| [No type errors]                 | `tsc --noEmit`                 |
| [Follows existing patterns]      | [Reference pattern file]       |
| [No modifications outside scope] | `git diff -- [excluded paths]` |

### Non-Functional Requirements

| Criterion                       | How to Verify                      |
| ------------------------------- | ---------------------------------- |
| [Response time < X ms]          | [Performance test / manual timing] |
| [Handles N concurrent requests] | [Load test scenario]               |

</success_criteria>

<implementation_notes>

## Role-Specific Guidance

### For api-developer

**Investigation Phase:**

1. Read all pattern files listed above (priority order)
2. Understand the route/middleware/schema patterns before implementing
3. Check for existing utilities in /lib, /utils

**Implementation Order:**

1. [First step — usually schema/migration]
2. [Second step — core route handlers]
3. [Third step — middleware integration]

**Key Decisions Already Made:**

- [Decision] — [Rationale]

### For api-tester

**Test Coverage Requirements:**

- Happy path: [Specific endpoint scenarios]
- Error cases: [Specific error conditions per endpoint]
- Edge cases: [Boundary conditions — empty lists, max pagination, concurrent mutations]
- Auth: [Unauthorized access, expired tokens, insufficient permissions]

### For api-reviewer

**Focus Areas:**

- [SQL injection prevention — parameterized queries]
- [Auth middleware applied to correct routes]
- [Transaction boundaries for multi-step operations]
- [Error response consistency]

</implementation_notes>

<questions>

## Open Questions (If Any)

**Resolved:**

- Q: [Question] → A: [Answer/decision made]

**Needs Clarification:**

- Q: [Unanswered question that may affect implementation]

</questions>

</output_format>

---

## Section Guidelines

### What Makes a Good Backend Spec

| Principle                            | Example                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| **Specific endpoint definitions**    | `GET /api/v1/users?cursor=X&limit=20` not "user listing"    |
| **Explicit request/response shapes** | `{ id: uuid, name: string, email: string }` not "user data" |
| **Auth per endpoint**                | "Requires authMiddleware + adminGuard" not "protected"      |
| **Error catalog per endpoint**       | "400/401/403/404/409" not "handle errors"                   |
| **Schema with constraints**          | "email: varchar(255), UNIQUE, NOT NULL" not "email column"  |
| **No implementation code**           | WHAT contracts and schemas, not HOW to code them            |

### Spec Quality Checklist

Before delivering a spec, verify:

- [ ] All pattern references have specific file:line locations
- [ ] Every endpoint has method, path, request shape, response shape, error catalog, and auth requirement
- [ ] Database schema has column types, constraints, relationships, indexes, and migration strategy
- [ ] Success criteria are measurable (testable with curl commands or automated tests)
- [ ] Scope is bounded (what's IN and what's OUT)
- [ ] No implementation code (only architecture/behavior)
- [ ] api-developer can implement autonomously
- [ ] api-tester knows what to test
- [ ] api-reviewer knows what to focus on

### Relationship to Other Agents

| This Spec Feeds To | What They Need                                                  |
| ------------------ | --------------------------------------------------------------- |
| **api-developer**  | Endpoint contracts, schema definitions, middleware requirements |
| **api-tester**     | Endpoint behaviors, error conditions, auth scenarios            |
| **api-reviewer**   | Security requirements, pattern references, scope limits         |
| **web-pm**         | API contract shapes (for frontend integration specs)            |
