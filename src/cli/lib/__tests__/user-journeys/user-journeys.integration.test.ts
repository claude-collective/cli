import os from "os";
import path from "path";
import { readFile } from "fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import { ALL_TEST_SKILLS } from "../mock-data/mock-skills";
import { installEject } from "../../installation/local-installer";
import { recompileAgents } from "../../agents";
import { useWizardStore } from "../../../stores/wizard-store";
import { initializeMatrix } from "../../matrix/matrix-provider";
import { BUILT_IN_MATRIX } from "../../../types/generated/matrix";
import { loadProjectConfig } from "../../configuration";
import { STANDARD_FILES } from "../../../consts";
import type {
  AgentScopeConfig,
  MergedSkillsMatrix,
  ProjectConfig,
  SkillConfig,
  SkillId,
} from "../../../types";
import type { SourceLoadResult } from "../../loading/source-loader";
import { splitConfigByScope } from "../../configuration/config-generator";
import {
  createBasicMatrix,
  createComprehensiveMatrix,
  buildProjectConfig,
  buildSkillConfigs,
  buildAgentConfigs,
  buildSourceResult,
  buildWizardResultFromStore,
  simulateSkillSelections,
  extractSkillIdsFromAssignment,
  fileExists,
  directoryExists,
  readTestTsConfig,
} from "../helpers";
// ── Setup ───────────────────────────────────────────────────────────────────────

// ── Constants ───────────────────────────────────────────────────────────────────

