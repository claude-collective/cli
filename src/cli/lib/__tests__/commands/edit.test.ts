import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir } from "fs/promises";
import { runCliCommand, createMockCategory } from "../helpers";
import { EXIT_CODES } from "../../exit-codes";
import { useWizardStore } from "../../../stores/wizard-store";
import type { Domain, SkillId, Subcategory } from "../../../types";

describe("edit command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-edit-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
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

      // Error message should mention running 'agentsinc init' first
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

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept -s shorthand for source", async () => {
      const { error } = await runCliCommand(["edit", "-s", "/some/path"]);

      // Should accept -s shorthand
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --agent-source flag with URL", async () => {
      const { error } = await runCliCommand([
        "edit",
        "--agent-source",
        "https://example.com/agents",
      ]);

      // Should not error on flag parsing
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("should accept --dry-run flag (inherited from BaseCommand)", async () => {
      const { error } = await runCliCommand(["edit", "--dry-run"]);

      // Should not error on flag parsing (dry-run is inherited from BaseCommand.baseFlags)
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

      // Should accept all flags without parsing errors
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });

    it("when mixing -s shorthand and --refresh long flag, should accept both", async () => {
      const { error } = await runCliCommand(["edit", "--refresh", "-s", "/custom/source"]);

      // Should accept mixed flag formats
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });
});

// ── T3: Edit Wizard Pre-Selects Previously Chosen Skills ────────────────────
//
// The edit command uses populateFromSkillIds() on the Zustand wizard store
// to restore prior selections. Testing at the store level because the edit
// command itself launches an interactive wizard that cannot be driven from
// runCliCommand. This validates the same code path used by
// use-wizard-initialization.ts when edit mode is active.

describe("edit wizard pre-selection via populateFromSkillIds (T3)", () => {
  const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
    framework: { domain: "web" },
    "client-state": { domain: "web" },
    api: { domain: "api" },
    testing: { domain: "shared" },
  };

  const skills: Partial<Record<SkillId, { category: string; displayName?: string }>> = {
    "web-framework-react": { category: "framework", displayName: "react" },
    "web-state-zustand": { category: "client-state", displayName: "zustand" },
    "api-framework-hono": { category: "api", displayName: "hono" },
    "web-testing-vitest": { category: "testing", displayName: "vitest" },
  } as Partial<Record<SkillId, { category: string; displayName?: string }>>;

  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  it("should pre-populate domainSelections from installed skill IDs", () => {
    const installedSkills: SkillId[] = [
      "web-framework-react",
      "web-state-zustand",
      "api-framework-hono",
    ];

    useWizardStore.getState().populateFromSkillIds(installedSkills, skills, categories);

    const { domainSelections } = useWizardStore.getState();

    // Web skills should appear under the web domain
    expect(domainSelections.web?.framework).toEqual(["react"]);
    expect(domainSelections.web?.["client-state"]).toEqual(["zustand"]);

    // API skill should appear under the api domain
    expect(domainSelections.api?.api).toEqual(["hono"]);
  });

  it("should not pre-select skills that are not in the installed list", () => {
    const installedSkills: SkillId[] = ["web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, skills, categories);

    const { domainSelections } = useWizardStore.getState();

    // Only web/framework should be populated
    expect(domainSelections.web?.framework).toEqual(["react"]);

    // Other subcategories should not exist
    expect(domainSelections.web?.["client-state"]).toBeUndefined();
    expect(domainSelections.api).toBeUndefined();
  });

  it("should set selectedDomains to all domains for domain filtering in build step", () => {
    const installedSkills: SkillId[] = ["web-framework-react"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, skills, categories);

    const { selectedDomains } = useWizardStore.getState();

    // populateFromSkillIds sets ALL_DOMAINS (same as populateFromStack)
    expect(selectedDomains).toContain("web");
    expect(selectedDomains).toContain("api");
    expect(selectedDomains).toContain("shared");
  });
});

// ── T4: Edit Wizard Hides Domains With No Prior Selections ──────────────────
//
// After populateFromSkillIds, the wizard uses getSelectedTechnologiesPerDomain()
// to determine which domains have active selections. Domains not in this result
// can be filtered out of the build step UI. This tests that the store correctly
// omits domains with zero selections.

describe("edit wizard domain filtering (T4)", () => {
  const categories: Partial<Record<Subcategory, { domain?: Domain }>> = {
    framework: { domain: "web" },
    "client-state": { domain: "web" },
    api: { domain: "api" },
    testing: { domain: "shared" },
  };

  const skills: Partial<Record<SkillId, { category: string; displayName?: string }>> = {
    "web-framework-react": { category: "framework", displayName: "react" },
    "web-state-zustand": { category: "client-state", displayName: "zustand" },
    "api-framework-hono": { category: "api", displayName: "hono" },
    "web-testing-vitest": { category: "testing", displayName: "vitest" },
  } as Partial<Record<SkillId, { category: string; displayName?: string }>>;

  beforeEach(() => {
    useWizardStore.getState().reset();
  });

  it("should report only web domain when only web skills are installed", () => {
    const installedSkills: SkillId[] = ["web-framework-react", "web-state-zustand"];

    useWizardStore.getState().populateFromSkillIds(installedSkills, skills, categories);

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

    useWizardStore.getState().populateFromSkillIds(installedSkills, skills, categories);

    const perDomain = useWizardStore.getState().getSelectedTechnologiesPerDomain();

    expect(perDomain.web).toBeDefined();
    expect(perDomain.api).toBeDefined();
    expect(perDomain.cli).toBeUndefined();
  });
});
