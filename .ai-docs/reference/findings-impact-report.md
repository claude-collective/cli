# Agent Findings Impact Report

**Generated:** 2026-03-28
**Total Findings Analyzed:** 70
**Date Range:** 2026-03-21 to 2026-03-28

## Summary Table

| Reference Doc | Findings Count | Stale Info | Missing Info | Priority |
|---|---|---|---|---|
| test-infrastructure.md | 9 | 2 | 3 | HIGH |
| commands.md | 2 | 1 | 1 | MED |
| component-patterns.md | 1 | 0 | 1 | LOW |
| store-map.md | 1 | 0 | 0 | LOW |
| configuration.md | 5 | 1 | 2 | HIGH |
| skills-and-matrix.md | 1 | 0 | 1 | LOW |
| plugin-system.md | 1 | 0 | 0 | LOW |
| utilities.md | 0 | 0 | 0 | -- |
| type-system.md | 0 | 0 | 0 | -- |
| compilation-pipeline.md | 0 | 0 | 0 | -- |
| wizard-flow.md | 0 | 0 | 0 | -- |
| architecture-overview.md | 1 | 0 | 1 | LOW |
| operations-layer.md | 1 | 0 | 1 | LOW |
| **agent-system.md (MISSING)** | 14 | -- | 14 | **HIGH** |
| **skills-content.md (MISSING)** | 38 | -- | 38 | **HIGH** |
| Uncategorized | 3 | -- | -- | LOW |

---

## Detailed Impact per Reference Doc

### 1. test-infrastructure.md -- 9 findings (HIGH)

| Finding | Summary | Impact Type |
|---|---|---|
| `2026-03-21-claudemd-violations-in-framework.md` | E2E framework code had double casts, unnecessary union casts, backward-compat shims | Missing: E2E framework patterns not documented |
| `2026-03-21-duplicated-e2e-constants.md` | Path/timeout constants duplicated locally in 10+ E2E files instead of centralized | Missing: `SOURCE_PATHS` and new `TIMEOUTS.*` entries not in doc |
| `2026-03-21-duplicated-e2e-helpers.md` | Helper functions duplicated in 8+ E2E files instead of shared | Missing: new shared helpers not catalogued |
| `2026-03-21-missing-test-cleanup.md` | Missing `afterAll` cleanup, unused variables, `as any` casts in E2E tests | Stale: cleanup patterns section may need reinforcement |
| `2026-03-21-toequal-vs-tostrictequal.md` | `toEqual` used where `toStrictEqual` required for objects | Missing: `toStrictEqual` rule not documented in test-infra doc |
| `2026-03-23-e2e-undefined-assertion-and-raw-readfile.md` | 34 `undefined!` assertions and 6 raw `readFile` calls in E2E | Stale: anti-patterns not in documented patterns |
| `2026-03-25-inline-test-data-in-build-step-logic.md` | Inline mock skill construction instead of using `SKILLS.*` constants | Missing: mock data discipline not cross-referenced |
| `2026-03-25-unnecessary-internal-mocks.md` | 12+ test files mock pure functions unnecessarily | Missing: mocking guidelines not documented |
| `2026-03-25-unnecessary-matrix-provider-mocks.md` | `getErrorMessage` and `consts` mocked to identical values | Missing: "what to mock" decision tree not documented |

**Actions needed:**
- Add `SOURCE_PATHS` and new `TIMEOUTS.*` constants to E2E constants section
- Add shared helper catalog (new helpers from `test-utils.ts`, `dual-scope-helpers.ts`)
- Add "Mocking Guidelines" section: what to mock (I/O, env-dependent paths), what NOT to mock (pure functions, identical-value consts)
- Add `toStrictEqual` rule to assertion patterns section
- Document `readTestFile()` as canonical file reading helper
- Remove `undefined!` cleanup pattern from any examples

---

### 2. configuration.md -- 5 findings (HIGH)

| Finding | Summary | Impact Type |
|---|---|---|
| `2026-03-24-inlined-global-stack-not-merged.md` | `generateProjectConfigWithInlinedGlobal` ignored global stack entirely | Stale: config-writer merge behavior not accurately documented |
| `2026-03-24-object-fromEntries-overwrites-duplicate-keys.md` | `Object.fromEntries()` silently dropped skills sharing same category | Missing: config-generator duplicate-key pitfall not documented |
| `2026-03-24-shallow-stack-merge-loses-categories.md` | Shallow spread lost nested categories in stack merge; config-types imports wrong for self-contained config | Missing: `deepMergeStacks()` and `writeStandaloneConfigTypes()` not documented |
| `2026-03-25-dead-code-and-type-cast-cleanup.md` | Dead functions (`writeProjectConfigTypes`, `compactStackForYaml`), type inconsistency in blank global config | Stale: dead code removal not reflected in doc |
| `matrix-loading-performance.md` | Matrix loading performance characteristics and anti-patterns in source-loader.ts shallow spreads | Missing: performance characteristics and loading strategy not documented |

