import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillId } from "../../types";
import type { SourceLoadResult } from "../loading/source-loader";
import type { MigrationPlan } from "./mode-migrator";
import {
  buildSourceResult,
  createMockMatrix,
  createMockSkill,
  createTempDir,
  cleanupTempDir,
} from "../__tests__/helpers";

// Mock dependencies before imports
vi.mock("../skills", () => ({
  deleteLocalSkill: vi.fn().mockResolvedValue(undefined),
  copySkillsToLocalFlattened: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/exec", () => ({
  claudePluginInstall: vi.fn().mockResolvedValue(undefined),
  claudePluginUninstall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/logger");

import { detectMigrations, executeMigration } from "./mode-migrator";
import { deleteLocalSkill, copySkillsToLocalFlattened } from "../skills";
import { claudePluginInstall, claudePluginUninstall } from "../../utils/exec";

describe("mode-migrator", () => {
  describe("detectMigrations", () => {
    it("should detect skills moving from plugin to local", () => {
      const result = detectMigrations(
        { "web-framework-react": "agents-inc" } as Partial<Record<SkillId, string>>,
        { "web-framework-react": "local" } as Partial<Record<SkillId, string>>,
        ["web-framework-react" as SkillId],
      );

      expect(result.toLocal).toEqual(["web-framework-react"]);
      expect(result.toPlugin).toEqual([]);
    });

    it("should detect skills moving from local to plugin", () => {
      const result = detectMigrations(
        { "web-framework-react": "local" } as Partial<Record<SkillId, string>>,
        { "web-framework-react": "agents-inc" } as Partial<Record<SkillId, string>>,
        ["web-framework-react" as SkillId],
      );

      expect(result.toLocal).toEqual([]);
      expect(result.toPlugin).toEqual(["web-framework-react"]);
    });

    it("should detect mixed migrations", () => {
      const result = detectMigrations(
        {
          "web-framework-react": "agents-inc",
          "web-state-zustand": "local",
        } as Partial<Record<SkillId, string>>,
        {
          "web-framework-react": "local",
          "web-state-zustand": "agents-inc",
        } as Partial<Record<SkillId, string>>,
        ["web-framework-react" as SkillId, "web-state-zustand" as SkillId],
      );

      expect(result.toLocal).toEqual(["web-framework-react"]);
      expect(result.toPlugin).toEqual(["web-state-zustand"]);
    });

    it("should return empty plan when no migrations needed", () => {
      const result = detectMigrations(
        { "web-framework-react": "agents-inc" } as Partial<Record<SkillId, string>>,
        { "web-framework-react": "agents-inc" } as Partial<Record<SkillId, string>>,
        ["web-framework-react" as SkillId],
      );

      expect(result.toLocal).toEqual([]);
      expect(result.toPlugin).toEqual([]);
    });

    it("should handle skills with no previous selection", () => {
      const result = detectMigrations(
        {} as Partial<Record<SkillId, string>>,
        { "web-framework-react": "local" } as Partial<Record<SkillId, string>>,
        ["web-framework-react" as SkillId],
      );

      expect(result.toLocal).toEqual(["web-framework-react"]);
      expect(result.toPlugin).toEqual([]);
    });

    it("should handle skills with no new selection", () => {
      const result = detectMigrations(
        { "web-framework-react": "local" } as Partial<Record<SkillId, string>>,
        {} as Partial<Record<SkillId, string>>,
        ["web-framework-react" as SkillId],
      );

      expect(result.toLocal).toEqual([]);
      expect(result.toPlugin).toEqual(["web-framework-react"]);
    });

    it("should only consider skills in the allSkills list", () => {
      const result = detectMigrations(
        {
          "web-framework-react": "agents-inc",
          "web-state-zustand": "local",
        } as Partial<Record<SkillId, string>>,
        {
          "web-framework-react": "local",
          "web-state-zustand": "agents-inc",
        } as Partial<Record<SkillId, string>>,
        // Only include react, not zustand
        ["web-framework-react" as SkillId],
      );

      expect(result.toLocal).toEqual(["web-framework-react"]);
      expect(result.toPlugin).toEqual([]);
    });
  });

  describe("executeMigration", () => {
    let tempDir: string;
    let sourceResult: SourceLoadResult;

    beforeEach(async () => {
      tempDir = await createTempDir("mode-migrator-test-");

      const matrix = createMockMatrix({
        "web-framework-react": createMockSkill(
          "web-framework-react" as SkillId,
          "web-framework",
        ),
        "web-state-zustand": createMockSkill(
          "web-state-zustand" as SkillId,
          "web-client-state",
        ),
      });
      sourceResult = buildSourceResult(matrix, "/test/source", {
        marketplace: "https://marketplace.example.com",
      });
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should copy skills to local and uninstall plugins for toLocal skills", async () => {
      vi.mocked(copySkillsToLocalFlattened).mockResolvedValue([
        {
          skillId: "web-framework-react" as SkillId,
          contentHash: "abc123",
          sourcePath: "/source/skills/web/framework/react",
          destPath: `${tempDir}/.claude/skills/web-framework-react`,
        },
      ]);

      const plan: MigrationPlan = {
        toLocal: ["web-framework-react" as SkillId],
        toPlugin: [],
      };

      const result = await executeMigration(plan, tempDir, sourceResult, "project");

      expect(copySkillsToLocalFlattened).toHaveBeenCalledWith(
        ["web-framework-react"],
        expect.stringContaining(".claude/skills"),
        sourceResult.matrix,
        sourceResult,
      );
      expect(claudePluginUninstall).toHaveBeenCalledWith(
        "web-framework-react",
        "project",
        tempDir,
      );
      expect(result.localizedSkills).toEqual(["web-framework-react"]);
      expect(result.warnings).toEqual([]);
    });

    it("should archive and install plugins for toPlugin skills", async () => {
      const plan: MigrationPlan = {
        toLocal: [],
        toPlugin: ["web-state-zustand" as SkillId],
      };

      const result = await executeMigration(plan, tempDir, sourceResult, "project");

      expect(deleteLocalSkill).toHaveBeenCalledWith(tempDir, "web-state-zustand");
      expect(claudePluginInstall).toHaveBeenCalledWith(
        "web-state-zustand@https://marketplace.example.com",
        "project",
        tempDir,
      );
      expect(result.pluginizedSkills).toEqual(["web-state-zustand"]);
      expect(result.warnings).toEqual([]);
    });

    it("should handle empty migration plan", async () => {
      const plan: MigrationPlan = {
        toLocal: [],
        toPlugin: [],
      };

      const result = await executeMigration(plan, tempDir, sourceResult, "project");

      expect(copySkillsToLocalFlattened).not.toHaveBeenCalled();
      expect(deleteLocalSkill).not.toHaveBeenCalled();
      expect(claudePluginInstall).not.toHaveBeenCalled();
      expect(claudePluginUninstall).not.toHaveBeenCalled();
      expect(result.localizedSkills).toEqual([]);
      expect(result.pluginizedSkills).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    it("should collect warnings when plugin operations fail", async () => {
      vi.mocked(claudePluginInstall).mockRejectedValue(new Error("install failed"));

      const plan: MigrationPlan = {
        toLocal: [],
        toPlugin: ["web-state-zustand" as SkillId],
      };

      const result = await executeMigration(plan, tempDir, sourceResult, "project");

      expect(deleteLocalSkill).toHaveBeenCalledWith(tempDir, "web-state-zustand");
      expect(result.pluginizedSkills).toEqual([]);
      expect(result.warnings).toEqual([
        expect.stringContaining("Could not install plugin for web-state-zustand"),
      ]);
    });

    it("should warn when no marketplace configured for plugin migration", async () => {
      const noMarketplaceSource = buildSourceResult(sourceResult.matrix, "/test/source");

      const plan: MigrationPlan = {
        toLocal: [],
        toPlugin: ["web-state-zustand" as SkillId],
      };

      const result = await executeMigration(plan, tempDir, noMarketplaceSource, "project");

      expect(deleteLocalSkill).toHaveBeenCalledWith(tempDir, "web-state-zustand");
      expect(claudePluginInstall).not.toHaveBeenCalled();
      expect(result.warnings).toEqual([
        expect.stringContaining("No marketplace configured"),
      ]);
    });
  });
});
