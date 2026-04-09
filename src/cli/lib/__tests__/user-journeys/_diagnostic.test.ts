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
import type { MergedSkillsMatrix, ProjectConfig, SkillId } from "../../../types";
import type { SourceLoadResult } from "../../loading/source-loader";
import {
  createBasicMatrix,
  createComprehensiveMatrix,
  buildSourceResult,
  buildWizardResultFromStore,
  simulateSkillSelections,
  readTestTsConfig,
} from "../helpers";

const CLI_REPO_PATH = path.resolve(__dirname, "../../../../..");

describe("DIAGNOSTIC: exact counts", () => {
  let dirs: TestDirs;
  let originalCwd: string;
  let matrix: MergedSkillsMatrix;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    originalCwd = process.cwd();
    dirs = await createTestSource({ skills: ALL_TEST_SKILLS });
    process.chdir(dirs.projectDir);
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

  it("Journey 1 test 1: initial install (web domain, react+zustand)", async () => {
    const initialSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];
    simulateSkillSelections(initialSkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();

    const initialWizardResult = buildWizardResultFromStore(matrix);
    const initialResult = await installEject({
      wizardResult: initialWizardResult,
      sourceResult,
      projectDir: dirs.projectDir,
    });

    console.log("=== Journey 1 test 1 initial ===");
    console.log("compiledAgents:", JSON.stringify(initialResult.compiledAgents));
    console.log("compiledAgents.length:", initialResult.compiledAgents.length);

    // Check agent file content lengths
    for (const agentName of initialResult.compiledAgents) {
      const agentPath = path.join(initialResult.agentsDir, `${agentName}.md`);
      const content = await readFile(agentPath, "utf-8");
      console.log(`agent ${agentName} content.length:`, content.length);
    }

    // Now do the edit
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

    console.log("=== Journey 1 test 1 edit ===");
    console.log("editResult.compiledAgents:", JSON.stringify(editResult.compiledAgents));
    console.log("editResult.compiledAgents.length:", editResult.compiledAgents.length);
    for (const agentName of editResult.compiledAgents) {
      const agentPath = path.join(editResult.agentsDir, `${agentName}.md`);
      const content = await readFile(agentPath, "utf-8");
      console.log(`edit agent ${agentName} content.length:`, content.length);
    }

    expect(true).toBe(true);
  });

  it("Journey 1 test 2: preserve existing agents (web then web+api)", async () => {
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
    console.log("=== Journey 1 test 2 initial ===");
    console.log("initialAgents:", JSON.stringify(initialAgents));
    console.log("initialAgents.length:", initialAgents.length);
    expect(true).toBe(true);
  });

  it("Journey 2 test 1: remove skill, recompile (web+api)", async () => {
    const initialSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];
    simulateSkillSelections(initialSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    await installEject({
      wizardResult: buildWizardResultFromStore(matrix),
      sourceResult,
      projectDir: dirs.projectDir,
    });
    useWizardStore.getState().reset();
    const reducedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(reducedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    const editResult = await installEject({
      wizardResult: buildWizardResultFromStore(matrix),
      sourceResult,
      projectDir: dirs.projectDir,
    });
    console.log("=== Journey 2 test 1 ===");
    console.log("editResult.compiledAgents:", JSON.stringify(editResult.compiledAgents));
    console.log("editResult.compiledAgents.length:", editResult.compiledAgents.length);
    expect(true).toBe(true);
  });

  it("Journey 2 test 2: remove all api skills (web only)", async () => {
    const initialSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];
    simulateSkillSelections(initialSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    await installEject({
      wizardResult: buildWizardResultFromStore(matrix),
      sourceResult,
      projectDir: dirs.projectDir,
    });
    useWizardStore.getState().reset();
    const webOnlySkills: SkillId[] = ["web-framework-react"];
    simulateSkillSelections(webOnlySkills, matrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    const editResult = await installEject({
      wizardResult: buildWizardResultFromStore(matrix),
      sourceResult,
      projectDir: dirs.projectDir,
    });
    console.log("=== Journey 2 test 2 ===");
    console.log("editResult.compiledAgents:", JSON.stringify(editResult.compiledAgents));
    console.log("editResult.compiledAgents.length:", editResult.compiledAgents.length);
    expect(true).toBe(true);
  });

  it("Journey 3 test 1: recompile from existing config", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    const installResult = await installEject({
      wizardResult: buildWizardResultFromStore(matrix),
      sourceResult,
      projectDir: dirs.projectDir,
    });
    console.log("=== Journey 3 test 1 install ===");
    console.log("installResult.compiledAgents:", JSON.stringify(installResult.compiledAgents));
    console.log("installResult.compiledAgents.length:", installResult.compiledAgents.length);

    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    console.log("loadedConfig.config.agents:", JSON.stringify(loadedConfig!.config.agents));
    console.log("loadedConfig.config.agents.length:", loadedConfig!.config.agents.length);

    const recompileResult = await recompileAgents({
      pluginDir: dirs.projectDir,
      sourcePath: CLI_REPO_PATH,
      projectDir: dirs.projectDir,
      outputDir: installResult.agentsDir,
    });
    console.log("recompileResult.compiled:", JSON.stringify(recompileResult.compiled));
    console.log("recompileResult.compiled.length:", recompileResult.compiled.length);
    for (const agentName of recompileResult.compiled) {
      const agentPath = path.join(installResult.agentsDir, `${agentName}.md`);
      const content = await readFile(agentPath, "utf-8");
      console.log(`recompile agent ${agentName} content.length:`, content.length);
    }
    expect(true).toBe(true);
  });

  it("Config Roundtrip: agents and skills counts", async () => {
    const selectedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];
    simulateSkillSelections(selectedSkills, matrix, ["web", "api"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    await installEject({
      wizardResult: buildWizardResultFromStore(matrix),
      sourceResult,
      projectDir: dirs.projectDir,
      sourceFlag: "github:test/source",
    });
    const loadedConfig = await loadProjectConfig(dirs.projectDir);
    const config = loadedConfig!.config;
    console.log("=== Config Roundtrip ===");
    console.log("config.agents:", JSON.stringify(config.agents));
    console.log("config.agents.length:", config.agents.length);
    console.log("config.skills:", JSON.stringify(config.skills));
    console.log("config.skills.length:", config.skills.length);
    expect(true).toBe(true);
  });

  it("per-agent scope: agents default to global scope (basic matrix)", () => {
    useWizardStore.getState().reset();
    initializeMatrix(BUILT_IN_MATRIX);
    const basicMatrix = createBasicMatrix();
    initializeMatrix(basicMatrix);
    simulateSkillSelections(["web-framework-react"], basicMatrix, ["web"]);
    useWizardStore.getState().preselectAgentsFromDomains();
    const { agentConfigs } = useWizardStore.getState();
    console.log("=== per-agent scope ===");
    console.log("agentConfigs:", JSON.stringify(agentConfigs));
    console.log("agentConfigs.length:", agentConfigs.length);
    expect(true).toBe(true);
  });
});
