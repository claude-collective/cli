# Agent Summoner Research Findings

This document consolidates research findings from 12 sub-agents analyzing the agent-summoner and related documentation for alignment with current standards.

---

## Research Areas

### 1. Agent-Summoner Source Files Analysis

**Status:** Complete
**Agent:** Research agent analyzing `src/agents/meta/agent-summoner/` files

#### Files Analyzed

All 7 files present: agent.yaml, intro.md, workflow.md, examples.md, output-format.md, critical-requirements.md, critical-reminders.md

#### Key Findings

**Positive:**

- ✅ All file names use kebab-case (CLAUDE.md compliant)
- ✅ Modular structure correctly implemented (separation of concerns)
- ✅ critical-requirements.md and critical-reminders.md contain identical rules (proper emphatic repetition)
- ✅ Semantic XML tags appear only in workflow.md (correct architecture)
- ✅ No XML wrapper tags in source files (template adds them)
- ✅ Directory at `src/agents/meta/agent-summoner/` follows category pattern

**Issues Found:**

| Priority | Issue                           | Details                                                                                           |
| -------- | ------------------------------- | ------------------------------------------------------------------------------------------------- |
| HIGH     | Incomplete agent.yaml           | Missing `core_prompts`, `ending_prompts`, `skills`, `output_format` fields                        |
| HIGH     | Outdated file references        | References to `CLAUDE_ARCHITECTURE_BIBLE.md` and `PROMPT_BIBLE.md` need verification              |
| MEDIUM   | Inconsistent directory guidance | examples.md shows `src/agents/example-developer/` but workflow.md uses `src/agents/{agent-name}/` |
| MEDIUM   | Incomplete output format docs   | Cascading resolution mentioned but not explained                                                  |
| LOW      | Template assembly docs          | May be outdated vs actual `agent.liquid`                                                          |

**Compliance Assessment:** 85% complete - core documentation solid but configuration needs updates

---

### 2. Agent-Summoner Compiled Bible Analysis

**Status:** Complete
**Agent:** Research agent analyzing `.claude/agents/agent-summoner.md`

#### Bible Stats

- Location: `/home/vince/dev/cli/.claude/agents/agent-summoner.md`
- Size: 2170 lines, 66,326 bytes
- All 18 agents compiled and present

#### CRITICAL DISCREPANCIES FOUND

| Issue                      | Severity | Details                                                                                   |
| -------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| Non-existent `src/stacks/` | CRITICAL | Bible references `src/stacks/{stack}/config.yaml` 9+ times - directory doesn't exist      |
| Wrong skills architecture  | CRITICAL | Bible: `src/skills/[cat]/[name].md` (files) → Actual: `.claude/skills/` (directories)     |
| Missing reference docs     | CRITICAL | `CLAUDE_ARCHITECTURE_BIBLE.md`, `PROMPT_BIBLE.md`, `SKILLS_ARCHITECTURE.md` don't exist   |
| Wrong directory structure  | HIGH     | Bible claims `src/_principles/`, `src/_templates/` → Only `src/agents/_templates/` exists |

#### Non-Existent References in Bible

- `CLAUDE_ARCHITECTURE_BIBLE.md` - referenced 5 times
- `PROMPT_BIBLE.md` - referenced 16 times
- `SKILLS_ARCHITECTURE.md` - referenced 1 time
- `src/docs/` directory - doesn't exist

#### What IS Correct

- ✅ All 18 documented agents exist
- ✅ Modular structure `src/agents/{category}/{name}/`
- ✅ Kebab-case naming conventions
- ✅ Essential Techniques implemented (self-reminder loop, XML tags, emphatic repetition)
- ✅ Source file structure (intro.md, workflow.md, etc.)

#### Root Issue

**The bible describes an idealized architecture that differs from actual implementation.** The actual implementation is sound, but documentation needs updating to match reality.

---

### 3. File Naming Convention Audit

**Status:** Complete
**Agent:** Checking all agent files against kebab-case requirements

#### Critical Violation Found

**SKILL.md files use ALL-CAPS instead of kebab-case**

- Location: `.claude/skills/*/SKILL.md`
- Affected: 30+ skill files
- Severity: HIGH - Violates CLAUDE.md kebab-case standard

Examples:

- `api-framework-hono/SKILL.md` → should be `skill.md`
- `web-framework-react/SKILL.md` → should be `skill.md`
- `meta-reviewing-cli-reviewing/SKILL.md` → should be `skill.md`

#### Compliant Elements

| Area                     | Status | Examples                                              |
| ------------------------ | ------ | ----------------------------------------------------- |
| Source agent directories | ✅     | `agent-summoner/`, `web-developer/`                   |
| Source agent files       | ✅     | `intro.md`, `workflow.md`, `critical-requirements.md` |
| Compiled agent files     | ✅     | `agent-summoner.md`, `web-developer.md`               |
| Skill directory names    | ✅     | `api-framework-hono/`, `web-state-zustand/`           |

#### Documentation Gap

Agent-summoner `workflow.md` (line 1029) references kebab-case but does NOT explicitly teach that skill source files should be `skill.md` (lowercase).

#### Remediation Required

1. Rename all `SKILL.md` → `skill.md` (30+ files)
2. Update agent-summoner docs to explicitly state skill file naming
3. Check build/compilation process for hardcoded SKILL.md naming

---

### 4. Folder Structure Validation

**Status:** Complete
**Agent:** Validating directory structure matches documented architecture

#### Source Structure (`src/agents/`)

| Category    | Agents | Purpose                                                       |
| ----------- | ------ | ------------------------------------------------------------- |
| developer   | 4      | api-developer, cli-developer, web-architecture, web-developer |
| meta        | 3      | agent-summoner, documentor, skill-summoner                    |
| reviewer    | 3      | api-reviewer, cli-reviewer, web-reviewer                      |
| tester      | 2      | cli-tester, web-tester                                        |
| researcher  | 2      | api-researcher, web-researcher                                |
| pattern     | 2      | pattern-scout, web-pattern-critique                           |
| planning    | 1      | web-pm                                                        |
| migration   | 1      | cli-migrator                                                  |
| \_templates | -      | agent.liquid template                                         |

**Total:** 18 agents across 8 categories

#### Compiled Structure (`.claude/`)

- **Agents:** 18 compiled .md files (matches source exactly)
- **Skills:** 25 directories with kebab-case naming

#### File Naming: ✅ FULLY COMPLIANT

- All directories: kebab-case
- All files: kebab-case
- All agent IDs: kebab-case

#### Standard Agent Files

