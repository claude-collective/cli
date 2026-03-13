import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { createTempDir } from "./test-utils.js";
import {
  DIRS,
  SKILL_RULES_PATH,
  SKILLS_DIR_PATH,
  STACKS_FILE_PATH,
  STANDARD_FILES,
} from "../../src/cli/consts.js";
import type {
  AgentName,
  CategoryPath,
  RelationshipDefinitions,
  SkillId,
  Stack,
  StackAgentConfig,
} from "../../src/cli/types/index.js";
import { createMockSkillAssignment } from "../../src/cli/lib/__tests__/helpers.js";
import {
  renderConfigTs,
  renderRulesTs,
  renderSkillMd,
} from "../../src/cli/lib/__tests__/content-generators.js";

type E2ESkill = {
  category: CategoryPath;
  id: SkillId;
  slug: string;
  description: string;
  domain: string;
  displayName: string;
};

const E2E_SKILLS: E2ESkill[] = [
  {
    category: "web-framework",
    id: "web-framework-react",
    slug: "react",
    description: "React framework for building user interfaces",
    domain: "web",
    displayName: "web-framework-react",
  },
  {
    category: "web-testing",
    id: "web-testing-vitest",
    slug: "vitest",
    description: "Next generation testing framework",
    domain: "web",
    displayName: "web-testing-vitest",
  },
  {
    category: "web-client-state",
    id: "web-state-zustand",
    slug: "zustand",
    description: "Bear necessities state management",
    domain: "web",
    displayName: "web-state-zustand",
  },
  {
    category: "api-api",
    id: "api-framework-hono",
    slug: "hono",
    description: "Lightweight web framework for the edge",
    domain: "api",
    displayName: "api-framework-hono",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-anti-over-engineering",
    slug: "anti-over-engineering",
    description: "Surgical implementation, not architectural innovation",
    domain: "shared",
    displayName: "Anti Over-Engineering",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-context-management",
    slug: "context-management",
    description: "Maintain project continuity across sessions",
    domain: "shared",
    displayName: "Context Management",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-improvement-protocol",
    slug: "improvement-protocol",
    description: "Evidence-based self-improvement",
    domain: "shared",
    displayName: "Improvement Protocol",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-investigation-requirements",
    slug: "investigation-requirements",
    description: "Never speculate - read actual code first",
    domain: "shared",
    displayName: "Investigation Requirements",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-success-criteria",
    slug: "success-criteria",
    description: "Explicit, measurable criteria defining done",
    domain: "shared",
    displayName: "Success Criteria",
  },
  {
    category: "shared-methodology",
    id: "meta-methodology-write-verification",
    slug: "write-verification",
    description: "Verify work was actually saved",
    domain: "shared",
    displayName: "Write Verification",
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

type E2ESourceOptions = {
  /** Custom relationship rules to write to config/skill-rules.ts */
  relationships?: Partial<RelationshipDefinitions>;
};

/**
 * Creates a complete skills source directory for E2E init wizard tests.
 *
 * Includes skills, agents, stacks, and the minimal matrix/template structure
 * needed for the full init -> compile pipeline to succeed.
 *
 * The source provides its own config/stacks.ts with a single test stack
 * that references only skills present in the source. This ensures the full
 * init flow (select stack -> accept defaults -> install) can complete without
 * missing skill errors.
 *
 * When `options.relationships` is provided, a `config/skill-rules.ts` file is
 * written to the source with those relationship rules. This enables E2E testing
 * of slug-based relationship resolution via `cc validate --source` and `cc info`.
 */
export async function createE2ESource(options?: E2ESourceOptions): Promise<{
  sourceDir: string;
  tempDir: string;
}> {
  const tempDir = await createTempDir();
  const sourceDir = path.join(tempDir, "source");

  await writeSkills(sourceDir, E2E_SKILLS);
  await writeStacks(sourceDir);
  await writeAgents(sourceDir);

  if (options?.relationships) {
    await writeSkillRules(sourceDir, options.relationships);
  }

  return { sourceDir, tempDir };
}

async function writeSkills(sourceDir: string, skills: E2ESkill[]): Promise<void> {
  for (const skill of skills) {
    const skillDir = path.join(sourceDir, SKILLS_DIR_PATH, skill.category, skill.id);
    await mkdir(skillDir, { recursive: true });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(skill.id, skill.description),
    );

    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      `author: "@agents-inc"\ncategory: ${skill.category}\ndomain: ${skill.domain}\nslug: ${skill.slug}\ntags: []\ndisplayName: ${skill.displayName}\ncliDescription: "${skill.description}"\nusageGuidance: "Use when testing E2E scenarios"\ncontentHash: "a1b2c3d"\n`,
    );
  }
}

async function writeStacks(sourceDir: string): Promise<void> {
  const stacksFilePath = path.join(sourceDir, STACKS_FILE_PATH);
  await mkdir(path.dirname(stacksFilePath), { recursive: true });
  await writeFile(stacksFilePath, renderConfigTs({ stacks: [E2E_STACK] }));
}

async function writeSkillRules(
  sourceDir: string,
  relationships: Partial<RelationshipDefinitions>,
): Promise<void> {
  const rulesFilePath = path.join(sourceDir, SKILL_RULES_PATH);
  await mkdir(path.dirname(rulesFilePath), { recursive: true });

  const fullRelationships: RelationshipDefinitions = {
    conflicts: relationships.conflicts ?? [],
    discourages: relationships.discourages ?? [],
    recommends: relationships.recommends ?? [],
    requires: relationships.requires ?? [],
    alternatives: relationships.alternatives ?? [],
    ...(relationships.compatibleWith ? { compatibleWith: relationships.compatibleWith } : {}),
  };

  await writeFile(
    rulesFilePath,
    renderRulesTs({ version: "1.0.0", relationships: fullRelationships }),
  );
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
      path.join(agentDir, STANDARD_FILES.AGENT_METADATA_YAML),
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
