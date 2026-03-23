# D-140: Agent Gap Analysis & New Agent Proposals

## Summary

With the domain reorganization (D-139) creating `ai`, `meta`, and `infra` domains, and the existing gaps in API and CLI agent coverage, the agent roster needs to expand. This document proposes 5 new agents prioritized by impact.

---

## Current Agent Roster (18 agents)

### By Role → Domain

| Role           | CLI           | Web                             | API            | Cross-cutting                                             |
| -------------- | ------------- | ------------------------------- | -------------- | --------------------------------------------------------- |
| **Developer**  | cli-developer | web-developer, web-architecture | api-developer  | -                                                         |
| **Reviewer**   | cli-reviewer  | web-reviewer                    | api-reviewer   | -                                                         |
| **Tester**     | cli-tester    | web-tester                      | -              | -                                                         |
| **Researcher** | -             | web-researcher                  | api-researcher | -                                                         |
| **Planning**   | -             | web-pm                          | -              | -                                                         |
| **Pattern**    | -             | web-pattern-critique            | -              | pattern-scout                                             |
| **Meta**       | -             | -                               | -              | agent-summoner, skill-summoner, scribe, convention-keeper |

### Coverage Gaps

```
                CLI    Web    API    AI    Infra   Meta   Mobile
Developer       ✓      ✓      ✓     ✗      -       -      -
Reviewer        ✓      ✓      ✓     ✗      ✗       -      -
Tester          ✓      ✓      ✗     -      -       -      -
Researcher      -      ✓      ✓     -      -       -      -
Planning        -      ✓      ✗     -      -       -      -

✓ = exists    ✗ = gap (proposed)    - = not needed yet
```

---

## Proposed Agents

### Priority 1: Add Now

#### 1. `ai-developer`

- **Role:** developer
- **Domain:** ai
- **Purpose:** Implements AI features from specs — RAG pipelines, agent loops, tool calling, prompt engineering, streaming responses, embedding workflows, multi-model orchestration.
- **Why it's needed:** 20 AI skills (largest non-web/api domain). AI implementation has unique concerns that api-developer doesn't cover: prompt design, token budget management, non-deterministic output handling, structured output parsing, retry/fallback for flaky model responses, streaming chunk assembly.
- **Distinct from api-developer:** api-developer knows REST routes, database ops, middleware. ai-developer knows prompt patterns, model selection trade-offs, RAG retrieval strategies, tool schema design, cost optimization.

#### 2. `api-tester`

- **Role:** tester
- **Domain:** api
- **Purpose:** Tests backend features — API endpoint integration tests, database operation tests, auth flow tests, middleware chain tests, error response validation.
- **Why it's needed:** API is the largest domain (45 skills after D-139 reorg) with zero test agent coverage. Web and CLI both have dedicated testers. Backend testing has distinct patterns: database seeding/teardown, request/response assertions, auth token lifecycle, rate limiting verification.
- **Distinct from web-tester:** web-tester focuses on component rendering, E2E browser flows, and DOM assertions. api-tester focuses on HTTP request/response cycles, database state, and server-side error handling.

#### 3. `api-pm`

- **Role:** planning
- **Domain:** api
- **Purpose:** Creates detailed backend implementation specs — API contract design, database schema design, middleware ordering, auth flow architecture, error handling strategy.
- **Why it's needed:** The web pipeline has a clear spec phase (web-pm → web-developer). The API pipeline skips it (request goes straight to api-developer). Backend features benefit from upfront planning: schema migrations are hard to undo, API contracts affect downstream consumers, auth flows have security implications.
- **Distinct from web-pm:** web-pm thinks in components, hooks, and user interactions. api-pm thinks in endpoints, schemas, middleware chains, and data flow.

### Priority 2: Add Soon

#### 4. `ai-reviewer`