- `agent.yaml` - YAML metadata (required)
- `intro.md`, `workflow.md`, `critical-requirements.md`, `critical-reminders.md`, `output-format.md` (required)
- `examples.md` (optional, 17/18 agents have it)

#### Minor Observations

1. `cli-migrator` has extra files: `anti-patterns.md`, `conversion-mappings.md`
2. `cli-tester` intentionally lacks `examples.md`
3. No README files in agent directories

#### Template System

- `agent.liquid`: 140 lines, current and comprehensive
- Handles YAML frontmatter, skills activation, core principles

#### Recommendations

1. Add `src/agents/STRUCTURE.md` documenting organization
2. Document category guidelines
3. Maintain strict naming convention enforcement

---

### 5. Skills Naming Convention Audit

**Status:** Complete
**Agent:** Analyzing `.claude/skills/` naming patterns

#### Naming Pattern Discovered

**Pattern:** `{domain}-{subcategory}-{technology}` (3-part kebab-case)

| Domain | Count | Examples                                              |
| ------ | ----- | ----------------------------------------------------- |
| api    | 8     | api-framework-hono, api-auth-better-auth-drizzle-hono |
| web    | 10    | web-framework-react, web-state-zustand                |
| meta   | 6     | meta-methodology-success-criteria                     |
| cli    | 1     | cli-framework-cli-commander                           |

**Consistency:** ✅ 100% - All 25 skills follow exact pattern

#### Directory Contents (Standard Structure)

- `SKILL.md` - Main documentation (required)
- `metadata.yaml` - Metadata with category, version, tags (required)
- `reference.md` - Quick reference (optional, ~12 skills)
- `examples/` - Example files (optional, ~11 skills)

#### Critical Issues Found

| Issue                        | Severity | Details                                                                                        |
| ---------------------------- | -------- | ---------------------------------------------------------------------------------------------- |
| Pattern NOT documented       | HIGH     | 3-part naming pattern used consistently but not documented in agent-summoner or skill-summoner |
| Redundant names              | LOW      | Some skills repeat: `api-testing-api-testing`, `web-accessibility-web-accessibility`           |
| Source vs compiled mismatch  | MEDIUM   | Source: `src/skills/[category]/[tech].md` → Compiled: `{domain}-{sub}-{tech}/` mapping unclear |
| metadata.yaml category field | LOW      | Single-level `category:` doesn't match 3-part directory name                                   |

#### Recommendations

1. **Document the naming convention** in skill-summoner explicitly
2. **Clarify source-to-compiled mapping** for skill creation
3. **Review redundant names** (may be intentional but worth reviewing)
4. **Add naming convention to critical-requirements** for skill creation

---

### 6. Agent YAML Configuration Analysis

**Status:** Complete
**Agent:** Reviewing all agent.yaml files for consistency

#### Schema Analysis (18 agents reviewed)

**Required Fields (100% compliant):**

- `$schema`, `id`, `title`, `description`, `model`, `tools`

**Optional Fields (0% utilized):**

- `disallowed_tools`, `permission_mode`, `hooks` - available in schema but unused

#### Model Distribution

| Model  | Count | Agents                   |
| ------ | ----- | ------------------------ |
| opus   | 17    | All except cli-migrator  |
| sonnet | 1     | cli-migrator (TEMPORARY) |
| haiku  | 0     | -                        |

#### Tool Set Patterns

| Agent Type     | Tools                                  | Count |
| -------------- | -------------------------------------- | ----- |
| Developer      | Read, Write, Edit, Grep, Glob, Bash    | 6     |
| Reviewer       | Read, Write, Edit, Grep, Glob, Bash    | 6     |
| Tester         | Read, Write, Edit, Grep, Glob, Bash    | 6     |
| Researcher     | Read, Grep, Glob, Bash (NO Write/Edit) | 4     |
| skill-summoner | +WebSearch, WebFetch                   | 7     |

#### Inconsistencies Found

| Issue                        | Severity | Details                                                |
| ---------------------------- | -------- | ------------------------------------------------------ |
| documentor missing Edit tool | MEDIUM   | Has Write but no Edit - breaks pattern                 |
| cli-reviewer bad reference   | LOW      | Mentions "backend-reviewer" (should be "api-reviewer") |
| cli-developer bad reference  | LOW      | Mentions "pm" (should be "web-pm")                     |

#### Critical Documentation Mismatch

**Agent-summoner output-format.md references fields that DON'T EXIST:**

- `core_prompts` - Not in any agent.yaml or schema
- `ending_prompts` - Not in any agent.yaml or schema

This suggests documentation is outdated or describes aspirational features.

---

### 7. Template System Analysis

**Status:** Complete
**Agent:** Analyzing `src/agents/_templates/agent.liquid`

#### Template Location

`/home/vince/dev/cli/src/agents/_templates/agent.liquid` (141 lines, LiquidJS)

#### Variables/Placeholders

| Variable                                     | Source File                  | Required? |
| -------------------------------------------- | ---------------------------- | --------- |
| `agent`                                      | agent.yaml                   | YES       |
| `intro`                                      | intro.md                     | YES       |
| `workflow`                                   | workflow.md                  | YES       |
| `examples`                                   | examples.md                  | Optional  |
| `criticalRequirementsTop`                    | critical-requirements.md     | Optional  |
| `criticalReminders`                          | critical-reminders.md        | Optional  |
| `outputFormat`                               | output-format.md (cascading) | Optional  |
| `skills`, `preloadedSkills`, `dynamicSkills` | config.yaml                  | Optional  |

#### Compilation Order

1. FRONTMATTER (from agent.yaml)
2. TITLE
3. `<role>` (from intro.md)
4. `<preloaded_content>` (skill list)
5. `<critical_requirements>` (if exists)
6. CORE PRINCIPLES (auto-added)
7. WORKFLOW (from workflow.md)
8. PRECOMPILED SKILLS
9. EXAMPLES
10. OUTPUT FORMAT
11. `<critical_reminders>` (if exists)
12. FINAL REMINDERS

#### Key Principles

- NO XML wrapper tags in source for critical-requirements/reminders (template adds them)
- Output format cascades: agent-level → category-level
- Template roots searched: `.claude-src/` → `.claude/templates/` → `src/agents/_templates/`

#### Compliance: ✅ All 18 Agents Follow Structure

- All have: agent.yaml, intro.md, workflow.md, critical-requirements.md, critical-reminders.md
- Most have: examples.md, output-format.md
- cli-migrator has extra files (appropriate for its domain)

#### Improvements Needed

