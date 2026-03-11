import path from "path";
import { mkdir, writeFile, readFile } from "fs/promises";
import { stringify as stringifyYaml } from "yaml";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  DEFAULT_PLUGIN_NAME,
  PLUGINS_SUBDIR,
  PLUGIN_MANIFEST_DIR,
  PLUGIN_MANIFEST_FILE,
  STANDARD_DIRS,
  STANDARD_FILES,
} from "../../../consts";
import type { ExtractedSkillMetadata } from "../../../types";
import { computeSkillFolderHash } from "../../versioning";
import {
  fileExists,
  directoryExists,
  readTestYaml,
  createTempDir,
  cleanupTempDir,
} from "../helpers";
import { renderSkillMd, renderConfigTs } from "../content-generators";
import { DEFAULT_TEST_SKILLS } from "../mock-data/mock-skills";

export type TestSkill = Pick<
  ExtractedSkillMetadata,
  "id" | "slug" | "description" | "category" | "author" | "domain" | "displayName" | "usageGuidance"
> & {
  tags?: string[];
  content?: string;
  cliDescription?: string;
  /** Skip metadata.yaml creation for this local skill (for testing missing-metadata warnings) */
  skipMetadata?: boolean;
  forkedFrom?: {
    skillId: string;
    contentHash: string;
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
  /** Create config/stacks.ts with these stack definitions */
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
  slug: "tooling",
  displayName: "Valid",
  description: "A valid skill",
  category: "web-tooling",
  author: TEST_AUTHOR,
  domain: "web",
};

/** Skill created WITHOUT metadata.yaml (for testing missing-metadata warnings) */
export const SKILL_WITHOUT_METADATA: TestSkill = {
  id: "web-tooling-incomplete",
  slug: "storybook",
  displayName: "Incomplete",
  description: "Missing metadata",
  category: "web-tooling",
  author: TEST_AUTHOR,
  domain: "web",
  skipMetadata: true,
};

/** Another skill without metadata.yaml (for path warning tests) */
export const SKILL_WITHOUT_METADATA_CUSTOM: TestSkill = {
  id: "web-tooling-custom",
  slug: "security",
  displayName: "Custom",
  description: "No metadata",
  category: "web-tooling",
  author: TEST_AUTHOR,
  domain: "web",
  skipMetadata: true,
};

/** A basic local-only skill (no forkedFrom) with SKILL.md and metadata.yaml */
export const LOCAL_SKILL_BASIC: TestSkill = {
  id: "web-tooling-my-skill",
  slug: "tooling",
  displayName: "My Skill",
  description: "A test skill",
  category: "web-tooling",
  author: TEST_AUTHOR,
  domain: "web",
  content: `---
name: my-skill
description: A test skill
category: test
---

# My Skill

Test content here.
`,
};

/** A forked local skill with forkedFrom metadata for diff/update/outdated commands */
export const LOCAL_SKILL_FORKED: TestSkill = {
  id: "web-tooling-forked-skill",
  slug: "tooling",
  displayName: "Forked Skill",
  description: "A forked skill",
  category: "web-tooling",
  author: TEST_AUTHOR,
  domain: "web",
  content: `---
name: forked-skill
description: A forked skill
category: test
---

# Forked Skill

Local modifications here.
`,
  forkedFrom: {
    skillId: "web-framework-react",
    contentHash: "abc123",
    date: "2025-01-01",
  },
};

/** A minimal local skill for error handling tests (with forkedFrom) */
export const LOCAL_SKILL_FORKED_MINIMAL: TestSkill = {
  id: "web-tooling-test-minimal",
  slug: "env",
  displayName: "Test Minimal",
  description: "Test skill",
  category: "web-tooling",
  author: TEST_AUTHOR,
  domain: "web",
  content: `---
name: test
---
# Test`,
  forkedFrom: {
    skillId: "web-framework-react",
    contentHash: "abc",
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
    author: "@external-author",
    tags: ["react", "patterns", "web"],
    category: "web-framework",
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
    author: "@external-author",
    tags: ["testing", "vitest"],
    category: "web-testing",
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

export {
  EXTRA_DOMAIN_TEST_SKILLS,
  COMPILE_LOCAL_SKILL,
  DEFAULT_TEST_SKILLS,
} from "../mock-data/mock-skills";

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
 * Generates matrix representations from skill definitions:
 * 1. `testMatrix` — the internal TestMatrix used by test assertions
 * 2. `diskCategories` — a skill-categories.ts-compatible structure
 * 3. `diskRules` — a skill-rules.ts-compatible structure (empty relationships)
 *
 * The disk format requires `categories` as CategoryDefinition objects
 * keyed by valid categorySchema values. Skill data is loaded separately
 * via `extractAllSkills`.
 */
function generateMatrix(
  skills: TestSkill[],
  overrides?: Partial<TestMatrix>,
): {
  testMatrix: TestMatrix;
  diskCategories: Record<string, unknown>;
  diskRules: Record<string, unknown>;
} {
  const skillsMap: Record<string, TestSkill> = {};
  const categories: Record<string, { name: string; description: string }> = {};

  for (const skill of skills) {
    skillsMap[skill.id] = skill;
    // Category is hyphen-separated (e.g., "web-framework", "api-api")
    const category = skill.category;
    if (!categories[category]) {
      // Extract display-friendly name from the category part after the domain prefix
      const dashIndex = category.indexOf("-");
      const categoryPart = dashIndex >= 0 ? category.slice(dashIndex + 1) : category;
      categories[category] = {
        name: categoryPart.charAt(0).toUpperCase() + categoryPart.slice(1),
        description: `${categoryPart} skills`,
      };
    }
  }

  const testMatrix: TestMatrix = {
    version: "1.0.0",
    skills: skillsMap,
    categories,
    suggestedStacks: [],
    ...overrides,
  };

  // Build skill-categories.ts-compatible structure for disk serialization.
  // Categories need full CategoryDefinition fields keyed by valid category enum values.
  // Skills carry their own category via metadata.yaml — these are only for UI grouping.
  const diskCategoriesMap: Record<string, Record<string, unknown>> = {};
  let order = 0;
  for (const [category, cat] of Object.entries(categories)) {
    // Category keys are already domain-prefixed (e.g., "web-framework", "api-api")
    const dashIndex = category.indexOf("-");
    const domain = dashIndex >= 0 ? category.slice(0, dashIndex) : category;
    diskCategoriesMap[category] = {
      id: category,
      displayName: cat.name,
      description: cat.description,
      domain,
      exclusive: true,
      required: false,
      order: order++,
    };
  }

  const diskCategories = {
    version: "1.0.0",
    categories: diskCategoriesMap,
  };

  const diskRules = {
    version: "1.0.0",
    relationships: {
      conflicts: [],
      discourages: [],
      recommends: [],
      requires: [],
      alternatives: [],
    },
  };

  return { testMatrix, diskCategories, diskRules };
}

/**
 * Creates a complete test source directory structure with skills, agents,
 * categories/rules config, and optionally a plugin layout. Sets up temp
 * directories that must be cleaned up via cleanupTestSource.
 * @returns TestDirs containing all created directory paths for assertions
 */
export async function createTestSource(options: TestSourceOptions = {}): Promise<TestDirs> {
  const skills = options.skills ?? DEFAULT_TEST_SKILLS;
  const agents = options.agents ?? DEFAULT_TEST_AGENTS;
  const { diskCategories, diskRules } = generateMatrix(skills, options.matrix);

  const tempDir = await createTempDir("ai-test-");
  const projectDir = path.join(tempDir, "project");
  const sourceDir = path.join(tempDir, "source");
  const skillsDir = path.join(sourceDir, "src", "skills");
  const agentsDir = path.join(sourceDir, "src", "agents");
  const configDir = path.join(sourceDir, "config");

  await mkdir(projectDir, { recursive: true });
  await mkdir(skillsDir, { recursive: true });
  await mkdir(agentsDir, { recursive: true });
  await mkdir(configDir, { recursive: true });

  await writeFile(path.join(configDir, "skill-categories.ts"), renderConfigTs(diskCategories));
  await writeFile(path.join(configDir, "skill-rules.ts"), renderConfigTs(diskRules));

  if (options.stacks && options.stacks.length > 0) {
    await writeFile(path.join(configDir, "stacks.ts"), renderConfigTs({ stacks: options.stacks }));
  }

  for (const skill of skills) {
    const skillDir = path.join(skillsDir, skill.category, skill.id);
    await mkdir(skillDir, { recursive: true });

    const content = skill.content ?? renderSkillMd(skill.id, skill.description);
    await writeFile(path.join(skillDir, STANDARD_FILES.SKILL_MD), content);

    const contentHash = await computeSkillFolderHash(skillDir);
    const domain = skill.domain;
    const slug = skill.slug;
    const metadata = {
      author: skill.author,
      category: skill.category,
      domain,
      tags: skill.tags ?? [],
      // displayName is required by extractAllSkills for source-based matrix loading
      displayName: skill.id,
      slug,
      contentHash,
    };
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));
  }

  const templatesDir = path.join(agentsDir, "_templates");
  await mkdir(templatesDir, { recursive: true });

  const agentTemplate = `---
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
    await writeFile(
      path.join(agentDir, STANDARD_FILES.AGENT_METADATA_YAML),
      stringifyYaml(agentYaml),
    );

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
    const pluginDir = path.join(projectDir, CLAUDE_DIR, PLUGINS_SUBDIR, DEFAULT_PLUGIN_NAME);
    await mkdir(pluginDir, { recursive: true });
    await mkdir(path.join(pluginDir, PLUGIN_MANIFEST_DIR), { recursive: true });
    await mkdir(path.join(pluginDir, "agents"), { recursive: true });
    await mkdir(path.join(pluginDir, STANDARD_DIRS.SKILLS), { recursive: true });

    const manifest = options.pluginManifest ?? {
      name: DEFAULT_PLUGIN_NAME,
      version: "1.0.0",
      description: "Test plugin",
    };
    await writeFile(
      path.join(pluginDir, PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE),
      JSON.stringify(manifest, null, 2),
    );

    for (const skill of skills) {
      const categoryPath = skill.category;
      const srcSkillDir = path.join(skillsDir, categoryPath, skill.id);
      const destSkillDir = path.join(pluginDir, STANDARD_DIRS.SKILLS, skill.id);
      await mkdir(destSkillDir, { recursive: true });

      const skillMdContent = await readFile(
        path.join(srcSkillDir, STANDARD_FILES.SKILL_MD),
        "utf-8",
      );
      await writeFile(path.join(destSkillDir, STANDARD_FILES.SKILL_MD), skillMdContent);

      const metadataContent = await readFile(
        path.join(srcSkillDir, STANDARD_FILES.METADATA_YAML),
        "utf-8",
      );
      await writeFile(path.join(destSkillDir, STANDARD_FILES.METADATA_YAML), metadataContent);
    }

    if (options.projectConfig) {
      await writeFile(
        path.join(pluginDir, STANDARD_FILES.CONFIG_TS),
        renderConfigTs(options.projectConfig),
      );
    }

    dirs.pluginDir = pluginDir;
  }

  if (options.projectConfig) {
    const projectClaudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
    await mkdir(projectClaudeSrcDir, { recursive: true });
    await writeFile(
      path.join(projectClaudeSrcDir, STANDARD_FILES.CONFIG_TS),
      renderConfigTs(options.projectConfig),
    );
  }

  if (options.localSkills && options.localSkills.length > 0) {
    const localSkillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    await mkdir(localSkillsDir, { recursive: true });

    for (const skill of options.localSkills) {
      const skillDir = path.join(localSkillsDir, skill.id);
      await mkdir(skillDir, { recursive: true });

      const content = skill.content ?? renderSkillMd(skill.id, skill.description);
      await writeFile(path.join(skillDir, STANDARD_FILES.SKILL_MD), content);

      if (!skill.skipMetadata) {
        const localDomain = skill.domain;
        const metadata: Record<string, unknown> = {
          displayName: skill.id,
          author: skill.author,
          domain: localDomain,
        };
        if (skill.forkedFrom) {
          metadata.forkedFrom = skill.forkedFrom;
        }
        await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), stringifyYaml(metadata));
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
