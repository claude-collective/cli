import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactElement } from "react";
import path from "path";
import { mkdir } from "fs/promises";
import {
  runCliCommand,
  createTempDir,
  cleanupTempDir,
  createMockMatrix,
  createMockSkill,
  buildSourceResult,
  buildWizardResult,
  buildSkillConfigs,
  buildAgentConfigs,
  CLI_ROOT,
  SKILLS,
  TEST_CATEGORIES,
} from "../helpers";
import { FULLSTACK_PAIR_MATRIX } from "../mock-data/mock-matrices";
import { EXIT_CODES } from "../../exit-codes";
import { useWizardStore } from "../../../stores/wizard-store";
import { initializeMatrix } from "../../matrix/matrix-provider";
import type { CategoryPath, SkillId } from "../../../types";
import Edit, { migratePluginSkillScopes } from "../../../commands/edit.js";

// --- Module mocks (hoisted by vitest) ---

const {
  mockRender,
  mockDetectInstallation,
  mockLoadSkillsMatrixFromSource,
  mockLoadProjectConfig,
  mockDiscoverAllPluginSkills,
  mockCopySkillsToLocalFlattened,
  mockEnsureDir,
  mockGetAgentDefinitions,
} = vi.hoisted(() => ({
  mockRender: vi
    .fn()
    .mockReturnValue({ waitUntilExit: () => Promise.resolve(), clear: vi.fn(), unmount: vi.fn() }),
  mockDetectInstallation: vi.fn().mockResolvedValue(null),
  mockLoadSkillsMatrixFromSource: vi.fn(),
  mockLoadProjectConfig: vi.fn().mockResolvedValue(null),
  mockDiscoverAllPluginSkills: vi.fn().mockResolvedValue({}),
  mockCopySkillsToLocalFlattened: vi.fn().mockResolvedValue(undefined),
  mockEnsureDir: vi.fn().mockResolvedValue(undefined),
  mockGetAgentDefinitions: vi.fn().mockResolvedValue({
    agentsDir: "/mock/agents",
    templatesDir: "/mock/templates",
    sourcePath: "/mock/source",
  }),
}));

vi.mock("ink", async (importOriginal) => {
  const original = await importOriginal<typeof import("ink")>();
  return { ...original, render: mockRender };
});

vi.mock("../../installation/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../installation/index.js")>();
  return {
    ...original,
    detectInstallation: (...args: unknown[]) => mockDetectInstallation(...(args as [])),
  };
});

vi.mock("../../loading/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../loading/index.js")>();
  return {
    ...original,
    loadSkillsMatrixFromSource: (...args: unknown[]) =>
      mockLoadSkillsMatrixFromSource(...(args as [])),
  };
});

vi.mock("../../configuration/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../configuration/index.js")>();
  return {
    ...original,
    loadProjectConfig: (...args: unknown[]) => mockLoadProjectConfig(...(args as [])),
  };
});

vi.mock("../../plugins/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../plugins/index.js")>();
  return {
    ...original,
    discoverAllPluginSkills: (...args: unknown[]) => mockDiscoverAllPluginSkills(...(args as [])),
  };
});

vi.mock("../../agents/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../agents/index.js")>();
  return {
    ...original,
    getAgentDefinitions: (...args: unknown[]) => mockGetAgentDefinitions(...(args as [])),
  };
});

vi.mock("../../skills/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../skills/index.js")>();
  return {
    ...original,
    copySkillsToLocalFlattened: (...args: unknown[]) =>
      mockCopySkillsToLocalFlattened(...(args as [])),
  };
});

vi.mock("../../../utils/fs.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../../utils/fs.js")>();
  return {
    ...original,
    ensureDir: (...args: unknown[]) => mockEnsureDir(...(args as [])),
  };
});