| Priority | Issue                                                 |
| -------- | ----------------------------------------------------- |
| HIGH     | No inline documentation in template                   |
| HIGH     | Cascading resolution not documented in agent-summoner |
| MEDIUM   | Template root search order undocumented               |
| LOW      | Skill activation protocol could use more examples     |

---

### 8. Cross-Reference Agent Documentation

**Status:** Complete
**Agent:** Checking if agent-summoner docs reference correct current agents

#### Agents Mentioned BUT Don't Exist

| Documentation Says | Should Be                  |
| ------------------ | -------------------------- |
| `tester-agent`     | `web-tester`, `cli-tester` |
| `architecture`     | `web-architecture`         |
| `pm`               | `web-pm`                   |
| `pattern-critique` | `web-pattern-critique`     |

#### Agents That Exist BUT Aren't Mentioned

| Missing Agent   | Category                            |
| --------------- | ----------------------------------- |
| `cli-developer` | developer                           |
| `cli-reviewer`  | reviewer                            |
| `cli-tester`    | tester                              |
| `cli-migrator`  | migration (entire category missing) |

#### Reference Table Issues (lines 1506-1514)

Inconsistent naming patterns:

- Some use `web-`/`api-` prefix, others don't
- No explanation of naming rules
- Creates confusion for users attempting invocation

#### Domain Scope Defers (Incomplete)

| Defer          | Current                      | Missing                            |
| -------------- | ---------------------------- | ---------------------------------- |
| Implementation | web-developer, api-developer | cli-developer                      |
| Code review    | web-reviewer, api-reviewer   | cli-reviewer                       |
| Testing        | "tester"                     | Should be "web-tester, cli-tester" |
| Planning       | "pm"                         | Should be "web-pm"                 |

#### Impact

Users may attempt to invoke agents with wrong names or miss CLI variants entirely.

---

### 9. Skill-Summoner Alignment Check

**Status:** Complete
**Agent:** Comparing skill-summoner with current skill structure

#### Overall Alignment: 6/10 (Significant Issues)

#### Critical Directory Mismatch

| What Docs Say                           | What Actually Exists                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `src/skills/[category]/[technology].md` | `.claude/skills/[domain]-[category]-[name]/`         |
| Single file structure                   | Directory with SKILL.md, metadata.yaml, reference.md |

**Impact:** Users following skill-summoner instructions will create files in non-existent directory

#### Missing Documentation

1. No mention of `.claude/` directory or compilation process
2. No documentation of `[domain]-[category]-[name]` naming pattern
3. No documentation of actual directory structure (SKILL.md, metadata.yaml, etc.)
4. Incomplete metadata.yaml schema (missing: version, content_hash, updated, forked_from, cli_name, cli_description, usage_guidance, tags)

#### Incorrect Path References (9+ instances)

| File                     | Lines                                   | Issue                                       |
| ------------------------ | --------------------------------------- | ------------------------------------------- |
| workflow.md              | 57, 174, 178, 356, 782, 1107, 1129-1130 | `src/skills/` → should be `.claude/skills/` |
| critical-requirements.md | 57                                      | Same                                        |
| output-format.md         | 12-27                                   | Incomplete metadata.yaml                    |

#### Comparison with Agent-Summoner

| Aspect              | Agent-Summoner                 | Skill-Summoner      |
| ------------------- | ------------------------------ | ------------------- |
| Source location     | ✅ Accurate                    | ❌ Incorrect        |
| Compiled output     | ✅ Documents `.claude/agents/` | ❌ Missing          |
| Directory structure | ✅ Well documented             | ❌ Says single file |
| Compilation process | ✅ via `src/stacks/`           | ❌ Not documented   |

#### Recommended Fixes

1. Replace all `src/skills/` references with `.claude/skills/`
2. Add compilation process documentation
3. Document skill naming pattern `[domain]-[category]-[name]`
4. Expand metadata.yaml schema to show all 11 fields
5. Show directory structure with metadata.yaml and reference.md

---

### 10. Developer Agents Consistency Check

**Status:** Complete
**Agent:** Reviewing web-developer, api-developer, cli-developer, web-architecture alignment

#### Consistency Scoring

| Dimension             | Score     |
| --------------------- | --------- |
| File Structure        | EXCELLENT |
| Documentation Format  | EXCELLENT |
| Core Principles       | PERFECT   |
| Workflow Consistency  | PERFECT   |
| Domain Specialization | EXCELLENT |
| Output Format         | EXCELLENT |
| Compiled Bibles       | VERIFIED  |

#### File Structure (All 4 Agents)

- 7-file structure: intro.md, workflow.md, critical-requirements.md, critical-reminders.md, output-format.md, examples.md, agent.yaml
- Consistent naming conventions

#### Core Principles (Identical Across All)

1. Investigation First
2. Follow Existing Patterns
3. Minimal Necessary Changes
4. Anti-Over-Engineering
5. Verify Everything

#### Domain Specialization (Appropriate)

| Agent            | Focus                                     |
| ---------------- | ----------------------------------------- |
| web-developer    | React/TypeScript/SCSS, accessibility      |
| api-developer    | Hono/Drizzle, security/database           |
| cli-developer    | Commander.js/@clack/prompts, cancellation |
| web-architecture | Multi-phase scaffolding, infrastructure   |

#### Workflow (Identical 5-Step)

Investigation → Planning → Implementation → Testing → Verification

#### Inconsistencies Found

**None.** Developer agents demonstrate exceptional consistency.

#### Minor Improvements

1. Unified testing standards reference across all agents
2. Explicit verification gates documentation
3. Cross-references in examples to output-format sections

---

### 11. Reviewer Agents Consistency Check

**Status:** Complete
**Agent:** Reviewing web-reviewer, api-reviewer, cli-reviewer alignment

#### Consistency Scoring

| Dimension            | Score   |
| -------------------- | ------- |
| File Structure       | 100%    |
| Documentation Format | 100%    |
| Workflow Patterns    | 100%    |
| Severity Framework   | 100%    |
| Output Templates     | 100%    |
| Compiled Bibles      | 100%    |
| **Overall**          | **98%** |

#### File Structure (Identical Across All Three)

- `intro.md`, `workflow.md`, `output-format.md`, `critical-requirements.md`, `critical-reminders.md`, `examples.md`

#### Severity Framework (Identical)

| Level     | Label        | Blocks Approval |
| --------- | ------------ | --------------- |
| Critical  | Must Fix     | Yes             |
| Important | Should Fix   | No              |
| Minor     | Nice to Have | No              |

