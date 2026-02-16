# Hackathon TODO

> Autonomous tasks moved to [todo-loop.md](./todo-loop.md).
> Deferred tasks moved to [TODO-deferred.md](./TODO-deferred.md).

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

## Development (Needs Clarification)

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

## Summary

- **Total Tasks:** 10
- **Comms Tasks:** 4 (#8, #9, #10, #15)
- **Development (Needs Clarification):** 6 (#1, #2, #3, #4, #5, #19)
- **Moved to loop:** 11 tasks (#6, #7, #11, #12, #13, #14, #16, #17, #18, #20, #21)
- **Deferred:** 1 task (#16 version bumping)
