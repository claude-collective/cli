import { afterEach, beforeEach, describe, expect, it } from "vitest";
import path from "path";
import { readFile, readdir } from "fs/promises";
import { readTestTsConfig } from "../helpers";

import { installLocal } from "../../installation/local-installer";
import { recompileAgents } from "../../agents/agent-recompiler";
import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import type { AgentName, ProjectConfig } from "../../../types";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, DEFAULT_PLUGIN_NAME, STANDARD_DIRS, STANDARD_FILES } from "../../../consts";
import {
  createMockMatrix,
  testSkillToResolvedSkill,
  fileExists,
  directoryExists,
  buildWizardResult,
  buildSkillConfigs,
  buildSourceResult,
} from "../helpers";
import { useMatrixStore } from "../../../stores/matrix-store";
import { PIPELINE_TEST_SKILLS } from "../mock-data/mock-skills.js";

const SKILL_NAMES = PIPELINE_TEST_SKILLS.map((s) => s.id);

const PIPELINE_MATRIX = createMockMatrix(
  Object.fromEntries(
    PIPELINE_TEST_SKILLS.map((skill) => [skill.id, testSkillToResolvedSkill(skill)]),
  ),
);

const PIPELINE_AGENTS: AgentName[] = ["web-developer", "api-developer"];

describe("Integration: Wizard -> Init -> Compile Pipeline", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: PIPELINE_TEST_SKILLS });
    useMatrixStore.getState().setMatrix(PIPELINE_MATRIX);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  describe("Scenario 1: Full pipeline with 7 skills from scratch flow", () => {
    it("should install skills, generate config, and compile agents", async () => {
      const wizardResult = buildWizardResult(buildSkillConfigs(SKILL_NAMES), {
        selectedAgents: PIPELINE_AGENTS,
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

      const configPath = path.join(dirs.projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS);
      expect(await fileExists(configPath)).toBe(true);
      expect(installResult.configPath).toBe(configPath);

      // Boundary cast: config parse returns `unknown`
      const config = await readTestTsConfig<ProjectConfig>(configPath);

      expect(config.name).toBe(DEFAULT_PLUGIN_NAME);
      expect(config.skills).toBeDefined();
      expect(Array.isArray(config.skills)).toBe(true);
      expect(config.agents).toBeDefined();
      expect(config.agents.length).toBeGreaterThan(0);
      const skillsDir = path.join(dirs.projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
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
      const wizardResult = buildWizardResult(buildSkillConfigs(SKILL_NAMES), {
        selectedAgents: PIPELINE_AGENTS,
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
          if (agentContent.includes(skill.description) || agentContent.includes(skill.id)) {
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
      const wizardResult = buildWizardResult(buildSkillConfigs(SKILL_NAMES), {
        selectedAgents: PIPELINE_AGENTS,
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

      const wizardResult = buildWizardResult(buildSkillConfigs(selectedSkills), {
        selectedAgents: PIPELINE_AGENTS,
      });
      const sourceResult = buildSourceResult(PIPELINE_MATRIX, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Boundary cast: config parse returns `unknown`
      const config = await readTestTsConfig<ProjectConfig>(installResult.configPath);

      for (const skillId of selectedSkills) {
        expect(config.skills.map((s) => s.id)).toContain(skillId);
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

      const wizardResult = buildWizardResult(buildSkillConfigs(selectedSkills), {
        selectedAgents: PIPELINE_AGENTS,
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

      // Boundary cast: config parse returns `unknown`
      const config = await readTestTsConfig<ProjectConfig>(
        path.join(dirs.projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS),
      );

      expect(config.source).toBe("github:my-org/skills");
      expect(config.marketplace).toBe("test-marketplace");
    });
  });

  describe("Scenario 4: Directory structure verification", () => {
    it("should create complete directory structure matching init expectations", async () => {
      const wizardResult = buildWizardResult(buildSkillConfigs(SKILL_NAMES), {
        selectedAgents: PIPELINE_AGENTS,
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
      //     config.ts
      //   .claude/
      //     skills/
      //       <skill-name>/  (flattened, using skill ID as folder name)
      //         SKILL.md
      //         metadata.yaml
      //     agents/
      //       <agent-name>.md

      expect(
        await fileExists(path.join(dirs.projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_TS)),
      ).toBe(true);

      const skillsDir = path.join(dirs.projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
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