#### Domain-Specific Focus (Appropriate Differences)

- **web-reviewer**: Components, hooks, props, state, accessibility, SCSS
- **api-reviewer**: Security, API design, database, validation
- **cli-reviewer**: Exit codes, signal handling, prompts, error messages

#### Issues Found

| Issue                                    | Severity | Location                                       |
| ---------------------------------------- | -------- | ---------------------------------------------- |
| cli-reviewer missing from agent-summoner | MEDIUM   | Lines 231, 1597 only mention web/api reviewers |
| No cross-linking between agents          | LOW      | Source docs don't reference related agents     |

#### Assessment

Reviewer agents are exceptionally well-aligned and consistently structured. This is a strong example of good agent design.

---

### 12. Meta Agents Architecture Review

**Status:** Complete
**Agent:** Holistic review of meta agents (agent-summoner, skill-summoner, documentor)

#### Meta Agents Overview

| Agent          | Purpose                  | Key Responsibility                       |
| -------------- | ------------------------ | ---------------------------------------- |
| agent-summoner | Create/improve agents    | PROMPT_BIBLE techniques, agent structure |
| skill-summoner | Create/improve skills    | Research-driven, uses WebSearch/WebFetch |
| documentor     | AI-focused documentation | WHERE/HOW docs, documentation map        |

#### Workflow Hierarchy

```
User Request → Agent-Summoner
    ├─→ New Agent? → Source files → Compilation
    └─→ New Skill? → Skill-Summoner → .claude/skills/
           ↓
    Documentor (documents the new agent/skill)
```

#### Documentation vs Reality Discrepancies

| Documented              | Actual                          |
| ----------------------- | ------------------------------- |
| `tester-agent`          | `web-tester`, `cli-tester`      |
| No migration category   | `migration/cli-migrator` exists |
| `cli-developer` missing | Exists in developer category    |

#### Architecture Strengths

- ✅ Clear separation of concerns
- ✅ Well-defined workflows with deference rules
- ✅ Non-overlapping domain scopes
- ✅ PROMPT_BIBLE compliance strong

#### Architecture Gaps

- ❌ Documentation drift (wrong agent names)
- ❌ No central architecture decision flowchart
- ❌ Pattern agents (pattern-scout vs web-pattern-critique) distinction unclear
- ❌ Duplicated content (Content Preservation Rules) in multiple agents

#### Proposed Improvements

**High Priority:**

1. Update agent reference table with correct names
2. Add `migration` category documentation
3. Create central decision tree guide

**Medium Priority:** 4. Create meta-agent orchestration guide 5. Consolidate repeated content to shared location

---

## Consolidated Findings

### Critical Issues (Must Fix)

| Issue                                                                             | Severity | Source   |
| --------------------------------------------------------------------------------- | -------- | -------- |
| Agent-summoner references wrong Bible paths (should be `docs/bibles/`)            | CRITICAL | Agent 2  |
| Skill-summoner points to non-existent `src/skills/` (should be `.claude/skills/`) | CRITICAL | Agent 9  |
| Agent-summoner missing cli-developer, cli-reviewer, cli-tester, cli-migrator      | HIGH     | Agent 8  |
| Skill naming pattern `{domain}-{subcategory}-{technology}` undocumented           | HIGH     | Agent 5  |
| Developer agents too specific (mention SCSS instead of "styling")                 | MEDIUM   | Feedback |

### Corrected/Clarified (Not Issues)

| Item                                            | Status      | Note                                              |
| ----------------------------------------------- | ----------- | ------------------------------------------------- |
| Bibles exist at `docs/bibles/`                  | ✅ RESOLVED | Not missing, just wrong path in docs              |
| `SKILL.md` ALL-CAPS                             | ✅ VALID    | Intentional design choice                         |
| core_prompts/ending_prompts not in schema       | ✅ VALID    | These are now skills, not compiled into agents    |
| Redundant skill names (api-testing-api-testing) | ✅ VALID    | Intentional design                                |
| Skills source = compiled (flat structure)       | ✅ VALID    | Skills are flat in both source and compiled       |
| Stacks simplified                               | ✅ VALID    | Now just config groupings of skills to sub-agents |
| Principles are now skills                       | ✅ VALID    | Moved from compiled prompts to skills             |

### Deferred Issues (Low Priority)

| Issue                                             | Destination   |
| ------------------------------------------------- | ------------- |
| documentor agent missing Edit tool                | TODO-deferred |
| Template system documentation improvements        | TODO-deferred |
| Agent naming prefix alignment (tester→web-tester) | TODO-deferred |

### Strengths Identified

| Strength                                             | Source        |
| ---------------------------------------------------- | ------------- |
| Bibles exist and are comprehensive at `docs/bibles/` | Verified      |
| Folder structure well-organized (18 agents, 8 cats)  | Agent 4       |
| Developer agents have PERFECT consistency (100%)     | Agent 10      |
| Reviewer agents have EXCELLENT consistency (98%)     | Agent 11      |
| Template system comprehensive and current            | Agent 7       |
| Core principles consistent across all agents         | Agents 10, 11 |
| SKILL.md ALL-CAPS is intentional convention          | Clarified     |

---

## Recommendations Summary

### Priority 1: Fix Path References in Agents

1. **Update Bible references in agent-summoner:**
   - Change `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md` → `docs/bibles/CLAUDE_ARCHITECTURE_BIBLE.md`
   - Change `src/docs/PROMPT_BIBLE.md` → `docs/bibles/PROMPT_BIBLE.md`
   - Remove references to non-existent `src/stacks/`
   - Update stacks documentation (now slim config groupings)

2. **Fix skill-summoner paths:**
   - Replace all `src/skills/` → `.claude/skills/`
   - Document flat skill structure (source = compiled)
   - Skills are directories with SKILL.md, metadata.yaml, reference.md

### Priority 2: Update Agent References

3. **Add missing CLI agents to documentation:**
   - cli-developer (in developer category)
   - cli-reviewer (in reviewer category)
   - cli-tester (in tester category)
   - cli-migrator (migration category)

### Priority 3: Document & Canonize Patterns

4. **Canonize skill naming convention:**
   - Pattern: `{domain}-{subcategory}-{technology}`
   - Domains: web, api, cli, meta
   - Add to skill-summoner critical-requirements

5. **Genericize developer agent technology references:**
   - Replace "SCSS" with "styling"
   - Replace specific frameworks with generic terms
   - Let skills add implementation details

### Deferred (See TODO-deferred.md)

