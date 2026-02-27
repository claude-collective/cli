import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { createTempDir } from "./test-utils.js";
import { DIRS, SKILLS_DIR_PATH, STACKS_FILE_PATH, STANDARD_FILES } from "../../src/cli/consts.js";
import type {
  AgentName,
  CategoryPath,
  SkillId,
  Stack,
  StackAgentConfig,
} from "../../src/cli/types/index.js";
import { createMockSkillAssignment } from "../../src/cli/lib/__tests__/helpers.js";

type E2ESkill = {
  category: CategoryPath;
  id: SkillId;
  description: string;
};

const E2E_SKILLS: E2ESkill[] = [
  {
    category: "web-framework",
    id: "web-framework-react",
    description: "React framework for building user interfaces",
  },
  {
    category: "web-testing",
    id: "web-testing-vitest",
    description: "Next generation testing framework",
  },
  {
    category: "web-client-state",
    id: "web-state-zustand",
    description: "Bear necessities state management",
  },
  {
    category: "api-api",
    id: "api-framework-hono",
    description: "Lightweight web framework for the edge",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-anti-over-engineering",
    description: "Surgical implementation, not architectural innovation",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-context-management",
    description: "Maintain project continuity across sessions",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-improvement-protocol",
    description: "Evidence-based self-improvement",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-investigation-requirements",
    description: "Never speculate - read actual code first",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-success-criteria",
    description: "Explicit, measurable criteria defining done",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-write-verification",
    description: "Verify work was actually saved",
  },
];

const METHODOLOGY_SKILLS: SkillId[] = [
  "meta-methodology-investigation-requirements",
  "meta-methodology-anti-over-engineering",
  "meta-methodology-success-criteria",
  "meta-methodology-write-verification",
  "meta-methodology-improvement-protocol",
  "meta-methodology-context-management",
];

const webDeveloperAgentConfig: StackAgentConfig = {
  "web-framework": [createMockSkillAssignment("web-framework-react", true)],
  "web-testing": [createMockSkillAssignment("web-testing-vitest")],
  "web-client-state": [createMockSkillAssignment("web-state-zustand")],
  "shared-methodology": METHODOLOGY_SKILLS.map((id) => createMockSkillAssignment(id, true)),
};

const apiDeveloperAgentConfig: StackAgentConfig = {
  "api-api": [createMockSkillAssignment("api-framework-hono", true)],
  "shared-methodology": METHODOLOGY_SKILLS.slice(0, 2).map((id) =>
    createMockSkillAssignment(id, true),
  ),
};

const E2E_STACK: Stack = {
  id: "e2e-test-stack",
  name: "E2E Test Stack",
  description: "Minimal stack for E2E testing",
  agents: {
    "web-developer": webDeveloperAgentConfig,
    "api-developer": apiDeveloperAgentConfig,
  },
};

const AGENT_TEMPLATE = `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
model: {{ agent.model }}
permissionMode: {{ agent.permissionMode }}
{% if agent.preloadedSkills %}skills: {{ agent.preloadedSkills | join: ", " }}{% endif %}
---

{% include "_partials/intro.liquid" %}

{% for skill in skills %}
{{ skill.content }}
{% endfor %}
`;

/**
 * Creates a complete skills source directory for E2E init wizard tests.
 *
 * Includes skills, agents, stacks, and the minimal matrix/template structure
 * needed for the full init -> compile pipeline to succeed.
 *
 * The source provides its own config/stacks.yaml with a single test stack
 * that references only skills present in the source. This ensures the full
 * init flow (select stack -> accept defaults -> install) can complete without
 * missing skill errors.
 */
export async function createE2ESource(): Promise<{
  sourceDir: string;
  tempDir: string;
}> {
  const tempDir = await createTempDir();
  const sourceDir = path.join(tempDir, "source");

  await writeSkills(sourceDir, E2E_SKILLS);
  await writeStacks(sourceDir);
  await writeAgents(sourceDir);

  return { sourceDir, tempDir };
}

async function writeSkills(sourceDir: string, skills: E2ESkill[]): Promise<void> {
  for (const skill of skills) {
    const skillDir = path.join(sourceDir, SKILLS_DIR_PATH, skill.category, skill.id);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      `---\nname: ${skill.id}\ndescription: ${skill.description}\n---\n\n# ${skill.id}\n\n${skill.description}\n`,
    );

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      `author: "@agents-inc"\ncategory: ${skill.category}\ntags: []\ndisplayName: ${skill.id}\ncontentHash: "e2e-hash"\n`,
    );
  }
}

async function writeStacks(sourceDir: string): Promise<void> {
  const stacksFilePath = path.join(sourceDir, STACKS_FILE_PATH);
  await mkdir(path.dirname(stacksFilePath), { recursive: true });
  await writeFile(stacksFilePath, stringifyYaml({ stacks: [E2E_STACK] }));
}

async function writeAgents(sourceDir: string): Promise<void> {
  const agentsDir = path.join(sourceDir, DIRS.agents);
  const templatesDir = path.join(sourceDir, DIRS.templates);
  await mkdir(templatesDir, { recursive: true });
  await writeFile(path.join(templatesDir, "agent.liquid"), AGENT_TEMPLATE);

  const agents: Array<{ name: AgentName; title: string; description: string }> = [
    {
      name: "web-developer",
      title: "Web Developer",
      description: "Full-stack web development specialist",
    },
    {
      name: "api-developer",
      title: "API Developer",
      description: "Backend API development specialist",
    },
  ];

  for (const agent of agents) {
    const agentDir = path.join(agentsDir, agent.name);
    await mkdir(agentDir, { recursive: true });

    await writeFile(
      path.join(agentDir, STANDARD_FILES.AGENT_YAML),
      `id: ${agent.name}\ntitle: ${agent.title}\ndescription: ${agent.description}\ntools:\n  - Read\n  - Write\n  - Edit\n  - Grep\n  - Glob\n  - Bash\nmodel: opus\npermissionMode: default\n`,
    );

    await writeFile(
      path.join(agentDir, STANDARD_FILES.INTRO_MD),
      `# ${agent.title}\n\n${agent.description}\n`,
    );

    await writeFile(
      path.join(agentDir, STANDARD_FILES.WORKFLOW_MD),
      `## Workflow\n\n1. Analyze requirements\n2. Implement solution\n`,
    );
  }
}
