# Agents Inc. CLI - Completed Tasks

> Tasks moved here from [TODO.md](./TODO.md), [TODO-deferred.md](./TODO-deferred.md), and [TODO-refactor.md](./TODO-refactor.md) after completion.

---

## From TODO.md

| ID    | Task                                                                                                                                            |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| D-107 | Audit base framework skills for meta-framework conflicts — added skip directives to React (useActionState) and Vue (watch+fetch) SKILL.md       |
| D-114 | Create `infra` domain — cancelled, sticking with `shared-` prefix for infra/monorepo/ci-cd/security skills                                      |
| D-104 | Audit all skills against the Skill Atomicity Bible — all skills audited and compliant                                                           |
| D-91  | `uninstall --all` filters to CLI-installed plugins only — uses `${id}@${source}` heuristic against config skills (106f79a)                      |
| D-103 | Remove `tags` from skill metadata — removed from schemas, types, loaders, resolvers, search, info command, all tests (0.75.1)                   |
| D-108 | Add `$schema` reference to generated metadata.yaml in `cc new skill` — uses custom-metadata.schema.json (0.75.1)                                |
| D-101 | Fix "Next.js Fullstack" stack description — updated to "Next.js + Hono full-stack" (0.75.1)                                                     |
| D-38  | Split framework categories — created `web-meta-framework` category, restructured conflict/requires/alternatives rules (released in 0.75.0)      |
| D-39  | Couple meta-frameworks with base frameworks — required-by label, block-deselect, auto-select (released in 0.75.0)                               |
| D-102 | Merge Next.js App Router + Server Actions into single unified skill with progressive disclosure (released in 0.75.0)                            |
| D-94  | Stack change or "start from scratch" doesn't reset previously selected skills                                                                   |
| D-95  | Create a reusable view title component for wizard steps                                                                                         |
| D-96  | Remove redundant left/right arrow navigation description below views                                                                            |
| D-98  | Break up large E2E test files + restructure E2E folder organization                                                                             |
| D-99  | Update README + .ai-docs to reflect current architecture                                                                                        |
| D-101 | Add `compatibleWith` groups to default-rules.ts — React, Vue, Angular, multi-framework scoping for 25+ framework-specific skills                |
| D-105 | Split `infra-tooling-setup-tooling` into 4 atomic skills + new `web-tooling` category — eslint-prettier, typescript-config, git-hooks, vite     |
| D-106 | Inline methodology skills into Liquid agent template — 6 partials in `_templates/methodologies/`, removed `SHARED_METHODOLOGY` from stacks      |
| D-113 | Stack selection → compact flat list — chevron pointer, inline label + dimmed description, React/Other Frameworks groups, `useRowScroll`         |
| D-115 | Overhaul default stacks — 13 stacks total (4 new), framework-first naming, "Full-Stack" suffix, comma-separated descriptions, React-first order |
| D-133 | E2E tests for 13 untested bug fixes — compile-scope-filtering.e2e.test.ts (7 tests: dual-pass, global plugin discovery, clobber prevention) + config-scope-integrity.e2e.test.ts (5 tests: source priority, agent scope merge, old agent deletion, stack filtering, domain placement, domain types) |

---

## From TODO-deferred.md

| ID   | Task                                                                                 |
| ---- | ------------------------------------------------------------------------------------ |
| D-72 | Only show Agents Inc logo on the first init screen (not on edit or subsequent steps) |

---

## From TODO-refactor.md

| ID   | Task                                                                                                                                                                                                    |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R-04 | Eliminate redundant central config — remove `aliases` and `perSkill` from `default-rules.ts`, add `slug` to metadata, add `compatibleWith` groups, `setupPairs`, redesign `recommends` as flat picks    |
| R-08 | Unify resolve\* functions in matrix-loader — single function for resolving relationships (conflicts, compatibility, setup, requirements) instead of 5 separate functions with duplicate iteration logic |
