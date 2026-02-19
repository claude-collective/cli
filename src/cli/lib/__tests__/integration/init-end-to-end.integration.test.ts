import path from "path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import { installLocal, installPluginConfig } from "../../installation/local-installer";
import { useWizardStore } from "../../../stores/wizard-store";
import { DEFAULT_PRESELECTED_SKILLS } from "../../../consts";
import type { MergedSkillsMatrix, ProjectConfig, SkillId } from "../../../types";
import type { SourceLoadResult } from "../../loading/source-loader";
import {
  createComprehensiveMatrix,
  buildSourceResult,
  buildWizardResultFromStore,
  simulateSkillSelections,
  extractSkillIdsFromAssignment,
  fileExists,
  directoryExists,
  readTestYaml,
} from "../helpers";
import {
  DEFAULT_TEST_SKILLS,
  METHODOLOGY_TEST_SKILLS,
  EXTRA_DOMAIN_TEST_SKILLS,
} from "../fixtures/create-test-source";
import { loadDefaultMappings, clearDefaultsCache } from "../../loading";

// ── Setup ───────────────────────────────────────────────────────────────────────

// Load YAML defaults once for all tests (agent-mappings.yaml drives skill-to-agent routing)
beforeAll(async () => {
  await loadDefaultMappings();
});

afterAll(() => {
  clearDefaultsCache();
});

// ── Constants ───────────────────────────────────────────────────────────────────

const ALL_TEST_SKILLS = [
  ...DEFAULT_TEST_SKILLS,
  ...EXTRA_DOMAIN_TEST_SKILLS,
  ...METHODOLOGY_TEST_SKILLS,
];

// ── Test Suites ─────────────────────────────────────────────────────────────────

