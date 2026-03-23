# D-139: Skill Domain & Category Reorganization

## Summary

Reorganize skills from the overloaded `shared` domain and overgrown `api-ai` category into purpose-built domains. Creates 3 new domains (`ai`, `meta`, `infra`) and recategorizes 3 BaaS skills to `api-database`. Total: **30 skills move**.

---

## New Domains

| Domain  | Purpose                                                                  | Skills After |
| ------- | ------------------------------------------------------------------------ | ------------ |
| `ai`    | AI/LLM providers, orchestration, observability, infrastructure, patterns | 20           |
| `meta`  | Engineering methodology — code review, research, process                 | 3            |
| `infra` | Deployment, CI/CD, platforms, environment config                         | 4            |

## Domains After Reorganization

| Domain   | Before | After | What Remains                                                                                                                     |
| -------- | ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| `api`    | 68     | 45    | frameworks, auth, database (+3), BaaS (5), CMS, commerce, email, observability, analytics, search, vector-db, performance, flags |
| `ai`     | 0      | 20    | provider, orchestration, observability, infrastructure, patterns                                                                 |
| `web`    | 67     | 67    | unchanged                                                                                                                        |
| `shared` | 15     | 8     | tooling (4), monorepo (3), security (1)                                                                                          |
| `infra`  | 0      | 4     | ci-cd, platform, config                                                                                                          |
| `meta`   | 0      | 3     | reviewing, methodology                                                                                                           |
| `cli`    | 2      | 2     | unchanged                                                                                                                        |
| `mobile` | 2      | 2     | unchanged                                                                                                                        |

---

## Complete Move List

### 1. `api` → `ai` (new domain) — 20 skills

#### ai-provider (8 skills)

First-party model API SDKs.

| Current Skill ID           | New Skill ID                    | Slug (unchanged)    |
| -------------------------- | ------------------------------- | ------------------- |
| `api-ai-anthropic-sdk`     | `ai-provider-anthropic-sdk`     | `anthropic-sdk`     |
| `api-ai-claude-vision`     | `ai-provider-claude-vision`     | `claude-vision`     |
| `api-ai-openai-sdk`        | `ai-provider-openai-sdk`        | `openai-sdk`        |
| `api-ai-openai-whisper`    | `ai-provider-openai-whisper`    | `openai-whisper`    |
| `api-ai-google-gemini-sdk` | `ai-provider-google-gemini-sdk` | `google-gemini-sdk` |
| `api-ai-mistral-sdk`       | `ai-provider-mistral-sdk`       | `mistral-sdk`       |
| `api-ai-cohere-sdk`        | `ai-provider-cohere-sdk`        | `cohere-sdk`        |
| `api-ai-elevenlabs`        | `ai-provider-elevenlabs`        | `elevenlabs`        |

> **Note:** `claude-vision` and `openai-whisper` are merge candidates into their parent SDKs (they are SDK features, not standalone tools). Merging is a separate task.

#### ai-orchestration (3 skills)

Frameworks for building multi-step AI workflows, chains, and agent loops.

| Current Skill ID       | New Skill ID                     | Slug (unchanged) |
| ---------------------- | -------------------------------- | ---------------- |
| `api-ai-langchain`     | `ai-orchestration-langchain`     | `langchain`      |
| `api-ai-llamaindex`    | `ai-orchestration-llamaindex`    | `llamaindex`     |
| `api-ai-vercel-ai-sdk` | `ai-orchestration-vercel-ai-sdk` | `vercel-ai-sdk`  |

#### ai-observability (2 skills)

Monitoring, evaluation, tracing of LLM systems.

| Current Skill ID   | New Skill ID                 | Slug (unchanged) |
| ------------------ | ---------------------------- | ---------------- |
| `api-ai-langfuse`  | `ai-observability-langfuse`  | `langfuse`       |
| `api-ai-promptfoo` | `ai-observability-promptfoo` | `promptfoo`      |

#### ai-infrastructure (6 skills)

Model hosting, serving, routing, and inference gateways.

| Current Skill ID               | New Skill ID                              | Slug (unchanged)        |
| ------------------------------ | ----------------------------------------- | ----------------------- |
| `api-ai-together-ai`           | `ai-infrastructure-together-ai`           | `together-ai`           |
| `api-ai-huggingface-inference` | `ai-infrastructure-huggingface-inference` | `huggingface-inference` |
| `api-ai-replicate`             | `ai-infrastructure-replicate`             | `replicate`             |
| `api-ai-litellm`               | `ai-infrastructure-litellm`               | `litellm`               |
| `api-ai-modal`                 | `ai-infrastructure-modal`                 | `modal`                 |
| `api-ai-ollama`                | `ai-infrastructure-ollama`                | `ollama`                |

