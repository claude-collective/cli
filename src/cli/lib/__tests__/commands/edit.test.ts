import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { ReactElement } from "react";
import path from "path";
import { mkdir } from "fs/promises";
import {
  runCliCommand,
  createTempDir,
  cleanupTempDir,
  buildSourceResult,
  CLI_ROOT,
  TEST_MATRICES,
} from "../helpers";
import { EXIT_CODES } from "../../exit-codes";
import { useWizardStore } from "../../../stores/wizard-store";
import type { Domain, SkillId, Subcategory } from "../../../types";
import Edit from "../../../commands/edit.js";

// --- Module mocks (hoisted by vitest) ---

const {
  mockRender,
  mockDetectInstallation,
  mockLoadSkillsMatrixFromSource,
  mockGetMarketplaceLabel,
  mockLoadProjectConfig,
  mockDiscoverAllPluginSkills,
} = vi.hoisted(() => ({
  mockRender: vi.fn().mockReturnValue({ waitUntilExit: () => Promise.resolve() }),
  mockDetectInstallation: vi.fn().mockResolvedValue(null),
  mockLoadSkillsMatrixFromSource: vi.fn(),
  mockGetMarketplaceLabel: vi.fn().mockReturnValue(undefined),
  mockLoadProjectConfig: vi.fn().mockResolvedValue(null),
  mockDiscoverAllPluginSkills: vi.fn().mockResolvedValue({}),
}));

vi.mock("ink", async (importOriginal) => {
  const original = await importOriginal<typeof import("ink")>();
  return { ...original, render: mockRender };
});

vi.mock("../../installation/index.js", () => ({
  detectInstallation: (...args: unknown[]) => mockDetectInstallation(...(args as [])),
}));