- **Role:** reviewer
- **Domain:** ai
- **Purpose:** Reviews AI integration code — prompt quality, injection risks, hallucination handling, token budget, retry/fallback patterns, cost implications, structured output validation.
- **Why it's needed:** AI code has unique failure modes that api-reviewer doesn't check: prompt injection vulnerabilities, missing output validation for non-deterministic responses, unbounded token usage, missing fallback for model outages, hardcoded model versions without migration path.
- **Distinct from api-reviewer:** api-reviewer checks REST patterns, SQL injection, auth middleware. ai-reviewer checks prompt safety, model cost, output parsing robustness, and AI-specific error handling.

#### 5. `infra-reviewer`

- **Role:** reviewer
- **Domain:** infra
- **Purpose:** Reviews infrastructure code — Dockerfile quality, CI/CD pipeline correctness, deployment configs, secret handling, environment variable management, build optimization.
- **Why it's needed:** Currently lumped into api-reviewer's broad scope ("API routes, server utils, configs, build tooling, CI/CD, security, env"). Infrastructure review is a distinct discipline: Docker layer caching, GitHub Actions security (pinned actions, OIDC), secret rotation, multi-stage build optimization, deployment rollback strategies.
- **Distinct from api-reviewer:** api-reviewer checks application code. infra-reviewer checks operational code — the code that builds, deploys, and runs the application.

---

## Not Proposed (Rationale)

| Agent              | Why Not Yet                                                                                                                       |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `cli-researcher`   | Only 2 CLI skills. cli-developer can self-research in this small domain.                                                          |
| `cli-pm`           | CLI features are typically more contained than web/API features. cli-developer handles planning inline.                           |
| `mobile-developer` | Only 2 mobile skills (Expo, React Native). Not enough domain mass to justify a dedicated agent.                                   |
| `mobile-reviewer`  | Same — insufficient domain size.                                                                                                  |
| `ai-researcher`    | ai-developer can research during implementation. Add when AI skill count exceeds 30+.                                             |
| `ai-tester`        | AI testing is still an emerging practice. Add when patterns stabilize.                                                            |
| `infra-developer`  | Infrastructure code (Dockerfiles, CI pipelines) is typically templated, not implemented from spec.                                |
| `meta-*` agents    | Meta domain contains methodology/review skills — the existing meta agents (scribe, convention-keeper) already serve this purpose. |

---

## Agent Roster After D-140 (23 agents)

| Role           | CLI           | Web                             | API            | AI               | Infra              | Cross-cutting                                             |
| -------------- | ------------- | ------------------------------- | -------------- | ---------------- | ------------------ | --------------------------------------------------------- |
| **Developer**  | cli-developer | web-developer, web-architecture | api-developer  | **ai-developer** | -                  | -                                                         |
| **Reviewer**   | cli-reviewer  | web-reviewer                    | api-reviewer   | **ai-reviewer**  | **infra-reviewer** | -                                                         |
| **Tester**     | cli-tester    | web-tester                      | **api-tester** | -                | -                  | -                                                         |
| **Researcher** | -             | web-researcher                  | api-researcher | -                | -                  | -                                                         |
| **Planning**   | -             | web-pm                          | **api-pm**     | -                | -                  | -                                                         |
| **Pattern**    | -             | web-pattern-critique            | -              | -                | -                  | pattern-scout                                             |
| **Meta**       | -             | -                               | -              | -                | -                  | agent-summoner, skill-summoner, scribe, convention-keeper |

---

## Implementation Notes

### Files to Create

Each new agent needs:

- `src/agents/{role}/{agent-id}/metadata.yaml` — agent metadata (name, display_name, description, agent_role, domain)
- `src/agents/{role}/{agent-id}/AGENT.md` — system prompt with domain-specific instructions
- Optional: `src/agents/{role}/{agent-id}/workflow.md` — workflow steps if the agent follows a structured process

### Files to Update

- `src/cli/types/generated/source-types.ts` — `AgentName` union gains new agent IDs (auto-generated)
- `src/cli/lib/configuration/default-categories.ts` — if agents map to categories, add mappings
- Agent-related test fixtures if they enumerate all agents

### Sequencing

D-140 can be implemented independently of D-139 (domain reorganization). The new agents work with current domains and will automatically pick up new domains after D-139 lands.
