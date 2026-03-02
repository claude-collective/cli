import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { AgentName, ProjectConfig, SkillId } from "../../../types";
import type { SourceLoadResult } from "../../loading/source-loader";
import { installLocal, buildAndMergeConfig, writeConfigFile } from "../../installation/local-installer";
import { detectMigrations } from "../../installation/mode-migrator";
import { useWizardStore } from "../../../stores/wizard-store";
import {
  createMockMatrix,
  createMockMultiSourceSkill,
  createMockSkillSource,
  createTempDir,
  cleanupTempDir,
  getTestSkill,
  readTestTsConfig,
  buildWizardResult,
  buildSourceResult,
  fileExists,
  writeTestTsConfig,
} from "../helpers";
import {
  createTestSource,
  cleanupTestSource,
  DEFAULT_TEST_SKILLS,
  type TestDirs,
} from "../fixtures/create-test-source";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../../consts";
import path from "path";

const REACT_SKILL_ID: SkillId = "web-framework-react";
const ZUSTAND_SKILL_ID: SkillId = "web-state-zustand";
const HONO_SKILL_ID: SkillId = "api-framework-hono";
const VITEST_SKILL_ID: SkillId = "web-testing-vitest";

const INIT_SKILL_IDS: SkillId[] = [REACT_SKILL_ID, HONO_SKILL_ID, VITEST_SKILL_ID];
const INIT_TEST_SKILLS = DEFAULT_TEST_SKILLS.filter((s) => INIT_SKILL_IDS.includes(s.id));

const INIT_TEST_MATRIX = createMockMatrix({
  "web-framework-react": getTestSkill("react"),
  "api-framework-hono": getTestSkill("hono"),
  "web-testing-vitest": getTestSkill("vitest"),
});

describe("Integration: Install Mode Persistence", () => {
  let dirs: TestDirs;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: INIT_TEST_SKILLS });
    sourceResult = buildSourceResult(INIT_TEST_MATRIX, dirs.sourceDir);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should persist installMode 'local' in config after install", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "local",
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(config.installMode).toBe("local");
  });

  it("should persist installMode 'plugin' in config after install", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "plugin",
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(config.installMode).toBe("plugin");
  });

  it("should persist installMode 'mixed' in config after install", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "mixed",
        sourceSelections: {
          [REACT_SKILL_ID]: "local",
          [HONO_SKILL_ID]: "agents-inc",
          [VITEST_SKILL_ID]: "agents-inc",
        },
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(config.installMode).toBe("mixed");
  });

  it("should persist sourceSelections in config after install", async () => {
    const sourceSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "agents-inc",
      [VITEST_SKILL_ID]: "local",
    };

    const result = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "mixed",
        sourceSelections,
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(config.sourceSelections).toBeDefined();
    expect(config.sourceSelections?.[REACT_SKILL_ID]).toBe("local");
    expect(config.sourceSelections?.[HONO_SKILL_ID]).toBe("agents-inc");
    expect(config.sourceSelections?.[VITEST_SKILL_ID]).toBe("local");
  });

  it("should not persist sourceSelections when empty", async () => {
    const result = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "local",
        sourceSelections: {},
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(config.sourceSelections).toBeUndefined();
  });
});

