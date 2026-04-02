import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ProjectConfig, SkillId } from "../../../types";
import type { SkillConfig } from "../../../types/config";
import type { SourceLoadResult } from "../../loading/source-loader";
import {
  installEject,
  buildAndMergeConfig,
  writeConfigFile,
} from "../../installation/local-installer";
import { detectMigrations } from "../../installation/mode-migrator";
import { deriveInstallMode } from "../../installation/installation";
import { useWizardStore } from "../../../stores/wizard-store";
import { initializeMatrix } from "../../matrix/matrix-provider";
import {
  createMockMatrix,
  createMockMultiSourceSkill,
  createMockSkillSource,
  createTempDir,
  cleanupTempDir,
  readTestTsConfig,
  buildProjectConfig,
  buildWizardResult,
  buildSkillConfigs,
  buildSourceResult,
  fileExists,
  writeTestTsConfig,
} from "../helpers";
import { FULLSTACK_TRIO_MATRIX } from "../mock-data/mock-matrices";
import { createTestSource, cleanupTestSource, type TestDirs } from "../fixtures/create-test-source";
import { INIT_SKILL_IDS, INIT_TEST_SKILLS } from "../mock-data/mock-skills";
import { CLAUDE_SRC_DIR, STANDARD_FILES } from "../../../consts";
import path from "path";

const REACT_SKILL_ID: SkillId = "web-framework-react";
const ZUSTAND_SKILL_ID: SkillId = "web-state-zustand";
const HONO_SKILL_ID: SkillId = "api-framework-hono";
const VITEST_SKILL_ID: SkillId = "web-testing-vitest";

const INIT_TEST_MATRIX = FULLSTACK_TRIO_MATRIX;