describe("edit command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-edit-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    // Ensure detectInstallation returns null (no installation) for these tests
    mockDetectInstallation.mockResolvedValue(null);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  describe("no installation found", () => {
    it("when .claude-src/ directory is missing, should exit with error code", async () => {
      // Clean temp dir has no .claude/ or .claude-src/ directories
      const { error } = await runCliCommand(["edit"]);

      // Should exit with EXIT_CODES.ERROR (1) because detectInstallation returns null
      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });

    it("when no installation exists, should suggest running agentsinc init", async () => {
      const { error } = await runCliCommand(["edit"]);

      expect(error?.message).toContain("No installation found");
    });
  });

  describe("flag validation", () => {
    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand(["edit", "--refresh"]);

      // Should not error on flag parsing (will error on no installation, which is expected)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --source flag with path", async () => {
      const { error } = await runCliCommand(["edit", "--source", "/some/path"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["edit", "-s", "/some/path"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source flag with URL", async () => {
      const { error } = await runCliCommand([
        "edit",
        "--agent-source",
        "https://example.com/agents",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("combined flags", () => {
    it("when --refresh, --source, and --agent-source provided together, should accept all flags", async () => {
      const { error } = await runCliCommand([
        "edit",
        "--refresh",
        "--source",
        "/custom/source",
        "--agent-source",
        "https://example.com/agents",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("when mixing -s shorthand and --refresh long flag, should accept both", async () => {
      const { error } = await runCliCommand(["edit", "--refresh", "-s", "/custom/source"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});

// Explicit domain assignments — these tests verify domain filtering, so domains must be correct
const EDIT_CATEGORIES = {
  "web-framework": { ...TEST_CATEGORIES.framework, displayName: "Web Framework" },
  "web-client-state": TEST_CATEGORIES.clientState,
  "api-api": { ...TEST_CATEGORIES.api, displayName: "API Framework", domain: "api" as const },
  "web-testing": { ...TEST_CATEGORIES.testing, domain: "shared" as const },
};

const EDIT_SKILLS = {
  "web-framework-react": SKILLS.react,
  "web-state-zustand": SKILLS.zustand,
  "api-framework-hono": SKILLS.hono,
  "web-testing-vitest": SKILLS.vitest,
};

// The edit command uses populateFromSkillIds() on the Zustand wizard store
// to restore prior selections. Testing at the store level because the edit
// command itself launches an interactive wizard that cannot be driven from
// runCliCommand. This validates the same code path used by
// use-wizard-initialization.ts when edit mode is active.

describe("edit wizard pre-selection via populateFromSkillIds", () => {
  beforeEach(() => {
    initializeMatrix(
      createMockMatrix(EDIT_SKILLS, {
        categories: EDIT_CATEGORIES,
      }),
    );
  });

  it("should pre-populate domainSelections from installed skill IDs", () => {
    const installedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    // Web skills should appear under the web domain
    expect(domainSelections.web?.["web-framework"]).toStrictEqual(["web-framework-react"]);
    expect(domainSelections.web?.["web-client-state"]).toStrictEqual(["web-state-zustand"]);

    // API skill should appear under the api domain
    expect(domainSelections.api?.["api-api"]).toStrictEqual(["api-framework-hono"]);
  });

  it("should not pre-select skills that are not in the installed list", () => {
    const installedSkills: SkillId[] = ["web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    // Only web/framework should be populated
    expect(domainSelections.web?.["web-framework"]).toStrictEqual(["web-framework-react"]);

    // Other categories should not exist
    expect(domainSelections.web?.["web-client-state"]).toBeUndefined();
    expect(domainSelections.api).toBeUndefined();
  });

  it("should set selectedDomains to only the domains found in the provided skill IDs", () => {
    const installedSkills: SkillId[] = ["web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { selectedDomains } = useWizardStore.getState();

    // populateFromSkillIds sets only domains derived from the skill IDs
    expect(selectedDomains).toContain("web");
    expect(selectedDomains).not.toContain("api");
    expect(selectedDomains).not.toContain("shared");
  });

  it("should place shared-domain skills under the shared domain key", () => {
    const installedSkills: SkillId[] = ["web-testing-vitest"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    // Testing category maps to the shared domain
    expect(domainSelections.shared?.["web-testing"]).toStrictEqual(["web-testing-vitest"]);

    // No web or api entries should exist
    expect(domainSelections.web).toBeUndefined();
    expect(domainSelections.api).toBeUndefined();
  });

  it("should produce empty domainSelections when installed list is empty", () => {
    const installedSkills: SkillId[] = [];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    expect(Object.keys(domainSelections)).toHaveLength(0);
  });

  it("should skip skills missing a category", () => {
    const sparseSkills = {
      "web-framework-react": SKILLS.react,
      // Boundary cast: intentionally testing skill with no category
      // Boundary cast: fictional skill ID for testing missing-category handling
      "web-framework-unknown": createMockSkill("web-framework-unknown" as SkillId, {
        category: undefined as unknown as CategoryPath,
      }),
    };

    initializeMatrix(
      createMockMatrix(sparseSkills, {
        categories: EDIT_CATEGORIES,
      }),
    );

    // Boundary cast: fake ID to test unknown-skill handling
    const installedSkills: SkillId[] = ["web-framework-react", "web-framework-unknown" as SkillId];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    // Only the skill with a valid category should be populated
    expect(domainSelections.web?.["web-framework"]).toStrictEqual(["web-framework-react"]);
    expect(domainSelections.web?.["web-framework"]).toHaveLength(1);
  });

  it("should skip skills whose category has no domain mapping", () => {
    const extraSkills = {
      "web-framework-react": SKILLS.react,
      // Boundary cast: intentionally testing unmapped category handling
      // Boundary cast: fictional skill ID for testing unmapped-category handling
      "infra-tooling-linter": createMockSkill("infra-tooling-linter" as SkillId),
    };

    initializeMatrix(
      createMockMatrix(extraSkills, {
        categories: EDIT_CATEGORIES,
      }),
    );

    // Boundary cast: fake ID to test unmapped-category handling
    const installedSkills: SkillId[] = ["web-framework-react", "infra-tooling-linter" as SkillId];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    // Only the resolvable skill should be populated
    expect(domainSelections.web?.["web-framework"]).toStrictEqual(["web-framework-react"]);
    // No domain should contain the unresolvable skill
    const allTechs = useWizardStore.getState().getAllSelectedTechnologies();
    expect(allTechs).not.toContain("infra-tooling-linter");
  });

  it("should not duplicate skills when the same skill ID appears twice in installed list", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    // Should deduplicate
    expect(domainSelections.web?.["web-framework"]).toStrictEqual(["web-framework-react"]);
    expect(domainSelections.web?.["web-framework"]).toHaveLength(1);
  });

  it("should populate multiple skills within the same category (non-exclusive)", () => {
    // testing category is non-exclusive, so multiple selections are valid
    const multiSkills = {
      ...EDIT_SKILLS,
      // Boundary cast: fictional skill ID for testing multi-skill category population
      "web-testing-playwright": createMockSkill("web-testing-playwright" as SkillId),
    };

    initializeMatrix(
      createMockMatrix(multiSkills, {
        categories: EDIT_CATEGORIES,
      }),
    );

    // Boundary cast: fake ID to test multi-selection in same category
    const installedSkills: SkillId[] = ["web-testing-vitest", "web-testing-playwright" as SkillId];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const { domainSelections } = useWizardStore.getState();

    expect(domainSelections.shared?.["web-testing"]).toContain("web-testing-vitest");
    expect(domainSelections.shared?.["web-testing"]).toContain("web-testing-playwright");
    expect(domainSelections.shared?.["web-testing"]).toHaveLength(2);
  });
});

// After populateFromSkillIds, the wizard uses getSelectedTechnologiesPerDomain()
// to determine which domains have active selections. Domains not in this result
// can be filtered out of the build step UI. This tests that the store correctly
// omits domains with zero selections.

describe("edit wizard domain filtering", () => {
  beforeEach(() => {
    initializeMatrix(
      createMockMatrix(EDIT_SKILLS, {
        categories: EDIT_CATEGORIES,
      }),
    );
  });

  it("should report only web domain when only web skills are installed", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    // Web should have selections
    expect(perDomain.web).toStrictEqual(["web-framework-react", "web-state-zustand"]);

    // API, CLI, mobile should be absent (no selections)
    expect(perDomain.api).toBeUndefined();
    expect(perDomain.cli).toBeUndefined();
    expect(perDomain.mobile).toBeUndefined();
  });

  it("should report both web and api domains when both have selections", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    expect(perDomain.web).toStrictEqual(["web-framework-react"]);
    expect(perDomain.api).toStrictEqual(["api-framework-hono"]);
    expect(perDomain.cli).toBeUndefined();
  });

  it("should report only shared domain when only shared skills are installed", () => {
    const installedSkills: SkillId[] = ["web-testing-vitest"];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    // Only shared domain should have selections
    expect(perDomain.shared).toStrictEqual(["web-testing-vitest"]);

    // All other domains should be absent
    expect(perDomain.web).toBeUndefined();
    expect(perDomain.api).toBeUndefined();
    expect(perDomain.cli).toBeUndefined();
    expect(perDomain.mobile).toBeUndefined();
  });

  it("should return empty result when no skills are installed", () => {
    const installedSkills: SkillId[] = [];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    // All domains should be absent
    expect(Object.keys(perDomain)).toHaveLength(0);
  });

  it("should include correct skill count per domain", () => {
    const installedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
      "web-testing-vitest",
    ];

    useWizardStore.getState().populateFromSkillIds(installedSkills);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    // Web has 2 skills (framework + client-state)
    expect(perDomain.web).toHaveLength(2);

    // API has 1 skill
    expect(perDomain.api).toHaveLength(1);

    // Shared has 1 skill (testing)
    expect(perDomain.shared).toHaveLength(1);

    // CLI and mobile still absent
    expect(perDomain.cli).toBeUndefined();
    expect(perDomain.mobile).toBeUndefined();
  });
});

// The edit command has an eject-mode fallback: when discoverAllPluginSkills returns
// empty (no plugin-based skills found), it falls back to project config skills.
// These tests verify that the correct installedSkillIds reach the Wizard component.

describe("edit command eject-mode skill fallback", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  const CONFIG_SKILL_IDS: SkillId[] = ["web-framework-react", "api-framework-hono"];
  const CONFIG_SKILLS = CONFIG_SKILL_IDS.map((id) => ({
    id,
    scope: "project" as const,
    source: "eject",
  }));

  const testMatrix = FULLSTACK_PAIR_MATRIX;

  const testSourceResult = buildSourceResult(testMatrix, "/test/source");

  function getRenderedInstalledSkillIds(): SkillId[] | undefined {
    // First render call is the spinner, second is the wizard
    const renderCall = mockRender.mock.calls[1];
    if (!renderCall) return undefined;
    // ink.render receives a React element; props are on .props
    const element = renderCall[0] as ReactElement;
    return element.props.installedSkillIds as SkillId[];
  }

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-edit-fallback-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    // Reset all mocks to known state for each test
    mockRender.mockClear();
    mockRender.mockReturnValue({
      waitUntilExit: () => Promise.resolve(),
      clear: vi.fn(),
      unmount: vi.fn(),
    });

    mockDetectInstallation.mockResolvedValue({
      mode: "eject",
      scope: "project",
      configPath: path.join(projectDir, ".claude-src/config.ts"),
      agentsDir: path.join(projectDir, ".claude/agents"),
      skillsDir: path.join(projectDir, ".claude/skills"),
      projectDir,
    });

    mockLoadSkillsMatrixFromSource.mockResolvedValue(testSourceResult);
    initializeMatrix(testSourceResult.matrix);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should use project config skills as installedSkillIds when plugin discovery returns empty", async () => {
    mockDiscoverAllPluginSkills.mockResolvedValue({});
    mockLoadProjectConfig.mockResolvedValue({
      config: {
        name: "test-project",
        agents: [],
        skills: CONFIG_SKILLS,
      },
      configPath: path.join(projectDir, ".claude-src/config.ts"),
    });

    try {
      await Edit.run([], { root: CLI_ROOT });
    } catch {
      // Expected: command errors after render because wizardResult is null
    }

    expect(mockRender).toHaveBeenCalledTimes(2);
    const installedSkillIds = getRenderedInstalledSkillIds();
    expect(installedSkillIds).toStrictEqual(CONFIG_SKILL_IDS);
  });

  it("should merge discovered plugin skills with config skills as installedSkillIds", async () => {
    mockDiscoverAllPluginSkills.mockResolvedValue({
      "web-framework-react": { id: "web-framework-react", path: "skills/web-framework-react/" },
    });
    mockLoadProjectConfig.mockResolvedValue({
      config: {
        name: "test-project",
        agents: [],
        skills: CONFIG_SKILLS,
      },
      configPath: path.join(projectDir, ".claude-src/config.ts"),
    });

    try {
      await Edit.run([], { root: CLI_ROOT });
    } catch {
      // Expected: command errors after render because wizardResult is null
    }

    expect(mockRender).toHaveBeenCalledTimes(2);
    const installedSkillIds = getRenderedInstalledSkillIds();
    // Plugin discovery found react; config also has hono — both should be included
    expect(installedSkillIds).toStrictEqual(CONFIG_SKILL_IDS);
  });
});

// Bug regression: edit command must detect when agents are added/removed,
// not just skill changes. Without the fix, adding a new agent (with no skill
// changes) would cause the command to print "No changes made" and exit early.

describe("edit command detects added agents", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  const EXISTING_SKILL_IDS: SkillId[] = ["web-framework-react"];
  const EXISTING_SKILLS = buildSkillConfigs(EXISTING_SKILL_IDS, {
    scope: "project",
    source: "eject",
  });

  const testMatrix = FULLSTACK_PAIR_MATRIX;
  const testSourceResult = buildSourceResult(testMatrix, "/test/source");

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-edit-agent-detect-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    mockRender.mockClear();
    mockDetectInstallation.mockResolvedValue({
      mode: "eject",
      scope: "project",
      configPath: path.join(projectDir, ".claude-src/config.ts"),
      agentsDir: path.join(projectDir, ".claude/agents"),
      skillsDir: path.join(projectDir, ".claude/skills"),
      projectDir,
    });

    mockLoadSkillsMatrixFromSource.mockResolvedValue(testSourceResult);
    initializeMatrix(testSourceResult.matrix);
    mockDiscoverAllPluginSkills.mockResolvedValue({});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should NOT report 'No changes made' when only agents are added", async () => {
    // Old config has one agent: web-developer
    mockLoadProjectConfig.mockResolvedValue({
      config: {
        name: "test-project",
        agents: buildAgentConfigs(["web-developer"]),
        skills: EXISTING_SKILLS,
      },
      configPath: path.join(projectDir, ".claude-src/config.ts"),
    });

    // Mock render to invoke onComplete with a wizard result that adds web-tester
    // (same skills, but a new agent)
    mockRender.mockImplementation((element: ReactElement) => {
      const onComplete = element.props.onComplete as ((result: unknown) => void) | undefined;
      if (onComplete) {
        const wizardResult = buildWizardResult(EXISTING_SKILLS, {
          agentConfigs: buildAgentConfigs(["web-developer", "web-tester"]),
        });
        onComplete(wizardResult);
      }
      return { waitUntilExit: () => Promise.resolve(), clear: vi.fn(), unmount: vi.fn() };
    });

    try {
      await Edit.run([], { root: CLI_ROOT });
    } catch {
      // Command may error on later steps — that's OK for this test
    }

    // With the fix, the command detects agent changes and proceeds past the
    // early return into agent loading (loadAgentDefs -> getAgentDefinitions).
    // Without the fix, the command exits early and getAgentDefinitions is never called.
    expect(mockGetAgentDefinitions).toHaveBeenCalledTimes(1);
  });
});

// Bug regression: edit command must copy newly added local-source skills to
// .claude/skills/. Without the fix, the addedLocalSkills copy block was missing,
// so skills switched to local source during edit were never copied.

describe("edit command copies newly added local skills", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  const testMatrix = FULLSTACK_PAIR_MATRIX;
  const testSourceResult = buildSourceResult(testMatrix, "/test/source");

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-edit-local-copy-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);

    mockRender.mockClear();
    mockCopySkillsToLocalFlattened.mockClear();
    mockEnsureDir.mockClear();
    mockDetectInstallation.mockResolvedValue({
      mode: "eject",
      scope: "project",
      configPath: path.join(projectDir, ".claude-src/config.ts"),
      agentsDir: path.join(projectDir, ".claude/agents"),
      skillsDir: path.join(projectDir, ".claude/skills"),
      projectDir,
    });

    mockLoadSkillsMatrixFromSource.mockResolvedValue(testSourceResult);
    initializeMatrix(testSourceResult.matrix);
    mockDiscoverAllPluginSkills.mockResolvedValue({});
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  it("should call copySkillsToLocalFlattened when a local skill is added", async () => {
    // Old config has no skills
    mockLoadProjectConfig.mockResolvedValue({
      config: {
        name: "test-project",
        agents: buildAgentConfigs(["web-developer"]),
        skills: [],
      },
      configPath: path.join(projectDir, ".claude-src/config.ts"),
    });

    const newLocalSkills = buildSkillConfigs(["web-framework-react"], {
      scope: "project",
      source: "eject",
    });

    // Mock render to invoke onComplete with a wizard result that adds a local skill
    mockRender.mockImplementation((element: ReactElement) => {
      const onComplete = element.props.onComplete as ((result: unknown) => void) | undefined;
      if (onComplete) {
        const wizardResult = buildWizardResult(newLocalSkills, {
          agentConfigs: buildAgentConfigs(["web-developer"]),
        });
        onComplete(wizardResult);
      }
      return { waitUntilExit: () => Promise.resolve(), clear: vi.fn(), unmount: vi.fn() };
    });

    try {
      await Edit.run([], { root: CLI_ROOT });
    } catch {
      // Expected: command errors after copy (getAgentDefinitions is not mocked)
    }

    // The copy function should have been called for the newly added local skill
    expect(mockCopySkillsToLocalFlattened).toHaveBeenCalledOnce();
    expect(mockCopySkillsToLocalFlattened).toHaveBeenCalledWith(
      ["web-framework-react"],
      expect.stringContaining(".claude/skills"),
      testSourceResult.matrix,
      testSourceResult,
    );
  });
});

// Bug regression: migratePluginSkillScopes must NOT uninstall the global ("user")
// plugin when re-scoping from global to project. The global registration is shared
// across projects and must remain intact. Only project→global should uninstall.

describe("migratePluginSkillScopes", () => {
  it("should not uninstall global plugin when re-scoping from global to project", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi.spyOn(execModule, "claudePluginInstall").mockResolvedValue();
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "global" as const, to: "project" as const }],
    ]);
    const skills = [{ id: "web-framework-react" as SkillId, source: "agents-inc" }];

    await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    expect(uninstallSpy).not.toHaveBeenCalledWith("web-framework-react", "user", "/project");
    expect(installSpy).toHaveBeenCalledWith(
      "web-framework-react@agents-inc",
      "project",
      "/project",
    );

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should uninstall project plugin when re-scoping from project to global", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi.spyOn(execModule, "claudePluginInstall").mockResolvedValue();
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "project" as const, to: "global" as const }],
    ]);
    const skills = [{ id: "web-framework-react" as SkillId, source: "agents-inc" }];

    await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    expect(uninstallSpy).toHaveBeenCalledWith("web-framework-react", "project", "/project");
    expect(installSpy).toHaveBeenCalledWith("web-framework-react@agents-inc", "user", "/project");

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should skip eject-source skills during scope migration", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi.spyOn(execModule, "claudePluginInstall").mockResolvedValue();
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "global" as const, to: "project" as const }],
    ]);
    const skills = [{ id: "web-framework-react" as SkillId, source: "eject" }];

    await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    expect(uninstallSpy).not.toHaveBeenCalledWith("web-framework-react", expect.any(String), "/project");
    expect(installSpy).not.toHaveBeenCalledWith("web-framework-react@eject", expect.any(String), "/project");

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should handle mixed scope changes correctly", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi.spyOn(execModule, "claudePluginInstall").mockResolvedValue();
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "global" as const, to: "project" as const }],
      ["web-state-zustand" as SkillId, { from: "project" as const, to: "global" as const }],
    ]);
    const skills = [
      { id: "web-framework-react" as SkillId, source: "agents-inc" },
      { id: "web-state-zustand" as SkillId, source: "agents-inc" },
    ];

    const result = await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    expect(result.migrated).toHaveLength(2);

    // React global→project: NO uninstall, install at project
    expect(uninstallSpy).not.toHaveBeenCalledWith("web-framework-react", "user", "/project");
    expect(installSpy).toHaveBeenCalledWith(
      "web-framework-react@agents-inc",
      "project",
      "/project",
    );

    // Zustand project→global: uninstall project, install at user
    expect(uninstallSpy).toHaveBeenCalledWith("web-state-zustand", "project", "/project");
    expect(installSpy).toHaveBeenCalledWith("web-state-zustand@agents-inc", "user", "/project");

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should report install failure without affecting global registration", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi
      .spyOn(execModule, "claudePluginInstall")
      .mockRejectedValue(new Error("install failed"));
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "global" as const, to: "project" as const }],
    ]);
    const skills = [{ id: "web-framework-react" as SkillId, source: "agents-inc" }];

    const result = await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    // Should NOT have uninstalled global
    expect(uninstallSpy).not.toHaveBeenCalledWith("web-framework-react", "user", "/project");
    // Should report failure
    expect(result.migrated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe("web-framework-react");

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should not install at global scope when project uninstall fails", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi.spyOn(execModule, "claudePluginInstall").mockResolvedValue();
    const uninstallSpy = vi
      .spyOn(execModule, "claudePluginUninstall")
      .mockRejectedValue(new Error("uninstall failed"));

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "project" as const, to: "global" as const }],
    ]);
    const skills = [{ id: "web-framework-react" as SkillId, source: "agents-inc" }];

    const result = await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    // Should have tried to uninstall
    expect(uninstallSpy).toHaveBeenCalledWith("web-framework-react", "project", "/project");
    // Should NOT have installed at global (uninstall failed, catch fired)
    expect(installSpy).not.toHaveBeenCalledWith("web-framework-react@agents-inc", "user", "/project");
    // Should report failure
    expect(result.migrated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should skip skills not found in the skills array", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi.spyOn(execModule, "claudePluginInstall").mockResolvedValue();
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "global" as const, to: "project" as const }],
    ]);
    // Empty skills array — skill not found
    const skills: Array<{ id: SkillId; source: string }> = [];

    const result = await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    expect(uninstallSpy).not.toHaveBeenCalledWith("web-framework-react", expect.any(String), "/project");
    expect(installSpy).not.toHaveBeenCalledWith(expect.stringContaining("web-framework-react"), expect.any(String), "/project");
    expect(result.migrated).toHaveLength(0);
    expect(result.failed).toHaveLength(0);

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });

  it("should continue processing after individual skill failure", async () => {
    const execModule = await import("../../../utils/exec.js");
    const installSpy = vi
      .spyOn(execModule, "claudePluginInstall")
      .mockRejectedValueOnce(new Error("first fails"))
      .mockResolvedValueOnce();
    const uninstallSpy = vi.spyOn(execModule, "claudePluginUninstall").mockResolvedValue();

    const scopeChanges = new Map([
      ["web-framework-react" as SkillId, { from: "global" as const, to: "project" as const }],
      ["web-state-zustand" as SkillId, { from: "global" as const, to: "project" as const }],
    ]);
    const skills = [
      { id: "web-framework-react" as SkillId, source: "agents-inc" },
      { id: "web-state-zustand" as SkillId, source: "agents-inc" },
    ];

    const result = await migratePluginSkillScopes(scopeChanges, skills, "agents-inc", "/project");

    // First skill failed, second succeeded
    expect(result.migrated).toStrictEqual(["web-state-zustand"]);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].id).toBe("web-framework-react");

    installSpy.mockRestore();
    uninstallSpy.mockRestore();
  });
});