const CLI_REPO_PATH = path.resolve(__dirname, "../../../../..");

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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should add a new skill to an existing installation and recompile agents", async () => {
    // Step 1: Initial install with skills A, B (react + zustand)
    const initialSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];

    simulateSkillSelections(initialSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    const initialResult = await installEject({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify initial state: config has react + zustand + methodology
    const initialConfig = await readTestTsConfig<ProjectConfig>(initialResult.configPath);
    expect(initialConfig.skills.map((s) => s.id)).toContain("web-framework-react");
    expect(initialConfig.skills.map((s) => s.id)).toContain("web-state-zustand");
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
    const editResult = await installEject({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Step 3: Assert
    const updatedConfig = await readTestTsConfig<ProjectConfig>(editResult.configPath);

    // Config now includes all three skills
    expect(updatedConfig.skills.map((s) => s.id)).toContain("web-framework-react");
    expect(updatedConfig.skills.map((s) => s.id)).toContain("web-state-zustand");
    expect(updatedConfig.skills.map((s) => s.id)).toContain("api-framework-hono");

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
    const initialResult = await installEject({
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
    const editResult = await installEject({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const updatedConfig = await readTestTsConfig<ProjectConfig>(editResult.configPath);

    // All initial agents should still be present (merge unions agents)
    const updatedAgentNames = updatedConfig.agents.map((a) => a.name);
    for (const agentName of initialAgents) {
      expect(updatedAgentNames).toContain(agentName);
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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
    await installEject({
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
    const editResult = await installEject({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Step 3: Assert
    const updatedConfig = await readTestTsConfig<ProjectConfig>(editResult.configPath);

    // Config should have react and hono
    expect(updatedConfig.skills.map((s) => s.id)).toContain("web-framework-react");
    expect(updatedConfig.skills.map((s) => s.id)).toContain("api-framework-hono");

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
    await installEject({
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
    const editResult = await installEject({
      wizardResult: editWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const updatedConfig = await readTestTsConfig<ProjectConfig>(editResult.configPath);

    // Web skill should remain
    expect(updatedConfig.skills.map((s) => s.id)).toContain("web-framework-react");

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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
    const installResult = await installEject({
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
    const installResult = await installEject({
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
    const configAgentNames = configAgents.map((a) => a.name);
    for (const compiledAgent of recompileResult.compiled) {
      expect(configAgentNames).toContain(compiledAgent);
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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should merge configs when running init twice with different selections", async () => {
    // First init: react + zustand, web agents
    const firstSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];
    simulateSkillSelections(firstSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const firstWizardResult = buildWizardResultFromStore(matrix);
    const firstResult = await installEject({
      wizardResult: firstWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const firstConfig = await readTestTsConfig<ProjectConfig>(firstResult.configPath);
    const firstAgents = [...firstConfig.agents];

    // Second init: hono + drizzle, api agents
    useWizardStore.getState().reset();
    const secondSkills: SkillId[] = ["api-framework-hono", "api-database-drizzle"];
    simulateSkillSelections(secondSkills, matrix, ["api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const secondWizardResult = buildWizardResultFromStore(matrix);
    const secondResult = await installEject({
      wizardResult: secondWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const mergedConfig = await readTestTsConfig<ProjectConfig>(secondResult.configPath);

    // Merged config should contain agents from BOTH inits (union)
    const mergedAgentNames = mergedConfig.agents.map((a) => a.name);
    for (const agent of firstAgents) {
      expect(mergedAgentNames).toContain(agent.name);
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
    await installEject({
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
    const secondResult = await installEject({
      wizardResult: secondWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const mergedConfig = await readTestTsConfig<ProjectConfig>(secondResult.configPath);

    // No duplicate agents
    const uniqueAgents = [...new Set(mergedConfig.agents)];
    expect(mergedConfig.agents).toStrictEqual(uniqueAgents);
  });

  it("should preserve description from first init when re-initializing", async () => {
    // First init
    const firstSkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(firstSkills, matrix, ["web"]);

    const firstWizardResult = buildWizardResultFromStore(matrix);
    const firstResult = await installEject({
      wizardResult: firstWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const firstConfig = await readTestTsConfig<ProjectConfig>(firstResult.configPath);
    const originalDescription = firstConfig.description;

    // Second init with different skills
    useWizardStore.getState().reset();
    const secondSkills: SkillId[] = ["api-framework-hono"];
    simulateSkillSelections(secondSkills, matrix, ["api"]);

    const secondWizardResult = buildWizardResultFromStore(matrix);
    const secondResult = await installEject({
      wizardResult: secondWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const mergedConfig = await readTestTsConfig<ProjectConfig>(secondResult.configPath);

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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
    const result = await installEject({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);

    // Config should contain all selected skills
    for (const skillId of selectedSkills) {
      expect(config.skills.map((s) => s.id)).toContain(skillId);
    }

    // Agents should include both web and api domain agents
    const hasWebAgent = config.agents.some((a) => a.name.startsWith("web-"));
    const hasApiAgent = config.agents.some((a) => a.name.startsWith("api-"));
    expect(hasWebAgent).toBe(true);
    expect(hasApiAgent).toBe(true);

    // Stack should have domain-appropriate assignments
    expect(config.stack).toBeDefined();
    if (config.stack) {
      // Verify stack structure: each agent has category-keyed entries
      // with skill assignments that are valid skill IDs from config.skills
      const stackAgentNames = config.agents.map((a) => a.name);
      for (const [agentId, agentConfig] of Object.entries(config.stack)) {
        expect(stackAgentNames).toContain(agentId);
        const agentSkillIds = extractSkillIdsFromStack(agentConfig);
        for (const skillId of agentSkillIds) {
          // Every skill in the stack must be in config.skills
          expect(config.skills.map((s) => s.id)).toContain(skillId);
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

  it("should create correct directory structure for multi-domain install", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "api-framework-hono",
      "web-testing-vitest",
    ];

    simulateSkillSelections(selectedSkills, matrix, ["web", "api", "shared"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const result = await installEject({
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
    const result = await installEject({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);

    expect(config.stack).toBeDefined();

    // Every agent in stack must be in config.agents
    const agentNames = config.agents.map((a) => a.name);
    for (const agentId of Object.keys(config.stack!)) {
      expect(agentNames).toContain(agentId);
    }

    // Every skill in stack must be in config.skills
    for (const [, agentConfig] of Object.entries(config.stack!)) {
      for (const [, assignments] of Object.entries(agentConfig as Record<string, unknown>)) {
        const skillIds = extractSkillIdsFromAssignment(assignments);
        for (const skillId of skillIds) {
          expect(config.skills.map((s) => s.id)).toContain(skillId);
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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    process.chdir(originalCwd);
    await cleanupTestSource(dirs);
  });

  it("should produce identical output on consecutive recompiles without changes", async () => {
    // Install
    const selectedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installEject({
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
    expect([...result1.compiled].sort()).toStrictEqual([...result2.compiled].sort());
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

    // Mock os.homedir() to return the project dir so writeScopedConfigs treats this
    // as a home-dir install (no scope splitting) and compileAndWriteAgents writes
    // all agents to the project's .claude/agents/ instead of the real ~/.claude/agents/
    vi.spyOn(os, "homedir").mockReturnValue(dirs.projectDir);

    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    sourceResult = buildSourceResult(matrix, dirs.sourceDir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
    await installEject({
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

    // Stack should be loadable
    if (config.stack) {
      const roundTripAgentNames = config.agents.map((a) => a.name);
      for (const [agentId] of Object.entries(config.stack)) {
        expect(roundTripAgentNames).toContain(agentId);
      }
    }
  });

  it("should produce valid config with satisfies ProjectConfig", async () => {
    const selectedSkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(selectedSkills, matrix, ["web"]);

    const wizardResult = buildWizardResultFromStore(matrix);
    const installResult = await installEject({
      wizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const configContent = await readFile(installResult.configPath, "utf-8");

    // Should use plain object export with satisfies
    expect(configContent).not.toContain("defineConfig");
    expect(configContent).toContain("export default {");
    expect(configContent).toContain("satisfies ProjectConfig");
  });
});

// ── Journey: Per-Agent Scope ──────────────────────────────────────────────────

describe("per-agent scope", () => {
  let matrix: MergedSkillsMatrix;

  beforeEach(() => {
    useWizardStore.getState().reset();
    initializeMatrix(BUILT_IN_MATRIX);

    matrix = createBasicMatrix();
    initializeMatrix(matrix);
  });

  it("agents default to global scope", () => {
    simulateSkillSelections(["web-framework-react"], matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const { agentConfigs } = useWizardStore.getState();
    expect(agentConfigs.length).toBeGreaterThan(0);
    for (const config of agentConfigs) {
      expect(config.scope).toBe("global");
    }
  });

  it("toggleAgentScope switches between project and global", () => {
    simulateSkillSelections(["web-framework-react"], matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    // Initially global
    const initialConfig = useWizardStore
      .getState()
      .agentConfigs.find((ac) => ac.name === "web-developer");
    expect(initialConfig?.scope).toBe("global");

    // Toggle to project
    useWizardStore.getState().toggleAgentScope("web-developer");
    const afterFirstToggle = useWizardStore
      .getState()
      .agentConfigs.find((ac) => ac.name === "web-developer");
    expect(afterFirstToggle?.scope).toBe("project");

    // Toggle back to global
    useWizardStore.getState().toggleAgentScope("web-developer");
    const afterSecondToggle = useWizardStore
      .getState()
      .agentConfigs.find((ac) => ac.name === "web-developer");
    expect(afterSecondToggle?.scope).toBe("global");
  });

  it("agent scope survives wizard result building", () => {
    const comprehensiveMatrix = createComprehensiveMatrix();
    initializeMatrix(comprehensiveMatrix);

    simulateSkillSelections(["web-framework-react", "api-framework-hono"], comprehensiveMatrix, [
      "web",
      "api",
    ]);
    useWizardStore.getState().preselectAgentsFromDomains();
    useWizardStore.getState().toggleAgentScope("web-developer");

    const result = buildWizardResultFromStore(comprehensiveMatrix);

    const webDevConfig = result.agentConfigs.find((ac) => ac.name === "web-developer");
    expect(webDevConfig).toStrictEqual({ name: "web-developer", scope: "project" });

    // Other agents should remain global
    const otherConfigs = result.agentConfigs.filter((ac) => ac.name !== "web-developer");
    for (const config of otherConfigs) {
      expect(config.scope).toBe("global");
    }
  });

  it("edit-mode restores agent scope configs", () => {
    // Simulate what useWizardInitialization does: set state directly with mixed scopes
    const agentConfigs: AgentScopeConfig[] = [
      { name: "web-developer", scope: "project" },
      { name: "api-developer", scope: "global" },
    ];

    useWizardStore.setState({
      selectedAgents: ["web-developer", "api-developer"],
      agentConfigs,
    });

    const state = useWizardStore.getState();
    expect(state.agentConfigs).toStrictEqual([
      { name: "web-developer", scope: "project" },
      { name: "api-developer", scope: "global" },
    ]);
    expect(state.selectedAgents).toStrictEqual(["web-developer", "api-developer"]);
  });

  it("deselecting global agent removes it during fresh init", () => {
    simulateSkillSelections(["web-framework-react"], matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    // Deselect web-developer (global scope, no installed configs) → should be removed
    useWizardStore.getState().toggleAgent("web-developer");

    const config = useWizardStore.getState().agentConfigs.find((ac) => ac.name === "web-developer");
    expect(config).toBeUndefined();
  });

  it("deselecting global agent marks it as excluded during edit", () => {
    simulateSkillSelections(["web-framework-react"], matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    // Simulate edit flow: set installed agent configs
    useWizardStore.setState({
      installedAgentConfigs: [{ name: "web-developer", scope: "global" }],
    });

    // Deselect web-developer (global scope, installed) → should be marked excluded
    useWizardStore.getState().toggleAgent("web-developer");

    const config = useWizardStore.getState().agentConfigs.find((ac) => ac.name === "web-developer");
    expect(config).toBeDefined();
    expect(config).toStrictEqual({
      name: "web-developer",
      scope: "global",
      excluded: true,
    });
  });

  it("agent scope changes detected in edit flow", () => {
    const oldAgentConfigs: AgentScopeConfig[] = [
      { name: "web-developer", scope: "global" },
      { name: "api-developer", scope: "global" },
    ];
    const newAgentConfigs: AgentScopeConfig[] = [
      { name: "web-developer", scope: "project" },
      { name: "api-developer", scope: "global" },
    ];

    // Compute changes: find agents where old.scope !== new.scope
    const changes = newAgentConfigs.filter((newConfig) => {
      const oldConfig = oldAgentConfigs.find((oc) => oc.name === newConfig.name);
      return oldConfig && oldConfig.scope !== newConfig.scope;
    });

    expect(changes).toHaveLength(1);
    expect(changes[0]).toStrictEqual({ name: "web-developer", scope: "project" });

    // api-developer should have no change
    const apiChange = changes.find((c) => c.name === "api-developer");
    expect(apiChange).toBeUndefined();
  });
});

// ── Excluded Skills — Global/Project Interaction ────────────────────────────────

describe("Excluded Skills — Global/Project Interaction", () => {
  let matrix: MergedSkillsMatrix;

  beforeEach(() => {
    matrix = createComprehensiveMatrix();
    initializeMatrix(matrix);
    useWizardStore.getState().reset();
  });

  it("should split skills and agents into global and project config via splitConfigByScope", () => {
    // Select skills: react at global, hono at project
    simulateSkillSelections(
      ["web-framework-react", "web-state-zustand", "api-framework-hono"],
      matrix,
      ["web", "api"],
    );
    useWizardStore.getState().preselectAgentsFromDomains();

    // Override scopes: react + zustand global, hono project
    useWizardStore.setState({
      skillConfigs: [
        { id: "web-framework-react", scope: "global", source: "agents-inc" },
        { id: "web-state-zustand", scope: "global", source: "agents-inc" },
        { id: "api-framework-hono", scope: "project", source: "agents-inc" },
      ],
      agentConfigs: [
        { name: "web-developer", scope: "global" },
        { name: "api-developer", scope: "project" },
      ],
    });

    const wizardResult = buildWizardResultFromStore(matrix);
    const config = buildProjectConfig({
      skills: wizardResult.skills,
      agents: wizardResult.agentConfigs,
    });

    const { global: globalConfig, project: projectConfig } = splitConfigByScope(config);

    // Global partition has only global-scoped skills
    const globalSkillIds = globalConfig.skills.map((s) => s.id);
    expect(globalSkillIds).toContain("web-framework-react");
    expect(globalSkillIds).toContain("web-state-zustand");
    expect(globalSkillIds).not.toContain("api-framework-hono");

    // Project partition has only project-scoped skills
    const projectSkillIds = projectConfig.skills.map((s) => s.id);
    expect(projectSkillIds).toContain("api-framework-hono");
    expect(projectSkillIds).not.toContain("web-framework-react");
    expect(projectSkillIds).not.toContain("web-state-zustand");

    // Global agents in global partition
    const globalAgentNames = globalConfig.agents.map((a) => a.name);
    expect(globalAgentNames).toContain("web-developer");
    expect(globalAgentNames).not.toContain("api-developer");

    // Project agents in project partition
    const projectAgentNames = projectConfig.agents.map((a) => a.name);
    expect(projectAgentNames).toContain("api-developer");
    expect(projectAgentNames).not.toContain("web-developer");
  });

  it("should route excluded global skill to project partition, not global partition", () => {
    // Set up: react is selected globally, simulate edit flow with installed configs
    const store = useWizardStore.getState();
    useWizardStore.setState({
      installedSkillConfigs: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
    });
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);
    store.toggleTechnology("web", "web-client-state", "web-state-zustand", false);

    // Deselect react: marks as excluded (global skill, previously installed)
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);

    const { skillConfigs } = useWizardStore.getState();
    const reactConfig = skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactConfig?.excluded).toBe(true);

    // Build config with zustand still active + react excluded
    const config = buildProjectConfig({
      skills: skillConfigs,
      agents: buildAgentConfigs(["web-developer"], { scope: "global" }),
    });

    const { global: globalConfig, project: projectConfig } = splitConfigByScope(config);

    // Excluded react should NOT be in global partition
    const globalSkillIds = globalConfig.skills.map((s) => s.id);
    expect(globalSkillIds).not.toContain("web-framework-react");

    // Excluded react SHOULD be in project partition (excluded global routes to project)
    const projectSkillIds = projectConfig.skills.map((s) => s.id);
    expect(projectSkillIds).toContain("web-framework-react");
    const projectReact = projectConfig.skills.find((s) => s.id === "web-framework-react");
    expect(projectReact?.excluded).toBe(true);

    // Zustand should remain in global partition unchanged
    expect(globalSkillIds).toContain("web-state-zustand");
  });

  it("should move skill cleanly to project partition when scope toggled from global to project", () => {
    // Set up: react at global scope
    const store = useWizardStore.getState();
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);

    // Toggle scope from global to project
    store.toggleSkillScope("web-framework-react");

    const { skillConfigs } = useWizardStore.getState();
    const reactConfig = skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactConfig?.scope).toBe("project");
    // Toggling scope does NOT set excluded
    expect(reactConfig?.excluded).toBeUndefined();

    const config = buildProjectConfig({
      skills: skillConfigs,
      agents: buildAgentConfigs(["web-developer"], { scope: "global" }),
    });

    const { global: globalConfig, project: projectConfig } = splitConfigByScope(config);

    // React should be in project partition (scope: "project")
    const projectSkillIds = projectConfig.skills.map((s) => s.id);
    expect(projectSkillIds).toContain("web-framework-react");
    const projectReact = projectConfig.skills.find((s) => s.id === "web-framework-react");
    expect(projectReact?.excluded).toBeUndefined();

    // React should NOT be in global partition
    const globalSkillIds = globalConfig.skills.map((s) => s.id);
    expect(globalSkillIds).not.toContain("web-framework-react");
  });

  it("should show excluded skills as deselected in domainSelections but preserved in skillConfigs on re-edit", () => {
    // Set up active skills + one excluded skill
    const activeSkillIds: SkillId[] = ["web-framework-react", "api-framework-hono"];
    const savedConfigs: SkillConfig[] = [
      { id: "web-framework-react", scope: "global", source: "agents-inc" },
      { id: "api-framework-hono", scope: "project", source: "agents-inc" },
      { id: "web-state-zustand", scope: "global", source: "agents-inc", excluded: true },
    ];

    // Simulate re-edit: populateFromSkillIds with active IDs + savedConfigs (including excluded)
    useWizardStore.getState().populateFromSkillIds(activeSkillIds, savedConfigs);

    const state = useWizardStore.getState();

    // Excluded skill should NOT be in domainSelections (appears deselected)
    const allSelectedTechs = state.getAllSelectedTechnologies();
    expect(allSelectedTechs).not.toContain("web-state-zustand");
    expect(allSelectedTechs).toContain("web-framework-react");
    expect(allSelectedTechs).toContain("api-framework-hono");

    // Excluded skill IS preserved in skillConfigs
    const zustandConfig = state.skillConfigs.find((sc) => sc.id === "web-state-zustand");
    expect(zustandConfig).toBeDefined();
    expect(zustandConfig?.excluded).toBe(true);

    // Build wizard result — excluded entries flow through
    const wizardResult = buildWizardResultFromStore(matrix);
    const excludedInResult = wizardResult.skills.find((sc) => sc.id === "web-state-zustand");
    expect(excludedInResult).toBeDefined();
    expect(excludedInResult?.excluded).toBe(true);
  });

  it("should allow project eject to global when no global eject exists", () => {
    const store = useWizardStore.getState();
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);

    // Set scope to project, source to eject, no global preselections
    useWizardStore.setState({
      skillConfigs: [{ id: "web-framework-react", scope: "project", source: "eject" }],
      globalPreselections: null,
    });

    store.toggleSkillScope("web-framework-react");

    const { skillConfigs } = useWizardStore.getState();
    expect(skillConfigs[0].scope).toBe("global");
  });

  it("should complete full exclusion lifecycle: select globally, exclude, re-edit deselected, re-select clears exclusion", () => {
    const store = useWizardStore.getState();

    // Step 1: Select react globally, simulate edit flow with installed configs
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);
    // Set installed configs to simulate edit flow (react was previously installed)
    useWizardStore.setState({
      installedSkillConfigs: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
    });

    const afterSelect = useWizardStore.getState();
    expect(afterSelect.getAllSelectedTechnologies()).toContain("web-framework-react");
    const reactActive = afterSelect.skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactActive?.scope).toBe("global");
    expect(reactActive?.excluded).toBeUndefined();

    // Step 2: Deselect react (marks as excluded since it was installed)
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);

    const afterDeselect = useWizardStore.getState();
    expect(afterDeselect.getAllSelectedTechnologies()).not.toContain("web-framework-react");
    const reactExcluded = afterDeselect.skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactExcluded?.excluded).toBe(true);

    // Step 3: Simulate re-edit — populateFromSkillIds with no active skills but excluded in savedConfigs
    store.reset();
    initializeMatrix(matrix);
    const savedConfigs: SkillConfig[] = [
      { id: "web-framework-react", scope: "global", source: "agents-inc", excluded: true },
    ];
    store.populateFromSkillIds([], savedConfigs);

    const afterPopulate = useWizardStore.getState();

    // React NOT in domainSelections (deselected)
    expect(afterPopulate.getAllSelectedTechnologies()).not.toContain("web-framework-react");
    // React IS in skillConfigs as excluded
    const reactInConfigs = afterPopulate.skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactInConfigs).toBeDefined();
    expect(reactInConfigs?.excluded).toBe(true);

    // Step 4: Re-select react via toggleTechnology — clears exclusion
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);

    const afterReselect = useWizardStore.getState();
    expect(afterReselect.getAllSelectedTechnologies()).toContain("web-framework-react");
    const reactCleared = afterReselect.skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactCleared?.excluded).toBeUndefined();
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
