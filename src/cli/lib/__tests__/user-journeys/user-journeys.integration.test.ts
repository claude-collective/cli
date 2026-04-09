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
import { DEFAULT_PLUGIN_NAME, STANDARD_FILES } from "../../../consts";
import type {
  AgentScopeConfig,
  MergedSkillsMatrix,
  ProjectConfig,
  SkillConfig,
  SkillId,
} from "../../../types";
import type { SourceLoadResult } from "../../loading/source-loader";
import { splitConfigByScope } from "../../configuration/config-generator";
import { createBasicMatrix, createComprehensiveMatrix } from "../factories/matrix-factories.js";
import { buildProjectConfig, buildAgentConfigs, buildSourceResult } from "../factories/config-factories.js";
import { buildWizardResultFromStore, simulateSkillSelections, extractSkillIdsFromAssignment } from "../helpers/wizard-simulation.js";
import { readTestTsConfig } from "../helpers/config-io.js";
import { fileExists, directoryExists } from "../test-fs-utils";
import {
  expectConfigSkills,
  expectConfigAgents,
  expectSkillConfigs,
  expectAgentConfigs,
  expectCompiledAgents,
} from "../assertions";
import { EXPECTED_AGENTS, EXPECTED_SKILLS } from "../expected-values";

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
    const initialSkills: SkillId[] = [...EXPECTED_SKILLS.WEB_DEFAULT];

    simulateSkillSelections(initialSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    const initialResult = await installEject({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify initial state: full config structure
    const initialConfig = await readTestTsConfig<ProjectConfig>(initialResult.configPath);
    expectSkillConfigs(initialConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
    ]);
    expectAgentConfigs(initialConfig, EXPECTED_AGENTS.WEB.map((name) => ({ name, scope: "global" })));
    expectCompiledAgents(initialResult, [...EXPECTED_AGENTS.WEB]);

    // Initial stack: web agents have web categories
    expect(initialConfig.stack).toBeDefined();
    expect(Object.keys(initialConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB]);
    for (const agentName of EXPECTED_AGENTS.WEB) {
      const agentStack = initialConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["web-client-state", "web-framework"]);
    }

    // Step 2: Re-init with skills A, B, C (add hono)
    useWizardStore.getState().reset();
    const expandedSkills: SkillId[] = [...EXPECTED_SKILLS.WEB_AND_API];

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

    // Config now includes all three skills with full structure (merge preserves existing order, appends new)
    expectSkillConfigs(updatedConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // Agents include both web and api (merged), all global scope
    expectAgentConfigs(updatedConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Stack: every agent gets every skill's category
    expect(updatedConfig.stack).toBeDefined();
    expect(Object.keys(updatedConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = updatedConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual([
        "api-api",
        "web-client-state",
        "web-framework",
      ]);
    }

    // Agents are compiled (6 web + 3 api)
    expectCompiledAgents(editResult, EXPECTED_AGENTS.WEB_AND_API);

    // Agent files exist on disk
    for (const agentName of editResult.compiledAgents) {
      const agentPath = path.join(editResult.agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);
      const content = await readFile(agentPath, "utf-8");
      expect(content).toContain("---");
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

    expectCompiledAgents(initialResult, [...EXPECTED_AGENTS.WEB]);

    // Verify initial config fully
    const initialConfig = await readTestTsConfig<ProjectConfig>(initialResult.configPath);
    expectSkillConfigs(initialConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
    ]);
    expectAgentConfigs(initialConfig, EXPECTED_AGENTS.WEB.map((name) => ({ name, scope: "global" })));
    expect(initialConfig.stack).toBeDefined();
    expect(Object.keys(initialConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB]);
    for (const agentName of EXPECTED_AGENTS.WEB) {
      const agentStack = initialConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["web-framework"]);
    }

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

    // All initial web agents + new API agents should be present (merge unions agents), all global
    expectAgentConfigs(updatedConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Skills include both web + api
    expectSkillConfigs(updatedConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // Stack: every agent gets every skill's category (react + hono)
    expect(updatedConfig.stack).toBeDefined();
    expect(Object.keys(updatedConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = updatedConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["api-api", "web-framework"]);
    }

    // Compiled agents should match
    expectCompiledAgents(editResult, EXPECTED_AGENTS.WEB_AND_API);
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
    const initialSkills: SkillId[] = [...EXPECTED_SKILLS.WEB_AND_API];
    simulateSkillSelections(initialSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    const initialResult = await installEject({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify initial config: 3 skills, web+api agents, stack with 3 categories
    const initialConfig = await readTestTsConfig<ProjectConfig>(initialResult.configPath);
    expectSkillConfigs(initialConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);
    expectAgentConfigs(initialConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));
    expect(initialConfig.stack).toBeDefined();
    expect(Object.keys(initialConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = initialConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual([
        "api-api",
        "web-client-state",
        "web-framework",
      ]);
    }

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

    // Merge UNIONS skills: zustand persists from first install, react + hono updated
    expectSkillConfigs(updatedConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // All agents preserved via merge (web + api), all global scope
    expectAgentConfigs(updatedConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Stack: merged union — all agents have all skill categories from both installs
    expect(updatedConfig.stack).toBeDefined();
    expect(Object.keys(updatedConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = updatedConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual([
        "api-api",
        "web-client-state",
        "web-framework",
      ]);
    }

    // Agents are compiled (6 web + 3 api from merged config)
    expectCompiledAgents(editResult, EXPECTED_AGENTS.WEB_AND_API);

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
    const initialResult = await installEject({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    // Verify initial config: web+api skills, web+api agents, stack with 2 categories
    const initialConfig = await readTestTsConfig<ProjectConfig>(initialResult.configPath);
    expectSkillConfigs(initialConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);
    expect(initialConfig.stack).toBeDefined();
    expect(Object.keys(initialConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = initialConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["api-api", "web-framework"]);
    }

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

    // Merge UNIONS: both react and hono persist (hono from first install, react updated)
    expectSkillConfigs(updatedConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // Merge UNIONS agents: both web + api agents preserved, all global
    expectAgentConfigs(updatedConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Stack: merged union — all agents have both categories from both installs
    expect(updatedConfig.stack).toBeDefined();
    expect(Object.keys(updatedConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = updatedConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["api-api", "web-framework"]);
    }

    // Agents should be recompiled (merged config preserves all agents)
    expectCompiledAgents(editResult, EXPECTED_AGENTS.WEB_AND_API);
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

    // Verify installation produced exact agents and config
    expectCompiledAgents(installResult, EXPECTED_AGENTS.WEB_AND_API);
    expect(await fileExists(installResult.configPath)).toBe(true);

    // Step 2: Load config back from disk — verify full structure
    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    expect(loadedConfig).not.toBeNull();
    expectAgentConfigs(loadedConfig!.config, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));
    expectSkillConfigs(loadedConfig!.config, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // Loaded stack: every agent has all skill categories
    const loadedStack = loadedConfig!.config.stack;
    expect(loadedStack).toBeDefined();
    expect(Object.keys(loadedStack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = loadedStack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual([
        "api-api",
        "web-client-state",
        "web-framework",
      ]);
    }

    // Step 3: Recompile using recompileAgents (simulating `compile` command)
    const agentsDir = installResult.agentsDir;
    const recompileResult = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: agentsDir,
    });

    // Step 4: Assert
    // Recompile should produce exact agents matching the config
    expectCompiledAgents({ compiledAgents: recompileResult.compiled }, EXPECTED_AGENTS.WEB_AND_API);

    // Every compiled agent should have a .md file
    for (const agentName of recompileResult.compiled) {
      const agentPath = path.join(agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);

      const content = await readFile(agentPath, "utf-8");
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

    // Load config from disk — verify full agent and skill structure
    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    expectAgentConfigs(loadedConfig!.config, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));
    expectSkillConfigs(loadedConfig!.config, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // Loaded stack: every agent has both categories
    const loadedStack = loadedConfig!.config.stack;
    expect(loadedStack).toBeDefined();
    expect(Object.keys(loadedStack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = loadedStack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["api-api", "web-framework"]);
    }

    // Recompile
    const recompileResult = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: installResult.agentsDir,
    });

    // Compiled agents should exactly match config.agents
    expectCompiledAgents({ compiledAgents: recompileResult.compiled }, EXPECTED_AGENTS.WEB_AND_API);

    // Agent files exist and contain frontmatter
    for (const agentName of recompileResult.compiled) {
      const agentPath = path.join(installResult.agentsDir, `${agentName}.md`);
      expect(await fileExists(agentPath)).toBe(true);
      const content = await readFile(agentPath, "utf-8");
      expect(content).toContain("---");
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
    const firstSkills: SkillId[] = [...EXPECTED_SKILLS.WEB_DEFAULT];
    simulateSkillSelections(firstSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const firstWizardResult = buildWizardResultFromStore(matrix);
    const firstResult = await installEject({
      wizardResult: firstWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const firstConfig = await readTestTsConfig<ProjectConfig>(firstResult.configPath);

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

    // Merged agents: web agents from first init + api agents from second init, all global
    expectAgentConfigs(mergedConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Merged skills: react + zustand from first, hono + drizzle from second (union, no overlap)
    expectSkillConfigs(mergedConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
      { id: "api-database-drizzle", scope: "project", source: "eject" },
    ]);

    // Config was merged
    expect(secondResult.wasMerged).toBe(true);

    // Stack: web agents have web categories, api agents have api categories (merged from both inits)
    expect(mergedConfig.stack).toBeDefined();
    expect(Object.keys(mergedConfig.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB) {
      const agentStack = mergedConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["web-client-state", "web-framework"]);
    }
    for (const agentName of EXPECTED_AGENTS.API) {
      const agentStack = mergedConfig.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(["api-api", "api-database"]);
    }

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

    // No duplicate agents — exact agent list with scopes
    expectAgentConfigs(mergedConfig, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // No duplicate agent names
    const agentNames = mergedConfig.agents.map((a) => a.name);
    expect(agentNames).toStrictEqual([...new Set(agentNames)]);

    // Skills: react + hono from both inits (deduplicated), drizzle new
    expectSkillConfigs(mergedConfig, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
      { id: "api-database-drizzle", scope: "project", source: "eject" },
    ]);
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
    const secondSkills: SkillId[] = [...EXPECTED_SKILLS.API_DEFAULT];
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

    // Full skills with scope and source
    expectSkillConfigs(config, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "web-styling-scss-modules", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
      { id: "api-database-drizzle", scope: "project", source: "eject" },
    ]);

    // Full agents with scope
    expectAgentConfigs(config, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Stack: every agent gets every skill's category (no stack filtering without selectedStackId)
    const expectedCategories = [
      "api-api",
      "api-database",
      "web-client-state",
      "web-framework",
      "web-styling",
    ];
    expect(config.stack).toBeDefined();
    expect(Object.keys(config.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = config.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(expectedCategories);
      // Verify exact skill assignments per category
      expect(
        extractSkillIdsFromAssignment(agentStack!["web-framework" as keyof typeof agentStack]),
      ).toStrictEqual(["web-framework-react"]);
      expect(
        extractSkillIdsFromAssignment(agentStack!["api-api" as keyof typeof agentStack]),
      ).toStrictEqual(["api-framework-hono"]);
      expect(
        extractSkillIdsFromAssignment(agentStack!["api-database" as keyof typeof agentStack]),
      ).toStrictEqual(["api-database-drizzle"]);
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

    // Full skills verification
    expectSkillConfigs(config, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "web-styling-scss-modules", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
      { id: "api-database-drizzle", scope: "project", source: "eject" },
      { id: "web-testing-vitest", scope: "project", source: "eject" },
    ]);

    // Full agents verification (shared domain has no domain agents)
    expectAgentConfigs(config, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));

    // Stack: exact agent keys and category keys
    const expectedCategories = [
      "api-api",
      "api-database",
      "web-client-state",
      "web-framework",
      "web-styling",
      "web-testing",
    ];
    expect(config.stack).toBeDefined();
    expect(Object.keys(config.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = config.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(expectedCategories);
    }

    // Every skill in stack must be in config.skills (invariant)
    const configSkillIds = config.skills.map((s) => s.id);
    for (const [, agentConfig] of Object.entries(config.stack!)) {
      for (const [, assignments] of Object.entries(agentConfig as Record<string, unknown>)) {
        const skillIds = extractSkillIdsFromAssignment(assignments);
        for (const skillId of skillIds) {
          expect(configSkillIds).toContain(skillId);
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
    expectCompiledAgents({ compiledAgents: result1.compiled }, result2.compiled);
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

    // Core fields should match what was installed — full strict equality
    expect(config.name).toBe(DEFAULT_PLUGIN_NAME);
    expectAgentConfigs(config, EXPECTED_AGENTS.WEB_AND_API.map((name) => ({ name, scope: "global" })));
    expectSkillConfigs(config, [
      { id: "web-framework-react", scope: "project", source: "eject" },
      { id: "web-state-zustand", scope: "project", source: "eject" },
      { id: "api-framework-hono", scope: "project", source: "eject" },
    ]);

    // Source should be preserved
    expect(config.source).toBe("github:test/source");

    // Stack roundtrip: exact agent keys and category-to-skill mappings
    const expectedCategories = ["api-api", "web-client-state", "web-framework"];
    expect(config.stack).toBeDefined();
    expect(Object.keys(config.stack!).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB_AND_API]);
    for (const agentName of EXPECTED_AGENTS.WEB_AND_API) {
      const agentStack = config.stack![agentName];
      expect(Object.keys(agentStack!).sort()).toStrictEqual(expectedCategories);
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
    expect(agentConfigs.map((ac) => ac.name).sort()).toStrictEqual([...EXPECTED_AGENTS.WEB]);
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
      [...EXPECTED_SKILLS.WEB_AND_API],
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
    expectConfigSkills(globalConfig, [...EXPECTED_SKILLS.WEB_DEFAULT]);

    // Project partition has only project-scoped skills
    expectConfigSkills(projectConfig, ["api-framework-hono"]);

    // Global agents in global partition
    expectConfigAgents(globalConfig, ["web-developer"]);

    // Project agents in project partition
    expectConfigAgents(projectConfig, ["api-developer"]);
  });

  it("should route excluded global skill to project partition, not global partition", () => {
    // Set up: react is selected globally, simulate project init with existing global installation
    const store = useWizardStore.getState();
    useWizardStore.setState({
      installedSkillConfigs: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
      isInitMode: true,
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

    // Excluded react should NOT be in global partition; zustand remains
    expectConfigSkills(globalConfig, ["web-state-zustand"]);

    // Excluded react SHOULD be in project partition (excluded global routes to project)
    expectConfigSkills(projectConfig, ["web-framework-react"]);
    const projectReact = projectConfig.skills.find((s) => s.id === "web-framework-react");
    expect(projectReact?.excluded).toBe(true);
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
    expectConfigSkills(projectConfig, ["web-framework-react"]);
    const projectReact = projectConfig.skills.find((s) => s.id === "web-framework-react");
    expect(projectReact?.excluded).toBeUndefined();

    // React should NOT be in global partition
    expectConfigSkills(globalConfig, []);
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
    expect(zustandConfig).toStrictEqual({
      id: "web-state-zustand",
      scope: "global",
      source: "agents-inc",
      excluded: true,
    });

    // Build wizard result — excluded entries flow through
    const wizardResult = buildWizardResultFromStore(matrix);
    const excludedInResult = wizardResult.skills.find((sc) => sc.id === "web-state-zustand");
    expect(excludedInResult).toStrictEqual({
      id: "web-state-zustand",
      scope: "global",
      source: "agents-inc",
      excluded: true,
    });
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

    // Step 1: Select react globally, simulate project init with existing global installation
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);
    // Set installed configs to simulate project init (react was previously installed globally)
    useWizardStore.setState({
      installedSkillConfigs: [{ id: "web-framework-react", scope: "global", source: "agents-inc" }],
      isInitMode: true,
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
    expect(reactInConfigs).toStrictEqual({
      id: "web-framework-react",
      scope: "global",
      source: "agents-inc",
      excluded: true,
    });

    // Step 4: Re-select react via toggleTechnology — clears exclusion
    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", "web-framework-react", true);

    const afterReselect = useWizardStore.getState();
    expect(afterReselect.getAllSelectedTechnologies()).toContain("web-framework-react");
    const reactCleared = afterReselect.skillConfigs.find((sc) => sc.id === "web-framework-react");
    expect(reactCleared?.excluded).toBeUndefined();
  });
});