describe("Integration: Install Mode Persistence", () => {
  let dirs: TestDirs;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: INIT_TEST_SKILLS });
    sourceResult = buildSourceResult(INIT_TEST_MATRIX, dirs.sourceDir);
    initializeMatrix(INIT_TEST_MATRIX);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should persist skills with 'local' source in config after install", async () => {
    const skills = buildSkillConfigs(INIT_SKILL_IDS, { source: "eject" });
    const result = await installEject({
      wizardResult: buildWizardResult(skills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(deriveInstallMode(config.skills)).toBe("eject");
  });

  it("should persist skills with 'plugin' source in config after install", async () => {
    const skills = buildSkillConfigs(INIT_SKILL_IDS, { source: "agents-inc" });
    const result = await installEject({
      wizardResult: buildWizardResult(skills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(deriveInstallMode(config.skills)).toBe("plugin");
  });

  it("should persist skills with 'mixed' sources in config after install", async () => {
    const skills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: VITEST_SKILL_ID, scope: "project", source: "agents-inc" },
    ];
    const result = await installEject({
      wizardResult: buildWizardResult(skills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    expect(deriveInstallMode(config.skills)).toBe("mixed");
  });

  it("should persist per-skill source in config after install", async () => {
    const skills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: VITEST_SKILL_ID, scope: "project", source: "eject" },
    ];

    const result = await installEject({
      wizardResult: buildWizardResult(skills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    const reactConfig = config.skills.find((s) => s.id === REACT_SKILL_ID);
    const honoConfig = config.skills.find((s) => s.id === HONO_SKILL_ID);
    const vitestConfig = config.skills.find((s) => s.id === VITEST_SKILL_ID);
    expect(reactConfig?.source).toBe("eject");
    expect(honoConfig?.source).toBe("agents-inc");
    expect(vitestConfig?.source).toBe("eject");
  });

  it("should have all skills as local when no explicit source set", async () => {
    const skills = buildSkillConfigs(INIT_SKILL_IDS, { source: "eject" });
    const result = await installEject({
      wizardResult: buildWizardResult(skills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    for (const skill of config.skills) {
      expect(skill.source).toBe("eject");
    }
  });
});

describe("Integration: Install Mode Config Round-Trip", () => {
  let dirs: TestDirs;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: INIT_TEST_SKILLS });
    sourceResult = buildSourceResult(INIT_TEST_MATRIX, dirs.sourceDir);
    initializeMatrix(INIT_TEST_MATRIX);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should round-trip install mode through config write and read", async () => {
    // First install with "eject" sources
    const localSkills = buildSkillConfigs(INIT_SKILL_IDS, { source: "eject" });
    const result1 = await installEject({
      wizardResult: buildWizardResult(localSkills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config1 = await readTestTsConfig<ProjectConfig>(result1.configPath);
    expect(deriveInstallMode(config1.skills)).toBe("eject");

    // Second install with "plugin" sources — config gets overwritten
    const pluginSkills = buildSkillConfigs(INIT_SKILL_IDS, { source: "agents-inc" });
    const result2 = await installEject({
      wizardResult: buildWizardResult(pluginSkills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config2 = await readTestTsConfig<ProjectConfig>(result2.configPath);
    expect(deriveInstallMode(config2.skills)).toBe("plugin");
  });

  it("should round-trip per-skill source through config write and read", async () => {
    const skills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: VITEST_SKILL_ID, scope: "project", source: "eject" },
    ];

    const result = await installEject({
      wizardResult: buildWizardResult(skills, {
        selectedAgents: ["web-developer"],
      }),
      sourceResult,
      projectDir: dirs.projectDir,
    });

    const config = await readTestTsConfig<ProjectConfig>(result.configPath);
    const reactConfig = config.skills.find((s) => s.id === REACT_SKILL_ID);
    const honoConfig = config.skills.find((s) => s.id === HONO_SKILL_ID);
    expect(reactConfig?.source).toBe("eject");
    expect(honoConfig?.source).toBe("agents-inc");
  });
});

describe("Integration: buildAndMergeConfig Install Mode", () => {
  let dirs: TestDirs;
  let sourceResult: SourceLoadResult;

  beforeEach(async () => {
    dirs = await createTestSource({ skills: INIT_TEST_SKILLS });
    sourceResult = buildSourceResult(INIT_TEST_MATRIX, dirs.sourceDir);
    initializeMatrix(INIT_TEST_MATRIX);
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  it("should derive installMode from skills in merged config", async () => {
    const skills = buildSkillConfigs(INIT_SKILL_IDS, { source: "agents-inc" });
    const wizardResult = buildWizardResult(skills, {
      selectedAgents: ["web-developer"],
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    expect(deriveInstallMode(mergeResult.config.skills)).toBe("plugin");
  });

  it("should preserve per-skill source in merged config when non-uniform", async () => {
    const skills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: VITEST_SKILL_ID, scope: "project", source: "eject" },
    ];

    const wizardResult = buildWizardResult(skills, {
      selectedAgents: ["web-developer"],
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    const reactConfig = mergeResult.config.skills.find((s) => s.id === REACT_SKILL_ID);
    const honoConfig = mergeResult.config.skills.find((s) => s.id === HONO_SKILL_ID);
    expect(reactConfig?.source).toBe("eject");
    expect(honoConfig?.source).toBe("agents-inc");
  });

  it("should have all-local skills in merged config when all sources are local", async () => {
    const skills = buildSkillConfigs(INIT_SKILL_IDS, { source: "eject" });
    const wizardResult = buildWizardResult(skills, {
      selectedAgents: ["web-developer"],
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    for (const skill of mergeResult.config.skills) {
      expect(skill.source).toBe("eject");
    }
  });

  it("should merge with existing config preserving install mode from new wizard result", async () => {
    // Write initial config with "eject" source skills
    await writeTestTsConfig(
      dirs.projectDir,
      buildProjectConfig({
        skills: buildSkillConfigs([REACT_SKILL_ID]),
      }) as Record<string, unknown>,
    );

    // Build wizard result with "plugin" source skills
    const skills = buildSkillConfigs(INIT_SKILL_IDS, { source: "agents-inc" });
    const wizardResult = buildWizardResult(skills, {
      selectedAgents: ["web-developer"],
    });

    const mergeResult = await buildAndMergeConfig(wizardResult, sourceResult, dirs.projectDir);

    // New wizard result's skills should take precedence
    expect(deriveInstallMode(mergeResult.config.skills)).toBe("plugin");
    expect(mergeResult.merged).toBe(true);
  });
});

describe("Integration: detectMigrations with Config Data", () => {
  it("should detect plugin-to-local migration from skill configs", () => {
    const oldSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
    ];

    const newSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: HONO_SKILL_ID, scope: "project", source: "eject" },
    ];

    const plan = detectMigrations(oldSkills, newSkills);

    expect(plan.toEject.map((m) => m.id)).toStrictEqual([REACT_SKILL_ID, HONO_SKILL_ID]);
    expect(plan.toPlugin).toStrictEqual([]);
  });

  it("should detect local-to-plugin migration from skill configs", () => {
    const oldSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "eject" },
    ];

    const newSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "agents-inc" },
    ];

    const plan = detectMigrations(oldSkills, newSkills);

    expect(plan.toEject).toStrictEqual([]);
    expect(plan.toPlugin.map((m) => m.id)).toStrictEqual([REACT_SKILL_ID, ZUSTAND_SKILL_ID]);
  });

  it("should detect bidirectional migration", () => {
    const oldSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "eject" },
      { id: HONO_SKILL_ID, scope: "project", source: "eject" },
    ];

    const newSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "agents-inc" },
      { id: HONO_SKILL_ID, scope: "project", source: "eject" },
    ];

    const plan = detectMigrations(oldSkills, newSkills);

    expect(plan.toEject.map((m) => m.id)).toStrictEqual([REACT_SKILL_ID]);
    expect(plan.toPlugin.map((m) => m.id)).toStrictEqual([ZUSTAND_SKILL_ID]);
  });

  it("should return empty plan when skill configs are unchanged", () => {
    const skills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: ZUSTAND_SKILL_ID, scope: "project", source: "agents-inc" },
    ];

    const plan = detectMigrations(skills, skills);

    expect(plan.toEject).toStrictEqual([]);
    expect(plan.toPlugin).toStrictEqual([]);
  });

  it("should detect migration when switching between marketplace sources as no migration", () => {
    // Switching from one marketplace to another is NOT a migration (both are plugin)
    const oldSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "agents-inc" },
    ];

    const newSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "other-marketplace" },
    ];

    const plan = detectMigrations(oldSkills, newSkills);

    // Neither source is "eject" so no migration needed
    expect(plan.toEject).toStrictEqual([]);
    expect(plan.toPlugin).toStrictEqual([]);
  });

  it("should handle new skills with no previous config", () => {
    const oldSkills: SkillConfig[] = [];

    const newSkills: SkillConfig[] = [
      { id: REACT_SKILL_ID, scope: "project", source: "eject" },
      { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
    ];

    const plan = detectMigrations(oldSkills, newSkills);

    // New skills have no old entry, so no migration detected
    expect(plan.toEject).toStrictEqual([]);
    expect(plan.toPlugin).toStrictEqual([]);
  });
});

