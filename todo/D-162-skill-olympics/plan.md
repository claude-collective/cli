# D-162: Skill Olympics — Benchmark and Optimize Expressive TypeScript Skill

Competitive benchmarking arena to find the optimal prompt for the `meta-design-expressive-typescript` skill. Harvest clean-code prompts from across the internet, pit them against real codebase anti-patterns, score the results, and Frankenstein the best parts into a superior skill.

**Catalog:** [test-catalog.md](./test-catalog.md) — 120 examples across 10 categories, 20 rated test cases, 10-axis scoring rubric.

---

## Phases

### Phase 1: Harvest contestants (DONE)

Collected 10 clean-code / refactoring prompts from diverse sources. See [Contestants](#contestants) below.

### Phase 2: Extract 5 test cases

Pull code from git refs as standalone files with:

- The original source code
- Required imports/types for context
- Anti-pattern description and baseline scores
- Constraints doc: available libraries (Remeda, etc.), file-boundary scope, no external lookups

### Phase 3: Arena runs

For each contestant × test case (10 × 5 = 50 runs):

- Sub-agent gets: contestant prompt + test case code + constraints
- Opus 4.6 for all runs (model consistency)
- Output: `arena/{contestant}/{test-case-id}/refactored.ts`
- Prompt isolation: no CLAUDE.md, no project context — just the skill and the code

### Phase 4: Scoring

LLM-as-judge on all 10 axes (first round):

- Score each refactored output on 10-axis rubric (GOD, SOC, IMP, DUP, FBF, MIX, NST, SFX, PRM, TST)
- Compute delta from baseline scores
- Rank contestants by total delta across all test cases
- Optional later: ts-morph automated scoring for mechanical axes

### Phase 5: Frankenstein

Analyze top 5 performers:

- Section ordering, language/framing, inclusions vs. omissions, length, example quality
- Build 3-5 hybrid skills from best components
- Re-run through arena, score again

### Phase 6: Crown winner

Replace current skill with the champion.

---

## Tooling Decision

**No Promptfoo.** Its strengths (caching, parallel execution, comparison UI) pay off at scale (100+ contestants × 20 test cases), not at proof-of-concept size (10 × 5 = 50 runs). Plain sub-agents writing to `arena/` directories give us more control over artifact collection and multi-axis scoring. Revisit if we scale past proof of concept.

---

## Contestant Registry

All discovered clean-code / refactoring prompts, skills, rules, agents, and reference docs. For Phase 1 proof of concept we pick 10 from this list. The rest are available for Phase 5 Frankenstein.

### Claude Skills & Agents

1. **Incumbent** — Our own `meta-design-expressive-typescript` skill. Two-tier orchestrator pattern, named abstractions, extraction decision framework, guard clauses
2. [Anthropic code-simplifier](https://github.com/anthropics/claude-code/blob/main/plugins/pr-review-toolkit/agents/code-simplifier.md) — Anthropic's own internal agent used on their codebase. Clarity over brevity, no nested ternaries, avoid over-simplification. Also [Sentry's fork](https://github.com/getsentry/skills/blob/main/plugins/sentry-skills/skills/code-simplifier/SKILL.md)
3. [citypaul refactoring SKILL.md](https://github.com/citypaul/.dotfiles/blob/main/claude/.claude/skills/refactoring/SKILL.md) — TDD-phase-aware: only refactor after mutation testing. Priority classification (Critical/High/Nice/Skip). Anti-speculative code
4. [Code Refactor Master](https://github.com/diet103/claude-code-infrastructure-showcase/blob/main/.claude/agents/code-refactor-master.md) — Opus-model agent. Discovery/planning/execution/verification phases. 300-line cap, 5-level nesting max
5. [affaan-m refactor-cleaner agent](https://github.com/affaan-m/everything-claude-code/blob/main/agents/refactor-cleaner.md) — Tool-driven: knip/depcheck/ts-prune detection. Risk-categorized removal (SAFE/CAREFUL/RISKY)
6. [VoltAgent refactoring-specialist](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/06-developer-experience/refactoring-specialist.md) — Fowler-catalog-heavy, code-smell taxonomy (long methods, feature envy, shotgun surgery, data clumps, primitive obsession)
7. [VoltAgent typescript-pro](https://github.com/VoltAgent/awesome-claude-code-subagents/blob/main/categories/02-language-specialists/typescript-pro.md) — Type-system mastery: conditional types, mapped types, branded types, type predicates, full-stack type safety
8. [VoltAgent code-reviewer](https://github.com/VoltAgent/awesome-claude-code-subagents/tree/main/categories/04-quality-security) — Code quality guardian, thorough review focus
9. [WomenDefiningAI code-refactoring](https://github.com/WomenDefiningAI/claude-code-skills/tree/main/skills/code-refactoring) — File-size-monitoring with progressive alerts (150/200/300 line thresholds), path-based thresholds
10. [ratacat clean-code skill](https://agentskills.so/skills/ratacat-claude-skills-clean-code) — Uncle Bob's Clean Code as a skill. Intention-revealing names, Boy Scout Rule, SRP, SOLID, F.I.R.S.T. test principles
11. [wondelai clean-code skill](https://agentskills.so/skills/wondelai-skills-clean-code) — Readable, maintainable code through disciplined naming, small functions, clean error handling, SRP, comment discipline
12. [wondelai refactoring-patterns skill](https://github.com/wondelai/skills) — Named refactoring transformations from Fowler's 2nd edition. Smell-driven, test-guarded, safe transformations
13. [danielsimonjr refactoring skill](https://lobehub.com/skills/danielsimonjr-claude-skills-refactoring-skill) — Surgical high-impact refactoring. Quick-reference patterns + real-world transformation examples
14. [ertugrul-dmr clean-code-skills](https://github.com/ertugrul-dmr/clean-code-skills) — Robert C. Martin rules as modular skills. Boy Scout orchestrator coordinating clean-functions, clean-names, clean-tests, clean-comments, clean-general
15. [l-mb python-refactoring-skills](https://github.com/l-mb/python-refactoring-skills) — "Deterministic validation over probabilistic generation." 8 modular skills using AST-based tooling as quality gates
16. [Jeffallan typescript-pro skill](https://github.com/Jeffallan/claude-skills/blob/main/skills/language/typescript-pro/) — TS 5.0+, generics, conditional types, mapped types, discriminated unions, branded types, satisfies operator
17. [SpillwaveSolutions mastering-typescript](https://github.com/SpillwaveSolutions/mastering-typescript-skill) — Enterprise TS 5.9+: type system mastery, enterprise patterns, Zod validation, React/NestJS integration, Vite 7/ESLint 9
18. [thechandanbhagat code-review skill](https://github.com/thechandanbhagat/claude-skills/blob/main/skills/code-review/SKILL.md) — Automated code review: cyclomatic complexity, SOLID violations, code smells, security checks, grep-based anti-pattern detection
19. [alirezarezvani refactor-expert agent](https://github.com/alirezarezvani/claude-code-tresor) — Part of Tresor suite: code-reviewer + refactor-expert + architect + debugger + performance-tuner agents
20. [honnibal mutation-testing skill](https://github.com/honnibal/claude-skills) — Fragile-area detection (implicit ordering, shared mutable state, stringly-typed contracts), mutation catalog
21. [levnikolaevich codebase-audit skills](https://github.com/levnikolaevich/claude-code-skills) — Orchestrator-Worker architecture. 5 audit groups: code health (DRY/KISS/YAGNI, complexity, dead code), architecture, testing, docs, persistence

### Claude Commands & Workflows

22. [rohitg00 simplify command](https://github.com/rohitg00/awesome-claude-code-toolkit/blob/main/commands/refactoring/simplify.md) — 6-step: reduce nesting, extract functions, improve naming, remove duplication, simplify conditionals, verify
23. [rohitg00 cleanup command](https://github.com/rohitg00/awesome-claude-code-toolkit/blob/main/commands/refactoring/cleanup.md) — Complementary cleanup workflow
24. [qdhenry refactor-code command](https://github.com/qdhenry/Claude-Command-Suite) — 17-step systematic: pre-analysis, test verification, strategy, incremental refactoring, design patterns, static analysis, performance verification
25. [SilenNaihin refactor command](https://gist.github.com/SilenNaihin/cd321a0ada16963867ad8984f44922cf) — 7-step: detect (jscpd/knip), categorize (SAFE/CAUTION/DANGER), delete with test verification, consolidate, invoke code-simplifier, commit
26. [affaan-m refactor-clean command](https://github.com/affaan-m/everything-claude-code/blob/main/commands/refactor-clean.md) — Language-polyglot dead code detection (knip/depcheck/ts-prune/vulture/deadcode/cargo-udeps), 3-tier safety
27. [qdhenry remove-dead-code command](https://github.com/qdhenry/Claude-Command-Suite) — Multi-agent dead code scanning with validation
28. [qdhenry cleanup-vibes command](https://github.com/qdhenry/Claude-Command-Suite) — "Transform vibecoded projects into structured codebases"
29. [wshobson refactor-clean command](https://github.com/wshobson/commands) — Production-ready slash commands collection

### Cursor Rules

30. [PatrickJS JS/TS Code Quality Pro](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/javascript-typescript-code-quality-cursorrules-pro/.cursorrules) — "Less code is better. Lines of code = debt." Early returns, functional/immutable style, minimal changes
31. [Alberto Basalo Clean NestJS/TS](https://cursor.directory/nestjs-clean-typescript-cursor-rules) — RO-RO pattern, <20 instructions/function, SOLID, composition over inheritance, single abstraction level
32. [Steve Kinney TS Rules](https://stevekinney.com/writing/cursor-rules-typescript) — Strict mode, Zod at parse boundaries, discriminated unions, branded types, no `any` ever
33. [PatrickJS typescript-react](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/typescript-react-cursorrules-prompt-file/.cursorrules) — TypeScript + React conventions
34. [PatrickJS typescript-code-convention](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/typescript-code-convention-cursorrules-prompt-file/.cursorrules) — TS code conventions
35. [PatrickJS typescript-nestjs-best-practices](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/typescript-nestjs-best-practices-cursorrules-promp/.cursorrules) — NestJS + TS best practices
36. [PatrickJS code-style-consistency](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/code-style-consistency-cursorrules-prompt-file/.cursorrules) — Code style consistency rules
37. [PatrickJS code-guidelines](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/code-guidelines-cursorrules-prompt-file/.cursorrules) — General code guidelines
38. [PatrickJS github-code-quality](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/github-code-quality-cursorrules-prompt-file/.cursorrules) — GitHub-focused code quality
39. [PatrickJS optimize-dry-solid](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/optimize-dry-solid-principles-cursorrules-prompt-f/.cursorrules) — DRY + SOLID optimization rules
40. [PatrickJS typescript-llm-tech-stack](https://github.com/PatrickJS/awesome-cursorrules/blob/main/rules/typescript-llm-tech-stack-cursorrules-prompt-file/.cursorrules) — TS + LLM tech stack rules
41. [Lb. Madesia Clean NestJS/TS](https://cursor.directory/clean-nestjs-typescript-cursor-rules) — Alternative NestJS clean TS rules
42. [Next.js React TS rules](https://cursor.directory/nextjs-react-typescript-cursor-rules) — Next.js + React + TS conventions
43. [Optimized Next.js TS Best Practices](https://cursor.directory/optimized-nextjs-typescript-best-practices-modern-ui-ux) — Modern UI/UX optimized TS
44. [TS Development Guidelines](https://cursor.directory/typescript-development-guidelines-shortcuts) — TS development guidelines
45. [Front End Cursor Rules](https://cursor.directory/front-end-cursor-rules) — Frontend-specific rules
46. [blefnk awesome-cursor-rules](https://github.com/blefnk/awesome-cursor-rules) — Next.js 15 / React 19 / TS 5 / Tailwind 4 optimized rules
47. [chand1012 personal cursorrules](https://github.com/chand1012/cursorrules) — Personal LLM rules with generation methodology
48. [mdsahil321 cursor-rules](https://github.com/mdsahil321/cursor-rules) — LessUp's coding standards for Cursor (Python, Java, TS, and more)
49. [Cursor Directory TypeScript collection](https://cursor.directory/plugins/typescript) — Community-curated TS rules collection

### ChatGPT / System Prompts

50. [RefactorGPT](https://github.com/craftvscruft/chatgpt-refactoring-prompts) — Letter-grade + smell detection, suggest refactoring steps without showing code. Read-by-refactoring
51. [The Great Sages](https://github.com/craftvscruft/chatgpt-refactoring-prompts) — Fowler/Feathers/Beck/GeePaw Hill/Chelsea Troy advice with contrasting viewpoints
52. [PromptsEra Staff Engineer Mega](https://promptsera.com/ai-code-refactoring-prompt/) — Persona + chain-of-thought (cyclomatic complexity analysis before code). Constraint engineering
53. [jamesponddotco TS coding prompt](https://github.com/jamesponddotco/llm-prompts/blob/trunk/data/coding-in-typescript.md) — PhD persona, Airbnb style guide, scratchpad thinking, DRY, comments describe purpose not effect
54. [Repository Refactoring Agent](https://imrecsige.dev/snippets/llm-prompt-for-refactoring-your-codebase-using-best-practices/) — Full repo-scale: inventory → findings table → 3-phase plan → diffs → test plan → risk/rollback. Guardrails: maintain APIs, incremental diffs, conventional commits
55. [Addyo Prompt Engineering Playbook](https://addyo.substack.com/p/the-prompt-engineering-playbook-for) — Practical prompt patterns: state refactoring goals explicitly, define "better", frame with constraints
56. [Taskade Code Refactoring Prompt](https://www.taskade.com/prompts/engineering/code-refactoring-prompt) — Structured refactoring prompt template

### Reference Docs (usable as prompts)

57. [labs42io clean-code-typescript](https://github.com/labs42io/clean-code-typescript/blob/main/README.md) — Uncle Bob for TS. Functions: one thing, one abstraction level, <3 args, favor functional over imperative
58. [ryanmcdermott clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) — 44k stars. Uncle Bob for JS. Same principles, JS-native examples. SOLID for JS
59. [Angular official LLM instructions](https://angular.dev/ai/develop-with-ai) — Angular team prompt. Signals for state, computed() for derived, pure transformations, single responsibility
60. [Vercel react-best-practices AGENTS.md](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md) — Official Vercel. Eliminating waterfalls, bundle optimization, re-render optimization, 40+ rules with impact metrics
61. [antfu skills](https://github.com/antfu/skills) — Anthony Fu's conventions: single responsibility files, split large files, type separation, explicit returns, self-explanatory code

### Official Framework / Vendor Prompts

62. [Angular LLM prompts](https://angular.dev/ai/develop-with-ai) — Official Angular. Standalone components, signals, computed(), OnPush, inject() over constructor
63. [Vercel Next.js LLM prompts](https://github.com/vercel/next.js/discussions/81291) — Next.js AI discussion on LLM prompt conventions
64. [Microsoft skills](https://github.com/microsoft/skills) — Microsoft's AGENTS.md for Azure SDKs. Code examples over paragraphs, include versions
65. [GitHub awesome-copilot](https://github.com/github/awesome-copilot) — Community copilot instructions, agents, skills. Coding standards by file pattern

### LobeHub / Marketplace Skills

66. [LobeHub clean-code](https://lobehub.com/skills/aiskillstore-marketplace-clean-code) — TypeScript-first functional patterns: explicit typing, immutable data, pure functions, discriminated unions, Either/Result error handling
67. [LobeHub Refactoring Rules](https://lobehub.com/skills/iceflower-opencode-agents-and-skills-refactoring) — Behavior preservation, small steps, test accompaniment, separation of concerns, code-smell catalog
68. [LobeHub TypeScript Best Practices](https://lobehub.com/skills/jwynia-agent-skills-typescript-best-practices) — Result/Either types, immutability conventions, architecture guidance
69. [LobeHub code-refactoring](https://lobehub.com/skills/ngxtm-devkit-code-refactoring) — Code smells with before/after transformations, test-driven refactoring
70. [LobeHub Effect-TS](https://agentskills.so/skills/teeverc-effect-ts-skills-effect-ts) — Effect-TS typed error modeling, Context/Layer wiring, resource lifecycles

### Antigravity / Large Collections

71. [sickn33 code-refactoring-refactor-clean](https://github.com/sickn33/antigravity-awesome-skills/tree/main/skills/code-refactoring-refactor-clean) — Clean code principles, SOLID patterns, practical improvements without over-engineering
72. [sickn33 codebase-cleanup-refactor-clean](https://tessl.io/registry/skills/github/sickn33/antigravity-awesome-skills/codebase-cleanup-refactor-clean) — High-impact refactor candidates, testable steps

### Universal Rule Generators

73. [botingw/rulebook-ai](https://github.com/botingw/rulebook-ai) — Universal rule generator for Cursor/Claude/Codex/Copilot/Roo — light/medium/heavy spec packs
74. [mgechev skills-best-practices](https://github.com/mgechev/skills-best-practices) — Meta: how to write professional-grade skills. Direct commands, specific terminology, lean context. Complements [skillgrade](https://github.com/mgechev/skillgrade) for validation

### Research Papers

75. [Arxiv: Refactoring with LLMs (2510.03914)](https://arxiv.org/abs/2510.03914) — 5 instruction strategies × Fowler's 61 refactoring types. Step-by-Step (procedural Fowler guidance) = 100% DeepSeek / 83.6% GPT. Rule-based best for specific scenarios. Objective/zero-shot worst
76. [Arxiv: Code Refactoring with LLM — Few-Shot (2511.21788)](https://arxiv.org/abs/2511.21788) — Comprehensive evaluation of few-shot settings for LLM refactoring across multiple languages
77. [Arxiv: Agentic Refactoring Empirical Study (2511.04824)](https://arxiv.org/html/2511.04824v1) — AI agents underrepresent high-level refactoring vs humans (43% vs 55%). Low-level operations dominate
78. [Vanderbilt Prompt Patterns for Code Quality](https://www.dre.vanderbilt.edu/~schmidt/PDF/prompt-patterns-book-chapter.pdf) — Academic prompt patterns for improving code quality, refactoring, and requirements

### Windsurf Rules

79. [muratkeremozcan Windsurf global rules](https://gist.github.com/muratkeremozcan/2fa569c9ba5a2a6459217aa01e42bcef) — Functional/declarative, avoid classes, descriptive names (isLoading, hasError), immutability
80. [balqaasem awesome-windsurfrules](https://github.com/balqaasem/awesome-windsurfrules) — Curated .windsurfrules collection
81. [mberman84 Windsurf Rules](https://gist.github.com/mberman84/19e184e3a3a4c3a20f32a18af51ce3bc) — Windsurf coding rules
82. [kinopeee windsurf-antigravity-rules](https://github.com/kinopeee/windsurf-antigravity-rules) — Windsurf + Antigravity rule integration
83. [Windsurf Rules Directory](https://windsurf.com/editor/directory) — Official Windsurf rules directory

### Roo Code / Cline Rules

84. [Roo Code AI Coding Rules](https://aicodingrules.com/rules/roo-code) — 11 AI coding rules for Roo Code
85. [AICodingrules.com collection](https://aicodingrules.com/) — 7000+ rules for Cursor, Claude, Windsurf, Copilot, Cline, Aider — copy-paste ready for Python, TS, React, Go, Rust

### Copilot Custom Instructions

86. [GitHub Copilot custom instructions docs](https://copilot-instructions.md/) — .github/copilot-instructions.md format: functions <50 lines, descriptive naming, proper error handling, dead code removal
87. [GitHub Copilot code review instructions](https://docs.github.com/en/copilot/tutorials/use-custom-instructions) — Custom instructions for Copilot code review

### Codex / OpenCode

88. [OpenAI Codex AGENTS.md](https://github.com/openai/codex/blob/main/AGENTS.md) — Official Codex agent configuration. Resist bloating core, refactor before adding
89. [remcocats opencode-agents](https://github.com/remcocats/opencode-agents) — OpenCode configurations, prompts, and agents
90. [darrenhinde OpenAgentsControl](https://github.com/darrenhinde/OpenAgentsControl) — Plan-first development with automatic testing, code review, and validation

### Aider

91. [Aider conventions](https://aider.chat/docs/) — CONVENTIONS.md for coding conventions. Strongest at legacy code refactoring per user reports. Maintains a refactoring leaderboard

### Devin AI

92. [Devin system prompt](https://github.com/EliFuzz/awesome-system-prompts/blob/main/leaks/devin/archived/2025-08-09_prompt_system.md) — Mimic existing conventions, verify libraries before use, examine surrounding context before editing

### System Prompt Collections

93. [EliFuzz awesome-system-prompts](https://github.com/EliFuzz/awesome-system-prompts) — System prompts from Augment Code, Claude Code, Cursor, Devin, Kiro, Perplexity, VSCode Agent, Gemini, Codex, OpenAI
94. [x1xhlol system-prompts-and-models](https://github.com/x1xhlol/system-prompts-and-models-of-ai-tools) — Full system prompts from 30+ AI tools
95. [0xeb TheBigPromptLibrary](https://github.com/0xeb/TheBigPromptLibrary) — Collection of system prompts and LLM instructions

### Misc Skills & Tools

96. [recca0120 skills-refactor](https://github.com/recca0120/skills-refactor) — Skills for analyzing, refactoring, and validating skills themselves. Lint checks, duplicate detection, shared module extraction
97. [mhattingpete claude-skills-marketplace](https://github.com/mhattingpete/claude-skills-marketplace) — Git automation, testing, and code review skills
98. [CloudAI-X claude-workflow-v2](https://github.com/CloudAI-X/claude-workflow-v2) — Universal workflow plugin with agents, skills, hooks, commands
99. [shanraisshan claude-code-best-practice](https://github.com/shanraisshan/claude-code-best-practice) — "Practice made Claude perfect" — best practices collection
100. [rosmur claudecode-best-practices](https://rosmur.github.io/claudecode-best-practices/) — Claude Code best practices guide

---

## Top 10 Prediction

My picks for the proof-of-concept arena, and why I think they'll perform:

1. **#1 Incumbent** — Our own skill. It's the only contestant designed specifically for the two-tier orchestrator pattern that the test catalog's scoring rubric rewards. It should score well on GOD, SOC, and MIX axes. But it may over-index on decomposition and miss simpler mechanical wins.

2. **#2 Anthropic code-simplifier** — Written by the team that builds Claude. They know what Claude responds to. The "maintain balance" and "avoid over-simplification" guardrails are unique — most contestants just say "simplify" without a ceiling. Prediction: strong on SOC and SFX (grouping I/O), weaker on GOD (it's scoped to recently modified code, not architectural decomposition).

3. **#54 Repository Refactoring Agent** — The most structured workflow: inventory → findings table → 3-phase plan → diffs. The phased approach (safe/mechanical first, then moderate, then higher-risk) mirrors exactly how a senior engineer would attack the test cases. Prediction: top performer on architectural cases (G01, G03), may over-plan on trivial ones (F03).

4. **#10 ratacat clean-code skill** — Uncle Bob distilled into a skill. Boy Scout Rule + smell detection + concrete refactoring suggestions. Prediction: strong on DUP and FBF (it's tuned for pattern recognition), weaker on SOC (Uncle Bob's rules don't explicitly address phase coherence).

5. **#31 Basalo Clean TypeScript** — The <20 instructions/function rule and RO-RO pattern are concrete, measurable constraints that Claude can apply mechanically. Prediction: consistent mid-tier performer — clear rules produce consistent results. Won't win on architectural cases but won't bomb either.

6. **#22 rohitg00 simplify command** — The 6-step sequential workflow (reduce nesting → extract → name → deduplicate → simplify conditionals → verify) maps almost 1:1 to the scoring axes. Prediction: dark horse. The step ordering forces Claude to address each anti-pattern type in order rather than freestyling.

7. **#57 clean-code-typescript** — The most comprehensive reference doc. Functions chapter alone covers: one thing, one abstraction level, <3 args, no flags, no side effects, encapsulate conditionals, avoid negative conditionals, remove dead code, use iterators. Prediction: strong on IMP and NST axes due to exhaustive function-level rules, but it's long — Claude may lose focus.

8. **#52 Staff Engineer Mega** — Persona + "analyze cyclomatic complexity before writing code" forces chain-of-thought. The constraint engineering approach (explicitly forbid hallucinated changes) is smart. Prediction: good on judgment-difficulty cases (S01, M01) where analysis-before-action prevents over-refactoring.

9. **#66 LobeHub clean-code** — TypeScript-first functional patterns with Either/Result error handling, discriminated unions, immutable data. The most TS-specific functional prompt in the registry. Prediction: strong on IMP axis (declarative transforms), may produce unfamiliar patterns that the judge scores differently.

10. **#75 Arxiv Step-by-Step strategy** — Not a skill but a research-validated approach: procedural Fowler instructions achieved 100% success rate. We'd need to adapt it (write step-by-step instructions for each anti-pattern category rather than each Fowler refactoring type). Prediction: if adapted well, this is the scientific favorite. Raw research backing > community intuition.

**Expected podium:** #2 Anthropic code-simplifier (consistency), #1 Incumbent (domain fit), #54 Repository Refactoring Agent (structured analysis). The wildcard is #75 — if we adapt the step-by-step Fowler strategy properly, the research says it should dominate.
