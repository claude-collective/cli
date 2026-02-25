import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { readFile, readdir } from "fs/promises";
import { parse as parseYaml } from "yaml";

import { installLocal } from "../../installation/local-installer";
import { recompileAgents } from "../../agents/agent-recompiler";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestSkill,
} from "../fixtures/create-test-source";
import type { AgentName, CategoryPath, ProjectConfig, SkillId } from "../../../types";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, DEFAULT_PLUGIN_NAME, STANDARD_FILES } from "../../../consts";
import {
  createMockSkill,
  createMockMatrix,
  fileExists,
  directoryExists,
  buildWizardResult,
  buildSourceResult,
} from "../helpers";

const PIPELINE_TEST_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    name: "web-framework-react",
    description: "React framework for building user interfaces",
    category: "web-framework",
    author: "@test",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework for building user interfaces
---

# React

React is a JavaScript library for building user interfaces.
Use component-based architecture with JSX.
`,
  },
  {
    id: "web-state-zustand",
    name: "web-state-zustand",
    description: "Bear necessities state management",
    category: "web-client-state",
    author: "@test",
    tags: ["state", "zustand"],
    content: `---
name: web-state-zustand
description: Bear necessities state management
---

# Zustand

Zustand is a minimal state management library for React.
`,
  },
  {
    id: "web-styling-scss-modules",
    name: "web-styling-scss-modules",
    description: "CSS Modules with SCSS",
    category: "web-styling",
    author: "@test",
    tags: ["css", "scss"],
    content: `---
name: web-styling-scss-modules
description: CSS Modules with SCSS
---

# SCSS Modules

Use CSS Modules with SCSS for scoped styling.
`,
  },
  {
    id: "web-testing-vitest",
    name: "web-testing-vitest",
    description: "Next generation testing framework",
    category: "web-testing",
    author: "@test",
    tags: ["testing", "vitest"],
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
    description: "Lightweight web framework for the edge",
    category: "api-api",
    author: "@test",
    tags: ["api", "hono"],
    content: `---
name: api-framework-hono
description: Lightweight web framework for the edge
---

# Hono

Hono is a fast web framework for the edge.
`,
  },
  {
    id: "api-database-drizzle",
    name: "api-database-drizzle",
    description: "TypeScript ORM for SQL databases",
    category: "api-database",
    author: "@test",
    tags: ["database", "orm"],
    content: `---
name: api-database-drizzle
description: TypeScript ORM for SQL databases
---

# Drizzle ORM

Drizzle is a lightweight TypeScript ORM.
`,
  },
  {
    id: "api-security-auth-patterns",
    name: "api-security-auth-patterns",
    description: "Authentication and authorization patterns",
    category: "api-security",
    author: "@test",
    tags: ["auth", "security"],
    content: `---
name: api-security-auth-patterns
description: Authentication and authorization patterns
---

# Auth Patterns

JWT-based authentication and role-based authorization.
`,
  },
  {
    id: "web-accessibility-a11y",
    name: "web-accessibility-a11y",
    description: "Web accessibility best practices",
    category: "web-accessibility",
    author: "@test",
    tags: ["a11y", "accessibility"],
    content: `---
name: web-accessibility-a11y
description: Web accessibility best practices
---

# Accessibility

Follow WCAG 2.1 guidelines for accessible web applications.
`,
  },
  {
    id: "meta-methodology-investigation",
    name: "meta-methodology-investigation",
    description: "Investigation before implementation",
    category: "shared-methodology",
    author: "@test",
    tags: ["methodology"],
    content: `---
name: meta-methodology-investigation
description: Investigation before implementation
---

# Investigation Requirements

Always investigate before implementing. Read the code first.
`,
  },
  {
    id: "web-animation-framer",
    name: "web-animation-framer",
    description: "Framer Motion animation library",
    category: "web-animation",
    author: "@test",
    tags: ["animation", "framer"],
    content: `---
name: web-animation-framer
description: Framer Motion animation library
---

# Framer Motion