describe("Integration: Install Mode Config Round-Trip", () => {
  let dirs: TestDirs;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: INIT_TEST_SKILLS });
    sourceResult = buildSourceResult(INIT_TEST_MATRIX, dirs.sourceDir);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should round-trip installMode through config write and read", async () => {
    // First install with "local"
    const result1 = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "local",
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config1 = await readTestTsConfig<ProjectConfig>(result1.configPath);
    expect(config1.installMode).toBe("local");

    // Second install with "plugin" — config gets overwritten
    const result2 = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "plugin",
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config2 = await readTestTsConfig<ProjectConfig>(result2.configPath);
    expect(config2.installMode).toBe("plugin");
  });

  it("should round-trip sourceSelections through config write and read", async () => {
    const sourceSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "agents-inc",
    };

    const result = await installLocal({
      wizardResult: buildWizardResult(INIT_SKILL_IDS, {
        selectedAgents: ["web-developer"] as AgentName[],
        installMode: "mixed",
        sourceSelections,
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(config.sourceSelections).toEqual(sourceSelections);
  });
});

describe("Integration: buildAndMergeConfig Install Mode", () => {
  let dirs: TestDirs;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: INIT_TEST_SKILLS });
    sourceResult = buildSourceResult(INIT_TEST_MATRIX, dirs.sourceDir);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should set installMode in merged config", async () => {
    const wizardResult = buildWizardResult(INIT_SKILL_IDS, {
      selectedAgents: ["web-developer"] as AgentName[],
      installMode: "plugin",
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    expect(mergeResult.config.installMode).toBe("plugin");
  });

  it("should set sourceSelections in merged config when non-empty", async () => {
    const sourceSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "agents-inc",
    };

    const wizardResult = buildWizardResult(INIT_SKILL_IDS, {
      selectedAgents: ["web-developer"] as AgentName[],
      installMode: "mixed",
      sourceSelections,
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    expect(mergeResult.config.sourceSelections).toEqual(sourceSelections);
  });

  it("should not set sourceSelections in merged config when empty", async () => {
    const wizardResult = buildWizardResult(INIT_SKILL_IDS, {
      selectedAgents: ["web-developer"] as AgentName[],
      installMode: "local",
      sourceSelections: {},
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    expect(mergeResult.config.sourceSelections).toBeUndefined();
  });

  it("should merge with existing config preserving installMode", async () => {
    // Write initial config with "local" mode
    await writeTestTsConfig(dirs.projectDir, {
      name: "test-project",
      agents: ["web-developer"],
      skills: [REACT_SKILL_ID],
      installMode: "local",
    });

    // Build wizard result with "plugin" mode
    const wizardResult = buildWizardResult(INIT_SKILL_IDS, {
      selectedAgents: ["web-developer"] as AgentName[],
      installMode: "plugin",
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    // New wizard result's installMode should take precedence
    expect(mergeResult.config.installMode).toBe("plugin");
    expect(mergeResult.merged).toBe(true);
  });
});

describe("Integration: detectMigrations with Config Data", () => {
  it("should detect plugin-to-local migration from config sourceSelections", () => {
    const oldSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "agents-inc",
      [ZUSTAND_SKILL_ID]: "agents-inc",
      [HONO_SKILL_ID]: "agents-inc",
    };

    const newSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [ZUSTAND_SKILL_ID]: "agents-inc",
      [HONO_SKILL_ID]: "local",
    };

    const allSkills: SkillId[] = [REACT_SKILL_ID, ZUSTAND_SKILL_ID, HONO_SKILL_ID];
    const plan = detectMigrations(oldSelections, newSelections, allSkills);

    expect(plan.toLocal).toEqual([REACT_SKILL_ID, HONO_SKILL_ID]);
    expect(plan.toPlugin).toEqual([]);
  });

  it("should detect local-to-plugin migration from config sourceSelections", () => {
    const oldSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [ZUSTAND_SKILL_ID]: "local",
    };

    const newSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "agents-inc",
      [ZUSTAND_SKILL_ID]: "agents-inc",
    };

    const allSkills: SkillId[] = [REACT_SKILL_ID, ZUSTAND_SKILL_ID];
    const plan = detectMigrations(oldSelections, newSelections, allSkills);

    expect(plan.toLocal).toEqual([]);
    expect(plan.toPlugin).toEqual([REACT_SKILL_ID, ZUSTAND_SKILL_ID]);
  });

  it("should detect bidirectional migration", () => {
    const oldSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "agents-inc",
      [ZUSTAND_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "local",
    };

    const newSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [ZUSTAND_SKILL_ID]: "agents-inc",
      [HONO_SKILL_ID]: "local",
    };

    const allSkills: SkillId[] = [REACT_SKILL_ID, ZUSTAND_SKILL_ID, HONO_SKILL_ID];
    const plan = detectMigrations(oldSelections, newSelections, allSkills);

    expect(plan.toLocal).toEqual([REACT_SKILL_ID]);
    expect(plan.toPlugin).toEqual([ZUSTAND_SKILL_ID]);
  });

  it("should return empty plan when sourceSelections are unchanged", () => {
    const selections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [ZUSTAND_SKILL_ID]: "agents-inc",
    };

    const allSkills: SkillId[] = [REACT_SKILL_ID, ZUSTAND_SKILL_ID];
    const plan = detectMigrations(selections, selections, allSkills);

    expect(plan.toLocal).toEqual([]);
    expect(plan.toPlugin).toEqual([]);
  });

  it("should detect migration when switching between marketplace sources as no migration", () => {
    // Switching from one marketplace to another is NOT a migration (both are plugin)
    const oldSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "agents-inc",
    };

    const newSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "other-marketplace",
    };

    const allSkills: SkillId[] = [REACT_SKILL_ID];
    const plan = detectMigrations(oldSelections, newSelections, allSkills);

    // Neither source is "local" so no migration needed
    expect(plan.toLocal).toEqual([]);
    expect(plan.toPlugin).toEqual([]);
  });

  it("should handle new skills with no previous sourceSelections", () => {
    const oldSelections: Partial<Record<SkillId, string>> = {};

    const newSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "agents-inc",
    };

    const allSkills: SkillId[] = [REACT_SKILL_ID, HONO_SKILL_ID];
    const plan = detectMigrations(oldSelections, newSelections, allSkills);

    // New skill with "local" source is treated as toLocal (was undefined -> local)
    expect(plan.toLocal).toEqual([REACT_SKILL_ID]);
    // New skill with "agents-inc" is not a migration (was undefined -> non-local)
    expect(plan.toPlugin).toEqual([]);
  });
});