- D-18: Template system documentation
- D-19: Template error messages
- D-20: documentor Edit tool
- D-21: Agent naming prefix alignment

---

## Action Items

### Immediate (Blocking Issues)

- [ ] Update Bible paths: `src/docs/` → `docs/bibles/` in agent-summoner
- [ ] Update skill-summoner: `src/skills/` → `.claude/skills/`
- [ ] Remove/update `src/stacks/` references (stacks are now config only)

### Short-Term (Documentation Alignment)

- [ ] Add cli-developer, cli-reviewer, cli-tester, cli-migrator to agent-summoner docs
- [ ] Canonize skill naming pattern in skill-summoner
- [ ] Genericize technology references in developer agents
- [ ] Document skill naming pattern `{domain}-{subcategory}-{technology}`
- [ ] Document template system compilation process

### Medium-Term (Improvements)

- [ ] Add inline documentation to agent.liquid template
- [ ] Add documentor Edit tool capability
- [ ] Create central architecture decision flowchart
- [ ] Document meta-agent orchestration workflow

---

## Research Completion

**Status:** All 12 research agents completed successfully

| Agent | Area                           | Status      |
| ----- | ------------------------------ | ----------- |
| 1     | Agent-Summoner Source Files    | ✅ Complete |
| 2     | Agent-Summoner Bible Analysis  | ✅ Complete |
| 3     | File Naming Convention Audit   | ✅ Complete |
| 4     | Folder Structure Validation    | ✅ Complete |
| 5     | Skills Naming Convention Audit | ✅ Complete |
| 6     | Agent YAML Configuration       | ✅ Complete |
| 7     | Template System Analysis       | ✅ Complete |
| 8     | Cross-Reference Documentation  | ✅ Complete |
| 9     | Skill-Summoner Alignment       | ✅ Complete |
| 10    | Developer Agents Consistency   | ✅ Complete |
| 11    | Reviewer Agents Consistency    | ✅ Complete |
| 12    | Meta Agents Architecture       | ✅ Complete |

**Date:** 2026-02-03

---

## Round 2: Bible Alignment & Specificity Review

### R2-1. Developer Agent Over-Specificity

**Status:** Complete

**Total violations found:** 41 instances across 4 agents

| Agent            | Instances | Severity |
| ---------------- | --------- | -------- |
| web-developer    | 3         | Low      |
| api-developer    | 7         | Medium   |
| cli-developer    | 6         | Medium   |
| web-architecture | 25        | High     |

**Key violations by category:**

| Category      | Examples                                       | Generic Replacement                                       |
| ------------- | ---------------------------------------------- | --------------------------------------------------------- |
| Styling       | "SCSS Modules"                                 | "styling"                                                 |
| State         | "Zustand", "React Query"                       | "state management"                                        |
| Database      | "Drizzle ORM"                                  | "ORM" or "database"                                       |
| API           | "Hono"                                         | "API framework"                                           |
| CLI           | "Commander.js", "@clack/prompts", "picocolors" | "CLI commands", "interactive prompts", "terminal styling" |
| Auth          | "Better Auth"                                  | "authentication"                                          |
| Analytics     | "PostHog"                                      | "analytics"                                               |
| Observability | "Pino", "Sentry", "Axiom"                      | "logging", "error tracking"                               |

**Principle:** Agents should use generic terms. Skills add implementation details.

**Priority:**

- Tier 1 (Critical): Agent descriptions, focus sections, critical requirements
- Tier 2 (Important): Workflow docs, example code
- Tier 3 (Nice to have): Detailed implementation examples

---

### R2-2. Skill-Summoner vs Bibles Alignment

**Status:** Complete

**Critical Path Issues:**

| Issue           | Location              | Current                                 | Should Be                                             |
| --------------- | --------------------- | --------------------------------------- | ----------------------------------------------------- |
| Wrong directory | workflow.md:328       | `src/skills/[category]/[technology].md` | `.claude/skills/[domain]-[subcategory]-[technology]/` |
| Wrong path      | workflow.md:1129-1130 | Avoid `.claude/skills/`                 | Use `.claude/skills/`                                 |
| Wrong structure | workflow.md:1708-1710 | Single file                             | Three-file structure                                  |

**Alignment Summary:**

| Aspect                  | Bible Says                            | Actual                                | skill-summoner          | Status     |
| ----------------------- | ------------------------------------- | ------------------------------------- | ----------------------- | ---------- |
| Directory               | `.claude/skills/`                     | `.claude/skills/`                     | `src/skills/`           | ❌ WRONG   |
| File naming             | SKILL.md ALL-CAPS                     | SKILL.md                              | Shown but not explained | ⚠️         |
| Structure               | Three files                           | SKILL.md, metadata.yaml, reference.md | Says single file        | ❌ WRONG   |
| Naming pattern          | `{domain}-{subcategory}-{technology}` | Implemented                           | Not documented          | ❌ MISSING |
| PROMPT_BIBLE compliance | Required                              | Implemented                           | Correctly taught        | ✅         |

**Files needing updates:**

- `workflow.md`: Lines 328, 1129-1130, 1708-1710
- `output-format.md`: Add three-file structure clarification
- `examples.md`: Note MobX is PROMPT_BIBLE style, actual skills differ

**Priority 1 (Critical):**

1. Fix directory path: `src/skills/` → `.claude/skills/`
2. Document naming pattern: `{domain}-{subcategory}-{technology}`
3. Clarify three-file structure (SKILL.md, metadata.yaml, reference.md)

---

### R2-3. CLAUDE_ARCHITECTURE_BIBLE Alignment

**Status:** Complete

**Major Finding:** The Architecture Bible describes an **older architecture** that has been significantly refactored.

#### Outdated Sections (Need Rewrite)

| Section               | Issue                                                    |
| --------------------- | -------------------------------------------------------- |
| Directory Structure   | Documents `src/stacks/` which doesn't exist              |
| Stack Switching       | `cc switch` command deprecated                           |
| agents.yaml           | File doesn't exist - agents loaded from marketplace      |
| config.yaml Structure | Now uses `.claude-src/config.yaml` with different format |
| Creating Skills       | Skills now from marketplace, not `src/stacks/`           |

#### Key Architecture Changes Not in Bible

| Old (Documented)                 | New (Reality)                           |
| -------------------------------- | --------------------------------------- |
| `src/stacks/{stack}/config.yaml` | `.claude-src/config.yaml`               |
| `src/agents.yaml` registry       | Agents loaded from marketplace          |
| Per-stack skill implementations  | Marketplace + local override            |
| `cc switch project-stack`        | Single config, no stack switching       |
| Hierarchical agent/skill config  | Flat lists + `stack:` semantic grouping |