Production-ready motion library for React.
`,
  },
];

const SKILL_NAMES = PIPELINE_TEST_SKILLS.map((s) => s.name);

const PIPELINE_MATRIX = createMockMatrix(
  Object.fromEntries(
    PIPELINE_TEST_SKILLS.map((skill) => [
      skill.name,
      createMockSkill(skill.name as SkillId, skill.category as CategoryPath, {
        description: skill.description,
        tags: skill.tags ?? [],
        author: skill.author,
        path: `skills/${skill.category}/${skill.name}/`,
      }),
    ]),
  ),
);

const PIPELINE_AGENTS: AgentName[] = ["web-developer", "api-developer"];

describe("Integration: Wizard -> Init -> Compile Pipeline", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: PIPELINE_TEST_SKILLS });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  describe("Scenario 1: Full pipeline with 10 skills from scratch flow", () => {
    it("should install skills, generate config, and compile agents", async () => {
      const wizardResult = buildWizardResult([], {
        selectedSkills: SKILL_NAMES,
        selectedAgents: PIPELINE_AGENTS,
        installMode: "local",
        domainSelections: {
          web: {
            "web-framework": ["web-framework-react"],
            "web-client-state": ["web-state-zustand"],
            "web-styling": ["web-styling-scss-modules"],
          },
          api: {
            "api-api": ["api-framework-hono"],
            "api-database": ["api-database-drizzle"],
          },
        },
      });

      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const configPath = path.join(dirs.projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
      expect(await fileExists(configPath)).toBe(true);
      expect(installResult.configPath).toBe(configPath);

      const configContent = await readFile(configPath, "utf-8");
      // Boundary cast: YAML parse returns `unknown`
      const config = parseYaml(configContent) as ProjectConfig;

      expect(config.name).toBe(DEFAULT_PLUGIN_NAME);
      expect(config.skills).toBeDefined();
      expect(Array.isArray(config.skills)).toBe(true);
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
      expect(config.installMode).toBe("local");

      const skillsDir = path.join(dirs.projectDir, CLAUDE_DIR, "skills");
      expect(await directoryExists(skillsDir)).toBe(true);
      expect(installResult.skillsDir).toBe(skillsDir);

      expect(installResult.copiedSkills.length).toBe(PIPELINE_TEST_SKILLS.length);

      const agentsDir = path.join(dirs.projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);
      expect(installResult.agentsDir).toBe(agentsDir);

      expect(installResult.compiledAgents.length).toBeGreaterThan(0);
      for (const agentName of installResult.compiledAgents) {
        const agentFilePath = path.join(agentsDir, `${agentName}.md`);
        expect(await fileExists(agentFilePath)).toBe(true);
      }

      for (const agentName of installResult.compiledAgents) {
        const agentFilePath = path.join(agentsDir, `${agentName}.md`);
        const agentContent = await readFile(agentFilePath, "utf-8");
        expect(agentContent.length).toBeGreaterThan(0);
      }
    });

    it("should produce agents that contain skill content from source", async () => {
      const wizardResult = buildWizardResult([], {
        selectedSkills: SKILL_NAMES,
        selectedAgents: PIPELINE_AGENTS,
        installMode: "local",
      });
      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      let foundSkillContent = false;
      for (const agentName of installResult.compiledAgents) {
        const agentFilePath = path.join(dirs.projectDir, CLAUDE_DIR, "agents", `${agentName}.md`);
        const agentContent = await readFile(agentFilePath, "utf-8");

        for (const skill of PIPELINE_TEST_SKILLS) {
          if (agentContent.includes(skill.description) || agentContent.includes(skill.name)) {
            foundSkillContent = true;
            break;
          }
        }
        if (foundSkillContent) break;
      }

      expect(foundSkillContent).toBe(true);
    });
  });

  describe("Scenario 2: Compile round-trip (init then recompile)", () => {
    it("should recompile agents from installLocal output", async () => {
      const wizardResult = buildWizardResult([], {
        selectedSkills: SKILL_NAMES,
        selectedAgents: PIPELINE_AGENTS,
        installMode: "local",
      });
      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const initialAgentCount = installResult.compiledAgents.length;
      expect(initialAgentCount).toBeGreaterThan(0);

      const initialAgentContents: Record<string, string> = {};
      for (const agentName of installResult.compiledAgents) {
        const agentPath = path.join(dirs.projectDir, CLAUDE_DIR, "agents", `${agentName}.md`);
        initialAgentContents[agentName] = await readFile(agentPath, "utf-8");
      }

      // In local mode, pluginDir is the project dir itself
      const recompileResult = await recompileAgents({
        pluginDir: dirs.projectDir,
        sourcePath: dirs.sourceDir,
        projectDir: dirs.projectDir,
        outputDir: path.join(dirs.projectDir, CLAUDE_DIR, "agents"),
      });

      expect(recompileResult.failed.length).toBe(0);
      expect(recompileResult.compiled.length).toBeGreaterThan(0);

      for (const agentName of recompileResult.compiled) {
        const agentPath = path.join(dirs.projectDir, CLAUDE_DIR, "agents", `${agentName}.md`);
        expect(await fileExists(agentPath)).toBe(true);

        const recompiledContent = await readFile(agentPath, "utf-8");
        expect(recompiledContent.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Scenario 3: Config integrity through the pipeline", () => {
    it("should preserve skill list and agent assignments through install and config write", async () => {
      const SUBSET_COUNT = 5;
      const selectedSkills = SKILL_NAMES.slice(0, SUBSET_COUNT);

      const wizardResult = buildWizardResult([], {
        selectedSkills,
        selectedAgents: PIPELINE_AGENTS,
        installMode: "local",
      });
      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const configContent = await readFile(installResult.configPath, "utf-8");
      // Boundary cast: YAML parse returns `unknown`
      const config = parseYaml(configContent) as ProjectConfig;

      for (const skillId of selectedSkills) {
        expect(config.skills).toContain(skillId);
      }
      expect(config.skills?.length).toBe(SUBSET_COUNT);

      expect(installResult.copiedSkills.length).toBe(SUBSET_COUNT);
      const copiedSkillIds = installResult.copiedSkills.map((s) => s.skillId);
      for (const skillId of selectedSkills) {
        expect(copiedSkillIds).toContain(skillId);
      }

      expect(config.agents.length).toBeGreaterThan(0);
    });

    it("should set source metadata in config when sourceFlag is provided", async () => {
      const selectedSkills = SKILL_NAMES.slice(0, 3);

      const wizardResult = buildWizardResult([], {
        selectedSkills,
        selectedAgents: PIPELINE_AGENTS,
        installMode: "local",
      });
      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir, {
        marketplace: "test-marketplace",
      });

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
        sourceFlag: "github:my-org/skills",
      });

      const configContent = await readFile(
        path.join(dirs.projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML),
        "utf-8",
      );
      // Boundary cast: YAML parse returns `unknown`
      const config = parseYaml(configContent) as ProjectConfig;

      expect(config.source).toBe("github:my-org/skills");
      expect(config.marketplace).toBe("test-marketplace");
    });
  });

  describe("Scenario 4: Directory structure verification", () => {
    it("should create complete directory structure matching init expectations", async () => {
      const wizardResult = buildWizardResult([], {
        selectedSkills: SKILL_NAMES,
        selectedAgents: PIPELINE_AGENTS,
        installMode: "local",
      });
      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Verify the exact directory structure init is expected to create:
      // project/
      //   .claude-src/
      //     config.yaml
      //   .claude/
      //     skills/
      //       <skill-name>/  (flattened, using skill ID as folder name)
      //         SKILL.md
      //         metadata.yaml
      //     agents/
      //       <agent-name>.md

      expect(
        await fileExists(path.join(dirs.projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML)),
      ).toBe(true);

      const skillsDir = path.join(dirs.projectDir, CLAUDE_DIR, "skills");
      expect(await directoryExists(skillsDir)).toBe(true);

      const skillDirs = await readdir(skillsDir);
      expect(skillDirs.length).toBe(PIPELINE_TEST_SKILLS.length);

      for (const skillDir of skillDirs) {
        const skillMdPath = path.join(skillsDir, skillDir, STANDARD_FILES.SKILL_MD);
        expect(await fileExists(skillMdPath)).toBe(true);
      }

      const agentsDir = path.join(dirs.projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);

      const agentFiles = await readdir(agentsDir);
      expect(agentFiles.length).toBeGreaterThan(0);

      for (const agentFile of agentFiles) {
        expect(agentFile.endsWith(".md")).toBe(true);
      }
    });
  });
});