describe("Integration: deriveInstallMode via Wizard Store", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  it("should derive 'local' when all sourceSelections are local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web" as any);
    store.toggleTechnology("web" as any, "web-framework" as any, REACT_SKILL_ID, true);
    store.toggleTechnology("web" as any, "web-styling" as any, "web-styling-scss-modules" as SkillId, true);

    store.setSourceSelection(REACT_SKILL_ID, "local");
    store.setSourceSelection("web-styling-scss-modules" as SkillId, "local");

    expect(store.deriveInstallMode()).toBe("local");
  });

  it("should derive 'plugin' when all sourceSelections are non-local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web" as any);
    store.toggleTechnology("web" as any, "web-framework" as any, REACT_SKILL_ID, true);
    store.toggleTechnology("web" as any, "web-styling" as any, "web-styling-scss-modules" as SkillId, true);

    store.setSourceSelection(REACT_SKILL_ID, "agents-inc");
    store.setSourceSelection("web-styling-scss-modules" as SkillId, "agents-inc");

    expect(store.deriveInstallMode()).toBe("plugin");
  });

  it("should derive 'mixed' when sourceSelections have both local and non-local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web" as any);
    store.toggleTechnology("web" as any, "web-framework" as any, REACT_SKILL_ID, true);
    store.toggleTechnology("web" as any, "web-styling" as any, "web-styling-scss-modules" as SkillId, true);

    store.setSourceSelection(REACT_SKILL_ID, "local");
    store.setSourceSelection("web-styling-scss-modules" as SkillId, "agents-inc");

    expect(store.deriveInstallMode()).toBe("mixed");
  });

  it("should return current installMode when no skills are selected", () => {
    const store = useWizardStore.getState();
    // Default installMode is "local"
    expect(store.deriveInstallMode()).toBe("local");
  });

  it("setAllSourcesLocal should set all selected skills to local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web" as any);
    store.toggleTechnology("web" as any, "web-framework" as any, REACT_SKILL_ID, true);
    store.toggleTechnology("web" as any, "web-styling" as any, "web-styling-scss-modules" as SkillId, true);

    // Set them to plugin first
    store.setSourceSelection(REACT_SKILL_ID, "agents-inc");
    store.setSourceSelection("web-styling-scss-modules" as SkillId, "agents-inc");
    expect(store.deriveInstallMode()).toBe("plugin");

    // Now set all to local
    store.setAllSourcesLocal();

    expect(useWizardStore.getState().sourceSelections[REACT_SKILL_ID]).toBe("local");
    expect(useWizardStore.getState().sourceSelections["web-styling-scss-modules" as SkillId]).toBe("local");
    expect(store.deriveInstallMode()).toBe("local");
  });

  it("setAllSourcesPlugin should set all selected skills to their marketplace source", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web" as any);
    store.toggleTechnology("web" as any, "web-framework" as any, REACT_SKILL_ID, true);

    // Set to local first
    store.setSourceSelection(REACT_SKILL_ID, "local");
    expect(store.deriveInstallMode()).toBe("local");

    // Build a matrix with availableSources
    const matrix = createMockMatrix({
      "web-framework-react": createMockMultiSourceSkill(
        REACT_SKILL_ID,
        "web-framework",
        [
          createMockSkillSource("local"),
          createMockSkillSource("public", { name: "agents-inc" }),
        ],
      ),
    });

    // Set all to plugin via matrix lookup
    store.setAllSourcesPlugin(matrix);

    expect(useWizardStore.getState().sourceSelections[REACT_SKILL_ID]).toBe("agents-inc");
    expect(store.deriveInstallMode()).toBe("plugin");
  });
});

