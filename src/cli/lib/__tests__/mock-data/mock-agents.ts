// Shared agent configs and definitions for test files.
// Uses createMockAgent/createMockAgentConfig from helpers.ts.

import type { AgentConfig, AgentDefinition } from "../../../types";
import { createMockAgent, createMockAgentConfig, createMockSkillEntry } from "../helpers.js";

// ---------------------------------------------------------------------------
// Agent definitions from resolver.test.ts
// ---------------------------------------------------------------------------

export const WEB_DEVELOPER_DEFINITION = createMockAgent("Web Developer", {
  description: "Frontend web developer",
  tools: ["Read", "Write", "Edit"],
  model: "opus",
  path: "web/web-developer",
});

export const API_DEVELOPER_DEFINITION = createMockAgent("API Developer", {
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

const REACT_SKILL_PRELOADED = createMockSkillEntry("web-framework-react", true);
const REACT_SKILL = createMockSkillEntry("web-framework-react");
const REACT_SKILL_WITH_PATH = {
  ...createMockSkillEntry("web-framework-react"),
  path: "skills/web-framework-react/",
};
const VITEST_SINGLE_FILE_SKILL = {
  ...createMockSkillEntry("web-testing-vitest"),
  path: "skills/web-testing-vitest.md",
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
