import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { fileExists, directoryExists, readTestYaml } from "../helpers";

export interface TestSkill {
  id: string;
  name: string;
  alias?: string;
  description: string;
  category: string;
  author: string;
  tags?: string[];
  content?: string;
  forkedFrom?: {
    skill_id: string;
    content_hash: string;
    date: string;
  };
}

export interface TestAgent {
  name: string;
  title: string;
  description: string;
  tools?: string[];
  model?: string;
  permissionMode?: string;
  introContent?: string;
  workflowContent?: string;
}

export interface TestMatrix {
  version: string;
  skills: Record<string, TestSkill>;
  categories: Record<string, { name: string; description: string }>;
  suggestedStacks: Array<{
    id: string;
    name: string;
    description: string;
    allSkillIds: string[];
  }>;
  aliases: Record<string, string>;
}

export interface TestProjectConfig {
  name: string;
  description?: string;
  agents?: string[];
  skills?: Array<string | { id: string }>;
  version?: string;
}

export interface TestPluginManifest {
  name: string;
  version: string;
  description?: string;
}

export interface TestStack {
  id: string;
  name: string;
  description: string;
  agents: Record<string, Record<string, string>>;
  philosophy?: string;
}

export interface TestSourceOptions {
  skills?: TestSkill[];
  agents?: TestAgent[];
  matrix?: Partial<TestMatrix>;
  projectConfig?: TestProjectConfig;
  pluginManifest?: TestPluginManifest;
  /** Create as a plugin structure (in ~/.claude/plugins/claude-collective) */
  asPlugin?: boolean;
  /** Create local skills in .claude/skills/ */
  localSkills?: TestSkill[];
  /** Create config/stacks.yaml with these stack definitions */
  stacks?: TestStack[];
}

export interface TestDirs {
  tempDir: string;
  projectDir: string;
  sourceDir: string;
  skillsDir: string;
  agentsDir: string;
  pluginDir?: string;
  configDir?: string;
}

const TEST_AUTHOR = "@test";

// Default skills for tests
export const DEFAULT_TEST_SKILLS: TestSkill[] = [
  {
    id: "react (@test)",
    name: "react",
    alias: "react",
    description: "React framework for building user interfaces",
    category: "web/framework",
    author: TEST_AUTHOR,
    tags: ["react", "web", "ui"],
    content: `---
name: react
description: React framework for building user interfaces
---

# React

React is a JavaScript library for building user interfaces with components.

## Key Capabilities

- Component-based architecture
- Virtual DOM for performance
- JSX syntax for templates
`,
  },
  {
    id: "zustand (@test)",
    name: "zustand",
    alias: "zustand",
    description: "Bear necessities state management",
    category: "web/state",
    author: TEST_AUTHOR,
    tags: ["state", "react", "zustand"],
    content: `---
name: zustand
description: Bear necessities state management
---

# Zustand

Zustand is a small, fast state management solution for React.

## Key Features

- Simple API
- No boilerplate
- TypeScript support
`,
  },
  {
    id: "vitest (@test)",
    name: "vitest",
    alias: "vitest",
    description: "Next generation testing framework",
    category: "testing",
    author: TEST_AUTHOR,
    tags: ["testing", "vitest", "unit"],
    content: `---
name: vitest
description: Next generation testing framework
---

# Vitest

Vitest is a fast unit test framework powered by Vite.
`,
  },
  {
    id: "hono (@test)",
    name: "hono",
    alias: "hono",
    description: "Lightweight web framework for the edge",
    category: "api/framework",
    author: TEST_AUTHOR,
    tags: ["api", "api", "edge"],
    content: `---
name: hono
description: Lightweight web framework for the edge
---

# Hono

Hono is a small, fast web framework for the edge.
`,
  },
];

// Default agents for tests
export const DEFAULT_TEST_AGENTS: TestAgent[] = [
  {
    name: "web-developer",
    title: "Web Developer",
    description: "Full-stack web development specialist",
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
    permissionMode: "default",
    introContent: "You are a web developer agent.",
    workflowContent: "## Workflow\n\n1. Analyze requirements\n2. Implement solution",
  },
  {
    name: "api-developer",
    title: "API Developer",
    description: "Backend API development specialist",
    tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"],
    model: "opus",
    permissionMode: "default",
    introContent: "You are an API developer agent.",
    workflowContent: "## Workflow\n\n1. Design API\n2. Implement endpoints",
  },
];

