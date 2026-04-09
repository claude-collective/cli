import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillId } from "../../types";
import type { SkillConfig } from "../../types/config";
import type { SourceLoadResult } from "../loading/source-loader";
import type { MigrationPlan } from "./mode-migrator";
import { buildSourceResult, createTempDir, cleanupTempDir } from "../__tests__/helpers";
import { WEB_PAIR_MATRIX } from "../__tests__/mock-data/mock-matrices";

// Mock dependencies before imports
vi.mock("../skills", () => ({
  deleteLocalSkill: vi.fn().mockResolvedValue(undefined),
  copySkillsToLocalFlattened: vi.fn().mockResolvedValue([]),
}));

vi.mock("../../utils/exec", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../utils/exec")>()),
  claudePluginInstall: vi.fn().mockResolvedValue(undefined),
  claudePluginUninstall: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/logger");

import { detectMigrations, executeMigration } from "./mode-migrator";
import { deleteLocalSkill, copySkillsToLocalFlattened } from "../skills";
import { claudePluginInstall, claudePluginUninstall } from "../../utils/exec";

describe("mode-migrator", () => {
  describe("detectMigrations", () => {
    function skill(
      id: string,
      source: string,
      scope: "project" | "global" = "project",
    ): SkillConfig {
      return { id: id as SkillId, source, scope };
    }

    it("should detect skills moving from plugin to eject", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "agents-inc")],
        [skill("web-framework-react", "eject")],
      );

      expect(result.toEject).toHaveLength(1);
      expect(result.toEject[0].id).toBe("web-framework-react");
      expect(result.toPlugin).toStrictEqual([]);
    });

    it("should detect skills moving from eject to plugin", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "eject")],
        [skill("web-framework-react", "agents-inc")],
      );

      expect(result.toEject).toStrictEqual([]);
      expect(result.toPlugin).toHaveLength(1);
      expect(result.toPlugin[0].id).toBe("web-framework-react");
    });

    it("should detect mixed migrations", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "agents-inc"), skill("web-state-zustand", "eject")],
        [skill("web-framework-react", "eject"), skill("web-state-zustand", "agents-inc")],
      );

      expect(result.toEject).toHaveLength(1);
      expect(result.toEject[0].id).toBe("web-framework-react");
      expect(result.toPlugin).toHaveLength(1);
      expect(result.toPlugin[0].id).toBe("web-state-zustand");
    });

    it("should return empty plan when no migrations needed", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "agents-inc")],
        [skill("web-framework-react", "agents-inc")],
      );

      expect(result.toEject).toStrictEqual([]);
      expect(result.toPlugin).toStrictEqual([]);
    });

    it("should handle skills with no previous selection (new skill, no migration)", () => {
      const result = detectMigrations([], [skill("web-framework-react", "eject")]);

      // New skills are not migrations (no old entry to compare)
      expect(result.toEject).toStrictEqual([]);
      expect(result.toPlugin).toStrictEqual([]);
    });

    it("should handle skills removed in new selection (no migration)", () => {
      const result = detectMigrations([skill("web-framework-react", "eject")], []);

      // Removed skills are not migrations (no new entry to compare)
      expect(result.toEject).toStrictEqual([]);
      expect(result.toPlugin).toStrictEqual([]);
    });

    it("should detect scope changes when source stays the same", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "eject", "project")],
        [skill("web-framework-react", "eject", "global")],
      );

      expect(result.toEject).toStrictEqual([]);
      expect(result.toPlugin).toStrictEqual([]);
      expect(result.scopeChanges).toHaveLength(1);
      expect(result.scopeChanges[0]).toStrictEqual({
        id: "web-framework-react",
        oldSource: "eject",
        newSource: "eject",
        oldScope: "project",
        newScope: "global",
      });
    });

    it("should NOT detect scope change when source also changes", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "eject", "project")],
        [skill("web-framework-react", "agents-inc", "global")],
      );

      // Source changed (eject -> agents-inc), so this is a toPlugin, not a scopeChange
      expect(result.toPlugin).toHaveLength(1);
      expect(result.scopeChanges).toStrictEqual([]);
    });

    it("should only detect migrations for skills present in both old and new", () => {
      const result = detectMigrations(
        [skill("web-framework-react", "agents-inc"), skill("web-state-zustand", "eject")],
        [skill("web-framework-react", "eject")],
      );

      // Only react is in both old and new with a source change
      expect(result.toEject).toHaveLength(1);
      expect(result.toEject[0].id).toBe("web-framework-react");
      expect(result.toPlugin).toStrictEqual([]);
    });
  });

  describe("executeMigration", () => {
    let tempDir: string;
    let sourceResult: SourceLoadResult;

    beforeEach(async () => {
      tempDir = await createTempDir("mode-migrator-test-");

      const matrix = WEB_PAIR_MATRIX;
      sourceResult = buildSourceResult(matrix, "/test/source", {
        marketplace: "https://marketplace.example.com",
      });
    });

    afterEach(async () => {
      await cleanupTempDir(tempDir);
    });

    it("should copy skills to local and uninstall plugins for toEject skills", async () => {
      vi.mocked(copySkillsToLocalFlattened).mockResolvedValue([
        {
          skillId: "web-framework-react",
          contentHash: "abc123",
          sourcePath: "/source/skills/web/framework/react",
          destPath: `${tempDir}/.claude/skills/web-framework-react`,
        },
      ]);

      const plan: MigrationPlan = {
        toEject: [
          {
            id: "web-framework-react",
            oldSource: "agents-inc",
            newSource: "eject",
            oldScope: "project",
            newScope: "project",
          },
        ],
        toPlugin: [],
        scopeChanges: [],
      };

      const result = await executeMigration(plan, tempDir, sourceResult);

      expect(copySkillsToLocalFlattened).toHaveBeenCalledWith(
        ["web-framework-react"],
        expect.stringContaining(".claude/skills"),
        sourceResult.matrix,
        sourceResult,
      );
      expect(claudePluginUninstall).toHaveBeenCalledWith("web-framework-react", "project", tempDir);
      expect(result.ejectedSkills).toStrictEqual(["web-framework-react"]);
      expect(result.warnings).toStrictEqual([]);
    });

    it("should archive and install plugins for toPlugin skills", async () => {
      const plan: MigrationPlan = {
        toEject: [],
        toPlugin: [
          {
            id: "web-state-zustand",
            oldSource: "eject",
            newSource: "agents-inc",
            oldScope: "project",
            newScope: "project",
          },
        ],
        scopeChanges: [],
      };

      const result = await executeMigration(plan, tempDir, sourceResult);

      expect(deleteLocalSkill).toHaveBeenCalledWith(tempDir, "web-state-zustand");
      expect(claudePluginInstall).toHaveBeenCalledWith(
        "web-state-zustand@https://marketplace.example.com",
        "project",
        tempDir,
      );
      expect(result.pluginizedSkills).toStrictEqual(["web-state-zustand"]);
      expect(result.warnings).toStrictEqual([]);
    });

    it("should handle empty migration plan", async () => {
      const plan: MigrationPlan = {
        toEject: [],
        toPlugin: [],
        scopeChanges: [],
      };

      const result = await executeMigration(plan, tempDir, sourceResult);

      expect(copySkillsToLocalFlattened).not.toHaveBeenCalled();
      expect(deleteLocalSkill).not.toHaveBeenCalled();
      expect(claudePluginInstall).not.toHaveBeenCalled();
      expect(claudePluginUninstall).not.toHaveBeenCalled();
      expect(result.ejectedSkills).toStrictEqual([]);
      expect(result.pluginizedSkills).toStrictEqual([]);
      expect(result.warnings).toStrictEqual([]);
    });

    it("should collect warnings when plugin operations fail", async () => {
      vi.mocked(claudePluginInstall).mockRejectedValue(new Error("install failed"));

      const plan: MigrationPlan = {
        toEject: [],
        toPlugin: [
          {
            id: "web-state-zustand",
            oldSource: "eject",
            newSource: "agents-inc",
            oldScope: "project",
            newScope: "project",
          },
        ],
        scopeChanges: [],
      };

      const result = await executeMigration(plan, tempDir, sourceResult);

      expect(deleteLocalSkill).toHaveBeenCalledWith(tempDir, "web-state-zustand");
      expect(result.pluginizedSkills).toStrictEqual([]);
      expect(result.warnings).toStrictEqual([
        expect.stringContaining("Could not install plugin for web-state-zustand"),
      ]);
    });

    it("should warn when no marketplace configured for plugin migration", async () => {
      const noMarketplaceSource = buildSourceResult(sourceResult.matrix, "/test/source");

      const plan: MigrationPlan = {
        toEject: [],
        toPlugin: [
          {
            id: "web-state-zustand",
            oldSource: "eject",
            newSource: "agents-inc",
            oldScope: "project",
            newScope: "project",
          },
        ],
        scopeChanges: [],
      };

      const result = await executeMigration(plan, tempDir, noMarketplaceSource);

      expect(deleteLocalSkill).toHaveBeenCalledWith(tempDir, "web-state-zustand");
      expect(claudePluginInstall).not.toHaveBeenCalled();
      expect(result.warnings).toStrictEqual([expect.stringContaining("No marketplace configured")]);
    });
  });
});
