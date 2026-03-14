# Agent Compliance Bible

> **Purpose**: A comprehensive test suite for verifying agent compliance. Run these tests periodically to ensure agents remain aligned with prompt-bible and architecture standards.

Each test has 3 verification steps. An agent passes when all 3 steps are verified.

---

## Table of Contents

1. [Reviewer Notes Section Quality](#test-reviewer-notes-section-quality)
2. [Intro Quality Compliance](#test-intro-quality-compliance)
3. [Help-Seeking Guidance Compliance](#test-help-seeking-guidance-compliance)
4. [Build and Test Status Compliance](#test-build-and-test-status-compliance)
5. [Code Quality Guidance Compliance](#test-code-quality-guidance-compliance)
6. [Error Handling Guidance Compliance](#test-error-handling-guidance-compliance)
7. [Performance Guidance Compliance](#test-performance-guidance-compliance)
8. [Accessibility Guidance Compliance](#test-accessibility-guidance-compliance)
9. [YAML Config Compliance](#test-yaml-config-compliance)
10. [File Naming Convention Compliance](#test-file-naming-convention-compliance)
11. [Template Core Principles Compliance](#test-template-core-principles-compliance)
12. [Implementation Scope Guidance](#test-implementation-scope-guidance)
13. [Specification Reading Guidance](#test-specification-reading-guidance)
14. [Extended Reasoning Guidance](#test-extended-reasoning-guidance)
15. [Agent Integration Documentation](#test-agent-integration-documentation)
16. [Common Mistakes Documentation Quality](#test-common-mistakes-documentation-quality)
17. [XML Semantic Tags Usage](#test-xml-semantic-tags-usage)
18. [Emphatic Repetition Quality](#test-emphatic-repetition-quality)
19. [Just-In-Time Loading Compliance](#test-just-in-time-loading-compliance)
20. [Progress Tracking Compliance](#test-progress-tracking-compliance)
21. [Write Verification Compliance](#test-write-verification-compliance)
22. [Post-Action Reflection Compliance](#test-post-action-reflection-compliance)
23. [Investigation-First Compliance](#test-investigation-first-compliance)
24. [Verbosity and Context Constraint Compliance](#test-verbosity-and-context-constraint-compliance)
25. [prompt-bible Essential Techniques Compliance](#test-prompt_bible-essential-techniques-compliance)
26. [Canonical Agent Structure Compliance](#test-canonical-agent-structure-compliance)
27. [Domain Scope and Agent Boundaries](#test-domain-scope-and-agent-boundaries)
28. [Output Format and Examples Quality](#test-output-format-and-examples-quality)
29. [Tonality and Style Compliance](#test-tonality-and-style-compliance)
30. [Anti-Over-Engineering Compliance](#test-anti-over-engineering-compliance)

---

## Test: Reviewer Notes Section Quality

- [ ] Test 1: Structure audit - 4 comprehensive subsections
  - For Reviewer: focus areas, discussion points, alternatives
  - Scope Control: what was added, what was NOT added (with rationale)
  - Known Limitations: scope reductions, technical debt
  - Dependencies: packages, breaking changes
- [ ] Test 2: Example demonstration verification
  - All 4 subsections demonstrated
  - "Did NOT add" shows anti-over-engineering teaching
  - Rationale: "tempting but out of scope", "not in spec"
  - Dependencies: "none" with explicit documentation
- [ ] Test 3: FINAL SIGN-OFF - Notes enable clean handoff
  - Anti-over-engineering explicitly documented
  - Reviewer focus areas guide review
  - Change tracking for dependencies

---

## Test: Intro Quality Compliance

- [ ] Test 1: Structure audit - 3 sentences, all essential
  - Line 1: Role (frontend developer + specs + conventions)
  - Line 3: Scope expansion (edge cases, error handling, a11y)
  - Line 5: Core job (surgical + 5-step process + scope control)
- [ ] Test 2: Cross-reference verification
  - "specifications" → critical-reminders MUST rules
  - "conventions" → pattern enforcement throughout
  - "surgical" → metadata.yaml, workflow.md
  - "verify" → test MUST rule
- [ ] Test 3: FINAL SIGN-OFF - Intro quality excellent
  - Concise (3 sentences)
  - Establishes role, input, approach, process, scope
  - Key concepts reinforced in critical files

---

## Test: Help-Seeking Guidance Compliance

- [ ] Test 1: Escalation scenarios audit - 5+4+4 scenarios
  - Ask PM/Architect: 5 scenarios (spec unclear, patterns missing, etc.)
  - Ask Specialists: 4 scenarios (performance, security, architecture)
  - Don't ask: 4 self-resolution scenarios
  - When in doubt: "Investigate first, then ask with context"
- [ ] Test 2: Cross-reference verification - integrated throughout
  - Gap analysis: "Is anything unclear?"
  - Progress tracking: "Questions needing clarification"
  - Red flags: triggers clarification gate
  - Complexity protocol: "Ask for guidance if stuck"
  - Implementation scope: "When unsure, ask"
- [ ] Test 3: FINAL SIGN-OFF - Help-seeking comprehensive
  - Clear escalation paths (PM vs Specialists)
  - Self-resolution guidance prevents unnecessary questions
  - Investigation-first principle reinforced

---

## Test: Build and Test Status Compliance

- [ ] Test 1: Build/test checklist audit - 5 items
  - Existing tests pass, new tests pass, build succeeds
  - No type errors, no lint errors
  - References in critical-reminders MUST rule, intro, workflow
- [ ] Test 2: Workflow integration verification
  - Step 4: Testing with 5 sub-steps
  - Skill reference for testing standards
  - Tester agent integration
  - Coverage verification requirement
- [ ] Test 3: FINAL SIGN-OFF - Build/test comprehensive
  - MUST rule enforces test verification
  - `<tests>` section in output format
  - Example includes complete test code

---

## Test: Code Quality Guidance Compliance

- [ ] Test 1: Code quality references audit
  - output-format.md: 5-item checklist + framework-agnostic section
  - examples.md: completed code quality checklist
  - critical-requirements.md: naming conventions MUST rule
- [ ] Test 2: Framework-agnostic guidance verification
  - 4 rules: constants, types, naming, structure
  - Concrete example: `const MAX_ITEMS = 10` vs `items.slice(0, 10)`
  - TypeScript-aware: explicit interfaces, no implicit any
- [ ] Test 3: FINAL SIGN-OFF - Code quality comprehensive
  - 5-item verification checklist
  - Universal principles with concrete examples
  - i18n consideration included

---

## Test: Error Handling Guidance Compliance

- [ ] Test 1: Error handling references audit - 6+ locations
  - intro.md: "error handling" as core requirement
  - output-format.md: 4-item checklist + framework-agnostic section
  - examples.md: completed checklist with N/A for sync operations
  - workflow.md: comprehensive mode + validation scope control
- [ ] Test 2: Framework-agnostic guidance verification
  - 4 async operation states: Loading, Error, Empty, Success
  - UX focus: user feedback, retry capability, clarity about state
- [ ] Test 3: FINAL SIGN-OFF - Error handling comprehensive
  - Verification checklist with (if applicable) notes
  - User feedback explicitly mentioned (toasts, messages)
  - Validation scope control in common mistakes

---

## Test: Performance Guidance Compliance

- [ ] Test 1: Performance references audit - 4 locations
  - output-format.md: 4-item checklist + framework-agnostic section
  - examples.md: completed checklist with N/A handling
  - workflow.md: escalation path to specialists
- [ ] Test 2: Framework-agnostic guidance verification
  - 4 rules: re-renders, virtualization, lazy loading, memoization
  - Specific threshold: "Lists over ~100 items should virtualize"
  - Anti-premature-optimization: "Only for measured bottlenecks"
- [ ] Test 3: FINAL SIGN-OFF - Performance guidance comprehensive
  - Verification checklist with (if applicable) notes
  - Example demonstrates N/A marking
  - Escalation path for performance concerns

---

## Test: Accessibility Guidance Compliance

- [ ] Test 1: Accessibility references audit - 8+ locations
  - intro.md: "accessibility considerations" requirement
  - workflow.md: domain scope + comprehensive mode expansion
  - output-format.md: 5-item checklist + framework-agnostic section
  - examples.md: completed checklist + reviewer notes
- [ ] Test 2: Framework-agnostic guidance verification
  - 4 universal rules: semantic HTML, keyboard access, focus visible, ARIA
  - Concrete examples: `<button>` not `<div onClick>`
  - Applies to React, Vue, Svelte, or any framework
- [ ] Test 3: FINAL SIGN-OFF - Accessibility comprehensive
  - 5-item verification checklist
  - Framework-agnostic universal principles
  - Example demonstrates completed accessibility check
  - Reviewer notes include accessibility verification

---

## Test: YAML Config Compliance

- [ ] Test 1: Required fields audit
  - $schema: present with schema URL
  - id: matches directory name
  - title: proper title format
  - description: comprehensive (purpose + tech + approach + orchestration)
  - model: "opus" or appropriate model
  - tools: appropriate tools listed
- [ ] Test 2: Tool appropriateness verification
  - File ops: Read, Write, Edit (essential for implementation)
  - Search: Grep, Glob (essential for investigation)
  - Testing: Bash (essential for running tests)
  - No unnecessary tools (Task, WebFetch appropriately excluded for most agents)
- [ ] Test 3: FINAL SIGN-OFF - YAML config follows best practices
  - Description includes orchestration hint (e.g., "invoke AFTER web-pm")
  - Tools match agent's domain scope
  - Model appropriate for complexity

---

## Test: File Naming Convention Compliance

- [ ] Test 1: Required files audit - 7/7 present with kebab-case
  - metadata.yaml, intro.md, workflow.md, critical-requirements.md
  - critical-reminders.md, output-format.md, examples.md
  - Directory: kebab-case naming
- [ ] Test 2: Content rule compliance verification
  - intro.md: prose role description (no header)
  - critical-requirements/reminders: header + MUST rules format
  - workflow.md: workflow sections with XML tags
  - output-format.md: template with XML structure
  - examples.md: complete implementation example
  - No XML wrapper tags in source (template adds them)
- [ ] Test 3: FINAL SIGN-OFF - File naming fully compliant
  - All 7 files present and correctly named
  - Content follows canonical structure
  - Ready for template compilation

---

## Test: Template Core Principles Compliance

- [ ] Test 1: Core principles identification from agent.liquid
  - 5 principles: Investigation First, Follow Existing Patterns, Minimal Necessary Changes, Anti-Over-Engineering, Verify Everything
  - Emphatic reminder: "DISPLAY ALL 5 CORE PRINCIPLES AT START OF EVERY RESPONSE"
- [ ] Test 2: Agent alignment verification - 5/5 principles aligned
  - Principle 1: critical-requirements + workflow STOP trigger
  - Principle 2: critical-requirements + metadata.yaml description
  - Principle 3: critical-requirements + intro "surgical" + workflow default
  - Principle 4: workflow "existing utilities" throughout
  - Principle 5: critical-requirements + workflow verification step
- [ ] Test 3: FINAL SIGN-OFF - Template core principles enforced
  - All 5 principles have MUST rules or equivalent enforcement
  - Cross-referenced in intro, critical files, workflow, output format
  - Anti-over-engineering integrated at multiple levels

---

## Test: Implementation Scope Guidance

- [ ] Test 1: Structure audit - 2 tiers with clear guidance
  - Default: Surgical/minimal (anti-over-engineering)
  - Comprehensive: Only when spec explicitly requests with 5 indicator phrases
  - 6 bounded expansions for comprehensive (error handling, states, a11y, etc.)
  - 4 constraints even for comprehensive (use existing, don't add unrelated)
  - Clarification question for ambiguous cases
- [ ] Test 2: Anti-over-engineering alignment verification
  - intro.md: "surgical implementation...Nothing more, nothing less"
  - critical-reminders: "minimal and necessary changes ONLY"
  - metadata.yaml: "surgical execution"
  - output-format: "Scope Control" with "Did NOT add" section
  - examples: "tempting but out of scope" demonstration
- [ ] Test 3: FINAL SIGN-OFF - Implementation scope comprehensive
  - Balances flexibility with anti-over-engineering
  - Clear indicators for when to expand
  - Constraints prevent scope creep even in comprehensive mode

---

## Test: Specification Reading Guidance

- [ ] Test 1: Structure audit - 7 extraction points + 4 red flags + gate
  - Extraction points: Goal, Context, Patterns, Requirements, Constraints, Criteria, Notes
  - Red flags: files unknown, patterns unread, criteria unclear, guessing conventions
  - Gate: "ask for clarification before starting"
- [ ] Test 2: Cross-reference verification - 8+ references across files
  - intro.md: job definition includes spec reading
  - critical-reminders: 3 MUST rules reference specification
  - metadata.yaml: description mentions "from detailed specs"
  - output-format.md: template has "[From specification]"
  - examples.md: shows "not in spec" scope control
- [ ] Test 3: FINAL SIGN-OFF - Spec reading guidance comprehensive
  - XML tag `<spec_reading>` structures extraction
  - Red flags catch incomplete understanding
  - MUST rules enforce spec reading requirement

---

## Test: Extended Reasoning Guidance

- [ ] Test 1: Structure audit - 5 phrases across 2 complexity tiers
  - Complex: "consider carefully", "analyze intensely", "evaluate comprehensively"
  - Moderate: "consider thoroughly", "analyze deeply"
  - 4 specific usage triggers (architecture, patterns, approaches, edge cases)
  - Efficiency note: save capacity for actual complexity
- [ ] Test 2: "Think" alternatives verification
  - 0 instances of "think" in all agent files
  - All phrases use approved verbs: consider, analyze, evaluate
- [ ] Test 3: FINAL SIGN-OFF - Extended reasoning properly documented
  - Tiered complexity guidance
  - Specific triggers for extended analysis
  - Efficiency-conscious approach

---

## Test: Agent Integration Documentation

- [ ] Test 1: Integration sections audit - 8 comprehensive sections
  - Tester Agent: test-first workflow with 4 points
  - Frontend-Reviewer: post-implementation review workflow
  - Specialist Agents: generic integration guidance
  - Coordination: independence, file-based handoffs
  - Ask PM/Architect: 5 specific escalation scenarios
  - Ask Specialists: 4 domain-specific scenarios
  - Don't ask if: 4 self-resolution scenarios
  - When in doubt: investigate-first guidance
- [ ] Test 2: Cross-reference verification - 6 agents referenced consistently
  - metadata.yaml references upstream agent for orchestration
  - domain_scope references related agents
  - Integration section references: Tester Agent, Reviewer
  - output-format has "For Reviewer" notes section
- [ ] Test 3: FINAL SIGN-OFF - Integration documentation complete
  - Domain deferrals align with integration guidance
  - Help-seeking clarifies when to escalate vs self-resolve
  - File-based handoffs explicitly documented

---

## Test: Common Mistakes Documentation Quality

- [ ] Test 1: Structure audit - 7/7 mistakes with ❌/✅ contrast
  - Each mistake has: numbered title, bad example, good example
  - Introduction explains consequence: "wastes time and requires rework"
  - Good examples show specific actions (file names, percentages, checklists)
- [ ] Test 2: Coverage verification - Aligns with self-correction triggers
  - Mistake 1 ↔ STOP trigger for "generating without reading"
  - Mistake 2 ↔ STOP trigger for "adding unrequested features"
  - Mistake 3 ↔ STOP trigger for "creating new utilities"
  - Mistake 4 ↔ STOP trigger for "modifying out of scope"
  - Mistake 7 ↔ STOP trigger for "proceeding without verification"
  - output-format.md includes "Unrequested feature avoided" in notes
- [ ] Test 3: FINAL SIGN-OFF - Comprehensive mistake documentation
  - 7 mistakes cover all major failure modes
  - Contrast format teaches correct behavior
  - Cross-references reinforce across workflow sections

---

## Test: XML Semantic Tags Usage

- [ ] Test 1: Tag inventory audit - 25 semantic XML tags
  - workflow.md: 10 tags (mandatory_investigation, retrieval_strategy, etc.)
  - output-format.md: 8 tags (output_format wrapper + 7 sections)
  - examples.md: 7 tags (same 7 sections as output-format)
  - All use snake_case naming convention
- [ ] Test 2: Closure verification - ALL tags properly closed
  - 10/10 workflow tags: open/close pairs verified
  - 8/8 output-format tags: open/close pairs verified
  - 7/7 examples tags: open/close pairs verified
  - Proper nesting (retrieval_strategy inside mandatory_investigation)
- [ ] Test 3: FINAL SIGN-OFF - XML tags follow all conventions
  - Tags inside code blocks with xml hint
  - snake_case naming throughout
  - Context isolation achieved per prompt-bible

---

## Test: Emphatic Repetition Quality

- [ ] Test 1: Rule comparison audit - 7/7 rules IDENTICAL
  - critical-requirements.md: 7 MUST rules
  - critical-reminders.md: 7 MUST rules + consequence statement
  - Line-by-line comparison: 100% match
- [ ] Test 2: Placement verification via agent.liquid template
  - critical_requirements: Lines 41-48 (TOP, after core_principles)
  - critical_reminders: Lines 130-137 (BOTTOM, before final reminder)
  - Template enforces TOP/BOTTOM placement for all agents
- [ ] Test 3: FINAL SIGN-OFF - Multiple emphatic repetition layers
  - 7 MUST rules: 2 appearances (TOP + BOTTOM)
  - Core principles display: 2 appearances (line 36 + 138)
  - Write verification: 3 appearances (critical files + line 140)
  - Pattern achieves 40-50% compliance improvement per prompt-bible

---

## Test: Just-In-Time Loading Compliance

- [ ] Test 1: Structure audit - ALL required elements present
  - XML tag: `<retrieval_strategy>` nested in mandatory_investigation
  - Principle: "just-in-time loading instead of reading every file"
  - 3-step process: discovery → strategic loading → context preservation
  - Token awareness: "Each file you read consumes tokens"
- [ ] Test 2: Tool usage guidance verification
  - Glob example: `Glob("**/*.tsx")` with purpose
  - Grep example: `Grep("importantPattern", type="ts")` with purpose
  - Self-correction trigger references Grep, Glob for searching
- [ ] Test 3: FINAL SIGN-OFF - Just-in-time loading properly implemented
  - metadata.yaml tools (Read, Grep, Glob) align with retrieval_strategy
  - Priority order: spec files → integration points → additional context
  - Purpose clear: preserve context window for implementation

---

## Test: Progress Tracking Compliance

- [ ] Test 1: Structure audit - ALL required elements present
  - XML tag: `<progress_tracking>` with 4 tracking categories
  - Categories: investigation findings, implementation progress, blockers, verification status
  - Each category has 3 specific items to track
  - Purpose: "maintains orientation across extended implementation sessions"
- [ ] Test 2: Integration verification
  - Investigation: reads progress.md for current state
  - Planning: estimates complexity level
  - complexity_protocol: updates progress.md after subtasks
  - Extended reasoning: tiered by complexity
- [ ] Test 3: FINAL SIGN-OFF - Progress tracking comprehensively implemented
  - complexity_protocol explicitly updates progress.md + decisions.md
  - 4-step complexity handling with documentation requirements
  - Gate: "Don't power through complexity—break it down"

---

## Test: Write Verification Compliance

- [ ] Test 1: Enforcement point audit - 6 touchpoints
  - critical-requirements.md: MUST rule "re-read files after editing"
  - critical-reminders.md: emphatic repetition
  - workflow.md: Step 5: Verification with ✅/❌
  - workflow.md: Common mistake #7 "Vague Success Verification"
  - output-format.md: `<verification>` always required
  - examples.md: complete verification demonstration
- [ ] Test 2: Rule quality verification
  - Rule 7: MUST + action + purpose + gate ("never report success without verification")
  - Rule 5: MUST + test action + gate ("never claim success without test verification")
  - Both follow complete pattern: directive + action + gate condition
- [ ] Test 3: FINAL SIGN-OFF - Write verification comprehensively enforced
  - Common mistake #7 shows ❌/✅ contrast for vague vs specific verification
  - Example verification section has evidence column and quality checklists
  - Gate conditions prevent premature success claims

---

## Test: Post-Action Reflection Compliance

- [ ] Test 1: Structure audit - ALL required elements present
  - XML tag: `<post_action_reflection>` properly nested in workflow
  - Timing: "After Completing Each Major Step"
  - Action: "Pause and evaluate"
  - 3 evaluation questions with phase-specific sub-questions
  - Gate condition: "Only proceed when confident"
- [ ] Test 2: Integration verification - Properly connected to workflow
  - Reflection positioned between 5-step workflow elements
  - Connects to Step 5: Verification (formal verification follows)
  - Self-correction trigger catches skipped verification
  - Progress tracking records verification status
  - Final reminder reinforces "Always verify assumptions"
- [ ] Test 3: FINAL SIGN-OFF - Reflection comprehensively implemented
  - Example verification section shows reflection output (criteria table + evidence)
  - Quality checklists demonstrate systematic evaluation
  - N/A markings show thoughtful applicability assessment

---

## Test: Investigation-First Compliance

- [ ] Test 1: Enforcement point audit - 9+ touchpoints across all 6 files
  - intro.md: job definition includes "read spec, examine patterns"
  - critical-requirements.md: two MUST rules for reading first
  - critical-reminders.md: emphatic repetition of same rules
  - workflow.md: mandatory_investigation with 5 steps + retrieval_strategy
  - workflow.md: self-correction trigger for "generating without reading"
  - workflow.md: common mistake #1 is "Implementing Without Investigation"
  - output-format.md: `<investigation>` section "Always required"
  - examples.md: complete demonstration with file:line refs
- [ ] Test 2: Self-correction trigger quality verification - 6/6 COMPLIANT
  - All triggers have: specific behavior + STOP + specific corrective action
  - Investigation trigger: "Generating code without reading" → "Read all referenced files"
  - No vague or generic triggers
- [ ] Test 3: FINAL SIGN-OFF - Investigation-first 100% enforced
  - Example demonstrates 3 files examined, 3 patterns with refs, 2 reuse items
  - output-format.md shows exact template structure
  - Self-correction catches violations before they compound

---

## Test: Verbosity and Context Constraint Compliance

- [ ] Test 1: Full verbosity audit across all 6 agent files
  - intro.md: 6 lines, ~60 words, 100% useful - GRADE A
  - critical-requirements/reminders: Maximum density, all actionable - GRADE A
  - workflow.md: 462 lines - Check for time estimates violations
  - output-format.md: 214 lines, high density - GRADE A
  - examples.md: 273 lines, appropriate length for example - GRADE A
- [ ] Test 2: Detailed filler word and redundancy analysis - ALL PASS
  - Filler words ("just/actually/really/very"): 3 uses max, all valid context
  - Verbose phrases ("in order to", "make sure"): 0 instances
  - Passive voice: 1 instance max (acceptable question format)
  - Active/imperative voice: ~99% of all instructions
- [ ] Test 3: FINAL SIGN-OFF - Verbosity compliance verified
  - 0 unnecessary filler words
  - 0 verbose phrase patterns
  - No time estimate violations
  - Overall context efficiency: EXCELLENT

---

## Test: prompt-bible Essential Techniques Compliance

- [ ] Test 1: Audit all 13 Essential Techniques
  - Positive framing in critical-requirements.md (use "modify only" not "do not modify")
  - Explicit write verification rule in critical-requirements/reminders
  - Extended reasoning uses "analysis" not "reasoning" or "think"
- [ ] Test 2: Verify all techniques applied correctly
  - Check each technique against agent files
  - Document any gaps
- [ ] Test 3: FINAL SIGN-OFF - 100% prompt-bible compliance verified with comprehensive audit

---

## Test: Canonical Agent Structure Compliance

- [ ] Test 1: Audit directory structure, required files, config, source content rules
  - All 7 required files present with correct content
  - No XML wrapper tags in wrong places
  - Semantic XML tags properly used in workflow.md
  - Config entry present with skill mappings
- [ ] Test 2: Verify template integration
  - metadata.yaml metadata correct
  - intro.md compatibility
  - workflow.md XML sections
  - critical files match (7/7 rules)
  - output-format completeness
- [ ] Test 3: FINAL COMPILATION VERIFICATION
  - Template assembly order verified
  - NO double-wrap risks
  - XML nesting valid
  - Final reminder lines present
  - APPROVED FOR COMPILATION

---

## Test: Domain Scope and Agent Boundaries

- [ ] Test 1: Audit domain scope against 5 related agents
  - Clean separation from related agents (e.g., api-developer, web-reviewer, web-tester, web-pm)
  - Clarify overlapping responsibilities with explicit deferrals
  - Add deferrals for activities that belong to other agents
- [ ] Test 2: Verify all fixes applied
  - 7 deferrals present
  - Boundary clarity achieved for orchestrator decisions
- [ ] Test 3: FINAL SIGN-OFF
  - 6/6 handles verified
  - 7/7 deferrals correct
  - 3/3 integrations documented
  - 7/7 scenarios correctly assigned

---

## Test: Output Format and Examples Quality

- [ ] Test 1: Audit output-format.md and examples.md for structure match
  - output-format.md: Check XML tags structure
  - examples.md: Must use SAME XML tags as output-format
  - Fix any structure mismatches
- [ ] Test 2: Verify examples.md completeness AND conciseness
  - 7/7 sections present
  - 4/4 code blocks minimum
  - 3/3 tables minimum
  - 5/5 checklists minimum
  - **CONCISENESS REQUIREMENTS:**
  - Total file length: 60-100 lines (compact, not exhaustive)
  - NO N/A checkboxes - only show relevant items
  - NO verbose "Design Notes:" sections after code blocks
  - NO meta-commentary explaining what the example demonstrates
  - Keep file:line references concise (e.g., "File.tsx:45-89")
  - Compact verification section (checklist only, no explanatory text)
- [ ] Test 3: FINAL SIGN-OFF
  - 100% format-example alignment
  - File length within 60-100 lines
  - Example teaches correct patterns without verbosity

---

## Test: Tonality and Style Compliance

- [ ] Test 1: Full tonality audit - 7/7 categories PASS
  - Sentence length: avg 6.5 words (target 12-15), no sentences >25 words
  - Imperative mood: 100% compliant, 0 "you should" patterns
  - Hedging language: 0 instances
  - Motivational fluff: 0 instances
  - Specificity: 8+ file references, 0 vague references
  - Positive framing: 5:1 positive-to-negative ratio
  - "Think" alternatives: 0 "think" usage, uses consider/analyze/evaluate
- [ ] Test 2: Detailed line-by-line audit of 4 sections
  - mandatory_investigation: 93.5% imperative, avg 4.9 words
  - self_correction_triggers: 6/6 use STOP pattern with specific actions
  - domain_scope: 6 positive handles, 7 specific deferrals
  - Extended Reasoning Guidance: 0 "think", 10 approved alternatives
- [ ] Test 3: FINAL SIGN-OFF
  - Cross-file consistency 100%
  - 0 anti-patterns
  - 23+ file refs
  - 15+ line refs
  - GRADE A

---

## Test: Anti-Over-Engineering Compliance

- [ ] Test 1: Full anti-over-engineering audit
  - Minimal changes is #1 critical rule in both critical files
  - 6/6 self-correction triggers target scope creep (adding unrequested features, modifying out-of-scope files)
  - 7/7 common mistakes documented with ❌/✅ examples
  - Example has explicit "Scope Control" section showing what was NOT added
  - Template enforces via Core Principles 3 (Minimal Changes) and 4 (Anti-Over-Engineering)
  - Failure consequence documented: "over-engineered, inconsistent code"
- [ ] Test 2: Detailed scope control verification
  - 13 explicit prohibitions (7 direct "don't/NOT", 6 "STOP" triggers)
  - 6/6 self-correction triggers have specific behaviors AND specific actions
  - Implementation scope: Default surgical + bounded expansion even for comprehensive mode
  - Complexity protocol: Decomposition guidance + "don't power through" + help-seeking
- [ ] Test 3: FINAL SIGN-OFF - Example demonstrates ALL anti-over-engineering principles
  - Investigation before implementation with file:line citations
  - 6 pattern references with sources, 2 code reuse instances with justification
  - Explicit scope control section (added vs NOT added with reasons)
  - Minimal changes: 5 files, +85/-0 lines, 0 new deps, 0 breaking changes

---

## Running These Tests

### Manual Execution

For each agent, run through the tests checking off items as you verify them.

### Automated Execution (Future)

Create an `agent-compliance-tester` agent that:

1. Takes an agent directory path as input
2. Runs all 30 tests programmatically
3. Reports pass/fail with specific failures
4. Suggests fixes for failures

### Periodic Schedule

Recommended: Run compliance tests:

- After any agent modification
- Before merging agent changes
- Monthly audit of all agents

---

## Quick Reference: Pass Criteria Summary

| Area                  | Key Metric                                     |
| --------------------- | ---------------------------------------------- |
| Files                 | 7/7 required files present                     |
| MUST Rules            | 7 rules in requirements = 7 rules in reminders |
| Self-Correction       | 6+ triggers with STOP + action                 |
| Common Mistakes       | 7+ with ❌/✅ contrast                         |
| XML Tags              | All properly closed, snake_case                |
| Investigation         | 9+ enforcement touchpoints                     |
| Anti-Over-Engineering | 13+ prohibitions                               |
| Tonality              | 0 "think", 0 hedging, 100% imperative          |
| Examples              | 60-100 lines, no N/A items, no meta-commentary |