**Actions needed:**
- Update config-writer section to document `deepMergeStacks()` and the merge-at-category-level pattern
- Update config-types-writer section to document `writeStandaloneConfigTypes()`
- Remove references to dead functions (`writeProjectConfigTypes`, `compactStackForYaml`, `compactAssignment`)
- Add note about `Object.fromEntries()` duplicate-key risk in config-generator
- Consider adding matrix loading performance characteristics (or create separate doc)

---

### 3. commands.md -- 2 findings (MED)

| Finding | Summary | Impact Type |
|---|---|---|
| `2026-03-26-marketplace-fallback-missing-skill-copy.md` | Init marketplace fallback path was incomplete -- skills not copied locally on fallback | Stale: init command flow missing fallback documentation |
| `init-missing-global-compile.md` | `cc init` does single-pass compilation, missing global agents | Missing: init multi-scope compilation gap not documented |

**Actions needed:**
- Update init command flow to document marketplace fallback behavior (copy skills locally when marketplace unavailable)
- Document the multi-scope compilation gap: init only compiles to project dir, not global
- Reference compile.ts `buildCompilePasses()` pattern as the correct multi-scope approach

---

### 4. component-patterns.md -- 1 finding (LOW)

| Finding | Summary | Impact Type |
|---|---|---|
| `2026-03-26-missing-scroll-indicator-rendering.md` | `UI_SYMBOLS.SCROLL_UP/DOWN` defined but never rendered; scroll hooks compute hidden counts but nothing displays them | Missing: scroll indicator rendering pattern not documented |

**Actions needed:**
- Add "Scroll Indicators" subsection under Virtual Scrolling documenting the gap between defined symbols/hooks and actual rendering
- Document recommended scroll indicator implementation pattern

---

### 5. skills-and-matrix.md -- 1 finding (LOW)

| Finding | Summary | Impact Type |
|---|---|---|
| `matrix-loading-performance.md` | Matrix loading flow from build-time to per-command; BUILT_IN_MATRIX optimization for default source | Missing: performance-oriented loading flow not documented |

**Actions needed:**
- Consider adding a "Performance" subsection documenting BUILT_IN_MATRIX optimization, eager vs lazy loading boundary, and per-command loading costs

---

### 6. plugin-system.md -- 1 finding (LOW)

| Finding | Summary | Impact Type |
|---|---|---|
| `2026-03-26-marketplace-fallback-missing-skill-copy.md` | Marketplace fallback in init should copy skills locally but was missing | Stale: fallback behavior in installation flow |

**Actions needed:**
- Verify marketplace fallback documentation in plugin installation section

---

### 7. architecture-overview.md -- 1 finding (LOW)

| Finding | Summary | Impact Type |
|---|---|---|
| `init-missing-global-compile.md` | Init lacks multi-scope compilation pattern that compile command uses | Missing: data flow section may not document init vs compile scope handling difference |

**Actions needed:**
- Note the init/compile asymmetry in data flow or compilation section

---

### 8. operations-layer.md -- 1 finding (LOW)

| Finding | Summary | Impact Type |
|---|---|---|
| `init-missing-global-compile.md` | `compile-agents.ts` operations module has `scopeFilter` but init doesn't use it | Missing: operations layer doc should reference the multi-scope pattern |

**Actions needed:**
- Verify `compile-agents.ts` `scopeFilter` parameter is documented

---

### 9. store-map.md -- 1 finding (LOW)

| Finding | Summary | Impact Type |
|---|---|---|
| `2026-03-26-marketplace-fallback-missing-skill-copy.md` | `createDefaultSkillConfig()` sets `source: primarySource` causing `deriveInstallMode()` to return `"plugin"` | Missing: store behavior context for install mode derivation |

**Actions needed:**
- Verify `createDefaultSkillConfig()` source-setting behavior is documented

---

## Missing Reference Docs

### agent-system.md (NEW DOC NEEDED) -- 14 findings

These findings affect `src/agents/` files -- a directory with no dedicated reference documentation.

