# D-33: README Reframe -- Position Agents Inc. as an AI Coding Framework

**Status:** Refinement complete
**Date:** 2026-02-26
**Scope:** Rewrite README.md content and structure

## Implementation Overview

Rewrite `README.md` to position Agents Inc. as an agent composition framework rather than just a CLI tool. The new structure adds "How It Works" (compilation pipeline diagram), "Skills" (show what a skill looks like), and "Agents" (list of 18 role-based agents) sections. Expands the customization section to show 9 progressive layers from config editing to plugin distribution. Fixes factual inaccuracies (stack count, eject examples). Tone is technical and specific — no marketing language. Target: 250-300 lines. Single file change (`README.md`) plus a `react-native-stack` re-addition to `config/stacks.yaml`.

---

## 1. Open Questions (ALL RESOLVED)

| #   | Question                                                                                                                        | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Who is the primary audience?                                                                                                    | **RESOLVED.** Developers using Claude Code -- specifically those who want to use skills and sub-agents but don't want to blindly install from skills.sh. Power users and companies that want to create scalable AI developer setups. Developers who take it upon themselves to introduce more structured setups to their workplace. Frame the README for this audience: technically competent, skeptical, wanting control and transparency. |
| 2   | Should we show the full wizard GIF or screenshots?                                                                              | **RESOLVED (unchanged).** A short GIF of the init wizard is the strongest possible hook. Prioritize making the GIF before or alongside the README rewrite. Screenshots are secondary.                                                                                                                                                                                                                                                       |
| 3   | The README currently lists 8 stacks but `stacks.yaml` only has 6. Are `react-native-stack` and `meta-stack` planned or removed? | **RESOLVED.** Re-add `react-native-stack` to stacks.yaml. Do NOT add `meta-stack`. This brings the total to 7 stacks: nextjs-fullstack, angular-stack, nuxt-stack, remix-stack, vue-stack, solidjs-stack, react-native-stack.                                                                                                                                                                                                               |
| 4   | How many skills actually exist?                                                                                                 | **RESOLVED.** Use "87+" -- confirmed acceptable by user. Don't worry about exact count.                                                                                                                                                                                                                                                                                                                                                     |
| 5   | Should we mention the plugin system / marketplace in the README?                                                                | **RESOLVED.** YES, mention it prominently -- the marketplace (skills.sh) is the starting-off point for users. Don't just mention it as an extensibility footnote; position it as where users browse and discover skills before installing.                                                                                                                                                                                                  |
| 6   | Does "framework" need a qualifier?                                                                                              | **RESOLVED.** Use "agent composition framework" -- this is already in the existing README and is the correct descriptor.                                                                                                                                                                                                                                                                                                                    |

---

## 2. Current State Analysis

### What the README Says Today

The current README (195 lines) has these sections:

1. **Hero** -- Logo, one-liner ("An agent composition framework..."), install command, GIF placeholder
2. **What this does** -- 2 paragraphs explaining the problem (Claude Code doesn't know your stack) and the solution (structured skills compiled into agents)
3. **Getting started** -- Install instructions + 3 wizard steps (pick stack, customize skills, configure agents) with screenshot placeholders
4. **Commands** -- Table of 11 commands + mention of additional ones
5. **Importing third-party skills** -- Import command examples
6. **Customization** -- Config editing, eject examples, custom skill creation
7. **Architecture** -- One sentence + link
8. **Links** -- Marketplace link
9. **License** -- MIT

### What's Good

- The one-liner is already decent: "An agent composition framework that builds stacks and compiles specialized subagents for Claude Code"
- The "What this does" section correctly identifies the problem
- Commands table is useful
- Customization section shows progressive depth

### What's Missing or Weak

| Issue                                         | Detail                                                                                                                                                                                                     |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **No quick demonstration of value**           | A reader can't see what a compiled agent looks like, or what changes after running `init`. There's no before/after.                                                                                        |
| **The "framework" claim isn't substantiated** | The README says "framework" in the title but reads like CLI documentation. The framework aspects (compilation pipeline, ejectable templates, schema validation, plugin architecture) are buried or absent. |
| **No "how it works" section**                 | The compilation pipeline is the most interesting architectural feature and is not explained at all. A reader who wants to understand the system has nothing.                                               |
| **Agent roles are unexplained**               | The README mentions agents like `web-developer` and `web-reviewer` but never explains what these actually are or what makes them different from a generic Claude Code setup.                               |
| **The skill structure isn't shown**           | What does a skill look like? What's inside? The README talks about skills abstractly but never shows one.                                                                                                  |
| **Stacks list has inaccuracies**              | Lists 8 stacks; only 6 exist in `stacks.yaml`. React Native stack to be re-added (7 total). Meta-stack will not be added.                                                                                  |
| **Skill count confirmed**                     | "87+ skills" confirmed as acceptable.                                                                                                                                                                      |
| **No "why this over X"**                      | No comparison to alternatives (manual CLAUDE.md, .cursorrules, other approaches). The value proposition needs to be clearer.                                                                               |
| **Architecture section is a dead end**        | Links to `docs/reference/architecture.md` but has no substance itself. Framework users care about this.                                                                                                    |

---

## 3. Positioning Strategy

### The Honest Framing

Agents Inc. is a **build system for AI coding agents**. It takes structured knowledge modules (skills) and compiles them into specialized sub-agents for Claude Code through a Liquid template pipeline. Everything is typed, validated, and ejectable.

This framing works because:

- **"Build system"** is a well-understood concept (webpack, vite, turbopack). It implies: there are inputs, a compilation step, and outputs. That's exactly what happens.
- **"For AI coding agents"** scopes it correctly. It's not a general AI framework. It's specifically for composing Claude Code sub-agents.
- **"Structured knowledge modules"** (skills) is more descriptive than "configuration" and more honest than "plugins" at this stage.

### Why It's Actually a Framework (Not Just a CLI)

The framework claim is justified by these concrete capabilities:

1. **There's a real compilation pipeline.** Skills + agent partials + Liquid templates produce compiled agent markdown files. This is `compileAllAgents()` in `compiler.ts`, not just config copying.

2. **The build is customizable at every layer.** Users can:
   - Edit config (`config.yaml`)
   - Swap skills (wizard or manual)
   - Eject agent partials (intro, workflow, critical requirements)
   - Eject Liquid templates (change the compilation format itself)
   - Eject skills (fork and modify any skill locally)
   - Create entirely new skills and agents

3. **There's a schema system.** Skills have typed metadata (YAML + Zod validation), categories, conflict rules, compatibility declarations, and content hashing for versioning. This is framework-grade structure, not freeform configuration.

4. **There's a plugin architecture.** Skills can be packaged as Claude Code plugins with manifests. Multiple skill sources can be configured. Custom marketplaces can be created and published.

5. **There are 18 agent roles.** The framework includes pre-built agent definitions for web-developer, api-developer, cli-developer, web-architecture, web-reviewer, api-reviewer, cli-reviewer, web-tester, cli-tester, web-researcher, api-researcher, web-pm, pattern-scout, web-pattern-critique, cli-migrator, documentor, skill-summoner, and agent-summoner. Each has its own intro, workflow, examples, and critical requirements.

### What NOT to Claim

- Do NOT call it "an AI framework" (too broad -- it's specifically for Claude Code)
- Do NOT use words like "revolutionary", "powerful", "game-changing", "next-generation"
- Do NOT imply it works with AI tools other than Claude Code (it doesn't)
- Do NOT overstate the marketplace maturity -- it works but is early
- Do NOT compare it to frameworks like Next.js or Rails -- the analogy is useful internally but sounds like marketing externally

---

## 4. Proposed README Structure

### Section 1: Hero (unchanged structure, better one-liner)

- Logo
- Badge row (npm, TypeScript strict, MIT, Node 18+)
- One-liner: keep "An agent composition framework that builds stacks and compiles specialized subagents for Claude Code" or refine to: "A build system for AI coding agents. Composes structured skills into specialized Claude Code sub-agents through a compilation pipeline."
- Quick install: `npx @agents-inc/cli init`
- GIF placeholder (or actual GIF if available)

### Section 2: What This Is (replaces "What this does")

**Goal:** Explain the core concept in 4-5 short paragraphs. Lead with the concrete problem, explain the solution, introduce the marketplace, then frame the framework aspect.

**Target audience:** Developers using Claude Code who want structured, transparent skill/agent setups -- not blind installs. Power users and companies introducing scalable AI developer workflows to their teams.

Bullet points for content:

- Paragraph 1: The problem. Claude Code has no knowledge of your stack, patterns, or conventions. You repeat yourself or maintain freeform markdown that fails silently.
- Paragraph 2: The solution. Agents Inc. provides structured skills -- focused knowledge modules for specific technologies (React, Drizzle, Vitest, etc.). Each skill covers patterns, anti-patterns, edge cases, and real code examples, backed by a metadata schema.
- Paragraph 3: The starting point. Browse 87+ skills on the plugin marketplace (skills.sh) before installing. See what each skill contains, its category, and its compatibility -- then install only what you need. The marketplace is the discovery layer; the CLI is the build layer.
- Paragraph 4: What makes it a framework. Skills don't work alone -- they get compiled into role-based sub-agents (a web developer, a reviewer, a tester) through a Liquid template pipeline. The compilation step validates structure, prevents template injection, and produces the final agent prompts.
- Paragraph 5: The escape hatches. Smart defaults but progressive customization: edit config, swap skills, eject partials, eject templates, eject skills, create your own. Everything is transparent and ejectable -- no vendor lock-in.

### Section 3: How It Works (NEW -- core of the framework story)

**Goal:** Show the compilation pipeline visually. This is what makes it a framework rather than a config manager.

Content:

- ASCII diagram or simple flow:
  ```
  Skills (SKILL.md + metadata.yaml)
    + Agent definitions (intro.md, workflow.md, ...)
    + Liquid templates (agent.liquid)
    = Compiled agents (.claude/agents/web-developer.md)
  ```
- Brief explanation of each layer:
  - **Skills**: Atomic knowledge modules. Each has markdown content, YAML metadata (category, tags, conflicts, compatibility), and is validated against a Zod schema.
  - **Agents**: Role definitions. Each agent has an intro (role description), workflow (how it operates), examples, and critical requirements. An agent references multiple skills.
  - **Templates**: Liquid templates that control how agents are assembled. The default template produces structured markdown with XML semantic sections, skill activation protocols, and core principles. Ejectable for full control.
  - **Compilation**: The `compile` command reads agent definitions + assigned skills, sanitizes user-controlled data (Liquid injection prevention), renders through templates, validates output (XML balance, placeholder detection), and writes final `.md` files.
- Mention the output structure:
  ```
  .claude/
    agents/web-developer.md
    agents/api-developer.md
    agents/web-reviewer.md
    skills/web-framework-react/SKILL.md
    skills/api-framework-hono/SKILL.md
    ...
  ```

### Section 4: Getting Started (streamlined)

**Goal:** Get from zero to working in 30 seconds.

Content:

- Install command
- Requirements (Node 18+, Claude Code)
- The wizard does three things: (1) pick a stack or start from scratch, (2) customize skills, (3) compile agents
- Stack list (7 stacks: nextjs-fullstack, angular-stack, nuxt-stack, remix-stack, vue-stack, solidjs-stack, react-native-stack)
- After init, mention what was created and what to do next (`agentsinc edit`, `agentsinc compile`)

### Section 5: Skills (NEW or expanded)

**Goal:** Show what a skill actually looks like.

Content:

- Brief explanation: a skill is a folder with SKILL.md (content) + metadata.yaml (schema-validated metadata)
- Show a truncated real skill example (e.g., a SKILL.md frontmatter block with name, description -- see Example 3)
- Category overview: web (frameworks, styling, state, testing, forms, components), api (frameworks, databases, auth, observability), cli, infra, meta
- Count of available skills: 87+
- Mention the plugin marketplace (skills.sh) as the starting point for browsing and discovering skills
- Mention that skills can be preloaded (embedded in agent prompt) or dynamic (loaded on demand via Skill tool)

### Section 6: Agents (NEW)

**Goal:** Explain what agents are and why they matter.

Content:

- An agent is a compiled role with specific expertise. Instead of one generic Claude Code setup, you get specialized sub-agents.
- List the 18 agent roles by category: developers (web-developer, api-developer, cli-developer, web-architecture), reviewers (web-reviewer, api-reviewer, cli-reviewer), testers (web-tester, cli-tester), researchers (web-researcher, api-researcher), planning (web-pm), pattern analysis (pattern-scout, web-pattern-critique), migration (cli-migrator), documentation (documentor), meta (skill-summoner, agent-summoner)
- Each agent consists of: role intro, workflow process, domain-specific skills, critical requirements, output format
- Agents are compiled from modular pieces -- you can eject and customize any part

### Section 7: Commands (mostly unchanged)

- Keep the command table
- Fix the supplementary command list (ensure accuracy)
- Maybe group into primary (init, edit, compile, update) and secondary (eject, search, doctor, etc.)

### Section 8: Customization (expanded slightly)

**Goal:** Show the progressive customization layers -- this is what makes it a framework.

Content, ordered from simple to deep:

1. **Edit config** -- `config.yaml` maps skills to agents, toggle preloaded/dynamic
2. **Use the wizard** -- `agentsinc edit` to add/remove skills interactively
3. **Eject agent partials** -- Customize intro, workflow, examples, critical requirements for any agent
4. **Eject templates** -- Modify the Liquid template that controls how agents are compiled
5. **Eject skills** -- Fork any skill for local editing
6. **Create custom skills** -- `agentsinc new skill` scaffolds the proper structure
7. **Create custom agents** -- `agentsinc new agent` scaffolds agent files
8. **Custom skill sources** -- Point to a private repo or local directory as a skill source
9. **Build plugins** -- Package skills/agents as Claude Code plugins for distribution

### Section 9: Importing Skills (keep, minor edit)

- Keep the import examples
- Maybe fold into Customization as a subsection

### Section 10: Architecture (brief but substantive)

**Goal:** Give framework users enough to understand the system.

Content:

- Technology stack table: oclif (commands), Ink + React (terminal UI), Zustand (wizard state), Zod (validation), LiquidJS (compilation), Vitest (testing)
- Directory overview (high-level: commands/, components/, lib/, stores/, types/, utils/)
- Mention: 260 TypeScript files, strict mode, zero `any` policy, 30+ Zod schemas at parse boundaries
- Link to full architecture docs

### Section 11: Links + License

- Marketplace link (skills.sh) should be prominent -- listed first in links, not buried
- Keep license (MIT)

---

## 5. Key Messages

The README should communicate these 5 messages (in priority order):

1. **Agents Inc. turns structured skill modules into specialized Claude Code sub-agents through a compilation pipeline.** This is the core value proposition. It's what it actually does.

2. **Skills are typed, validated, and atomic.** They're not freeform markdown -- they have schemas, metadata, categories, conflict rules, and compatibility declarations. Misconfigurations surface immediately.

3. **The framework is progressively customizable.** Smart defaults out of the box, but you can go deeper at every layer: config, wizard, partials, templates, skills, custom agents, custom sources.

4. **There's a real build step.** `agentsinc compile` is not copying files -- it's resolving skills, rendering Liquid templates, sanitizing inputs, and validating output. This is a compilation pipeline.

5. **It's specifically for Claude Code.** Not trying to be a universal AI framework. Purpose-built for composing Claude Code sub-agents.

---

## 6. Wording Guidelines

### Tone

- **Technical and specific.** Write like documentation, not like a landing page.
- **Concrete over abstract.** Show file structures, command output, code snippets. Don't describe things in generalities.
- **Honest about scope.** "For Claude Code" is a feature, not a limitation. Don't hedge or apologize.
- **Calm confidence.** The framework does genuinely interesting things. Let the features speak.

### Words to AVOID

| Avoid         | Why                                      | Use Instead                        |
| ------------- | ---------------------------------------- | ---------------------------------- |
| powerful      | Meaningless filler                       | (describe the specific capability) |
| revolutionary | Marketing hyperbole                      | (omit)                             |
| game-changing | Marketing hyperbole                      | (omit)                             |
| seamless      | Almost never true                        | (describe the actual integration)  |
| leverage      | Corporate jargon                         | use                                |
| cutting-edge  | Marketing                                | (omit)                             |
| ecosystem     | Overused, vague                          | marketplace, skill sources         |
| AI-powered    | Agents Inc. is for AI, not powered by AI | (be specific about what it does)   |
| supercharge   | Marketing fluff                          | (describe the improvement)         |

### Words to USE

| Word/Phrase                 | When                                     |
| --------------------------- | ---------------------------------------- |
| compile, compilation        | Describing the build step                |
| structured                  | Describing skills (vs freeform markdown) |
| validated, schema-validated | Describing the type safety               |
| eject, ejectable            | Describing the escape hatches            |
| compose, composition        | Describing how skills form agents        |
| specialize, specialized     | Describing what agents become            |
| role-based                  | Describing agent organization            |

### Formatting Rules

- Use code blocks for all commands, file paths, and config examples
- Use tables for structured comparisons (stacks, commands, customization levels)
- Keep paragraphs to 3-4 sentences maximum
- Use headers for scannability -- someone should understand the README from headers alone

---

## 7. Examples to Include

### Example 1: Quick Start Command + Output

```bash
npx @agents-inc/cli init
```

Show or describe what this produces: the `.claude/` directory with compiled agents and skills.

### Example 2: What a Compiled Agent Looks Like (truncated)

Show the frontmatter + first few sections of a compiled `web-developer.md`. This example is verified against the actual compiled output:

```markdown
---
name: web-developer
description: Implements frontend features from detailed specs...
tools: Read, Write, Edit, Grep, Glob, Bash
model: opus
permissionMode: default
skills:
  - meta-methodology-write-verification
  - meta-methodology-anti-over-engineering
  - meta-methodology-investigation-requirements
  ...
---

# Web Developer Agent

<role>
You are an expert web developer...
</role>

<core_principles>
...
</core_principles>

<skill_activation_protocol>
...
</skill_activation_protocol>
```

Note: The `skills:` list in frontmatter contains preloaded skills (embedded in the agent prompt). Dynamic skills are loaded on demand via the Skill tool during the agent's session.

This is the best possible demonstration of value -- showing the actual output.

### Example 3: What a Skill Looks Like (truncated)

Show a SKILL.md frontmatter (verified against actual `web-framework-react/SKILL.md`):

```yaml
---
name: web-framework-react
description: Component architecture, hooks, patterns
---
```

Note: The frontmatter uses `name:` (not `id:`) as the identifier field. Additional metadata (category, tags, conflicts, compatibility) lives in the companion `metadata.yaml` file, not in the SKILL.md frontmatter.

### Example 4: Compilation Pipeline Flow

```
Skills (87+ modules)       Agent Definitions          Liquid Templates
    |                           |                          |
    v                           v                          v
 [agentsinc compile] ---> Resolve + Validate ---> Render ---> Output
                                                              |
                                                              v
                                                    .claude/agents/*.md
                                                    .claude/skills/*/SKILL.md
```

### Example 5: Eject Examples (keep existing, they're good)

```bash
agentsinc eject agent-partials    # Customize agent intros, workflows
agentsinc eject templates         # Customize the Liquid template
agentsinc eject skills            # Fork skills for local editing
```

### Example 6: Config YAML (keep existing, it's clear)

```yaml
web-developer:
  web-framework:
    id: web-framework-react
    preloaded: true
  web-styling: web-styling-scss-modules
```

---

## 8. Step-by-Step Implementation Plan

### Step 1: Resolve Open Questions (DONE)

All open questions resolved -- see Section 1. Summary:

- Audience: power users/companies wanting scalable AI dev setups
- Stacks: 7 (re-add react-native-stack, skip meta-stack)
- Skill count: 87+ (confirmed)
- Marketplace: emphasize as starting point
- Framework qualifier: "agent composition framework" (already in use)

### Step 2: Draft the New README

- Follow the proposed structure in Section 4
- Write each section as a self-contained draft
- Ensure all numbers, commands, and file paths are verified against codebase
- Include all code examples from Section 7

### Step 3: Technical Accuracy Review

- Verify every command example works
- Verify all file paths match the actual project structure
- Verify the compilation pipeline description matches `compiler.ts`
- Verify the agent list matches `src/agents/` directories
- Verify the stack list matches `config/stacks.yaml`

### Step 4: Tone and Wording Review

- Apply wording guidelines from Section 6
- Remove any marketing language that crept in
- Ensure technical specificity throughout
- Check that the "framework" framing emerges naturally from feature descriptions

### Step 5: Final Polish

- Ensure GIF/screenshot placeholders are clearly marked if assets aren't ready
- Check all links work
- Verify badge URLs
- Run a final read-through for flow and scannability

---

## 9. Acceptance Criteria

| #   | Criterion                                                                                                  | How to Verify                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | README positions Agents Inc. as a framework through concrete feature descriptions, not marketing language. | Read the "What this is" and "How it works" sections -- they should explain the compilation pipeline, schema validation, and ejectable architecture without using any words from the "avoid" list. |
| 2   | A new reader can understand what Agents Inc. does within the first 2 sections.                             | Have someone unfamiliar with the project read the first 2 sections and explain it back. They should be able to say: "it compiles knowledge modules into specialized Claude Code agents."          |
| 3   | The "How it works" section shows the compilation pipeline concretely.                                      | It should include a flow diagram and mention: skill resolution, Liquid template rendering, injection sanitization, and output validation.                                                         |
| 4   | All numbers are accurate.                                                                                  | Skill count matches actual source. Stack list matches `config/stacks.yaml`. Agent roles match `src/agents/`. Command list matches `src/cli/commands/`.                                            |
| 5   | All code examples are runnable or accurately represent real files.                                         | Every `agentsinc` command shown should work. Config YAML snippets should match actual schema. Skill frontmatter should match a real skill.                                                        |
| 6   | The progressive customization story is clear.                                                              | A reader should understand there are multiple layers (config, wizard, partials, templates, skills, custom) ordered from simple to deep.                                                           |
| 7   | No marketing language or buzzwords.                                                                        | Grep for: powerful, revolutionary, game-changing, seamless, leverage, cutting-edge, supercharge. Zero results.                                                                                    |
| 8   | Framework aspects are substantiated, not just claimed.                                                     | Every framework claim should have a concrete feature backing it (e.g., "ejectable templates" includes an actual eject command and example).                                                       |
| 9   | README is under 300 lines.                                                                                 | Line count check. The current README is 195 lines. Adding "How it works" and "Skills"/"Agents" sections will add content, but verbose sections should be trimmed. Target: 250-300 lines.          |
| 10  | The README reads well from headers alone.                                                                  | Read only the `##` headers in sequence -- they should tell a coherent story: what it is, how it works, getting started, skills, agents, commands, customization.                                  |

---

## 10. Factual Issues to Fix in Current README

These are inaccuracies discovered during research that must be fixed regardless of the reframe:

| Issue               | Current                                                                                   | Correct                                                                                                                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stack count         | Lists 8 stacks including react-native-stack and meta-stack                                | Re-add react-native-stack to stacks.yaml. Do NOT add meta-stack. Final count: 7 stacks (nextjs-fullstack, angular-stack, nuxt-stack, remix-stack, vue-stack, solidjs-stack, react-native-stack) |
| Skill count         | "87+ skills"                                                                              | Confirmed: use "87+" -- exact count not needed                                                                                                                                                  |
| Eject examples      | Shows `agentsinc eject agent-partials --templates` in the eject section                   | The `--templates` flag was replaced by `agentsinc eject templates` as a separate type (per D-44) -- though the current README already shows this correctly, verify no stale references remain   |
| Package description | "CLI for managing Agents Inc. skills, stacks, and agents for Claude Code" in package.json | Should be updated to match the new framing -- this is the description that appears on npm                                                                                                       |

---

## Appendix: Codebase Facts for Accuracy

These numbers/facts were verified against the actual codebase on 2026-02-26:

| Fact                      | Value                                                                                                                                                                                                                                                                  | Source                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| TypeScript source files   | 260                                                                                                                                                                                                                                                                    | `find src/cli -name "*.ts" -o -name "*.tsx"`                                              |
| Stacks                    | 7 (6 existing + react-native-stack to be re-added)                                                                                                                                                                                                                     | `config/stacks.yaml`                                                                      |
| Stack IDs                 | nextjs-fullstack, angular-stack, nuxt-stack, remix-stack, vue-stack, solidjs-stack, react-native-stack (pending)                                                                                                                                                       | `config/stacks.yaml`                                                                      |
| Agent roles (directories) | 18                                                                                                                                                                                                                                                                     | `src/agents/` subdirectories (verified via `find src/agents -name "agent.yaml" \| wc -l`) |
| Agent role names          | web-developer, api-developer, cli-developer, web-architecture, web-reviewer, api-reviewer, cli-reviewer, web-tester, cli-tester, web-researcher, api-researcher, web-pm, pattern-scout, web-pattern-critique, cli-migrator, documentor, skill-summoner, agent-summoner | `src/agents/`                                                                             |
| Commands                  | 26                                                                                                                                                                                                                                                                     | `.ai-docs/commands.md`                                                                    |
| Zod schemas               | 30+                                                                                                                                                                                                                                                                    | `src/cli/lib/schemas.ts`                                                                  |
| Skills matrix categories  | ~38                                                                                                                                                                                                                                                                    | `config/skills-matrix.yaml`                                                               |
| Template engine           | LiquidJS                                                                                                                                                                                                                                                               | `src/cli/lib/compiler.ts`                                                                 |
| State management          | Zustand v5                                                                                                                                                                                                                                                             | `src/cli/stores/wizard-store.ts`                                                          |
| Terminal UI               | Ink v5 + React                                                                                                                                                                                                                                                         | `src/cli/components/`                                                                     |
| CLI framework             | oclif                                                                                                                                                                                                                                                                  | `src/cli/commands/`                                                                       |
| Version                   | 0.47.0                                                                                                                                                                                                                                                                 | `package.json`                                                                            |