vi.mock("../../loading/index.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../loading/index.js")>();
  return {
    ...original,
    loadSkillsMatrixFromSource: (...args: unknown[]) =>
      mockLoadSkillsMatrixFromSource(...(args as [])),
    getMarketplaceLabel: (...args: unknown[]) => mockGetMarketplaceLabel(...(args as [])),
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

    it("should accept --dry-run flag (inherited from BaseCommand)", async () => {
      const { error } = await runCliCommand(["edit", "--dry-run"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
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

// Shared test data for populateFromSkillIds and domain filtering tests
const EDIT_CATEGORIES: Partial<Record<Subcategory, { domain?: Domain }>> = {
  "web-framework": { domain: "web" },
  "web-client-state": { domain: "web" },
  "api-api": { domain: "api" },
  "web-testing": { domain: "shared" },
};

const EDIT_SKILLS: Partial<Record<SkillId, { category: string; displayName?: string }>> = {
  "web-framework-react": { category: "web-framework" },
  "web-state-zustand": { category: "web-client-state" },
  "api-framework-hono": { category: "api-api" },
  "web-testing-vitest": { category: "web-testing" },
} as Partial<Record<SkillId, { category: string; displayName?: string }>>;

// The edit command uses populateFromSkillIds() on the Zustand wizard store
// to restore prior selections. Testing at the store level because the edit
// command itself launches an interactive wizard that cannot be driven from
// runCliCommand. This validates the same code path used by
// use-wizard-initialization.ts when edit mode is active.

describe("edit wizard pre-selection via populateFromSkillIds", () => {
  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  it("should pre-populate domainSelections from installed skill IDs", () => {
    const installedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    // Web skills should appear under the web domain
    expect(domainSelections.web?.["web-framework"]).toEqual(["web-framework-react"]);
    expect(domainSelections.web?.["web-client-state"]).toEqual(["web-state-zustand"]);

    // API skill should appear under the api domain
    expect(domainSelections.api?.["api-api"]).toEqual(["api-framework-hono"]);
  });

  it("should not pre-select skills that are not in the installed list", () => {
    const installedSkills: SkillId[] = ["web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    // Only web/framework should be populated
    expect(domainSelections.web?.["web-framework"]).toEqual(["web-framework-react"]);

    // Other subcategories should not exist
    expect(domainSelections.web?.["web-client-state"]).toBeUndefined();
    expect(domainSelections.api).toBeUndefined();
  });

  it("should set selectedDomains to only the domains found in the provided skill IDs", () => {
    const installedSkills: SkillId[] = ["web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const { selectedDomains } = useWizardStore.getState();

    // populateFromSkillIds sets only domains derived from the skill IDs
    expect(selectedDomains).toContain("web");
    expect(selectedDomains).not.toContain("api");
    expect(selectedDomains).not.toContain("shared");
  });

  it("should place shared-domain skills under the shared domain key", () => {
    const installedSkills: SkillId[] = ["web-testing-vitest"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    // Testing category maps to the shared domain
    expect(domainSelections.shared?.["web-testing"]).toEqual(["web-testing-vitest"]);

    // No web or api entries should exist
    expect(domainSelections.web).toBeUndefined();
    expect(domainSelections.api).toBeUndefined();
  });

  it("should produce empty domainSelections when installed list is empty", () => {
    const installedSkills: SkillId[] = [];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    expect(Object.keys(domainSelections)).toHaveLength(0);
  });

  it("should skip skills missing a category", () => {
    const sparseSkills: Partial<Record<SkillId, { category: string; displayName?: string }>> = {
      "web-framework-react": { category: "web-framework" },
      "web-framework-unknown": {} as { category: string },
    } as Partial<Record<SkillId, { category: string; displayName?: string }>>;

    const installedSkills: SkillId[] = ["web-framework-react", "web-framework-unknown"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, sparseSkills, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    // Only the skill with a valid category should be populated
    expect(domainSelections.web?.["web-framework"]).toEqual(["web-framework-react"]);
    expect(domainSelections.web?.["web-framework"]).toHaveLength(1);
  });

  it("should skip skills whose category has no domain mapping", () => {
    const extraSkills: Partial<Record<SkillId, { category: string; displayName?: string }>> = {
      "web-framework-react": { category: "web-framework" },
      "infra-tooling-linter": { category: "unmapped-category" },
    };

    const installedSkills: SkillId[] = ["web-framework-react", "infra-tooling-linter"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, extraSkills, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    // Only the resolvable skill should be populated
    expect(domainSelections.web?.["web-framework"]).toEqual(["web-framework-react"]);
    // No domain should contain the unresolvable skill
    const allTechs = useWizardStore.getState().getAllSelectedTechnologies();
    expect(allTechs).not.toContain("infra-tooling-linter");
  });

  it("should not duplicate skills when the same skill ID appears twice in installed list", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const { domainSelections } = useWizardStore.getState();

    // Should deduplicate
    expect(domainSelections.web?.["web-framework"]).toEqual(["web-framework-react"]);
    expect(domainSelections.web?.["web-framework"]).toHaveLength(1);
  });

  it("should populate multiple skills within the same subcategory (non-exclusive)", () => {
    // testing category is non-exclusive, so multiple selections are valid
    const multiSkills: Partial<Record<SkillId, { category: string; displayName?: string }>> = {
      ...EDIT_SKILLS,
      "web-testing-playwright": { category: "web-testing" },
    } as Partial<Record<SkillId, { category: string; displayName?: string }>>;

    const installedSkills: SkillId[] = ["web-testing-vitest", "web-testing-playwright"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, multiSkills, EDIT_CATEGORIES);

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
    useWizardStore.getState().reset();
  });

  it("should report only web domain when only web skills are installed", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    // Web should have selections
    expect(perDomain.web).toBeDefined();
    expect(perDomain.web!.length).toBe(2);

    // API, CLI, mobile should be absent (no selections)
    expect(perDomain.api).toBeUndefined();
    expect(perDomain.cli).toBeUndefined();
    expect(perDomain.mobile).toBeUndefined();
  });

  it("should report both web and api domains when both have selections", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "api-framework-hono"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    expect(perDomain.web).toBeDefined();
    expect(perDomain.api).toBeDefined();
    expect(perDomain.cli).toBeUndefined();
  });

  it("should report only shared domain when only shared skills are installed", () => {
    const installedSkills: SkillId[] = ["web-testing-vitest"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    // Only shared domain should have selections
    expect(perDomain.shared).toBeDefined();
    expect(perDomain.shared).toEqual(["web-testing-vitest"]);

    // All other domains should be absent
    expect(perDomain.web).toBeUndefined();
    expect(perDomain.api).toBeUndefined();
    expect(perDomain.cli).toBeUndefined();
    expect(perDomain.mobile).toBeUndefined();
  });

  it("should return empty result when no skills are installed", () => {
    const installedSkills: SkillId[] = [];

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

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

    useWizardStore.getState().populateFromSkillIds(installedSkills, EDIT_SKILLS, EDIT_CATEGORIES);

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

// The edit command has a local-mode fallback: when discoverAllPluginSkills returns
// empty (no plugin-based skills found), it falls back to project config skills.
// These tests verify that the correct installedSkillIds reach the Wizard component.

describe("edit command local-mode skill fallback", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  const CONFIG_SKILLS: SkillId[] = ["web-framework-react", "api-framework-hono"];

  const testMatrix = TEST_MATRICES.reactAndHono;

  const testSourceResult = buildSourceResult(testMatrix, "/test/source");

  function getRenderedInstalledSkillIds(): SkillId[] | undefined {
    const renderCall = mockRender.mock.calls[0];
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
    mockRender.mockReturnValue({ waitUntilExit: () => Promise.resolve() });

    mockDetectInstallation.mockResolvedValue({
      mode: "local",
      scope: "project",
      configPath: path.join(projectDir, ".claude-src/config.yaml"),
      agentsDir: path.join(projectDir, ".claude/agents"),
      skillsDir: path.join(projectDir, ".claude/skills"),
      projectDir,
    });

    mockLoadSkillsMatrixFromSource.mockResolvedValue(testSourceResult);
    mockGetMarketplaceLabel.mockReturnValue(undefined);
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
      configPath: path.join(projectDir, ".claude-src/config.yaml"),
    });

    try {
      await Edit.run([], { root: CLI_ROOT });
    } catch {
      // Expected: command errors after render because wizardResult is null
    }

    expect(mockRender).toHaveBeenCalledOnce();
    const installedSkillIds = getRenderedInstalledSkillIds();
    expect(installedSkillIds).toEqual(CONFIG_SKILLS);
  });

  it("should use discovered plugin skills as installedSkillIds when plugin discovery returns results", async () => {
    const pluginSkillIds: SkillId[] = ["web-framework-react"];
    mockDiscoverAllPluginSkills.mockResolvedValue({
      "web-framework-react": { id: "web-framework-react", path: "skills/web-framework-react/" },
    });
    mockLoadProjectConfig.mockResolvedValue({
      config: {
        name: "test-project",
        agents: [],
        skills: CONFIG_SKILLS,
      },
      configPath: path.join(projectDir, ".claude-src/config.yaml"),
    });

    try {
      await Edit.run([], { root: CLI_ROOT });
    } catch {
      // Expected: command errors after render because wizardResult is null
    }

    expect(mockRender).toHaveBeenCalledOnce();
    const installedSkillIds = getRenderedInstalledSkillIds();
    expect(installedSkillIds).toEqual(pluginSkillIds);
  });
});