| Finding | Summary |
|---|---|
| `2026-03-23-skill-summoner-stale-metadata-format.md` | Skill-summoner agent templates used stale metadata.yaml format |
| `2026-03-27-ai-developer-deprecated-grep-pattern.md` | ai-developer used deprecated OpenAI v3 grep pattern |
| `2026-03-27-ai-developer-missing-config-and-stale-refs.md` | ai-developer missing from config, stale file references, missing findings instruction |
| `2026-03-27-api-pm-missing-findings-instruction.md` | api-pm and web-pm missing findings capture propagation |
| `2026-03-27-api-tester-rate-limit-loop-off-by-one.md` | api-tester had off-by-one in rate limit test example |
| `2026-03-27-api-tester-template-duplication-and-missing-findings.md` | api-tester had template-injected content duplicated in source files |
| `2026-03-27-infra-reviewer-core-principles-conflict.md` | infra-reviewer had custom `<core_principles>` conflicting with template |
| `2026-03-27-infra-reviewer-github-actions-latest-tag-inaccuracy.md` | infra-reviewer used `@latest` instead of `@main` for Actions tags |
| `2026-03-27-reviewer-agents-missing-findings-capture-instruction.md` | cli-reviewer and infra-reviewer missing findings capture instruction |
| `2026-03-27-planning-agents-arrow-inconsistency.md` | api-pm used ASCII arrows where Unicode convention applies |
| `2026-03-27-self-correction-arrow-convention-drift.md` | 5 new agents used wrong arrow conventions |
| `2026-03-27-core-md-pattern-numbering-disorder.md` | Skill examples had disordered pattern numbering |
| `2026-03-27-deprecated-model-references-in-skills.md` | AI provider skills referenced deprecated model names |
| `2026-03-27-skill-metadata-missing-version-tags.md` | Multiple skills missing version/tags in metadata.yaml |

**What this doc should cover:**
- Agent directory structure (`src/agents/{category}/{agent-name}/`)
- Agent file roles: `intro.md`, `workflow.md`, `critical-requirements.md`, `critical-reminders.md`, `output-format.md`, `examples.md`
- Template injection rules: what the `agent.liquid` template injects vs what source files provide
- Agent compilation: config.ts entry, `agentsinc compile`, scope routing
- Convention rules: arrow types, findings capture, no template duplication, no custom `<core_principles>`
- Relationship to skills repo: agents reference skills, metadata schema alignment

---

### skills-content.md (NEW DOC NEEDED) -- 38 findings

These findings affect skill content files in the `/home/vince/dev/skills/` sibling repo. While this is a separate repository, the CLI compiles and installs these skills. A reference doc would help agents working on skill content.

**Note:** This doc may belong in the skills repo rather than the CLI repo. Listing here for completeness since the findings were filed in the CLI repo's agent-findings pipeline.

| Category | Count | Key Findings |
|---|---|---|
| **Fabricated/Wrong APIs** | 12 | Appwrite `Realtime` class, Pinecone `fetchByMetadata`, Weaviate `.use()`, Clack `p.progress`, oclif `usePaste`, Resend idempotency, OpenAI `Float64Array`, Vercel Postgres wrapper claim, PostHog defaults, Eden Treaty bracket syntax, Wrangler `--secrets-file`, Promptfoo `--fail-on-error` |
| **Cross-domain coupling** | 8 | Firebase React context, Vitest Playwright coupling, mobile Expo/RN overlap, GraphQL `@/` imports, VeeValidate React reference, Hono Server Actions, data-fetching `"use client"`, MSW React imports |
| **Content duplication** | 8 | Prisma, Sanity, Payload, Drizzle, Turso SKILL.md full implementations duplicating examples; reviewing skill rationale duplication; auth-security red flags duplication; turborepo philosophy duplication |
| **Atomicity violations** | 6 | UI skills naming competitors, mobile cross-contamination, SCSS module coupling in file-upload, SCSS fences for CSS, CLAUDE.md template contamination, auth library coupling |
| **Stale/wrong metadata** | 4 | Deprecated model names, missing version/tags, NestJS SWC claim, Auth.js env var naming |

---

## Uncategorized Findings (3)

These findings don't map cleanly to any existing or proposed reference doc:

| Finding | Summary | Why Uncategorized |
|---|---|---|
| `2026-03-27-anthropic-sdk-skill-incorrect-model-specs.md` | Incorrect model specs in Anthropic SDK skill | Affects skills repo content, not CLI codebase |
| `2026-03-27-forms-skills-magic-numbers-and-console-log.md` | Magic numbers and console.log in VeeValidate/Zod skills | Affects skills repo content, not CLI codebase |
| `2026-03-27-skill-good-example-contradicts-red-flag.md` | TypeORM good example used pattern the skill's own red flags warned against | Affects skills repo content, internal coherence issue |

---

## Systemic Patterns Detected

### Pattern 1: Agent Template Contamination (7 findings)

Multiple agent findings reveal the same root cause: agent source files duplicate content that the `agent.liquid` template injects automatically.

