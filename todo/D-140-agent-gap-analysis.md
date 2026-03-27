# D-140: Agent Gap Analysis & New Agent Proposals

## Summary

With the domain reorganization (D-139) creating `ai`, `meta`, and `infra` domains, and the existing gaps in API and CLI agent coverage, the agent roster needs to expand. This document proposes 5 new agents prioritized by impact.

---

## Current Agent Roster (18 agents)

### By Role → Domain

| Role           | CLI           | Web                             | API            | Cross-cutting                                                   |
| -------------- | ------------- | ------------------------------- | -------------- | --------------------------------------------------------------- |
| **Developer**  | cli-developer | web-developer, web-architecture | api-developer  | -                                                               |
| **Reviewer**   | cli-reviewer  | web-reviewer                    | api-reviewer   | -                                                               |
| **Tester**     | cli-tester    | web-tester                      | -              | -                                                               |
| **Researcher** | -             | web-researcher                  | api-researcher | -                                                               |
| **Planning**   | -             | web-pm                          | -              | -                                                               |
| **Pattern**    | -             | web-pattern-critique            | -              | pattern-scout                                                   |
| **Meta**       | -             | -                               | -              | agent-summoner, skill-summoner, codex-keeper, convention-keeper |

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

| Agent              | Why Not Yet                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `cli-researcher`   | Only 2 CLI skills. cli-developer can self-research in this small domain.                                                                |
| `cli-pm`           | CLI features are typically more contained than web/API features. cli-developer handles planning inline.                                 |
| `mobile-developer` | Only 2 mobile skills (Expo, React Native). Not enough domain mass to justify a dedicated agent.                                         |
| `mobile-reviewer`  | Same — insufficient domain size.                                                                                                        |
| `ai-researcher`    | ai-developer can research during implementation. Add when AI skill count exceeds 30+.                                                   |
| `ai-tester`        | AI testing is still an emerging practice. Add when patterns stabilize.                                                                  |
| `infra-developer`  | Infrastructure code (Dockerfiles, CI pipelines) is typically templated, not implemented from spec.                                      |
| `meta-*` agents    | Meta domain contains methodology/review skills — the existing meta agents (codex-keeper, convention-keeper) already serve this purpose. |

---

## Agent Roster After D-140 (23 agents)

| Role           | CLI           | Web                             | API            | AI               | Infra              | Cross-cutting                                                   |
| -------------- | ------------- | ------------------------------- | -------------- | ---------------- | ------------------ | --------------------------------------------------------------- |
| **Developer**  | cli-developer | web-developer, web-architecture | api-developer  | **ai-developer** | -                  | -                                                               |
| **Reviewer**   | cli-reviewer  | web-reviewer                    | api-reviewer   | **ai-reviewer**  | **infra-reviewer** | -                                                               |
| **Tester**     | cli-tester    | web-tester                      | **api-tester** | -                | -                  | -                                                               |
| **Researcher** | -             | web-researcher                  | api-researcher | -                | -                  | -                                                               |
| **Planning**   | -             | web-pm                          | **api-pm**     | -                | -                  | -                                                               |
| **Pattern**    | -             | web-pattern-critique            | -              | -                | -                  | pattern-scout                                                   |
| **Meta**       | -             | -                               | -              | -                | -                  | agent-summoner, skill-summoner, codex-keeper, convention-keeper |

---

## Implementation Progress

### Agent Creation (2026-03-27) — COMPLETE

All 5 agents created with full 7-file structure (metadata.yaml, intro.md, workflow.md, critical-requirements.md, critical-reminders.md, output-format.md, examples.md):

| Agent            | Directory                             | Model  | Status  |
| ---------------- | ------------------------------------- | ------ | ------- |
| `ai-developer`   | `src/agents/developer/ai-developer/`  | opus   | Created |
| `api-tester`     | `src/agents/tester/api-tester/`       | sonnet | Created |
| `api-pm`         | `src/agents/planning/api-pm/`         | opus   | Created |
| `ai-reviewer`    | `src/agents/reviewer/ai-reviewer/`    | opus   | Created |
| `infra-reviewer` | `src/agents/reviewer/infra-reviewer/` | sonnet | Created |

### Improvement Passes

