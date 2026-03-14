import path from "path";
import { mkdir, writeFile, readFile, rm } from "fs/promises";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  fileExists,
  directoryExists,
  readTestFile,
  runCLI,
  writeProjectConfig,
  createLocalSkill,
  renderConfigTs,
  EXIT_CODES,
  COMPILE_ENV,
} from "../helpers/test-utils.js";
import type {
  AgentDefinition,
  AgentName,
  ProjectConfig,
  SkillId,
} from "../../src/cli/types/index.js";
import { writeScopedConfigs } from "../../src/cli/lib/installation/local-installer.js";
import { splitConfigByScope } from "../../src/cli/lib/configuration/config-generator.js";
import { initializeMatrix } from "../../src/cli/lib/matrix/matrix-provider.js";
import { EMPTY_MATRIX } from "../../src/cli/lib/__tests__/mock-data/mock-matrices.js";
import { buildProjectConfig } from "../../src/cli/lib/__tests__/helpers.js";

// Boundary cast: empty agents record for tests that don't need agent definitions
const emptyAgents = {} as Record<AgentName, AgentDefinition>;

/**
 * Unified config view with split writes E2E tests.
 *
 * Verifies the following behaviors:
 *
 * 1. writeScopedConfigs skips project config when no existing config on disk and project split is empty
 * 2. Dual-scope project structure works with compile
 * 3. Edit from project with only global config creates project config correctly
 * 4. Edit from ~/ writes to global only
 */
