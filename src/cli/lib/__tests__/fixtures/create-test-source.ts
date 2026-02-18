import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import { DEFAULT_PLUGIN_NAME } from "../../../consts";
import type { CategoryPath, SkillId } from "../../../types";
import {
  fileExists,
  directoryExists,
  readTestYaml,
  createTempDir,
  cleanupTempDir,
} from "../helpers";

export type TestSkill = {
  id: SkillId;
  name: SkillId;
  alias?: string;
  description: string;
  category: CategoryPath;
  author: string;
  tags?: string[];
  content?: string;
  /** Skip metadata.yaml creation for this local skill (for testing missing-metadata warnings) */
  skipMetadata?: boolean;
  forkedFrom?: {
    skill_id: string;
    content_hash: string;
    date: string;
  };
};

export type TestAgent = {
  name: string;
  title: string;
  description: string;
  tools?: string[];
  model?: string;
  permissionMode?: string;
  introContent?: string;
  workflowContent?: string;
};

export type TestMatrix = {
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
};

export type TestProjectConfig = {
  name: string;
  description?: string;
  agents?: string[];
  skills?: Array<string | { id: string }>;
  version?: string;
};

export type TestPluginManifest = {
  name: string;
  version: string;
  description?: string;
};

export type TestStack = {
  id: string;
  name: string;
  description: string;
  agents: Record<string, Record<string, string>>;
  philosophy?: string;
};

export type TestSourceOptions = {
  skills?: TestSkill[];
  agents?: TestAgent[];
  matrix?: Partial<TestMatrix>;
  projectConfig?: TestProjectConfig;
  pluginManifest?: TestPluginManifest;
  /** Create as a plugin structure (in .claude/plugins/<plugin-name>) */
  asPlugin?: boolean;
  /** Create local skills in .claude/skills/ */
  localSkills?: TestSkill[];
  /** Create config/stacks.yaml with these stack definitions */
  stacks?: TestStack[];
};

export type TestDirs = {
  tempDir: string;
  projectDir: string;
  sourceDir: string;
  skillsDir: string;
  agentsDir: string;
  pluginDir?: string;
  configDir?: string;
};

const TEST_AUTHOR = "@test";

/** Valid local skill with SKILL.md and metadata.yaml */
export const VALID_LOCAL_SKILL: TestSkill = {
  id: "web-tooling-valid",
  name: "web-tooling-valid",
  description: "A valid skill",
  category: "web/tooling",
  author: TEST_AUTHOR,
};

/** Skill created WITHOUT metadata.yaml (for testing missing-metadata warnings) */
export const SKILL_WITHOUT_METADATA: TestSkill = {
  id: "web-tooling-incomplete",
  name: "web-tooling-incomplete",
  description: "Missing metadata",
  category: "web/tooling",
  author: TEST_AUTHOR,
  skipMetadata: true,
};

/** Another skill without metadata.yaml (for path warning tests) */
export const SKILL_WITHOUT_METADATA_CUSTOM: TestSkill = {
  id: "web-tooling-custom",
  name: "web-tooling-custom",
  description: "No metadata",
  category: "web/tooling",
  author: TEST_AUTHOR,
  skipMetadata: true,
};

/** Skill used for dry-run tests */
export const DRY_RUN_SKILL: TestSkill = {
  id: "web-tooling-test",
  name: "web-tooling-test",
  description: "Test",
  category: "web/tooling",
  author: TEST_AUTHOR,
};

/** A basic local-only skill (no forked_from) with SKILL.md and metadata.yaml */
export const LOCAL_SKILL_BASIC: TestSkill = {
  id: "web-tooling-my-skill",
  name: "web-tooling-my-skill",
  description: "A test skill",
  category: "web/tooling",
  author: TEST_AUTHOR,
  content: `---
name: my-skill
description: A test skill
category: test
---

# My Skill

Test content here.
`,
};

/** A forked local skill with forked_from metadata for diff/update/outdated commands */
export const LOCAL_SKILL_FORKED: TestSkill = {
  id: "web-tooling-forked-skill",
  name: "web-tooling-forked-skill",
  description: "A forked skill",
  category: "web/tooling",
  author: TEST_AUTHOR,
  content: `---
name: forked-skill
description: A forked skill
category: test
---

# Forked Skill

Local modifications here.
`,
  forkedFrom: {
    skill_id: "web-framework-react",
    content_hash: "abc123",
    date: "2025-01-01",
  },
};

/** A minimal local skill for error handling tests (with forked_from) */
export const LOCAL_SKILL_FORKED_MINIMAL: TestSkill = {
  id: "web-tooling-test-minimal",
  name: "web-tooling-test-minimal",
  description: "Test skill",
  category: "web/tooling",
  author: TEST_AUTHOR,
  content: `---
name: test
---
# Test`,
  forkedFrom: {
    skill_id: "web-framework-react",
    content_hash: "abc",
    date: "2025-01-01",
  },
};