describe("Integration: deriveInstallMode via Wizard Store", () => {
  it("should derive 'local' when all skillConfigs are local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", REACT_SKILL_ID, true);
    store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);

    store.setSourceSelection(REACT_SKILL_ID, "eject");
    store.setSourceSelection("web-styling-scss-modules", "eject");

    expect(store.deriveInstallMode()).toBe("eject");
  });

  it("should derive 'plugin' when all skillConfigs are non-local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", REACT_SKILL_ID, true);
    store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);

    store.setSourceSelection(REACT_SKILL_ID, "agents-inc");
    store.setSourceSelection("web-styling-scss-modules", "agents-inc");

    expect(store.deriveInstallMode()).toBe("plugin");
  });

  it("should derive 'mixed' when skillConfigs have both local and non-local", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", REACT_SKILL_ID, true);
    store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);

    store.setSourceSelection(REACT_SKILL_ID, "eject");
    store.setSourceSelection("web-styling-scss-modules", "agents-inc");

    expect(store.deriveInstallMode()).toBe("mixed");
  });

  it("should return current installMode when no skills are selected", () => {
    const store = useWizardStore.getState();
    // Default installMode is "eject"
    expect(store.deriveInstallMode()).toBe("eject");
  });

  it("setAllSourcesEject should set all selected skills to eject", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", REACT_SKILL_ID, true);
    store.toggleTechnology("web", "web-styling", "web-styling-scss-modules", true);

    // Set them to plugin first
    store.setSourceSelection(REACT_SKILL_ID, "agents-inc");
    store.setSourceSelection("web-styling-scss-modules", "agents-inc");
    expect(store.deriveInstallMode()).toBe("plugin");

    // Now set all to eject
    store.setAllSourcesEject();

    const updatedStore = useWizardStore.getState();
    const reactConfig = updatedStore.skillConfigs.find((sc) => sc.id === REACT_SKILL_ID);
    const scssConfig = updatedStore.skillConfigs.find((sc) => sc.id === "web-styling-scss-modules");
    expect(reactConfig?.source).toBe("eject");
    expect(scssConfig?.source).toBe("eject");
    expect(store.deriveInstallMode()).toBe("eject");
  });

  it("setAllSourcesPlugin should set all selected skills to their marketplace source", () => {
    const store = useWizardStore.getState();

    store.toggleDomain("web");
    store.toggleTechnology("web", "web-framework", REACT_SKILL_ID, true);

    // Set to eject first
    store.setSourceSelection(REACT_SKILL_ID, "eject");
    expect(store.deriveInstallMode()).toBe("eject");

    // Build a matrix with availableSources and set on store
    initializeMatrix(
      createMockMatrix(
        createMockMultiSourceSkill(REACT_SKILL_ID, [
          createMockSkillSource("local"),
          createMockSkillSource("public", { name: "agents-inc" }),
        ]),
      ),
    );

    // Set all to plugin via matrix store lookup
    store.setAllSourcesPlugin();

    const updatedStore = useWizardStore.getState();
    const reactConfig = updatedStore.skillConfigs.find((sc) => sc.id === REACT_SKILL_ID);
    expect(reactConfig?.source).toBe("agents-inc");
    expect(store.deriveInstallMode()).toBe("plugin");
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

  it("should write and read back skills with derived installMode", async () => {
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);

    const config = buildProjectConfig({
      skills: [
        { id: REACT_SKILL_ID, scope: "project", source: "eject" },
        { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
      ],
    });

    await writeConfigFile(config, configPath);

    expect(await fileExists(configPath)).toBe(true);
    const readBack = await readTestTsConfig<ProjectConfig>(configPath);
    expect(deriveInstallMode(readBack.skills)).toBe("mixed");
  });

  it("should write and read back per-skill source", async () => {
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);

    const config = buildProjectConfig({
      skills: [
        { id: REACT_SKILL_ID, scope: "project", source: "eject" },
        { id: HONO_SKILL_ID, scope: "project", source: "agents-inc" },
      ],
    });

    await writeConfigFile(config, configPath);

    const readBack = await readTestTsConfig<ProjectConfig>(configPath);
    const reactConfig = readBack.skills.find((s) => s.id === REACT_SKILL_ID);
    const honoConfig = readBack.skills.find((s) => s.id === HONO_SKILL_ID);
    expect(reactConfig?.source).toBe("eject");
    expect(honoConfig?.source).toBe("agents-inc");
  });

  it("should write config with all-local skills correctly", async () => {
    const configDir = path.join(tempDir, CLAUDE_SRC_DIR);
    const { mkdir } = await import("fs/promises");
    await mkdir(configDir, { recursive: true });
    const configPath = path.join(configDir, STANDARD_FILES.CONFIG_TS);

    const config = buildProjectConfig({
      skills: [{ id: REACT_SKILL_ID, scope: "project", source: "eject" }],
    });

    await writeConfigFile(config, configPath);

    const readBack = await readTestTsConfig<ProjectConfig>(configPath);
    expect(deriveInstallMode(readBack.skills)).toBe("eject");
  });
});