export { fileExists, directoryExists };

function generateMatrix(skills: TestSkill[], overrides?: Partial<TestMatrix>): TestMatrix {
  const skillsMap: Record<string, TestSkill> = {};
  const aliases: Record<string, string> = {};
  const categories: Record<string, { name: string; description: string }> = {};

  for (const skill of skills) {
    skillsMap[skill.id] = skill;
    if (skill.alias) {
      aliases[skill.alias] = skill.id;
    }
    // Add category if not exists
    const categoryParts = skill.category.split("/");
    let categoryPath = "";
    for (const part of categoryParts) {
      categoryPath = categoryPath ? `${categoryPath}/${part}` : part;
      if (!categories[categoryPath]) {
        categories[categoryPath] = {
          name: part.charAt(0).toUpperCase() + part.slice(1),
          description: `${part} skills`,
        };
      }
    }
  }

  return {
    version: "1.0.0",
    skills: skillsMap,
    categories,
    suggestedStacks: [],
    aliases,
    ...overrides,
  };
}

/**
 * Creates a complete test source directory structure with skills, agents,
 * matrix config, and optionally a plugin layout. Sets up temp directories
 * that must be cleaned up via cleanupTestSource.
 * @returns TestDirs containing all created directory paths for assertions
 */
export async function createTestSource(options: TestSourceOptions = {}): Promise<TestDirs> {
  const skills = options.skills ?? DEFAULT_TEST_SKILLS;
  const agents = options.agents ?? DEFAULT_TEST_AGENTS;
  const matrix = generateMatrix(skills, options.matrix);

  // Create temp directory
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-test-"));
  const projectDir = path.join(tempDir, "project");
  const sourceDir = path.join(tempDir, "source");
  const skillsDir = path.join(sourceDir, "src", "skills");
  const agentsDir = path.join(sourceDir, "src", "agents");
  const configDir = path.join(sourceDir, "config");

  await mkdir(projectDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });
  await mkdir(configDir, { recursive: true });

  // Write skills-matrix.yaml
  await writeFile(path.join(configDir, "skills-matrix.yaml"), stringifyYaml(matrix));

  // Write config/stacks.yaml if stacks provided
  if (options.stacks && options.stacks.length > 0) {
    await writeFile(path.join(configDir, "stacks.yaml"), stringifyYaml({ stacks: options.stacks }));
  }

  // Write skill files
  for (const skill of skills) {
    const categoryPath = skill.category.replace(/\//g, path.sep);
    const skillDir = path.join(skillsDir, categoryPath, skill.name);
    await mkdir(skillDir, { recursive: true });

    // SKILL.md
    const content =
      skill.content ??
      `---
name: ${skill.name}
description: ${skill.description}
---

# ${skill.name}

${skill.description}
`;
    await writeFile(path.join(skillDir, "SKILL.md"), content);

    // metadata.yaml
    const metadata = {
      version: 1,
      author: skill.author,
      category: skill.category,
      tags: skill.tags ?? [],
    };
    await writeFile(path.join(skillDir, "metadata.yaml"), stringifyYaml(metadata));
  }

  // Write agent partials
  const templatesDir = path.join(agentsDir, "_templates");
  await mkdir(templatesDir, { recursive: true });

  // Write a basic agent.liquid template
  const agentTemplate = `---
name: {{ agent.name }}
description: {{ agent.description }}
tools: {{ agent.tools | join: ", " }}
model: {{ agent.model }}
permissionMode: {{ agent.permission_mode }}
{% if agent.preloaded_skills %}skills: {{ agent.preloaded_skills | join: ", " }}{% endif %}
---

{% include "_partials/intro.liquid" %}

{% for skill in skills %}
{{ skill.content }}
{% endfor %}
`;
  await writeFile(path.join(templatesDir, "agent.liquid"), agentTemplate);

  // Write each agent partial
  for (const agent of agents) {
    const agentDir = path.join(agentsDir, agent.name);
    await mkdir(agentDir, { recursive: true });

    // agent.yaml (uses "id" field to match agentYamlConfigSchema)
    const agentYaml = {
      id: agent.name,
      title: agent.title,
      description: agent.description,
      tools: agent.tools ?? ["Read", "Write", "Edit"],
      model: agent.model ?? "opus",
      permissionMode: agent.permissionMode ?? "default",
    };
    await writeFile(path.join(agentDir, "agent.yaml"), stringifyYaml(agentYaml));

    // intro.md
    await writeFile(
      path.join(agentDir, "intro.md"),
      agent.introContent ?? `# ${agent.title}\n\n${agent.description}`,
    );

    // workflow.md
    await writeFile(
      path.join(agentDir, "workflow.md"),
      agent.workflowContent ?? "## Workflow\n\n1. Analyze\n2. Implement",
    );
  }

  const dirs: TestDirs = {
    tempDir,
    projectDir,
    sourceDir,
    skillsDir,
    agentsDir,
    configDir,
  };

  // Create plugin structure if requested
  if (options.asPlugin) {
    const pluginDir = path.join(projectDir, ".claude", "plugins", "claude-collective");
    await mkdir(pluginDir, { recursive: true });
    await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
    await mkdir(path.join(pluginDir, "agents"), { recursive: true });
    await mkdir(path.join(pluginDir, "skills"), { recursive: true });

    // Write plugin.json
    const manifest = options.pluginManifest ?? {
      name: "claude-collective",
      version: "1.0.0",
      description: "Test plugin",
    };
    await writeFile(
      path.join(pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify(manifest, null, 2),
    );

    // Copy skills to plugin
    for (const skill of skills) {
      const categoryPath = skill.category.replace(/\//g, path.sep);
      const srcSkillDir = path.join(skillsDir, categoryPath, skill.name);
      const destSkillDir = path.join(pluginDir, "skills", skill.name);
      await mkdir(destSkillDir, { recursive: true });

      const skillMdContent = await readFile(path.join(srcSkillDir, "SKILL.md"), "utf-8");
      await writeFile(path.join(destSkillDir, "SKILL.md"), skillMdContent);

      const metadataContent = await readFile(path.join(srcSkillDir, "metadata.yaml"), "utf-8");
      await writeFile(path.join(destSkillDir, "metadata.yaml"), metadataContent);
    }

    // Write config.yaml for plugin
    if (options.projectConfig) {
      await writeFile(path.join(pluginDir, "config.yaml"), stringifyYaml(options.projectConfig));
    }

    dirs.pluginDir = pluginDir;
  }

  // Create project config if requested
  if (options.projectConfig) {
    const projectClaudeDir = path.join(projectDir, ".claude");
    await mkdir(projectClaudeDir, { recursive: true });
    await writeFile(
      path.join(projectClaudeDir, "config.yaml"),
      stringifyYaml(options.projectConfig),
    );
  }

  // Create local skills if requested
  if (options.localSkills && options.localSkills.length > 0) {
    const localSkillsDir = path.join(projectDir, ".claude", "skills");
    await mkdir(localSkillsDir, { recursive: true });

    for (const skill of options.localSkills) {
      const skillDir = path.join(localSkillsDir, skill.name);
      await mkdir(skillDir, { recursive: true });

      // SKILL.md
      const content =
        skill.content ??
        `---
name: ${skill.name}
description: ${skill.description}
---

# ${skill.name}

${skill.description}
`;
      await writeFile(path.join(skillDir, "SKILL.md"), content);

      // metadata.yaml with optional forked_from
      const metadata: Record<string, unknown> = {
        version: 1,
        author: skill.author,
      };
      if (skill.forkedFrom) {
        metadata.forked_from = skill.forkedFrom;
      }
      await writeFile(path.join(skillDir, "metadata.yaml"), stringifyYaml(metadata));
    }
  }

  return dirs;
}

export async function cleanupTestSource(dirs: TestDirs): Promise<void> {
  await rm(dirs.tempDir, { recursive: true, force: true });
}

export async function readTestFile(filePath: string): Promise<string> {
  return readFile(filePath, "utf-8");
}

export { readTestYaml };

export async function readTestJson<T>(filePath: string): Promise<T> {
  const content = await readFile(filePath, "utf-8");
  // Boundary cast: JSON.parse returns `any`, caller provides expected type
  return JSON.parse(content) as T;
}

export async function writeTestFile(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content);
}

export async function writeTestYaml(filePath: string, data: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, stringifyYaml(data));
}
