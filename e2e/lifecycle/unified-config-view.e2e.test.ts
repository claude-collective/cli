import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, afterEach, beforeAll } from "vitest";
import { DIRS, EXIT_CODES, FILES } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  writeProjectConfig,
  createLocalSkill,
} from "../helpers/test-utils.js";
import { CLI } from "../fixtures/cli.js";

/**
 * Unified config view -- dual-scope compile verification E2E test.
 *
 * Verifies that a project with both global and project configs can compile.
 */
describe("unified config view -- split writes", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe("dual-scope compile verification", () => {
    it("should compile agents from project with global-only config", async () => {
      tempDir = await createTempDir();
      const globalHome = path.join(tempDir, "fake-home");
      const projectDir = path.join(tempDir, "project");

      // Create global config with a global skill and agent
      await writeProjectConfig(globalHome, {
        name: "global",
        skills: [{ id: "web-framework-react", scope: "global", source: "eject" }],
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
      const projectConfigDir = path.join(projectDir, DIRS.CLAUDE_SRC);
      await mkdir(projectConfigDir, { recursive: true });

      // Write project config that imports from global
      const globalImportPath = path
        .relative(projectConfigDir, path.join(globalHome, DIRS.CLAUDE_SRC))
        .split(path.sep)
        .join("/");

      const projectConfigContent = `import globalConfig from "${globalImportPath}/config";
import type { ProjectConfig } from "./config-types";

const skills = [
  ...globalConfig.skills,
  {"id":"web-testing-vitest","scope":"project","source":"eject"},
];

const agents = [
  ...globalConfig.agents,
  {"name":"api-developer","scope":"project"},
];

export default {
  ...globalConfig,
  name: "test-project",
  skills,
  agents } satisfies ProjectConfig;
`;
      await writeFile(path.join(projectConfigDir, FILES.CONFIG_TS), projectConfigContent);

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
      await writeFile(path.join(projectConfigDir, FILES.CONFIG_TYPES_TS), configTypesContent);

      // Also write global config-types.ts so the import resolves
      const globalConfigTypesDir = path.join(globalHome, DIRS.CLAUDE_SRC);
      await writeFile(path.join(globalConfigTypesDir, FILES.CONFIG_TYPES_TS), configTypesContent);

      // Create the project skill on disk
      await createLocalSkill(projectDir, "web-testing-vitest", {
        description: "Vitest testing skill for project scope testing",
        metadata: `author: "@test"\ncategory: web-testing\nslug: vitest\ncontentHash: "hash-vitest"\n`,
      });

      // Run compile from the project directory with HOME pointing to fake-home
      const { exitCode, output } = await CLI.run(
        ["compile"],
        { dir: projectDir },
        { env: { HOME: globalHome } },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Discovered");

      // Verify agents were compiled in the project directory
      const agentsDir = path.join(projectDir, DIRS.CLAUDE, "agents");
      expect(await directoryExists(agentsDir)).toBe(true);
    });
  });
});