#### Accurate Sections (No Changes Needed)

- ✅ Agent Source File Structure (intro.md, workflow.md, etc.)
- ✅ Writing Style Guidelines
- ✅ Core Principles (5 hardcoded)
- ✅ Skill Activation Protocol
- ✅ Required XML Tags
- ✅ Output Format System
- ✅ Skill Schema Requirements

#### Priority Updates for Bible

**High Priority:**

1. Rewrite Directory Structure section
2. Rewrite config.yaml section
3. Add Marketplace Architecture section
4. Remove/deprecate agents.yaml section
5. Update stack switching section

**Medium Priority:**

1. Update "Creating New Agent" steps
2. Add Installation Modes section (local vs plugin)
3. Add Project Configuration section

---

### R2-4. SKILL-ATOMICITY-BIBLE Alignment

**Status:** Complete

**Overall Assessment:** Documentation is sound, implementation is mostly aligned.

#### Naming Pattern: ✅ PERFECT COMPLIANCE

All 25 skills follow `{domain}-{subcategory}-{technology}` pattern correctly.

#### Metadata Structure: ✅ EXCEEDS REQUIREMENTS

All required fields present + additional tracking fields.

#### Atomicity Violations Found in Skills

| Skill                    | Violations                                | Severity |
| ------------------------ | ----------------------------------------- | -------- |
| web-framework-react      | lucide-react prescriptions, @repo imports | HIGH     |
| web-styling-scss-modules | cva integration depth                     | MEDIUM   |
| web-mocks-msw            | @repo/api-mocks, @repo/api/types          | MEDIUM   |
| web-state-zustand        | compatible_with metadata                  | LOW      |

#### Documentation Gaps (Bible needs updates)

| Gap                                      | Recommended Fix                                  |
| ---------------------------------------- | ------------------------------------------------ |
| No guidance on @repo imports in examples | Add "Acceptable Cross-Domain References" section |
| No icon library guidance                 | Add example showing generic icon patterns        |
| No clarification on compatible_with      | Define when metadata cross-refs are acceptable   |

#### Skills Needing Updates

**HIGH PRIORITY:**

- `web-framework-react` - Remove lucide-react prescriptions

**MEDIUM PRIORITY:**

- `web-mocks-msw` - Add comments explaining @repo imports are adaptable
- `web-styling-scss-modules` - Refocus cva examples into separate cva skill

---

### R2-5. Agent-Summoner vs Bibles

**Status:** Complete

**Major Finding:** Agent-summoner reflects an **earlier architecture version** and needs systematic updating.

#### Critical Misalignments

| Issue            | agent-summoner Says                      | Bible Says                                        |
| ---------------- | ---------------------------------------- | ------------------------------------------------- |
| core_prompts     | Configurable (`core_prompts: developer`) | Hardcoded in template, no config needed           |
| Skills structure | `precompiled:` vs `dynamic:` distinction | Unified - all skills via Skill tool               |
| agents.yaml      | References stack config for agents       | agents.yaml is single source of truth             |
| Skill Activation | Not mentioned                            | Three-step protocol (evaluate/activate/implement) |
| Bible path       | `CLAUDE_ARCHITECTURE_BIBLE.md` (root)    | `docs/bibles/CLAUDE_ARCHITECTURE_BIBLE.md`        |
| SKILL.md         | No schema docs                           | Requires frontmatter + metadata.yaml              |

#### Files Needing Updates

| File                     | Lines                     | Issue                                         |
| ------------------------ | ------------------------- | --------------------------------------------- |
| workflow.md              | 87, 208, 1261-1262        | References non-existent `core_prompts` config |
| workflow.md              | 549-560, 568-569          | Shows outdated precompiled/dynamic structure  |
| workflow.md              | 257-262                   | Missing CLAUDE.md in stacks structure         |
| examples.md              | 136-138, 165-169, 191-195 | Old config structure and core_prompts refs    |
| critical-requirements.md | 3-5, 27                   | Wrong Bible path, core_prompts ref            |
| critical-reminders.md    | 3-5, 27                   | Wrong Bible path, core_prompts ref            |
| output-format.md         | 22-26                     | Deprecated core_prompts/ending_prompts        |

#### Key Conceptual Shifts Needed

1. **Core Principles** → Hardcoded in template (not configurable)
2. **Skills** → Unified (no precompiled/dynamic distinction)
3. **agents.yaml** → Single source of truth for agent definitions
4. **Skill Activation** → Add three-step protocol documentation
5. **Bible paths** → Reference `docs/bibles/`

---

### R2-6. DOCUMENTATION_BIBLE Alignment

**Status:** Complete

**Major Finding:** The DOCUMENTATION_BIBLE is written for **web applications**, not CLI tools.

**Overall Alignment: ~25%**

#### Path Misalignments

| Referenced Path                          | Actual Path                                |
| ---------------------------------------- | ------------------------------------------ |
| `/src/docs/PROMPT_BIBLE.md`              | `docs/bibles/PROMPT_BIBLE.md`              |
| `/src/docs/CLAUDE_ARCHITECTURE_BIBLE.md` | `docs/bibles/CLAUDE_ARCHITECTURE_BIBLE.md` |
| `.ai-docs/` directory                    | Does not exist                             |
| `/apps/webapp/.ai-docs/`                 | Completely inapplicable                    |

#### Scope Mismatch

**Bible assumes:**

- Feature-heavy web apps (batch editor, MobX stores, React)
- `.ai-docs/` structure with `_quick/`, `_decisions/`, `_session/`, `features/`
- E2E tests, flow docs, store APIs

**Actual CLI project:**

- Simple `/docs/` structure
- Agent/skill generation system
- Stack-based configuration

#### Recommended Actions

**HIGH PRIORITY:**

1. Fix path references to `docs/bibles/`
2. Remove `/apps/webapp/` references

**MEDIUM PRIORITY:**

1. Add scope clarification ("for web apps, not CLI tools")
2. Add "When to Use This" section

**Assessment:** This Bible is a **template/reference** for web apps, not guidance for this CLI project

---

### R2-7. Domain Documentation Exists

**Status:** Complete

**Major Finding:** Domain naming IS documented, but scattered across multiple files.

#### Documentation Status

