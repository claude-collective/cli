# Hackathon TODO

## Comms

### Task #8: Ask people which repositories they want sub agents and skills generated for
**Status:** Pending

Create a survey or discussion to gather input from team members and users about which repositories they would like to have sub agents and skills automatically generated for (claudified). This will help prioritize which codebases to target for agent/skill generation.

---

### Task #9: Figure out how to divide tasks during the hackathon
**Status:** Pending

Plan and organize task distribution for the hackathon. Identify team members' strengths, assign responsibilities, set up parallel workstreams, and ensure everyone knows what they're working on. Create a coordination strategy to maximize productivity during the event.

---

### Task #10: Create a work level repository for the marketplace
**Status:** Pending

Coordinate with team members who have the necessary permissions to create a new work-level repository for the marketplace. This repository will serve as the central location for marketplace-related code and configurations.

---

### Task #15: Create a logo for Agents Inc.
**Status:** Pending

Design and create a logo for the Agents Inc. brand. The logo should be professional, scalable (vector format), and suitable for use in:
- CLI interface/terminal output
- Documentation and README files
- GitHub repository
- Marketing materials
- Potential white-label scenarios (see Task #11)

Consider creating multiple variations (full logo, icon only, monochrome) for different use cases.

---

## Development

### Task #1: Create proper Work web stack
**Status:** Pending

Build a comprehensive web stack configuration for work-related projects. This should include all necessary tooling, frameworks, and configurations needed for professional web development.

---

### Task #2: Add proper documentation
**Status:** Pending

Create comprehensive documentation covering the project structure, usage patterns, configuration options, and development guidelines. This should help developers understand and contribute to the project effectively.

---

### Task #3: Rename current workstack to work web stack and add simple stack
**Status:** Pending

Rename the existing workstack configuration to "work web stack" to better reflect its purpose. Then create an additional simple stack configuration for basic project needs. This will provide users with both comprehensive and minimal stack options.

---

### Task #4: Handle simultaneously plug-ins and local skills
**Status:** Pending

Implement functionality to support both plugins and local skills working together simultaneously. This should allow users to use external plugins while also having access to their locally-defined skills without conflicts.

---

### Task #5: Create agents command for skill assignment and preloading
**Status:** Pending

Implement an agents command that allows users to assign specific skills to agents and configure whether those skills should be preloaded or loaded on-demand. This will give users fine-grained control over agent capabilities and performance characteristics.

---

### Task #6: Implement intelligent default skill assignment for agents
**Status:** Pending

Make skill assignment to agents more intelligent by setting sensible defaults based on agent type. For example: web agents should automatically get all web-related skills assigned, with the framework skills preloaded; API agents should get API-related skills; CLI agents should get CLI-related skills. This improves the out-of-box experience and ensures agents have the right tools for their domain.

---

### Task #7: Change the name to Agents Inc.
**Status:** Pending

Rebrand the project from its current name to "Agents Inc." This includes updating project names, documentation, configuration files, package.json, and any other references throughout the codebase.

---

### Task #11: Investigate branding customization options
**Status:** Pending

Research and implement branding capabilities for the CLI. Explore options to add a work/company logo to the CLI interface, or at minimum, add customizable text to indicate the CLI is for a specific company. This should allow organizations to white-label or brand the CLI for their internal use.

---

### Task #12: Verify config YAML as source of truth for custom paths
**Status:** Pending

**Investigation findings:**
- ✅ `skills_dir`, `matrix_file`, `stacks_file` are implemented and being read from config YAML in `source-loader.ts`
- ❌ `agents_dir` is defined in types/schema/tests but NOT actually used in runtime code
- These fields are designed for **marketplace repositories** with non-standard layouts (e.g., `lib/skills` instead of `src/skills`)
- For user projects, skills/agents always come from `.claude/` dir, so these configs may not be needed

**Action items:**
1. Implement `agents_dir` support in `agent-fetcher.ts` to complete the feature
2. Evaluate if these configs should be marketplace-only (see Task #14)

---

### Task #13: Auto-generate commented path overrides in config.yaml on init
**Status:** Pending

During `cc init`, automatically add the custom path configuration fields (`skills_dir`, `agents_dir`, `stacks_file`, `matrix_file`) to the generated `.claude-src/config.yaml` file, but have them commented out by default with helpful comments explaining they're for marketplace repos with non-standard layouts. This provides discoverability without cluttering the config for typical users.

Example:
```yaml
name: my-project
# Custom paths (for marketplace repos with non-standard layouts):
# skills_dir: src/skills
# agents_dir: src/agents
# stacks_file: config/stacks.yaml
# matrix_file: config/skills-matrix.yaml
```

---

### Task #14: Implement agents_dir consumption and evaluate path override strategy
**Status:** Pending

**Phase 1 - Implement agents_dir:**
Currently, `agents_dir` is defined in types/schema but NOT consumed in runtime code. Before deciding whether to keep or remove it, complete the implementation:
- Wire `agents_dir` from config through to `agent-fetcher.ts` (similar to how `skills_dir` is handled in `source-loader.ts`)
- Ensure `getAgentDefinitions()` reads and uses the config value
- Add integration tests to verify it works

**Phase 2 - Test eject scenarios with plugins:**
Test various levels of eject functionality when using plugins:
- Can you eject only templates and use them with plugins?
- Can you eject skills individually while keeping others as plugins?
- Can you mix ejected content with plugin content?
- Document supported eject workflows and add tests to prevent regressions

**Phase 3 - Evaluate path override strategy:**
After implementation is complete, decide whether `skills_dir` and `agents_dir` should:
1. Be removed from user project configs (breaking change)
2. Be restricted to marketplace repositories only
3. Be kept with clear documentation as marketplace-only features
4. Be moved to a separate `marketplace` config section

**Rationale:** User projects always install to `.claude/` directory, so these path overrides may be unnecessary and confusing for typical users. They appear designed for marketplace repositories with non-standard layouts.

**Related:** Task #12 (investigation findings), Task #13 (auto-generate commented fields)

---

### Task #16: Test version bumping and create version bump command
**Status:** Pending

Test the existing version bumping workflow and create a dedicated command (e.g., `cc version bump`) to automate the release process. The command should:
- Bump version in package.json (major, minor, patch)
- Update version references in relevant files
- Create a git commit with the version bump
- **Important:** Ensure Claude is NOT added as co-author in the commit
- Automatically update or generate changelog entry for the new version
- Optionally create a git tag for the release
- Follow semantic versioning conventions

Add comprehensive tests for the version bumping logic to ensure it handles edge cases correctly.

**Related:** Task #17 (changelog management)

---

### Task #17: Implement changelog management system
**Status:** Pending

Create a dedicated system for managing changelogs across releases:
- Ensure CHANGELOG.md file exists and follows a standard format (e.g., Keep a Changelog format)
- Consider implementing automated changelog generation from commit messages or PR descriptions
- Add tooling to append new entries to the changelog during version bumps
- Structure changelog with clear sections: Added, Changed, Deprecated, Removed, Fixed, Security
- Maintain changelog in reverse chronological order (newest first)
- Consider integration with the version bump command (Task #16) to automatically prompt for or generate changelog entries

**Format considerations:**
- Use markdown for readability
- Include version numbers and release dates
- Link to relevant commits, PRs, or issues where applicable
- Make it easy for users and contributors to understand what changed between versions

---

### Task #18: Create CLI-specific AI documentation using documentor agent
**Status:** Pending

Generate AI-optimized documentation for this CLI repository using the documentor agent. This involves three phases: aligning the DOCUMENTATION_BIBLE to this project, updating the documentor agent to reference it, then running the agent to generate comprehensive docs.

**Phase 1: Align DOCUMENTATION_BIBLE.md to CLI project**

The current `docs/bibles/DOCUMENTATION_BIBLE.md` documents a completely different project (web app with MobX, batch processing). Rewrite it for this CLI codebase.

**CLI-specific documentation categories:**
- **Command Patterns** - oclif command structure, flag patterns, interactive vs non-interactive modes
- **Wizard Flow** - Ink components, wizard state management (Zustand), step navigation, keyboard shortcuts
- **Agent/Skill Compilation** - Compilation pipeline, Liquid templates, plugin system, directory structures
- **Test Infrastructure** - Test helpers (`__tests__/helpers.ts`), fixture organization (`test/fixtures/`), factory patterns
- **Type System** - Branded types (SkillId, Subcategory), template literal types, boundary casts
- **Configuration** - Config loading, source management, multi-source support
- **Ink UI Patterns** - Component structure, useInput hooks, virtual windowing, scroll management

**Phase 2: Update documentor agent to reference DOCUMENTATION_BIBLE**

- Add reference to `docs/bibles/DOCUMENTATION_BIBLE.md` in documentor agent workflow
- Update templates section to point to CLI-specific patterns
- Ensure agent knows to follow CLI conventions

**Phase 3: Run documentor agent**

Create `.claude/docs/` directory structure with:
- `DOCUMENTATION_MAP.md` - Master index tracking coverage
- `command-patterns.md` - oclif command conventions and examples
- `wizard-architecture.md` - Wizard flow, state management, Ink components
- `compilation-system.md` - Agent/skill compilation pipeline
- `test-patterns.md` - Test infrastructure and fixture organization
- `anti-patterns.md` - Known issues and things to avoid
- `type-system.md` - Type conventions and branded types

**Implementation steps:**
1. Rewrite `docs/bibles/DOCUMENTATION_BIBLE.md` using CLI patterns
2. Update `src/agents/meta/documentor/workflow.md` to reference the Bible (add link in documentation philosophy section)
3. Run documentor agent: `cc run documentor` (or spawn via Task tool)
4. Review generated documentation for accuracy
5. Update `claude.md` to reference `.claude/docs/` for AI-focused documentation
6. Iterate and refine based on agent output

**Success criteria:**
- DOCUMENTATION_BIBLE.md contains CLI-specific patterns (not web app patterns)
- Documentor agent workflow references the Bible
- `.claude/docs/` directory exists with 5+ documentation files
- All file paths in documentation are verified to exist
- Documentation helps agents answer "where is X?" and "how does Y work?"

**Related:** Task #20 (documentation reorganization), Task #21 (Loop Prompts Bible)

---

### Task #19: Implement sub-agent learning capture system
**Status:** Pending

Create a system to capture learnings from sub-agents after they complete their work, which can be used to continuously improve agent performance and documentation.

**Core functionality:**
- Implement a post-completion hook that fires when a sub-agent finishes its task
- The hook prompts the agent with reflection questions:
  - "Did you struggle with any part of this task?"
  - "Were there any conventions or patterns you needed that weren't documented?"
  - "What would have made this task easier?"
  - "Did you discover any patterns worth documenting for future agents?"
- Store learnings in a structured format (e.g., `.claude/learnings.md` or `.claude/agent-feedback.jsonl`)
- Categorize learnings by: struggles, undocumented conventions, discovered patterns, suggested improvements

**Use cases:**
- Identify gaps in coding standards and documentation
- Discover patterns that should be added to TypeScript Types Bible or Clean Code Standards
- Track recurring pain points across multiple agent runs
- Generate prompts for improving agent instructions or system prompts
- Feed learnings back into the agent improvement cycle

**Implementation considerations:**
- Make it opt-in (user can enable/disable via config)
- Keep prompts concise to avoid token overhead
- Support both automatic capture (hook) and manual capture (command like `cc learn`)
- Consider deduplication of similar learnings
- Provide command to review accumulated learnings (`cc learnings list`)
- Add tooling to convert learnings into documentation updates (`cc learnings apply`)

**Related:** Task #18 (AI documentation iteration) - learnings can inform documentation improvements

---

### Task #20: Reorganize documentation folder to Option 4 (Hybrid structure)
**Status:** Pending

Reorganize the `docs/` folder using the Option 4 (Hybrid) categorization scheme to improve discoverability and separate concerns by type and status.

**New structure:**
```
docs/
├── index.md                           # Update with new structure
│
├── standards/                         # Enforceable rules
│   ├── code/                          # For CLI developers
│   │   ├── clean-code-standards.md
│   │   └── type-conventions.md
│   └── content/                       # For agent/skill authors (Bibles)
│       ├── CLAUDE_ARCHITECTURE_BIBLE.md
│       ├── PROMPT_BIBLE.md
│       ├── SKILL-ATOMICITY-BIBLE.md
│       ├── AGENT-COMPLIANCE-BIBLE.md
│       ├── DOCUMENTATION_BIBLE.md
│       ├── FRONTEND_BIBLE.md
│       └── LOOP_PROMPTS_BIBLE.md      # New - from Task #21
│
├── reference/                         # System documentation
│   ├── architecture.md
│   ├── data-models.md
│   └── commands.md
│
├── guides/                            # How-to docs
│   ├── creating-a-marketplace.md
│   ├── migrate-to-marketplace.md
│   └── skill-extraction-criteria.md
│
├── features/                          # Feature development
│   ├── active/                        # In development
│   │   ├── scroll-viewport/
│   │   │   ├── research.md            # ux-2.0-scroll-viewport.md
│   │   │   └── implementation.md      # implementation-scroll-viewport.md
│   │   ├── multi-source/
│   │   │   ├── research.md            # ux-2.0-multi-source.md
│   │   │   └── implementation.md      # ux-2.0-multi-source-implementation.md
│   │   └── stack-domain-filtering/
│   │       └── spec.md
│   ├── proposed/                      # Research only
│   │   ├── skill-consume.md           # SKILL-CONSUME-UX-RESEARCH.md
│   │   ├── skill-search.md            # SKILL-SEARCH-UX-RESEARCH.md
│   │   └── cli-agent-invocation.md    # cli-agent-invocation-research.md
│   └── completed/                     # Shipped features
│       └── multi-skill-categories-findings.md
│
└── archive/                           # Deprecated/historical
    └── recent-claude-code-updates.md
```

**Benefits:**
- **Standards split clearly:** Code standards (CLI devs) vs Content standards (agent/skill authors)
- **Feature lifecycle visible:** Proposed → Active → Completed status tracking
- **Related docs grouped:** Research + implementation for same feature live together
- **Easy to maintain:** Move completed features to archive/ when done

**Action items:**
1. Create new directory structure
2. Move files to appropriate locations (use `git mv` to preserve history)
3. Update all internal links in documentation
4. Update `docs/index.md` with new structure and navigation
5. Update `claude.md` to reference new paths
6. Update any agent/skill references to Bible paths
7. Test that all links resolve correctly

**Related:** Task #18 (AI documentation iteration), Task #21 (Loop Prompts Bible)

---

### Task #21: Create Loop Prompts Bible from "Reminders for Agents"
**Status:** Pending

Extract the "Reminders for Agents" section from `TODO.md` and transform it into a comprehensive Bible for loop/orchestrator agents (the main agent that coordinates sub-agents).

**Current content in TODO.md:**
- R1: Use Specialized Agents - Delegation patterns
- R2: Handle Uncertainties - Research and investigation workflows
- R3: Blockers Go to Top - Priority management
- R4: Do NOT Commit - Version control boundaries
- R5: Move Completed Tasks to Archive - Task lifecycle management

**Expanded Bible should include:**

**1. Agent Delegation Patterns**
- When to use CLI Developer vs CLI Tester vs Web Developer
- How to parallelize agent work (multiple agents in single message)
- Agent hand-off protocols and context passing
- Sub-agent selection decision tree

**2. Uncertainty Management**
- Research workflow (spawn explore agents, gather findings)
- Prototyping and validation approaches
- Documentation of decisions and rationale
- Handling ambiguous requirements (AskUserQuestion vs research)

**3. Task Management**
- Creating well-scoped tasks for sub-agents
- Blocker identification and escalation
- Task lifecycle (TODO → In Progress → Completed → Archived)
- Progress tracking and reporting

**4. Context Management**
- What context to pass to sub-agents
- How to summarize sub-agent results
- Managing conversation length and context windows
- When to use memory files vs inline context

**5. Quality Control**
- Verification patterns before reporting completion
- Test validation workflows
- Code review patterns (when to spawn reviewers)
- Compliance checking (standards, types, tests)

**6. Boundaries and Constraints**
- What loop agents should NOT do (direct implementation, commits)
- Tool usage patterns (Task vs direct implementation)
- Permission management and user approval flows
- When to defer to user judgment

**7. Communication Patterns**
- Reporting progress to users (concise summaries)
- Asking clarifying questions effectively
- Presenting options and recommendations
- Documenting decisions for future reference

**Output location:** `docs/standards/content/LOOP_PROMPTS_BIBLE.md`

**Related:** Task #20 (documentation reorganization) - Bible goes in `standards/content/`

---

## Summary

- **Total Tasks:** 21
- **Pending:** 21
- **In Progress:** 0
- **Completed:** 0
- **Development Tasks:** 17
- **Comms Tasks:** 4