#### ai-patterns (1 skill)

Cross-cutting, provider-agnostic AI usage patterns.

| Current Skill ID           | New Skill ID                    | Slug (unchanged)    |
| -------------------------- | ------------------------------- | ------------------- |
| `api-ai-tool-use-patterns` | `ai-patterns-tool-use-patterns` | `tool-use-patterns` |

### 2. `shared` → `meta` (new domain) — 3 skills

| Current Skill ID                   | New Skill ID                            | Slug (unchanged)       | New Category       |
| ---------------------------------- | --------------------------------------- | ---------------------- | ------------------ |
| `shared-meta-reviewing`            | `meta-reviewing-reviewing`              | `reviewing`            | `meta-reviewing`   |
| `shared-meta-cli-reviewing`        | `meta-reviewing-cli-reviewing`          | `cli-reviewing`        | `meta-reviewing`   |
| `shared-meta-research-methodology` | `meta-methodology-research-methodology` | `research-methodology` | `meta-methodology` |

### 3. `shared` → `infra` (new domain) — 4 skills

| Current Skill ID                  | New Skill ID                        | Slug (unchanged)     | New Category     |
| --------------------------------- | ----------------------------------- | -------------------- | ---------------- |
| `shared-ci-cd-docker`             | `infra-ci-cd-docker`                | `docker`             | `infra-ci-cd`    |
| `shared-ci-cd-github-actions`     | `infra-ci-cd-github-actions`        | `github-actions`     | `infra-ci-cd`    |
| `shared-ci-cd-cloudflare-workers` | `infra-platform-cloudflare-workers` | `cloudflare-workers` | `infra-platform` |
| `shared-infra-setup-env`          | `infra-config-setup-env`            | `setup-env`          | `infra-config`   |

### 4. `api-baas` → `api-database` (within api) — 3 skills

| Current Skill ID           | New Skill ID                   | Slug (unchanged)  |
| -------------------------- | ------------------------------ | ----------------- |
| `api-baas-upstash`         | `api-database-upstash`         | `upstash`         |
| `api-baas-vercel-kv`       | `api-database-vercel-kv`       | `vercel-kv`       |
| `api-baas-vercel-postgres` | `api-database-vercel-postgres` | `vercel-postgres` |

### 5. NOT moving (corrections from research)

| Skill                           | Originally Proposed | Stays Because                                                  |
| ------------------------------- | ------------------- | -------------------------------------------------------------- |
| `shared-security-auth-security` | infra-security      | Application security (XSS, CSRF, CSP), not infra security      |
| `api-flags-posthog-flags`       | infra-flags         | Application-level feature management, not infrastructure       |
| `api-baas-neon`                 | api-database        | Has platform features (branching, scale-to-zero, compute mgmt) |
| `api-baas-planetscale`          | api-database        | Has platform features (deploy requests, schema branching)      |
| `api-baas-turso`                | api-database        | Has platform features (edge groups, embedded replicas)         |

---

## Implementation: Files That Must Change

### Skills Repository (`/home/vince/dev/skills`)

**Per skill — 3 changes each, 30 skills, 90 edits total:**

For each moved skill under `src/skills/`:

1. **Rename directory** to match the new skill ID (e.g. `api-ai-anthropic-sdk/` → `ai-provider-anthropic-sdk/`)
2. **Update SKILL.md `name` frontmatter** — the `name` field IS the skill ID (e.g. `name: api-ai-anthropic-sdk` → `name: ai-provider-anthropic-sdk`)
3. **Update metadata.yaml** — change `category` and `domain` fields (e.g. `category: api-ai`, `domain: api` → `category: ai-provider`, `domain: ai`). The `slug` field does NOT change.

### CLI Repository (`/home/vince/dev/cli`)

#### Auto-Generated (regenerate after skills changes)

| File                                      | What Changes                                                                                                                                                  | How                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `src/cli/types/generated/source-types.ts` | `Domain` union gains `"ai"`, `"meta"`, `"infra"`. `Category` union gains new categories. All moved `SkillId` values change. `SkillSlug` values are unchanged. | Run `bun run generate:types` |
| `src/cli/types/generated/matrix.ts`       | `BUILT_IN_MATRIX` regenerated with new category/skill assignments                                                                                             | Run `bun run generate:types` |

#### Configuration (manual updates)