| Pass | Focus                      | Status   |
| ---- | -------------------------- | -------- |
| 1    | Structural alignment       | Complete |
| 2    | Domain knowledge precision | Complete |
| 3    | Verbosity reduction        | Complete |
| 4    | Cross-agent consistency    | Complete |
| 5    | Final surgical polish      | Complete |

**Pass 1 fixes applied:**

- Added missing `<investigation_requirement>` blocks (api-tester, infra-reviewer)
- Schema URL alignment to full URLs (ai-reviewer, infra-reviewer, api-pm)
- Positive framing conversion in critical-reminders (ai-developer)
- Added `<domain_scope>` sections (ai-reviewer, infra-reviewer)
- Added `<core_principles>` self-reminder loop (api-tester)
- Arrow/emoji consistency with reference agents (ai-developer)
- Added Write/Edit tools to api-pm metadata (PM saves specs)
- Added approval decision framework (infra-reviewer)

**Pass 2 fixes applied (domain knowledge precision):**

- Fixed deprecated OpenAI SDK grep pattern in ai-developer (createChatCompletion -> modern patterns)
- Fixed rate limit test off-by-one error in api-tester workflow example
- Fixed `@latest` -> `@main` for GitHub Actions tag example in infra-reviewer
- Removed template-injected duplicates from api-tester (core_principles, write_verification)
- Added findings capture instruction to ai-developer, api-tester, ai-reviewer, infra-reviewer
- Added git safety self-correction trigger to api-tester
- Removed custom core_principles from infra-reviewer intro.md (conflicts with template)
- Added findings capture handoff instruction to api-pm workflow
- Fixed arrow convention in api-pm (ASCII `->` to Unicode `→` in self-correction triggers)
- Removed stale template paths (.claude/conventions.md, .claude/patterns.md) from ai-developer

**Pass 3 fixes applied (verbosity reduction):**

- Removed redundant "Skipping investigation leads to..." warning from ai-developer workflow (already enforced by self-correction triggers and critical-requirements)

**Pass 4 fixes applied (cross-agent consistency):**

- Standardized arrow convention across all 5 agents: `→` in self-correction triggers, `->` in defer-to lists
- Fixed ai-developer intro.md and workflow.md: `→` to `->` in defer-to lists
- Fixed api-tester workflow.md: `->` to `→` in all 11 self-correction triggers
- Fixed ai-reviewer workflow.md: `->` to `→` in all 9 self-correction triggers
- Fixed infra-reviewer workflow.md: `->` to `→` in all 10 self-correction triggers
- Expanded infra-reviewer domain_scope from prose to bullet list format (matching all other agents)
- Removed template artifact "DISPLAY ALL 5 CORE PRINCIPLES..." from infra-reviewer critical-reminders.md

**Pass 5 fixes applied (final surgical polish):**

- Fixed api-tester metadata.yaml schema URL from relative to full URL (matching all other agents)
- Verified no stale template references remain across all 5 agents
- Verified all metadata.yaml files have correct model, tools, and description
- Verified all critical-requirements and critical-reminders match (emphatic repetition)
- Verified all domain_scope tags are properly opened and closed

### Remaining Work

- [ ] Compile agents with `agentsinc compile` and verify output
- [ ] Register agents in config (`.claude-src/config.yaml` when it exists)
- [ ] Update `AgentName` union in generated types

---

## Implementation Notes

### Files Created Per Agent

Each agent has 7 source files:

- `metadata.yaml` — id, title, description, model, tools
- `intro.md` — role definition, focus areas, defer-to-specialists
- `workflow.md` — investigation-first, development/review workflow, self-correction triggers
- `critical-requirements.md` — emphatic MUST rules (top of compiled prompt)
- `critical-reminders.md` — emphatic repetition of rules (bottom of compiled prompt)
- `output-format.md` — structured output template
- `examples.md` — concrete example of good agent output

### Files to Update

- `src/cli/types/generated/source-types.ts` — `AgentName` union gains new agent IDs (auto-generated)
- `src/cli/lib/configuration/default-categories.ts` — if agents map to categories, add mappings
- Agent-related test fixtures if they enumerate all agents

### Sequencing

D-140 can be implemented independently of D-139 (domain reorganization). The new agents work with current domains and will automatically pick up new domains after D-139 lands.