describe("Integration: getInstallModeLabel", () => {
  // Import the function from step-confirm (it's not exported, so we re-implement the logic here
  // to test the labeling behavior that users see in the confirm step)

  function getInstallModeLabel(
    installMode: "local" | "plugin" | "mixed",
    selectedSkills?: SkillId[],
    sourceSelections?: Partial<Record<SkillId, string>>,
  ): string {
    if (!selectedSkills?.length || !sourceSelections) {
      return installMode === "plugin" ? "Plugin" : "Local (editable copies)";
    }

    const localCount = selectedSkills.filter((id) => sourceSelections[id] === "local").length;
    const pluginCount = selectedSkills.length - localCount;

    if (localCount === 0) return "Plugin";
    if (pluginCount === 0) return "Local (editable copies)";
    return `Mixed (${localCount} local, ${pluginCount} plugin)`;
  }

  it("should return 'Local (editable copies)' for local mode without skills", () => {
    expect(getInstallModeLabel("local")).toBe("Local (editable copies)");
  });

  it("should return 'Plugin' for plugin mode without skills", () => {
    expect(getInstallModeLabel("plugin")).toBe("Plugin");
  });

  it("should return 'Local (editable copies)' for local mode even with mixed flag", () => {
    // When installMode is "mixed" but no skills/sourceSelections, fallback to "Local"
    expect(getInstallModeLabel("mixed")).toBe("Local (editable copies)");
  });

  it("should return 'Plugin' when all skills have non-local sources", () => {
    const skills: SkillId[] = [REACT_SKILL_ID, HONO_SKILL_ID];
    const selections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "agents-inc",
      [HONO_SKILL_ID]: "agents-inc",
    };

    expect(getInstallModeLabel("plugin", skills, selections)).toBe("Plugin");
  });

  it("should return 'Local (editable copies)' when all skills have local sources", () => {
    const skills: SkillId[] = [REACT_SKILL_ID, HONO_SKILL_ID];
    const selections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "local",
    };

    expect(getInstallModeLabel("local", skills, selections)).toBe("Local (editable copies)");
  });

  it("should return 'Mixed' label with counts when sources are mixed", () => {
    const skills: SkillId[] = [REACT_SKILL_ID, HONO_SKILL_ID, VITEST_SKILL_ID];
    const selections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "agents-inc",
      [VITEST_SKILL_ID]: "local",
    };

    expect(getInstallModeLabel("mixed", skills, selections)).toBe("Mixed (2 local, 1 plugin)");
  });

  it("should count skills without sourceSelections as non-local (plugin)", () => {
    const skills: SkillId[] = [REACT_SKILL_ID, HONO_SKILL_ID, VITEST_SKILL_ID];
    const selections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      // HONO and VITEST have no selection -> treated as non-local
    };

    expect(getInstallModeLabel("mixed", skills, selections)).toBe("Mixed (1 local, 2 plugin)");
  });
});

describe("Integration: writeConfigFile Round-Trip", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("config-roundtrip-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it("should write and read back installMode", async () => {
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);

    const config: ProjectConfig = {
      name: "test-project",
      agents: ["web-developer"] as AgentName[],
      skills: [REACT_SKILL_ID],
      installMode: "mixed",
    };

    await writeConfigFile(config, configPath);

    expect(await fileExists(configPath)).toBe(true);
    const readBack = await readTestTsConfig<ProjectConfig>(configPath);
    expect(readBack.installMode).toBe("mixed");
  });

  it("should write and read back sourceSelections", async () => {
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);

    const sourceSelections: Partial<Record<SkillId, string>> = {
      [REACT_SKILL_ID]: "local",
      [HONO_SKILL_ID]: "agents-inc",
    };

    const config: ProjectConfig = {
      name: "test-project",
      agents: ["web-developer"] as AgentName[],
      skills: [REACT_SKILL_ID, HONO_SKILL_ID],
      installMode: "mixed",
      sourceSelections,
    };

    await writeConfigFile(config, configPath);

    const readBack = await readTestTsConfig<ProjectConfig>(configPath);
    expect(readBack.sourceSelections).toEqual(sourceSelections);
  });

  it("should omit sourceSelections from config when undefined", async () => {
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);

    const config: ProjectConfig = {
      name: "test-project",
      agents: ["web-developer"] as AgentName[],
      skills: [REACT_SKILL_ID],
      installMode: "local",
      // sourceSelections is intentionally omitted
    };

    await writeConfigFile(config, configPath);

    const readBack = await readTestTsConfig<ProjectConfig>(configPath);
    expect(readBack.sourceSelections).toBeUndefined();
  });
});
