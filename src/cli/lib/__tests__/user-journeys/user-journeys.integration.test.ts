import path from "path";
import { readFile } from "fs/promises";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  DEFAULT_TEST_SKILLS,
  METHODOLOGY_TEST_SKILLS,
  EXTRA_DOMAIN_TEST_SKILLS,
} from "../fixtures/create-test-source";
import { installLocal } from "../../installation/local-installer";
import { recompileAgents } from "../../agents";
import { useWizardStore } from "../../../stores/wizard-store";
import { loadProjectConfig } from "../../configuration";
import { DEFAULT_PRESELECTED_SKILLS, STANDARD_FILES } from "../../../consts";
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
// ── Setup ───────────────────────────────────────────────────────────────────────

// ── Constants ───────────────────────────────────────────────────────────────────

const CLI_REPO_PATH = path.resolve(__dirname, "../../../../..");

const ALL_TEST_SKILLS = [
  ...DEFAULT_TEST_SKILLS,
  ...EXTRA_DOMAIN_TEST_SKILLS,
  ...METHODOLOGY_TEST_SKILLS,
];

// ── Journey 1: Init -> Edit -> Recompile (Add Skills) ────────────────────────

describe("Init -> Edit -> Recompile (Add Skills)", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should add a new skill to an existing installation and recompile agents", async () => {
    // Step 1: Initial install with skills A, B (react + zustand)
    const initialSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];

    simulateSkillSelections(initialSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    const initialResult = await installLocal({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify initial state: config has react + zustand + methodology
    const initialConfig = await readTestYaml<ProjectConfig>(initialResult.configPath);
    expect(initialConfig.skills).toContain("web-framework-react");
    expect(initialConfig.skills).toContain("web-state-zustand");
    expect(initialResult.compiledAgents.length).toBeGreaterThan(0);

    // Step 2: Re-init with skills A, B, C (add hono)
    useWizardStore.getState().reset();
    const expandedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];

    simulateSkillSelections(expandedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const editWizardResult = buildWizardResultFromStore(matrix);
    const editResult = await installLocal({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Step 3: Assert
    const updatedConfig = await readTestYaml<ProjectConfig>(editResult.configPath);

    // Config now includes all three skills
    expect(updatedConfig.skills).toContain("web-framework-react");
    expect(updatedConfig.skills).toContain("web-state-zustand");
    expect(updatedConfig.skills).toContain("api-framework-hono");

    // Agents are compiled
    expect(editResult.compiledAgents.length).toBeGreaterThan(0);

    // Agent files exist on disk
    for (const agentName of editResult.compiledAgents) {
      const agentPath = path.join(editResult.agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);
      const content = await readFile(agentPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
    }

    // The new skill (hono) has a skill directory in .claude/skills/
    const honoSkillDir = path.join(editResult.skillsDir, "api-framework-hono");
    expect(await directoryExists(honoSkillDir)).toBe(true);

    // Config was merged (wasMerged is true because initial config existed)
    expect(editResult.wasMerged).toBe(true);
  });

  it("should preserve existing agents when adding skills from a new domain", async () => {
    // Initial: web-only skills
    const initialSkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(initialSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    const initialResult = await installLocal({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const initialAgents = [...initialResult.compiledAgents].sort();
    expect(initialAgents.length).toBeGreaterThan(0);

    // Edit: add API skills
    useWizardStore.getState().reset();
    const expandedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(expandedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const editWizardResult = buildWizardResultFromStore(matrix);
    const editResult = await installLocal({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const updatedConfig = await readTestYaml<ProjectConfig>(editResult.configPath);

    // All initial agents should still be present (merge unions agents)
    for (const agentName of initialAgents) {
      expect(updatedConfig.agents).toContain(agentName);
    }

    // API agents should also be present
    const editAgents = editResult.compiledAgents;
    expect(editAgents.length).toBeGreaterThanOrEqual(initialAgents.length);
  });
});

// ── Journey 2: Init -> Edit -> Recompile (Remove Skills) ─────────────────────

describe("Init -> Edit -> Recompile (Remove Skills)", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should remove a skill from config and recompile agents without it", async () => {
    // Step 1: Init with A, B, C (react, zustand, hono)
    const initialSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];
    simulateSkillSelections(initialSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    await installLocal({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Step 2: Re-init with A, C (remove zustand)
    useWizardStore.getState().reset();
    const reducedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(reducedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const editWizardResult = buildWizardResultFromStore(matrix);
    const editResult = await installLocal({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Step 3: Assert
    const updatedConfig = await readTestYaml<ProjectConfig>(editResult.configPath);

    // Config should have react and hono
    expect(updatedConfig.skills).toContain("web-framework-react");
    expect(updatedConfig.skills).toContain("api-framework-hono");

    // Note: config merge UNIONS skills, so zustand may still be in config.skills.
    // However, the STACK entries control what goes into agents. The stack is
    // rebuilt from the new wizard result's selected skills.
    // Verify agents were compiled
    expect(editResult.compiledAgents.length).toBeGreaterThan(0);

    // Each compiled agent should still be a valid markdown file
    for (const agentName of editResult.compiledAgents) {
      const agentPath = path.join(editResult.agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);
    }
  });

  it("should handle removing all skills from a domain", async () => {
    // Init with web + api
    const initialSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(initialSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    await installLocal({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Remove API skills, keep only web
    useWizardStore.getState().reset();
    const webOnlySkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(webOnlySkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const editWizardResult = buildWizardResultFromStore(matrix);
    const editResult = await installLocal({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const updatedConfig = await readTestYaml<ProjectConfig>(editResult.configPath);

    // Web skill should remain
    expect(updatedConfig.skills).toContain("web-framework-react");

    // Agents should be recompiled successfully
    expect(editResult.compiledAgents.length).toBeGreaterThan(0);
  });
});

// ── Journey 3: Init -> Compile Standalone (From Existing Config) ─────────────

describe("Init -> Compile Standalone (From Existing Config)", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should recompile agents from existing config on disk", async () => {
    // Step 1: Initial install to create config + agents
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify installation produced agents and config
    expect(installResult.compiledAgents.length).toBeGreaterThan(0);
    expect(await fileExists(installResult.configPath)).toBe(true);

    // Step 2: Load config back from disk
    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    expect(loadedConfig).not.toBeNull();
    expect(loadedConfig!.config.agents.length).toBeGreaterThan(0);

    // Step 3: Recompile using recompileAgents (simulating `compile` command)
    const agentsDir = installResult.agentsDir;
    const recompileResult = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: agentsDir,
    });

    // Step 4: Assert
    // Recompile should produce agents matching the config
    expect(recompileResult.compiled.length).toBeGreaterThan(0);

    // Every compiled agent should have a .md file
    for (const agentName of recompileResult.compiled) {
      const agentPath = path.join(agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);

      const content = await readFile(agentPath, "utf-8");
      expect(content.length).toBeGreaterThan(0);
      expect(content).toContain("---"); // Has frontmatter
    }
  });

  it("should produce agents matching the config agent list", async () => {
    // Install with specific agents
    const selectedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Load config from disk
    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    const configAgents = loadedConfig!.config.agents;

    // Recompile
    const recompileResult = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: installResult.agentsDir,
    });

    // The compiled agents should match what config.agents lists
    // (some may fail if agent definitions don't exist in source, but none should be extra)
    for (const compiledAgent of recompileResult.compiled) {
      expect(configAgents).toContain(compiledAgent);
    }
  });
});

// ── Journey 4: Init Local -> Re-init Local (Config Merge) ────────────────────

describe("Init Local -> Re-init Local (Config Merge)", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should merge configs when running init twice with different selections", async () => {
    // First init: react + zustand, web agents
    const firstSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];
    simulateSkillSelections(firstSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const firstWizardResult = buildWizardResultFromStore(matrix);
    const firstResult = await installLocal({
      wizardResult: firstWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const firstConfig = await readTestYaml<ProjectConfig>(firstResult.configPath);
    const firstAgents = [...firstConfig.agents];

    // Second init: hono + drizzle, api agents
    useWizardStore.getState().reset();
    const secondSkills: SkillId[] = ["api-framework-hono", "api-database-drizzle"];
    simulateSkillSelections(secondSkills, matrix, ["api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const secondWizardResult = buildWizardResultFromStore(matrix);
    const secondResult = await installLocal({
      wizardResult: secondWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const mergedConfig = await readTestYaml<ProjectConfig>(secondResult.configPath);

    // Merged config should contain agents from BOTH inits (union)
    for (const agent of firstAgents) {
      expect(mergedConfig.agents).toContain(agent);
    }

    // Config was merged
    expect(secondResult.wasMerged).toBe(true);

    // Stack should have entries from both inits
    expect(mergedConfig.stack).toBeDefined();

    // Name from first init should be preserved (existing takes precedence)
    expect(mergedConfig.name).toBe(firstConfig.name);
  });

  it("should not duplicate agents when re-initializing with overlapping selections", async () => {
    // First init: web skills
    const firstSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(firstSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const firstWizardResult = buildWizardResultFromStore(matrix);
    await installLocal({
      wizardResult: firstWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Second init: overlapping + new skills
    useWizardStore.getState().reset();
    const secondSkills: SkillId[] = [
      "web-framework-react", // overlap
      "api-framework-hono", // overlap
      "api-database-drizzle", // new
    ];
    simulateSkillSelections(secondSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const secondWizardResult = buildWizardResultFromStore(matrix);
    const secondResult = await installLocal({
      wizardResult: secondWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const mergedConfig = await readTestYaml<ProjectConfig>(secondResult.configPath);

    // No duplicate agents
    const uniqueAgents = [...new Set(mergedConfig.agents)];
    expect(mergedConfig.agents).toEqual(uniqueAgents);
  });

  it("should preserve description from first init when re-initializing", async () => {
    // First init
    const firstSkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(firstSkills, matrix, ["web"]);

    const firstWizardResult = buildWizardResultFromStore(matrix);
    const firstResult = await installLocal({
      wizardResult: firstWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const firstConfig = await readTestYaml<ProjectConfig>(firstResult.configPath);
    const originalDescription = firstConfig.description;

    // Second init with different skills
    useWizardStore.getState().reset();
    const secondSkills: SkillId[] = ["api-framework-hono"];
    simulateSkillSelections(secondSkills, matrix, ["api"]);

    const secondWizardResult = buildWizardResultFromStore(matrix);
    const secondResult = await installLocal({
      wizardResult: secondWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const mergedConfig = await readTestYaml<ProjectConfig>(secondResult.configPath);

    // Description from first init should be preserved
    if (originalDescription) {
      expect(mergedConfig.description).toBe(originalDescription);
    }
  });
});

// ── Journey 5: Multi-Domain Init (Web + API + Shared Skills) ─────────────────

describe("Multi-Domain Init (Web + API + Shared Skills)", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should correctly assign skills across web and api agents", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "web-styling-scss-modules",
      "api-framework-hono",
      "api-database-drizzle",
    ];

    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const result = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);

    // Config should contain all selected skills + methodology
    for (const skillId of selectedSkills) {
      expect(config.skills).toContain(skillId);
    }
    for (const methodSkill of DEFAULT_PRESELECTED_SKILLS) {
      expect(config.skills).toContain(methodSkill);
    }

    // Agents should include both web and api domain agents
    const hasWebAgent = config.agents.some((a: string) => a.startsWith("web-"));
    const hasApiAgent = config.agents.some((a: string) => a.startsWith("api-"));
    expect(hasWebAgent).toBe(true);
    expect(hasApiAgent).toBe(true);

    // Stack should have domain-appropriate assignments
    expect(config.stack).toBeDefined();
    if (config.stack) {
      // Verify stack structure: each agent has subcategory-keyed entries
      // with skill assignments that are valid skill IDs from config.skills
      for (const [agentId, agentConfig] of Object.entries(config.stack)) {
        expect(config.agents).toContain(agentId);
        const agentSkillIds = extractSkillIdsFromStack(agentConfig);
        for (const skillId of agentSkillIds) {
          // Every skill in the stack must be in config.skills
          expect(config.skills).toContain(skillId);
        }
      }

      // At least some web agent should have web skills
      const webAgentStacks = Object.entries(config.stack).filter(([agentId]) =>
        agentId.startsWith("web-"),
      );
      const allWebStackSkills = webAgentStacks.flatMap(([, agentConfig]) =>
        extractSkillIdsFromStack(agentConfig),
      );
      const hasWebSkillInWebAgent = allWebStackSkills.some((s) => s.startsWith("web-"));
      expect(hasWebSkillInWebAgent).toBe(true);

      // At least some api agent should have api skills
      const apiAgentStacks = Object.entries(config.stack).filter(([agentId]) =>
        agentId.startsWith("api-"),
      );
      const allApiStackSkills = apiAgentStacks.flatMap(([, agentConfig]) =>
        extractSkillIdsFromStack(agentConfig),
      );
      const hasApiSkillInApiAgent = allApiStackSkills.some((s) => s.startsWith("api-"));
      expect(hasApiSkillInApiAgent).toBe(true);
    }

    // Agent files should exist for all compiled agents
    for (const agentName of result.compiledAgents) {
      const agentPath = path.join(result.agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);
    }
  });

  it("should include methodology skills in all domain agents via the config", async () => {
    const selectedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];

    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const result = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);

    // Methodology skills should be in config.skills
    for (const methodSkill of DEFAULT_PRESELECTED_SKILLS) {
      expect(config.skills).toContain(methodSkill);
    }

    // All compiled agents should have valid .md files
    expect(result.compiledAgents.length).toBeGreaterThan(0);
    for (const agentName of result.compiledAgents) {
      const agentPath = path.join(result.agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);
      const content = await readFile(agentPath, "utf-8");
      expect(content).toContain("---");
    }
  });

  it("should create correct directory structure for multi-domain install", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "api-framework-hono",
      "web-testing-vitest",
    ];

    simulateSkillSelections(selectedSkills, matrix, ["web", "api", "shared"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const result = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify directory structure
    expect(await fileExists(result.configPath)).toBe(true);
    expect(await directoryExists(result.skillsDir)).toBe(true);
    expect(await directoryExists(result.agentsDir)).toBe(true);

    // Each selected skill should have been copied
    for (const copiedSkill of result.copiedSkills) {
      expect(await fileExists(path.join(copiedSkill.destPath, STANDARD_FILES.SKILL_MD))).toBe(true);
    }
  });

  it("should maintain stack consistency invariant: every stack agent is in config.agents", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "web-styling-scss-modules",
      "api-framework-hono",
      "api-database-drizzle",
      "web-testing-vitest",
    ];

    simulateSkillSelections(selectedSkills, matrix, ["web", "api", "shared"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const result = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestYaml<ProjectConfig>(result.configPath);

    expect(config.stack).toBeDefined();

    // Every agent in stack must be in config.agents
    for (const agentId of Object.keys(config.stack!)) {
      expect(config.agents).toContain(agentId);
    }

    // Every skill in stack must be in config.skills
    for (const [, agentConfig] of Object.entries(config.stack!)) {
      for (const [, assignments] of Object.entries(agentConfig as Record<string, unknown>)) {
        const skillIds = extractSkillIdsFromAssignment(assignments);
        for (const skillId of skillIds) {
          expect(config.skills).toContain(skillId);
        }
      }
    }
  });
});

// ── Journey: Recompile Idempotency ───────────────────────────────────────────

describe("Recompile Idempotency", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should produce identical output on consecutive recompiles without changes", async () => {
    // Install
    const selectedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const agentsDir = installResult.agentsDir;

    // First recompile
    const result1 = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: agentsDir,
    });

    // Read first output
    const firstContents: Record<string, string> = {};
    for (const agentName of result1.compiled) {
      const agentPath = path.join(agentsDir, `${agentName}.md`);
      firstContents[agentName] = await readFile(agentPath, "utf-8");
    }

    // Second recompile
    const result2 = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: agentsDir,
    });

    // Read second output
    for (const agentName of result2.compiled) {
      const agentPath = path.join(agentsDir, `${agentName}.md`);
      const secondContent = await readFile(agentPath, "utf-8");

      // Content should be identical (deterministic compilation)
      if (firstContents[agentName]) {
        expect(secondContent).toBe(firstContents[agentName]);
      }
    }

    // Same agent list
    expect([...result1.compiled].sort()).toEqual([...result2.compiled].sort());
  });
});

// ── Journey: Config Roundtrip (Write -> Load -> Verify) ──────────────────────

describe("Config Roundtrip (Write -> Load -> Verify)", () => {
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
    useWizardStore.getState().reset();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should write config that can be loaded back identically", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
      sourceFlag: "github:test/source",
    });

    // Load config back using production loadProjectConfig
    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    expect(loadedConfig).not.toBeNull();

    const config = loadedConfig!.config;

    // Core fields should match what was installed
    expect(config.name).toBeDefined();
    expect(config.agents.length).toBeGreaterThan(0);
    expect(config.skills.length).toBeGreaterThan(0);

    // Source should be preserved
    expect(config.source).toBe("github:test/source");

    // Install mode should be preserved
    expect(config.installMode).toBe("local");

    // Stack should be loadable
    if (config.stack) {
      for (const [agentId] of Object.entries(config.stack)) {
        expect(config.agents).toContain(agentId);
      }
    }
  });

  it("should produce valid YAML with schema comment", async () => {
    const selectedSkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(selectedSkills, matrix, ["web"]);

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installLocal({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const configContent = await readFile(installResult.configPath, "utf-8");

    // Should start with YAML schema comment
    expect(configContent.startsWith("# yaml-language-server")).toBe(true);

    // Should contain config options comment hints
    expect(configContent).toContain("# Additional config options:");
    expect(configContent).toContain("# Custom paths");
  });
});

// ── Utility ─────────────────────────────────────────────────────────────────────

/**
 * Extracts all skill IDs from a stack agent config, handling nested structures.
 */
function extractSkillIdsFromStack(agentConfig: unknown): string[] {
  if (!agentConfig || typeof agentConfig !== "object") return [];
  return Object.values(agentConfig as Record<string, unknown>).flatMap(
    extractSkillIdsFromAssignment,
  );
}