/**
 * Skills used by import:skill integration tests with richer content.
 * These use a plain object type (not TestSkill) because import sources use
 * simple directory names that don't follow the SkillId pattern.
 */
export type ImportSourceSkill = {
  name: string;
  content: string;
  metadata?: Record<string, unknown>;
};

/** React patterns skill with metadata for import integration tests */
export const IMPORT_REACT_PATTERNS_SKILL: ImportSourceSkill = {
  name: "react-patterns",
  content: `---
name: react-patterns
description: React design patterns and best practices
---

# React Patterns

## Component Composition

Use composition over inheritance for flexible component design.

## Hooks Patterns

- Custom hooks for shared logic
- useReducer for complex state
- useMemo for expensive computations
`,
  metadata: {
    version: 1,
    author: "@external-author",
    tags: ["react", "patterns", "web"],
    category: "web/framework",
  },
};

/** Testing utils skill with metadata for import integration tests */
export const IMPORT_TESTING_UTILS_SKILL: ImportSourceSkill = {
  name: "testing-utils",
  content: `---
name: testing-utils
description: Testing utilities and best practices
---

# Testing Utilities

## Unit Testing

Write focused tests that verify single behaviors.

## Integration Testing

Test component interactions and data flow.
`,
  metadata: {
    version: 1,
    author: "@external-author",
    tags: ["testing", "vitest"],
    category: "testing",
  },
};

/** API security skill without metadata for import integration tests */
export const IMPORT_API_SECURITY_SKILL: ImportSourceSkill = {
  name: "api-security",
  content: `---
name: api-security
description: API security patterns and middleware
---

# API Security

## Authentication

Implement JWT-based authentication with refresh tokens.

## Rate Limiting

Apply rate limiting to prevent abuse.
`,
};

export const DEFAULT_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    name: "web-framework-react",
    alias: "web-framework-react",
    description: "React framework for building user interfaces",
    category: "web/framework",
    author: TEST_AUTHOR,
    tags: ["react", "web", "ui"],
    content: `---
name: web-framework-react
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
    id: "web-state-zustand",
    name: "web-state-zustand",
    alias: "web-state-zustand",
    description: "Bear necessities state management",
    category: "web/client-state",
    author: TEST_AUTHOR,
    tags: ["state", "react", "zustand"],
    content: `---
name: web-state-zustand
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
    id: "web-testing-vitest",
    name: "web-testing-vitest",
    alias: "web-testing-vitest",
    description: "Next generation testing framework",
    category: "web/testing",
    author: TEST_AUTHOR,
    tags: ["testing", "vitest", "unit"],
    content: `---
name: web-testing-vitest
description: Next generation testing framework
---

# Vitest

Vitest is a fast unit test framework powered by Vite.
`,
  },
  {
    id: "api-framework-hono",
    name: "api-framework-hono",
    alias: "api-framework-hono",
    description: "Lightweight web framework for the edge",
    category: "api/framework",
    author: TEST_AUTHOR,
    tags: ["api", "hono", "edge"],
    content: `---
name: api-framework-hono
description: Lightweight web framework for the edge
---

# Hono

Hono is a small, fast web framework for the edge.
`,
  },
];

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

/**
 * Generates two matrix representations from skill definitions:
 * 1. `testMatrix` — the internal TestMatrix used by test assertions
 * 2. `diskMatrix` — a skills-matrix.yaml-compatible structure for
 *    `loadSkillsMatrix()` (schema: skillsMatrixConfigSchema)
 *
 * The disk format requires `categories` as CategoryDefinition objects
 * keyed by valid subcategorySchema values, `relationships` (empty arrays),
 * and `skill_aliases` (empty — test aliases are not valid SkillDisplayName
 * enum members). Skill data is loaded separately via `extractAllSkills`.
 */