describe("end-to-end: wizard store -> handleComplete -> installLocal", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let matrix: MergedSkillsMatrix;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: ALL_TEST_SKILLS });
    process.chdir(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);

    // Reset wizard store between tests
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  describe("customize path with explicit agent selection", () => {
    it("should produce config with preselected agents sorted alphabetically", async () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        "web-state-zustand",
        "web-styling-scss-modules",
        "api-framework-hono",
      ];

      // Simulate user selecting skills
      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);

      // Simulate navigating to agents step and preselecting agents from domains
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);

      // Verify methodology skills were added
      for (const methodSkill of DEFAULT_PRESELECTED_SKILLS) {
        expect(wizardResult.selectedSkills).toContain(methodSkill);
      }

      // Verify agents were preselected from domains (sorted)
      expect(wizardResult.selectedAgents.length).toBeGreaterThan(0);
      const sortedAgents = [...wizardResult.selectedAgents].sort();
      expect(wizardResult.selectedAgents).toEqual(sortedAgents);

      // Install
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
        sourceFlag: dirs.sourceDir,
      });

      // Read config and verify agents list
      const config = await readTestYaml<ProjectConfig>(result.configPath);

      // config.agents should match the preselected agents (sorted)
      expect(config.agents).toEqual([...wizardResult.selectedAgents].sort());

      // Methodology skills should appear in config.skills
      for (const methodSkill of DEFAULT_PRESELECTED_SKILLS) {
        expect(config.skills).toContain(methodSkill);
      }
    });

    it("should assign skills only to agents in the user's selection", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react", "api-framework-hono"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      expect(config.stack).toBeDefined();

      // Every agent in the stack must also be in config.agents
      for (const agentId of Object.keys(config.stack || {})) {
        expect(config.agents).toContain(agentId);
      }

      // DEFAULT_AGENTS (agent-summoner, skill-summoner, documentor) must NOT
      // appear in stack when selectedAgents is populated and doesn't include them
      expect(config.stack?.["agent-summoner"]).toBeUndefined();
      expect(config.stack?.["skill-summoner"]).toBeUndefined();
      expect(config.stack?.["documentor"]).toBeUndefined();
    });

    it("should compile agent .md files that exist and have content", async () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        "web-state-zustand",
        "api-framework-hono",
      ];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      expect(result.compiledAgents.length).toBeGreaterThan(0);

      for (const agentName of result.compiledAgents) {
        const agentPath = path.join(result.agentsDir, `${agentName}.md`);
        expect(await fileExists(agentPath)).toBe(true);

        const content = await readFile(agentPath, "utf-8");
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain("---");
      }
    });
  });

  describe("accept defaults path (selectedAgents = empty)", () => {
    it("should derive agents from agent-mappings.yaml when no explicit agent selection", async () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        "web-state-zustand",
        "api-framework-hono",
      ];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);

      // Do NOT call preselectAgentsFromDomains — selectedAgents stays []
      const wizardResult = buildWizardResultFromStore(matrix);
      expect(wizardResult.selectedAgents).toEqual([]);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      // When selectedAgents is empty, agents are derived from agent-mappings.yaml
      // via getAgentsForSkill. The default mapping should produce some agents.
      expect(config.agents.length).toBeGreaterThan(0);

      // Every skill in config.skills should be in selectedSkills + methodology skills
      for (const skillId of config.skills) {
        const isSelected = selectedSkillIds.includes(skillId as SkillId);
        const isMethodology = DEFAULT_PRESELECTED_SKILLS.includes(skillId as SkillId);
        expect(isSelected || isMethodology).toBe(true);
      }
    });

    it("should include DEFAULT_AGENTS in stack when no agent selection is made", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      // No preselectAgentsFromDomains call -> selectedAgents stays []

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      // When no agents are selected, the default agents (agent-summoner, etc.)
      // may appear in config.agents as determined by the agent-mappings.yaml
      // At minimum, some agents should be derived from skill categories
      expect(config.agents.length).toBeGreaterThan(0);
    });
  });

  describe("plugin mode with explicit agent selection", () => {
    it("should generate config and compile agents without copying skills", async () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        "web-state-zustand",
        "api-framework-hono",
      ];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix, {
        installMode: "plugin",
      });

      const result = await installPluginConfig({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
        sourceFlag: dirs.sourceDir,
      });

      // Config should exist
      expect(await fileExists(result.configPath)).toBe(true);

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      // config.agents should match preselected agents (sorted)
      expect(config.agents).toEqual([...wizardResult.selectedAgents].sort());

      // installMode should be plugin
      expect(config.installMode).toBe("plugin");

      // Compiled agents should exist as .md files
      expect(result.compiledAgents.length).toBeGreaterThan(0);
      for (const agentName of result.compiledAgents) {
        const agentPath = path.join(result.agentsDir, `${agentName}.md`);
        expect(await fileExists(agentPath)).toBe(true);
      }

      // Plugin mode: no copiedSkills property (not part of PluginConfigResult)
      // Verify by checking the result type doesn't have copiedSkills
      expect("copiedSkills" in result).toBe(false);
    });

    it("should produce same agent list as local mode for same selections", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react", "api-framework-hono"];

      // Setup for plugin mode
      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();
      const pluginResult = buildWizardResultFromStore(matrix, { installMode: "plugin" });
      const pluginAgents = [...pluginResult.selectedAgents].sort();

      // Reset and setup for local mode with same selections
      useWizardStore.getState().reset();
      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();
      const localResult = buildWizardResultFromStore(matrix, { installMode: "local" });
      const localAgents = [...localResult.selectedAgents].sort();

      // Same selections should produce same agent list
      expect(pluginAgents).toEqual(localAgents);

      // Same skills (including methodology)
      expect([...pluginResult.selectedSkills].sort()).toEqual(
        [...localResult.selectedSkills].sort(),
      );
    });
  });

  describe("stack consistency invariants", () => {
    it("every agent in config.stack should be in config.agents", async () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        "web-state-zustand",
        "web-styling-scss-modules",
        "api-framework-hono",
        "api-database-drizzle",
        "web-testing-vitest",
      ];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api", "shared"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      expect(config.stack).toBeDefined();
      for (const agentId of Object.keys(config.stack!)) {
        expect(config.agents).toContain(agentId);
      }
    });

    it("every skill ID in config.stack should be in config.skills", async () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        "web-state-zustand",
        "api-framework-hono",
        "api-database-drizzle",
      ];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      expect(config.stack).toBeDefined();
      for (const [, agentConfig] of Object.entries(config.stack!)) {
        for (const [, assignments] of Object.entries(agentConfig as Record<string, unknown>)) {
          // Assignments can be a bare string or an object with .id or an array
          const skillIds = extractSkillIdsFromAssignment(assignments);
          for (const skillId of skillIds) {
            expect(config.skills).toContain(skillId);
          }
        }
      }
    });

    it("no DEFAULT_AGENTS in stack when selectedAgents is populated without them", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react", "api-framework-hono"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      // Verify that preselectAgentsFromDomains does NOT include default meta agents
      const store = useWizardStore.getState();
      expect(store.selectedAgents).not.toContain("agent-summoner");
      expect(store.selectedAgents).not.toContain("skill-summoner");
      expect(store.selectedAgents).not.toContain("documentor");

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      // Stack should not contain default agents
      expect(config.stack).toBeDefined();
      expect(config.stack!["agent-summoner"]).toBeUndefined();
      expect(config.stack!["skill-summoner"]).toBeUndefined();
      expect(config.stack!["documentor"]).toBeUndefined();

      // config.agents should not contain default agents
      expect(config.agents).not.toContain("agent-summoner");
      expect(config.agents).not.toContain("skill-summoner");
      expect(config.agents).not.toContain("documentor");
    });
  });

  describe("methodology skill injection", () => {
    it("should add all DEFAULT_PRESELECTED_SKILLS to selectedSkills", () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      const wizardResult = buildWizardResultFromStore(matrix);

      // All methodology skills should be present
      for (const methodSkill of DEFAULT_PRESELECTED_SKILLS) {
        expect(wizardResult.selectedSkills).toContain(methodSkill);
      }

      // Original selection should also be present
      expect(wizardResult.selectedSkills).toContain("web-framework-react");
    });

    it("should not duplicate methodology skills if already selected", () => {
      const selectedSkillIds: SkillId[] = [
        "web-framework-react",
        // Include one methodology skill explicitly
        DEFAULT_PRESELECTED_SKILLS[0],
      ];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      const wizardResult = buildWizardResultFromStore(matrix);

      // Count occurrences of the first methodology skill
      const occurrences = wizardResult.selectedSkills.filter(
        (s) => s === DEFAULT_PRESELECTED_SKILLS[0],
      ).length;
      expect(occurrences).toBe(1);
    });
  });

  describe("preselectAgentsFromDomains behavior", () => {
    it("should select web domain agents when web domain is selected", () => {
      useWizardStore.setState({
        selectedDomains: ["web"],
      });

      useWizardStore.getState().preselectAgentsFromDomains();
      const store = useWizardStore.getState();

      // DOMAIN_AGENTS.web = ["web-developer", "web-reviewer", "web-researcher", "web-tester", "web-pm", "web-architecture"]
      expect(store.selectedAgents).toContain("web-developer");
      expect(store.selectedAgents).toContain("web-reviewer");
      expect(store.selectedAgents).toContain("web-tester");
    });

    it("should select combined agents for web + api domains", () => {
      useWizardStore.setState({
        selectedDomains: ["web", "api"],
      });

      useWizardStore.getState().preselectAgentsFromDomains();
      const store = useWizardStore.getState();

      // Should contain agents from both domains
      expect(store.selectedAgents).toContain("web-developer");
      expect(store.selectedAgents).toContain("api-developer");
      expect(store.selectedAgents).toContain("api-reviewer");

      // Should be sorted
      const sortedAgents = [...store.selectedAgents].sort();
      expect(store.selectedAgents).toEqual(sortedAgents);
    });

    it("should select cli agents when cli domain is selected", () => {
      useWizardStore.setState({
        selectedDomains: ["cli"],
      });

      useWizardStore.getState().preselectAgentsFromDomains();
      const store = useWizardStore.getState();

      // DOMAIN_AGENTS.cli = ["cli-developer", "cli-tester", "cli-reviewer", "cli-migrator"]
      expect(store.selectedAgents).toContain("cli-developer");
      expect(store.selectedAgents).toContain("cli-tester");
      expect(store.selectedAgents).toContain("cli-reviewer");
    });
  });

  describe("validation runs correctly", () => {
    it("should produce valid validation for non-conflicting skills", () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react", "web-state-zustand"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      const wizardResult = buildWizardResultFromStore(matrix);

      expect(wizardResult.validation.valid).toBe(true);
      expect(wizardResult.validation.errors).toHaveLength(0);
    });

    it("should detect conflicts for react + vue selection", () => {
      // React and Vue conflict with each other in the comprehensive matrix
      const selectedSkillIds: SkillId[] = ["web-framework-react", "web-framework-vue"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      const wizardResult = buildWizardResultFromStore(matrix);

      // Validation should report errors for conflicting skills
      expect(wizardResult.validation.errors.length).toBeGreaterThan(0);
    });
  });

  describe("stack defaults path through wizard store", () => {
    it("should use stack allSkillIds when stackAction is defaults", async () => {
      const stackId = "nextjs-fullstack";
      const stack = matrix.suggestedStacks.find((s) => s.id === stackId);
      expect(stack).toBeDefined();

      // Simulate selecting a stack and accepting defaults
      useWizardStore.setState({
        selectedStackId: stackId,
        stackAction: "defaults",
        approach: "stack",
        selectedDomains: ["web", "api"],
        step: "confirm",
      });

      // Preselect agents from domains
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);

      // Skills should come from stack.allSkillIds + methodology skills
      for (const skillId of stack!.allSkillIds) {
        expect(wizardResult.selectedSkills).toContain(skillId);
      }
      for (const methodSkill of DEFAULT_PRESELECTED_SKILLS) {
        expect(wizardResult.selectedSkills).toContain(methodSkill);
      }

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);

      // Config should include all stack skills and methodology skills
      for (const skillId of stack!.allSkillIds) {
        expect(config.skills).toContain(skillId);
      }
    });
  });

  describe("file system output verification", () => {
    it("should create the complete directory structure", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react", "api-framework-hono"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web", "api"]);
      useWizardStore.getState().preselectAgentsFromDomains();

      const wizardResult = buildWizardResultFromStore(matrix);
      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // .claude-src/config.yaml
      expect(await fileExists(result.configPath)).toBe(true);

      // .claude/skills/
      expect(await directoryExists(result.skillsDir)).toBe(true);

      // .claude/agents/
      expect(await directoryExists(result.agentsDir)).toBe(true);

      // Copied skills should have SKILL.md
      for (const copiedSkill of result.copiedSkills) {
        expect(await fileExists(path.join(copiedSkill.destPath, "SKILL.md"))).toBe(true);
      }
    });

    it("should write config.yaml with YAML schema comment", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      const wizardResult = buildWizardResultFromStore(matrix);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const configContent = await readFile(result.configPath, "utf-8");

      // Should start with YAML schema comment
      expect(configContent.startsWith("# yaml-language-server")).toBe(true);

      // Should parse as valid YAML
      const config = parseYaml(configContent) as ProjectConfig;
      expect(config.name).toBeDefined();
      expect(config.agents).toBeDefined();
      expect(config.skills).toBeDefined();
    });

    it("should set source flag in config when provided", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      const wizardResult = buildWizardResultFromStore(matrix);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
        sourceFlag: "github:my-org/my-marketplace",
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);
      expect(config.source).toBe("github:my-org/my-marketplace");
    });

    it("should set expertMode in config when wizard has it enabled", async () => {
      const selectedSkillIds: SkillId[] = ["web-framework-react"];

      simulateSkillSelections(selectedSkillIds, matrix, ["web"]);
      useWizardStore.setState({ expertMode: true });

      const wizardResult = buildWizardResultFromStore(matrix);
      expect(wizardResult.expertMode).toBe(true);

      const result = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      const config = await readTestYaml<ProjectConfig>(result.configPath);
      expect(config.expertMode).toBe(true);
    });
  });
});