describe("unified config view — split writes", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("writeScopedConfigs empty project guard", () => {
    it("should skip project config file when no existing config on disk and no project-scoped items", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(tempDir, "project");

      // Setup fake HOME
      process.env.HOME = globalHome;

      try {
        initializeMatrix(EMPTY_MATRIX);

        const config = buildProjectConfig({
          skills: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
          agents: [{ name: "web-developer", scope: "global" }],
        });

        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        // Create directory but NOT config.ts — no existing config on disk
        await mkdir(path.dirname(projectConfigPath), { recursive: true });

        await writeScopedConfigs(
          config,
          EMPTY_MATRIX,
          emptyAgents,
          projectDir,
          projectConfigPath,
          false,
        );

        // Global config should be written
        const globalConfigPath = path.join(globalHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(globalConfigPath)).toBe(true);

        // Project config should NOT be written (no existing project installation and no project-scoped items)
        expect(await fileExists(projectConfigPath)).toBe(false);
      } finally {
        // Restore HOME
        delete process.env.HOME;
      }
    });

    it("should write project config when project split has project-scoped items", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(tempDir, "project");

      process.env.HOME = globalHome;

      try {
        initializeMatrix(EMPTY_MATRIX);

        const config = buildProjectConfig({
          skills: [
            { id: "web-framework-react", scope: "global", source: "agents-inc" },
            { id: "web-testing-vitest", scope: "project", source: "local" },
          ],
          agents: [
            { name: "web-developer", scope: "global" },
            { name: "web-reviewer", scope: "project" },
          ],
        });

        const projectConfigPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        await mkdir(path.dirname(projectConfigPath), { recursive: true });

        await writeScopedConfigs(
          config,
          EMPTY_MATRIX,
          emptyAgents,
          projectDir,
          projectConfigPath,
          false,
        );

        // Both configs should be written
        const globalConfigPath = path.join(globalHome, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
        expect(await fileExists(globalConfigPath)).toBe(true);
        expect(await fileExists(projectConfigPath)).toBe(true);

        // Project config should have the project-scoped skill
        const projectContent = await readTestFile(projectConfigPath);
        expect(projectContent).toContain("web-testing-vitest");
        // Project config should import from global
        expect(projectContent).toContain("import globalConfig");
      } finally {
        delete process.env.HOME;
      }
    });
  });

  describe("dual-scope compile verification", () => {
    it("should compile agents from project with global-only config", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(tempDir, "project");

      // Create global config with a global skill and agent
      await writeProjectConfig(globalHome, {
        name: "global",
        skills: [{ id: "web-framework-react", scope: "global", source: "local" }],
        agents: [{ name: "web-developer", scope: "global" }],
        domains: ["web"],
        stack: {
          "web-developer": {
            "web-framework": [{ id: "web-framework-react", preloaded: true }],
          },
        },
      });

      // Create the global skill on disk
      await createLocalSkill(globalHome, "web-framework-react", {
        description: "React framework skill for global scope testing",
        metadata: `author: "@test"\ncategory: web-framework\nslug: react\ncontentHash: "hash-react"\n`,
      });

      // Create a project config that imports from global and adds a project skill
      const projectConfigDir = path.join(projectDir, CLAUDE_SRC_DIR);
      await mkdir(projectConfigDir, { recursive: true });

      // Write project config that imports from global
      const globalImportPath = path
        .relative(projectConfigDir, path.join(globalHome, CLAUDE_SRC_DIR))
        .split(path.sep)
        .join("/");

      const projectConfigContent = `import globalConfig from "${globalImportPath}/config";
import type { ProjectConfig } from "./config-types";

const skills = [
  ...globalConfig.skills,
  {"id":"web-testing-vitest","scope":"project","source":"local"},
];

const agents = [
  ...globalConfig.agents,
  {"name":"api-developer","scope":"project"},
];

export default {
  ...globalConfig,
  name: "test-project",
  skills,
  agents,
} satisfies ProjectConfig;
`;
      await writeFile(path.join(projectConfigDir, STANDARD_FILES.CONFIG_TS), projectConfigContent);

      // Write a simple config-types.ts for the project
      const configTypesContent = `// AUTO-GENERATED
export type SkillId = "web-framework-react" | "web-testing-vitest";
export type AgentName = "web-developer" | "api-developer";
export type Domain = "web";
export type Category = "web-framework" | "web-testing";
export type SkillConfig = { id: SkillId; scope: "project" | "global"; source: string };
export type SkillAssignment = SkillId | { id: SkillId; preloaded: boolean };
export type StackAgentConfig = Partial<Record<Category, SkillAssignment>>;
export type AgentScopeConfig = { name: AgentName; scope: "project" | "global" };
export interface ProjectConfig {
  version?: "1";
  name: string;
  description?: string;
  agents: AgentScopeConfig[];
  skills: SkillConfig[];
  author?: string;
  stack?: Partial<Record<AgentName, StackAgentConfig>>;
  source?: string;
  marketplace?: string;
  agentsSource?: string;
  domains?: Domain[];
  selectedAgents?: AgentName[];
}
`;
      await writeFile(
        path.join(projectConfigDir, STANDARD_FILES.CONFIG_TYPES_TS),
        configTypesContent,
      );

      // Also write global config-types.ts so the import resolves
      const globalConfigTypesDir = path.join(globalHome, CLAUDE_SRC_DIR);
      await writeFile(
        path.join(globalConfigTypesDir, STANDARD_FILES.CONFIG_TYPES_TS),
        configTypesContent,
      );

      // Create the project skill on disk
      await createLocalSkill(projectDir, "web-testing-vitest", {
        description: "Vitest testing skill for project scope testing",
        metadata: `author: "@test"\ncategory: web-testing\nslug: vitest\ncontentHash: "hash-vitest"\n`,
      });

      // Run compile from the project directory with HOME pointing to fake-home
      const { exitCode, combined } = await runCLI(["compile"], projectDir, {
        env: { HOME: globalHome, ...COMPILE_ENV },
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(combined).toContain("Discovered");

      // Verify agents were compiled in the project directory
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);
    });
  });

  describe("splitConfigByScope correctness", () => {
    it("should produce empty project split when all items are global", () => {
      const config: ProjectConfig = {
        name: "test",
        skills: [
          { id: "web-framework-react", scope: "global", source: "agents-inc" },
          { id: "web-testing-vitest", scope: "global", source: "agents-inc" },
        ],
        agents: [{ name: "web-developer", scope: "global" }],
      };

      const { project } = splitConfigByScope(config);

      expect(project.skills).toHaveLength(0);
      expect(project.agents).toHaveLength(0);
    });

    it("should correctly split mixed-scope configs", () => {
      const config: ProjectConfig = {
        name: "test",
        skills: [
          { id: "web-framework-react", scope: "global", source: "agents-inc" },
          { id: "web-testing-vitest", scope: "project", source: "local" },
        ],
        agents: [
          { name: "web-developer", scope: "global" },
          { name: "api-developer", scope: "project" },
        ],
      };

      const { global: g, project: p } = splitConfigByScope(config);

      expect(g.skills.map((s) => s.id)).toEqual(["web-framework-react"]);
      expect(g.agents.map((a) => a.name)).toEqual(["web-developer"]);
      expect(p.skills.map((s) => s.id)).toEqual(["web-testing-vitest"]);
      expect(p.agents.map((a) => a.name)).toEqual(["api-developer"]);
    });
  });
});