| File                                              | What Changes                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/cli/lib/configuration/default-categories.ts` | Add `CategoryDefinition` entries for all new categories (`ai-provider`, `ai-orchestration`, `ai-observability`, `ai-infrastructure`, `ai-patterns`, `meta-reviewing`, `meta-methodology`, `infra-ci-cd`, `infra-platform`, `infra-config`). Remove old `shared-ci-cd`, `shared-meta`, `shared-infra` entries. |
| `src/cli/lib/configuration/default-rules.ts`      | Update any slug references for renamed skills                                                                                                                                                                                                                                                                 |
| `src/cli/lib/configuration/default-stacks.ts`     | Update category references in pre-built stacks (e.g. `"shared-ci-cd"` → `"infra-ci-cd"`)                                                                                                                                                                                                                      |
| `src/schemas/metadata.schema.json`                | Update category and slug enum lists                                                                                                                                                                                                                                                                           |

#### Wizard & UI (manual updates)

| File                                         | What Changes                                                                                         |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `src/cli/components/wizard/utils.ts`         | Update `getDomainDisplayName()` for `"ai"`, `"meta"`, `"infra"`. Update `orderDomains()` sort order. |
| `src/cli/components/wizard/step-build.tsx`   | Verify domain tab rendering works with new domains                                                   |
| `src/cli/components/wizard/step-confirm.tsx` | Verify domain grouping in confirmation view                                                          |
| `src/cli/components/wizard/step-stack.tsx`   | Verify stack display with new categories                                                             |
| `src/cli/stores/wizard-store.ts`             | Verify domain selection state handles new domains                                                    |

#### Matrix & Resolution (likely no manual changes)

| File                                        | Impact                                                       |
| ------------------------------------------- | ------------------------------------------------------------ |
| `src/cli/lib/matrix/matrix-loader.ts`       | Should work — loads from generated data                      |
| `src/cli/lib/matrix/matrix-resolver.ts`     | Should work — domain-agnostic resolution                     |
| `src/cli/lib/matrix/matrix-provider.ts`     | Should work — `getCategoryDomain()` reads from matrix        |
| `src/cli/lib/matrix/matrix-health-check.ts` | Should work — `checkCategoryDomains()` validates dynamically |

#### Agent docs (update examples)

| File                                         | What Changes                                                                       |
| -------------------------------------------- | ---------------------------------------------------------------------------------- |
| `src/agents/meta/agent-summoner/workflow.md` | Update example paths (e.g. `shared-meta-reviewing/` → `meta-reviewing-reviewing/`) |

---

## Test Impact

### Unit Tests — Update Test Data

These files reference affected skill IDs, categories, or domains in test fixtures:

| File                                                             | What to Update                                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `src/cli/lib/__tests__/test-fixtures.ts`                         | Update `SKILLS` registry entries, `TEST_CATEGORIES` with new domains/categories |
| `src/cli/lib/__tests__/mock-data/mock-skills.ts`                 | Update mock skill definitions                                                   |
| `src/cli/lib/__tests__/mock-data/mock-categories.ts`             | Add new category mocks, remove old ones                                         |
| `src/cli/lib/__tests__/mock-data/mock-matrices.ts`               | Update pre-built matrices                                                       |
| `src/cli/lib/__tests__/mock-data/mock-stacks.ts`                 | Update stack definitions                                                        |
| `src/cli/lib/__tests__/helpers.ts`                               | Update factory defaults if they reference affected IDs                          |
| `src/cli/lib/__tests__/fixtures/create-test-source.ts`           | Update test source creation                                                     |
| `src/cli/lib/configuration/__tests__/default-categories.test.ts` | Verify category count assertions                                                |
| `src/cli/lib/configuration/__tests__/default-stacks.test.ts`     | Update stack reference assertions                                               |
| `src/cli/lib/configuration/config-generator.test.ts`             | Update config generation assertions                                             |
| `src/cli/lib/configuration/project-config.test.ts`               | Update config assertions                                                        |
| `src/cli/components/wizard/utils.test.ts`                        | Update domain display name tests                                                |
| `src/cli/components/wizard/step-build.test.tsx`                  | Update domain assertions                                                        |
| `src/cli/components/wizard/step-confirm.test.tsx`                | Update grouping assertions                                                      |
| `src/cli/stores/wizard-store.test.ts`                            | Update domain/category references                                               |
| `src/cli/lib/matrix/matrix-provider.test.ts`                     | Update skill lookup tests                                                       |
| `src/cli/lib/matrix/matrix-resolver.test.ts`                     | Update resolution tests                                                         |
| `src/cli/lib/matrix/matrix-health-check.test.ts`                 | Update health check assertions                                                  |

### E2E Tests — Surgical Updates Required

E2E tests are slow (retries on failure). Changes must be precise.

| File                                               | What It Tests                 | What to Update                                                                                                                                 |
| -------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `e2e/helpers/create-e2e-source.ts`                 | Creates in-memory test skills | Update `E2E_SKILLS` array — change domain/category for any `"shared-meta"` skills to `"meta-reviewing"`. Update `SHARED_META_SKILLS` constant. |
| `e2e/commands/info.e2e.test.ts`                    | `cc info` command output      | Update "suggest shared-meta skills" assertion to new category name                                                                             |
| `e2e/commands/relationships.e2e.test.ts`           | Slug-based relationship rules | Update if any affected slugs are in test assertions                                                                                            |
| `e2e/commands/plugin-build.e2e.test.ts`            | Build pipeline                | Verify — may not reference affected skills directly                                                                                            |
| `e2e/smoke/pom-framework.e2e.test.ts`              | Init/edit wizard flow         | Verify — may not reference affected skills directly                                                                                            |
| `e2e/lifecycle/plugin-scope-lifecycle.e2e.test.ts` | Plugin scope lifecycle        | Verify — may not reference affected skills directly                                                                                            |

**E2E strategy:** Most E2E tests use their own test sources via `create-e2e-source.ts`. Fix that file first, then verify which E2E tests actually assert on affected skill/domain/category names. Only touch tests that assert on renamed values.

---

## Execution Plan

### Dependency Chain

```
Skills repo (rename dirs, update metadata)
  → User: commit, push, run marketplace update
    → CLI repo: regenerate types from updated source
      → CLI repo: update config, wizard, tests