| Naming Type                         | Documented? | Location                                   |
| ----------------------------------- | ----------- | ------------------------------------------ |
| Domain naming (web, api, cli, meta) | ✅ Yes      | `docs/architecture.md`                     |
| Agent naming                        | ✅ Yes      | `docs/bibles/CLAUDE_ARCHITECTURE_BIBLE.md` |
| Skill naming pattern                | ✅ Yes      | Multiple locations                         |
| Skill metadata schema               | ✅ Yes      | `CLAUDE_ARCHITECTURE_BIBLE.md:1160-1327`   |
| Custom agents                       | ✅ Yes      | `docs/custom-agents-schema.md`             |
| Stack naming                        | ✅ Yes      | `CLAUDE_ARCHITECTURE_BIBLE.md`             |

#### Current Skill Naming (Normalized)

**Pattern:** `{domain}-{subcategory}-{skill-name}`

Examples:

- `web-framework-react`
- `api-framework-hono`
- `api-database-prisma`
- `cli-framework-cli-commander`

#### Domains Documented

| Domain | Purpose                                             |
| ------ | --------------------------------------------------- |
| web    | Web development (React, frameworks, state, styling) |
| api    | Backend/API (frameworks, databases, observability)  |
| cli    | Command-line tooling                                |
| meta   | Meta-level utilities (methodology, documentation)   |

#### Recommendations

1. **Create consolidated `docs/naming-conventions.md`** - All patterns in one place
2. **Update skill-id-normalization-plan.md** - Current migration status
3. **Add explicit kebab-case requirement** for agent names

---

### R2-8. FRONTEND_BIBLE Alignment

**Status:** Complete

**Major Finding:** FRONTEND_BIBLE is for **web applications**, but this codebase is a **CLI tool using Ink** (React for terminals).

#### Alignment Summary

| Section                    | Alignment | Note                                 |
| -------------------------- | --------- | ------------------------------------ |
| 1. Package Architecture    | ✅ 95%    | Accurate                             |
| 2. API Client Architecture | ❌ 0%     | Not applicable (no hey-api, OpenAPI) |
| 3. Code Conventions        | ✅ 85%    | Mostly accurate, need Ink-specific   |
| 4. State Management        | ✅ 90%    | Zustand used correctly               |
| 5. Testing Standards       | ✅ 80%    | Use fixtures, not MSW                |
| 6. Design System           | ❌ 0%     | Not applicable (no CSS/SCSS)         |
| 7. Accessibility           | ✅ 70%    | Keyboard nav ✅, ARIA N/A            |
| 13. Anti-Patterns          | ✅ 95%    | Good guidance followed               |

#### What Codebase Actually Uses

- **UI Framework:** Ink (React for terminals), not web React
- **Styling:** Ink's built-in color/layout props, no CSS/SCSS
- **Forms:** @inkjs/ui components, not React Hook Form
- **Testing:** Ink Testing Library, fixtures (not MSW)
- **State:** Zustand ✅

#### Sections Needing Updates

| Section     | Issue                                     |
| ----------- | ----------------------------------------- |
| Section 2   | Remove or conditionally gate (API client) |
| Section 6   | Remove (Design System not applicable)     |
| Section 3.1 | Add Ink-specific component patterns       |
| Section 3.8 | Note: Use framework-specific forms        |
| Section 5.3 | Use fixtures for CLI, MSW for web         |

#### Recommendations

1. Add preamble clarifying "for web apps, not CLI/Ink"
2. Add `[WEB APP ONLY]` or `[CLI ONLY]` tags
3. Create supplementary "Terminal UI Patterns" guide

---

### R2-9. PROMPT_BIBLE Alignment

**Status:** Complete

**Alignment Grade: 65%**

- Prompt techniques: 100% aligned ✅
- XML tag standards: 100% aligned ✅
- Core principles: 100% aligned ✅
- Configuration examples: 0% aligned ❌ (shows deprecated fields)

#### Critical Issues: Deprecated Fields

| Deprecated Field       | PROMPT_BIBLE Says      | Current Reality                               |
| ---------------------- | ---------------------- | --------------------------------------------- |
| `core_prompts`         | Configurable per agent | Embedded in template, not configurable        |
| `ending_prompts`       | Configurable per agent | Embedded in template, not configurable        |
| Precompiled vs dynamic | Two types of skills    | All skills are dynamic, loaded via Skill tool |

#### What's Correct ✅

All 13 Essential Techniques are implemented correctly:

- Self-Reminder Loop, Investigation-First, Emphatic Repetition
- XML Tags, Documents First, Expansion Modifiers
- Self-Correction Triggers, Post-Action Reflection
- Progress Tracking, Positive Framing, Think Alternatives
- Just-in-Time Loading, Write Verification

#### Files Needing Updates

| File                                  | Issue                                                          |
| ------------------------------------- | -------------------------------------------------------------- |
| PROMPT_BIBLE.md:1143-1148             | Example config with deprecated `core_prompts`/`ending_prompts` |
| agent-summoner/output-format.md:21-25 | Shows deprecated fields in example                             |
| agent-summoner/workflow.md            | Multiple refs to "core_prompts sets"                           |
| agent-summoner/examples.md            | References deprecated fields                                   |

#### Architecture Evolution

| Old                             | New                                           |
| ------------------------------- | --------------------------------------------- |
| `core_prompts` configurable     | Embedded in agent.liquid template             |
| `ending_prompts` configurable   | Hardcoded in template                         |
| Precompiled/dynamic distinction | All skills via Skill tool                     |
| Many agent.yaml fields          | Minimal: id, title, description, model, tools |

---

### R2-10. INDEX.md Bibles Reference

**Status:** Complete

**Major Finding:** INDEX.md has significant accuracy issues with paths and agent names.

#### Path Reference Errors

| INDEX.md Claims                            | Actual Location                            |
| ------------------------------------------ | ------------------------------------------ |
| `src/docs/CLAUDE_ARCHITECTURE_BIBLE.md`    | `docs/bibles/CLAUDE_ARCHITECTURE_BIBLE.md` |
| `src/docs/PROMPT_BIBLE.md`                 | `docs/bibles/PROMPT_BIBLE.md`              |
| `src/docs/DOCUMENTATION_BIBLE.md`          | `docs/bibles/DOCUMENTATION_BIBLE.md`       |
| `src/docs/skills/SKILL-ATOMICITY-BIBLE.md` | `docs/bibles/SKILL-ATOMICITY-BIBLE.md`     |

#### Agent Name Mismatches