**Affected findings:**
- `api-tester-template-duplication-and-missing-findings.md` -- `<core_principles>` and `<write_verification_protocol>` duplicated
- `infra-reviewer-core-principles-conflict.md` -- custom `<core_principles>` conflicts with template
- `skill-metadata-and-template-contamination.md` -- CLAUDE.md references in marketplace skills

**Root cause:** No documented list of what the agent template injects, so agents created by agent-summoner include sections that end up double-rendered.

**Recommendation:** Document template-injected sections in agent-system.md. Add a post-creation validation step to agent-summoner.

---

### Pattern 2: Missing Findings Capture Instruction (5 findings)

Five separate findings discovered the same gap: agents lacking the CLAUDE.md-mandated findings capture instruction.

**Affected findings:**
- `ai-developer-missing-config-and-stale-refs.md`
- `api-pm-missing-findings-instruction.md`
- `api-tester-template-duplication-and-missing-findings.md`
- `reviewer-agents-missing-findings-capture-instruction.md`
- `self-correction-arrow-convention-drift.md` (tangentially)

**Root cause:** The findings capture instruction is in CLAUDE.md but not propagated to agent templates. Each agent must be individually patched.

**Recommendation:** Add findings capture to the agent template (`agent.liquid`) so all compiled agents get it automatically.

---

### Pattern 3: AI-Fabricated APIs in Skills (12 findings)

The largest category of skill findings involves AI-generated code that references APIs, methods, classes, CLI flags, or callback signatures that do not exist. This is a hallucination pattern.

**Examples:**
- Appwrite `Realtime` class and `Channel` helper (completely fabricated)
- Pinecone `fetchByMetadata()` (does not exist)
- Weaviate `.use()` instead of `.get()` (wrong method name)
- Promptfoo `--fail-on-error` (fabricated CLI flag)
- Resend idempotency key in wrong position (wrong API shape)
- Vercel Postgres claimed to wrap `@neondatabase/serverless` (wraps `pg`)

**Root cause:** AI models generate plausible-looking APIs that don't match real SDKs. The skill-atomicity-primer already warns about this but enforcement is inconsistent.

**Recommendation:** Strengthen the quality gate checklist in skill-atomicity-bible.md with a mandatory "verify every import and method call against official docs" step.

---

### Pattern 4: SKILL.md Content Duplication (8 findings)

Skills consistently duplicate full code implementations between SKILL.md and their example files, despite the atomicity bible requiring "brief 3-10 line snippet + link."

**Affected skills:** Prisma, Sanity, Payload, Drizzle, Turso, auth-security, turborepo, reviewing

**Root cause:** AI-generated skills create full implementations in SKILL.md and again in example files. The atomicity bible rule exists but is frequently violated in initial generation.

**Recommendation:** Add a more prominent callout in skill-atomicity-bible.md and a specific skill-summoner validation check.

---

### Pattern 5: Config Writer / Generator Bugs (4 findings)

Four findings uncovered bugs in the configuration generation pipeline, all involving merge semantics:

- Global stack not merged (shallow spread lost data)
- `Object.fromEntries()` dropped duplicate categories
- Config-types used wrong import pattern for self-contained config
- Dead code from YAML-to-TS migration not cleaned up

**Root cause:** The configuration system underwent a YAML-to-TypeScript migration and a global/project scope split. Both transitions introduced merge edge cases that weren't covered by tests.

**Recommendation:** Update configuration.md to document merge semantics, especially `deepMergeStacks()` and the global-inlined vs global-imported patterns.

---

## Priority Actions

### HIGH Priority (do first)

1. **Create `agent-system.md`** -- 14 findings have no reference doc. Document agent directory structure, template injection rules, compilation, and conventions.
2. **Update `test-infrastructure.md`** -- 9 findings. Add mocking guidelines, new E2E constants/helpers, `toStrictEqual` rule.
3. **Update `configuration.md`** -- 5 findings. Document `deepMergeStacks()`, remove dead code references, add merge semantics.
4. **Decide on skills-content.md location** -- 38 findings affect skills repo. Determine if this doc belongs here or in the skills repo.

### MEDIUM Priority

5. **Update `commands.md`** -- 2 findings. Document init marketplace fallback and multi-scope compilation gap.

### LOW Priority

6. **Update `component-patterns.md`** -- 1 finding. Add scroll indicator rendering pattern.
7. **Update `skills-and-matrix.md`** -- 1 finding. Add performance characteristics.
8. **Update `architecture-overview.md`** -- 1 finding. Note init/compile scope asymmetry.
9. **Update `operations-layer.md`** -- 1 finding. Verify `scopeFilter` documented.
10. **Verify `store-map.md`** -- 1 finding. Check `createDefaultSkillConfig()` source behavior.
11. **Verify `plugin-system.md`** -- 1 finding. Check marketplace fallback documentation.