function generateMatrix(
  skills: TestSkill[],
  overrides?: Partial<TestMatrix>,
): { testMatrix: TestMatrix; diskMatrix: Record<string, unknown> } {
  const skillsMap: Record<string, TestSkill> = {};
  const aliases: Record<string, string> = {};
  const categories: Record<string, { name: string; description: string }> = {};

  for (const skill of skills) {
    skillsMap[skill.id] = skill;
    if (skill.alias) {
      aliases[skill.alias] = skill.id;
    }
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

  const testMatrix: TestMatrix = {
    version: "1.0.0",
    skills: skillsMap,
    categories,
    suggestedStacks: [],
    aliases,
    ...overrides,
  };

  // Build skillsMatrixConfigSchema-compatible structure for disk serialization.
  // Categories need full CategoryDefinition fields keyed by valid subcategory enum values.
  // Skills carry their own category via metadata.yaml — these are only for UI grouping.
  const diskCategories: Record<string, Record<string, unknown>> = {};
  let order = 0;
  const seenSubcategories = new Set<string>();
  for (const [categoryPath, cat] of Object.entries(categories)) {
    const parts = categoryPath.split("/");
    const rawSubcategory = parts[parts.length - 1];
    const subcategory = rawSubcategory;
    // Skip domain-level entries (e.g., "web") and duplicate subcategories
    if (parts.length < 2 || seenSubcategories.has(subcategory)) continue;
    seenSubcategories.add(subcategory);
    const domain = parts[0];
    diskCategories[subcategory] = {
      id: subcategory,
      displayName: cat.name,
      description: cat.description,
      domain,
      exclusive: true,
      required: false,
      order: order++,
    };
  }

  // skill_aliases must be empty — test skill aliases (e.g., "web-framework-react")
  // are not valid skillDisplayNameSchema enum members (which expects values like
  // "react", "zustand", "vitest"). The aliases are only for wizard display names.
  const diskMatrix: Record<string, unknown> = {
    version: "1.0.0",
    categories: diskCategories,
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
    skill_aliases: {},
  };

  return { testMatrix, diskMatrix };
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
  const { diskMatrix } = generateMatrix(skills, options.matrix);

  const tempDir = await createTempDir("cc-test-");
  const projectDir = path.join(tempDir, "project");
  const sourceDir = path.join(tempDir, "source");
  const skillsDir = path.join(sourceDir, "src", "skills");
  const agentsDir = path.join(sourceDir, "src", "agents");
  const configDir = path.join(sourceDir, "config");

  await mkdir(projectDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });
  await mkdir(configDir, { recursive: true });

  await writeFile(path.join(configDir, "skills-matrix.yaml"), stringifyYaml(diskMatrix));

  if (options.stacks && options.stacks.length > 0) {
    await writeFile(path.join(configDir, "stacks.yaml"), stringifyYaml({ stacks: options.stacks }));
  }

  for (const skill of skills) {
    const categoryPath = skill.category.replace(/\//g, path.sep);
    const skillDir = path.join(skillsDir, categoryPath, skill.name);
    await mkdir(skillDir, { recursive: true });

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

    const metadata = {
      version: 1,
      author: skill.author,
      category: skill.category,
      tags: skill.tags ?? [],
      // cli_name is required by extractAllSkills for source-based matrix loading
      cli_name: skill.name,
    };
    await writeFile(path.join(skillDir, "metadata.yaml"), stringifyYaml(metadata));
  }

  const templatesDir = path.join(agentsDir, "_templates");
  await mkdir(templatesDir, { recursive: true });

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

  for (const agent of agents) {
    const agentDir = path.join(agentsDir, agent.name);
    await mkdir(agentDir, { recursive: true });

    const agentYaml = {
      id: agent.name,
      title: agent.title,
      description: agent.description,
      tools: agent.tools ?? ["Read", "Write", "Edit"],
      model: agent.model ?? "opus",
      permissionMode: agent.permissionMode ?? "default",
    };
    await writeFile(path.join(agentDir, "agent.yaml"), stringifyYaml(agentYaml));

    await writeFile(
      path.join(agentDir, "intro.md"),
      agent.introContent ?? `# ${agent.title}\n\n${agent.description}`,
    );

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

  if (options.asPlugin) {
    const pluginDir = path.join(projectDir, ".claude", "plugins", DEFAULT_PLUGIN_NAME);
    await mkdir(pluginDir, { recursive: true });
    await mkdir(path.join(pluginDir, ".claude-plugin"), { recursive: true });
    await mkdir(path.join(pluginDir, "agents"), { recursive: true });
    await mkdir(path.join(pluginDir, "skills"), { recursive: true });

    const manifest = options.pluginManifest ?? {
      name: DEFAULT_PLUGIN_NAME,
      version: "1.0.0",
      description: "Test plugin",
    };
    await writeFile(
      path.join(pluginDir, ".claude-plugin", "plugin.json"),
      JSON.stringify(manifest, null, 2),
    );

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

    if (options.projectConfig) {
      await writeFile(path.join(pluginDir, "config.yaml"), stringifyYaml(options.projectConfig));
    }

    dirs.pluginDir = pluginDir;
  }

  if (options.projectConfig) {
    const projectClaudeDir = path.join(projectDir, ".claude");
    await mkdir(projectClaudeDir, { recursive: true });
    await writeFile(
      path.join(projectClaudeDir, "config.yaml"),
      stringifyYaml(options.projectConfig),
    );
  }

  if (options.localSkills && options.localSkills.length > 0) {
    const localSkillsDir = path.join(projectDir, ".claude", "skills");
    await mkdir(localSkillsDir, { recursive: true });

    for (const skill of options.localSkills) {
      const skillDir = path.join(localSkillsDir, skill.name);
      await mkdir(skillDir, { recursive: true });

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

      if (!skill.skipMetadata) {
        const metadata: Record<string, unknown> = {
          cli_name: skill.name,
          version: 1,
          author: skill.author,
        };
        if (skill.forkedFrom) {
          metadata.forked_from = skill.forkedFrom;
        }
        await writeFile(path.join(skillDir, "metadata.yaml"), stringifyYaml(metadata));
      }
    }
  }

  return dirs;
}

export async function cleanupTestSource(dirs: TestDirs): Promise<void> {
  await cleanupTempDir(dirs.tempDir);
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