| INDEX.md Lists        | Actual Name                |
| --------------------- | -------------------------- |
| `frontend-developer`  | `web-developer`            |
| `backend-developer`   | `api-developer`            |
| `frontend-researcher` | `web-researcher`           |
| `backend-researcher`  | `api-researcher`           |
| `frontend-reviewer`   | `web-reviewer`             |
| `backend-reviewer`    | `api-reviewer`             |
| `tester`              | `web-tester`, `cli-tester` |
| `architecture`        | `web-architecture`         |
| `pm`                  | `web-pm`                   |

#### Missing from INDEX.md

- `cli-developer`
- `cli-reviewer`
- `cli-tester`
- `cli-migrator`
- `web-pattern-critique`

#### Non-Existent Paths Referenced

- `src/docs/plugins/PLUGIN-DEVELOPMENT.md` - MISSING
- `src/docs/plugins/CLI-REFERENCE.md` - MISSING
- `src/docs/agents/` directory - MISSING
- `src/docs/skills/` directory - MISSING

---

## Round 2 Summary

**10 research agents completed analyzing:**

- 6 Bible documents
- agent-summoner and skill-summoner alignment
- Developer agent specificity
- Domain documentation

### Key Findings

1. **CLAUDE_ARCHITECTURE_BIBLE:** Significantly outdated (src/stacks/, agents.yaml don't exist)
2. **PROMPT_BIBLE:** core_prompts/ending_prompts are deprecated (embedded in template)
3. **SKILL-ATOMICITY-BIBLE:** Well-aligned, minor atomicity violations in skills
4. **DOCUMENTATION_BIBLE:** Written for web apps, not CLI tools
5. **FRONTEND_BIBLE:** Written for web React, codebase uses Ink (terminal)
6. **INDEX.md:** Wrong paths, wrong agent names throughout
7. **Agent-summoner:** References deprecated concepts extensively
8. **Skill-summoner:** Wrong paths (src/skills/ → .claude/skills/)
9. **Developer agents:** 41 over-specific tech references (SCSS, Drizzle, etc.)
10. **Domain docs:** Exist but scattered across multiple files

---

## Round 3: Documentation Verification (2026-02-04)

### R3-1. docs/architecture.md - CRITICAL

| Issue                          | Details                                                                            |
| ------------------------------ | ---------------------------------------------------------------------------------- |
| Wrong module path              | References `src/cli/lib/` - path is correct after rename                           |
| Missing commands               | `doctor`, `search`, `outdated`, `info`, `diff`, `update`, `new skill` undocumented |
| Wrong directory structure      | Documents `src/skills/` (doesn't exist)                                            |
| Missing `.claude-src/`         | Primary config location not documented                                             |
| Outdated marketplace structure | Confuses skills repo with this codebase                                            |

### R3-2. docs/commands.md - HIGH

| Issue                    | Details                                                                   |
| ------------------------ | ------------------------------------------------------------------------- |
| 7 undocumented commands  | `doctor`, `search`, `outdated`, `info`, `diff`, `update`, `new skill`     |
| `cc eject` wrong options | Docs: `templates, config, agents` → Actual: `agent-partials, skills, all` |

### R3-3. README.md - HIGH

| Issue               | Line   | Details                                      |
| ------------------- | ------ | -------------------------------------------- |
| Wrong install path  | 79     | Says `~/.claude/` but actual is `./.claude/` |
| Non-existent flags  | 85, 92 | `--local` and `--marketplace` don't exist    |
| Incomplete commands | 35-40  | Missing 9+ commands                          |

### R3-4. docs/custom-agents-schema.md - MEDIUM

| Issue                       | Details                                            |
| --------------------------- | -------------------------------------------------- |
| Missing `_custom` directory | `src/agents/_custom/` documented but doesn't exist |
| Phase status unclear        | Documented as "proposal" but already implemented   |

### R3-5. Config Documentation - MEDIUM

| Issue              | Details                                                        |
| ------------------ | -------------------------------------------------------------- |
| `stack:` field     | Documented in CLAUDE_ARCHITECTURE_BIBLE.md but not implemented |
| skills-matrix.yaml | Schema not documented in `docs/data-models.md`                 |

### R3-6. Orphaned/Outdated Documents - CRITICAL

| File                                 | Issue                                        |
| ------------------------------------ | -------------------------------------------- |
| `docs/solution-a-migration-tasks.md` | References deprecated `src/stacks/`          |
| `docs/workflows.md`                  | References `src/stacks/` which doesn't exist |
| `docs/stacks-as-visual-hierarchy.md` | Entire doc based on deprecated architecture  |

### R3-7. Fixes Applied (2026-02-04)

**Agent References Fixed:**

- All `frontend-developer` → `web-developer`
- All `backend-developer` → `api-developer`
- All `frontend-reviewer`/`backend-reviewer` → `web-reviewer`/`api-reviewer`
- All `-> pm` → `-> web-pm`
- All `-> tester` → `-> web-tester` or `-> cli-tester`
- All `api-tester` → `web-tester` (api-tester doesn't exist)

**Skill Paths Fixed:**

- All `src/skills/` → `.claude/skills/` in skill-summoner and agent-summoner

**Developer Agents Genericized:**

- Removed specific tech names from Tier 1 files (intro.md, critical-requirements.md, agent.yaml)
- Commander.js, @clack/prompts, picocolors, Drizzle, Zod, Sentry, Better Auth, PostHog, Pino, Axiom → generic terms

**Bible Paths Fixed:**

- INDEX.md: `src/skills/` → `.claude/skills/`
- DOCUMENTATION_BIBLE.md: `src/docs/PROMPT_BIBLE.md` → `docs/bibles/PROMPT_BIBLE.md`

### R3-8. Outstanding Tasks

| Priority | Task                                                                            |
| -------- | ------------------------------------------------------------------------------- |
| HIGH     | Update `docs/commands.md` with 7 missing commands                               |
| HIGH     | Fix `cc eject` documentation (wrong options)                                    |
| HIGH     | Fix README.md install path and non-existent flags                               |
| HIGH     | Mark `docs/workflows.md` and `docs/stacks-as-visual-hierarchy.md` as deprecated |
| MEDIUM   | Create `src/agents/_custom/` directory with templates                           |
| MEDIUM   | Document `skills-matrix.yaml` schema in `docs/data-models.md`                   |
| LOW      | Create task #5: repo-specific agent-summoner                                    |

---

## Status Summary

| Round | Focus                                  | Issues Found | Issues Fixed              |
| ----- | -------------------------------------- | ------------ | ------------------------- |
| 1     | Agent-summoner source files            | 12+          | Documented                |
| 2     | Bible alignment, developer specificity | 10+          | Most fixed                |
| 3     | Documentation verification             | 15+          | Some fixed, tasks created |