```

The skills repo must be pushed and the marketplace rebuilt BEFORE any CLI-side E2E test that fetches real skills can pass. Unit tests and mock-based E2E tests are independent — they use inline fixtures.

### Phase 1: Skills Repo (user-driven)

1. Rename 30 skill directories to new IDs
2. Update `metadata.yaml` in each: set new `category` field, verify `domain`
3. Commit and push
4. Run marketplace update command to rebuild marketplace artifacts

> **Gate:** Skills repo changes are live. CLI repo work can begin.

### Phase 2: CLI Repo — Type Foundation

1. Run `bun run generate:types` to regenerate `source-types.ts` and `matrix.ts` from the updated skills source
2. Run `tsc --noEmit` — expect failures in files that reference old domain/category values

> **Gate:** Generated types compile. Failures are only in consumer code referencing old values.

### Phase 3: CLI Repo — Configuration + Wizard

Minimal changes to make the CLI compile:

1. `default-categories.ts` — add new category definitions, remove old ones
2. `default-stacks.ts` — update category references (`"shared-ci-cd"` → `"infra-ci-cd"`, etc.)
3. `default-rules.ts` — update any slug references for renamed skills (slugs don't change, so this may be a no-op)
4. `metadata.schema.json` — update category and slug enum lists
5. `wizard/utils.ts` — add display names for `"ai"`, `"meta"`, `"infra"` domains, update sort order
6. Run `tsc --noEmit` — should compile clean

> **Gate:** `tsc --noEmit` passes with zero errors.

### Phase 4: CLI Repo — Unit Tests

1. Update test fixtures and mock data (test-fixtures.ts, mock-skills.ts, mock-categories.ts, mock-matrices.ts, mock-stacks.ts, helpers.ts, create-test-source.ts)
2. Update unit test assertions in config, wizard, matrix, and store test files
3. Run `npm test` (unit tests only, no E2E)

> **Gate:** All unit tests pass.

### Phase 5: CLI Repo — E2E Tests

These tests create their own skill sources via `create-e2e-source.ts` and do NOT fetch from the real marketplace. They can be fixed independently of Phase 1.

1. Update `e2e/helpers/create-e2e-source.ts` — change `E2E_SKILLS` domain/category values, update `SHARED_META_SKILLS` constant
2. Update `e2e/commands/info.e2e.test.ts` — fix "suggest shared-meta skills" assertion
3. Verify remaining E2E tests — only touch those that assert on renamed domain/category/skill values
4. Run the mock-based E2E tests

> **Gate:** All E2E tests that use `create-e2e-source.ts` pass.

### Phase 6: Smoke Tests (after skills repo is live)

These tests fetch from the real marketplace and WILL FAIL until Phase 1 is complete.

1. Verify `e2e/smoke/pom-framework.e2e.test.ts` passes
2. Verify `e2e/commands/plugin-build.e2e.test.ts` passes
3. Verify any other tests that use `--source` pointing to the real skills repo

> **Gate:** Full E2E suite passes. Done.

### What NOT to change

- Matrix resolution logic (`matrix-loader.ts`, `matrix-resolver.ts`, `matrix-provider.ts`, `matrix-health-check.ts`) — these are domain-agnostic and read from generated data. No manual changes expected.
- Wizard components (`step-build.tsx`, `step-confirm.tsx`, `step-stack.tsx`, `wizard-store.ts`) — these render from matrix data. Verify they work but don't change unless something breaks.
- Changelogs and historical docs — don't rewrite history.
- Agent workflow docs — update example paths but these are non-blocking.
