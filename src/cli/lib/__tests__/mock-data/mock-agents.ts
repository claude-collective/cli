// Shared agent configs and definitions for test files.
// Uses createMockAgent/createMockAgentConfig from helpers.ts.

import type { AgentConfig, AgentDefinition } from "../../../types";
import { createMockAgent, createMockAgentConfig } from "../helpers.js";
import { REACT_SKILL, REACT_SKILL_PRELOADED, VITEST_SINGLE_FILE_SKILL } from "./mock-skills.js";

// ---------------------------------------------------------------------------
// Canonical agent definitions — reusable for both mock objects and disk-writing tests.
// Use AGENT_DEFS.webDev.title etc. instead of repeating inline strings.
// ---------------------------------------------------------------------------

export const AGENT_DEFS = {
  webDev: {
    name: "web-developer",
    title: "Frontend Developer",
    description: "A frontend developer agent",
    tools: ["Read", "Write", "Glob"],
  },
  apiDev: {
    name: "api-developer",
    title: "Backend Developer",
    description: "A backend developer agent",
    tools: ["Read", "Write", "Bash"],
  },
  webTester: {
    name: "web-tester",
    title: "Tester",
    description: "A testing agent",
    tools: ["Read", "Bash"],
  },
  webReviewer: {
    name: "web-reviewer",
    title: "Code Reviewer",
    description: "A code review agent",
    tools: ["Read", "Grep", "Glob"],
  },
};

// ---------------------------------------------------------------------------
// Agent definitions from resolver.test.ts
// ---------------------------------------------------------------------------

const WEB_DEVELOPER_DEFINITION = createMockAgent("Web Developer", {
  description: "Frontend web developer",
  tools: ["Read", "Write", "Edit"],
  model: "opus",
  path: "web/web-developer",
});

const API_DEVELOPER_DEFINITION = createMockAgent("API Developer", {
  description: "Backend API developer",
  tools: ["Read", "Write", "Edit", "Bash"],
  model: "opus",
  path: "api/api-developer",
});

export const RESOLVE_AGENTS_DEFINITIONS: Record<string, AgentDefinition> = {
  "web-developer": WEB_DEVELOPER_DEFINITION,
  "api-developer": API_DEVELOPER_DEFINITION,
};

// ---------------------------------------------------------------------------
// Agent config maps from compiler.test.ts
// ---------------------------------------------------------------------------

const REACT_SKILL_WITH_PATH = {
  ...REACT_SKILL,
  path: "skills/web-framework-react/",
};

export const WEB_DEV_NO_SKILLS: Record<string, AgentConfig> = {
  "web-developer": createMockAgentConfig("web-developer"),
};

export const API_DEV_NO_SKILLS: Record<string, AgentConfig> = {
  "api-developer": createMockAgentConfig("api-developer"),
};

export const WEB_DEV_WITH_REACT: Record<string, AgentConfig> = {
  "web-developer": createMockAgentConfig("web-developer", [REACT_SKILL]),
};

export const WEB_DEV_WITH_PRELOADED_REACT: Record<string, AgentConfig> = {
  "web-developer": createMockAgentConfig("web-developer", [REACT_SKILL_PRELOADED]),
};

export const WEB_DEV_WITH_VITEST: Record<string, AgentConfig> = {
  "web-developer": createMockAgentConfig("web-developer", [VITEST_SINGLE_FILE_SKILL]),
};

export const TWO_AGENTS_SHARED_SKILL: Record<string, AgentConfig> = {
  "web-developer": createMockAgentConfig("web-developer", [REACT_SKILL_WITH_PATH]),
  "web-reviewer": createMockAgentConfig("web-reviewer", [REACT_SKILL_WITH_PATH]),
};
