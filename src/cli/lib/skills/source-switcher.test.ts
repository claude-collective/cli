import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillId } from "../../types";

// Mock file system and logger (manual mocks from __mocks__ directories)
vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { archiveLocalSkill, restoreArchivedSkill, hasArchivedSkill } from "./source-switcher";
import { copy, directoryExists, ensureDir, remove } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";

describe("source-switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("archiveLocalSkill", () => {
    it("moves skill to archived directory", async () => {
      vi.mocked(directoryExists).mockResolvedValue(true);

      await archiveLocalSkill("/project", "web-framework-react" as SkillId);

      expect(ensureDir).toHaveBeenCalledWith("/project/.claude/skills/_archived");
      expect(copy).toHaveBeenCalledWith(
        "/project/.claude/skills/web-framework-react",
        "/project/.claude/skills/_archived/web-framework-react",
      );
      expect(remove).toHaveBeenCalledWith("/project/.claude/skills/web-framework-react");
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Archived"));
    });

    it("creates archived directory if it doesn't exist", async () => {
      vi.mocked(directoryExists).mockResolvedValue(true);

      await archiveLocalSkill("/project", "api-framework-hono" as SkillId);

      // ensureDir creates the _archived directory if needed
      expect(ensureDir).toHaveBeenCalledWith("/project/.claude/skills/_archived");
    });

    it("warns and returns early when skill directory does not exist", async () => {
      vi.mocked(directoryExists).mockResolvedValue(false);

      await archiveLocalSkill("/project", "web-framework-react" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("not found"));
      expect(copy).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe("restoreArchivedSkill", () => {
    it("restores from archived and returns true", async () => {
      vi.mocked(directoryExists).mockResolvedValue(true);

      const result = await restoreArchivedSkill("/project", "web-framework-react" as SkillId);

      expect(result).toBe(true);
      expect(copy).toHaveBeenCalledWith(
        "/project/.claude/skills/_archived/web-framework-react",
        "/project/.claude/skills/web-framework-react",
      );
      expect(remove).toHaveBeenCalledWith("/project/.claude/skills/_archived/web-framework-react");
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Restored"));
    });

    it("returns false when no archive exists", async () => {
      vi.mocked(directoryExists).mockResolvedValue(false);

      const result = await restoreArchivedSkill("/project", "web-framework-react" as SkillId);

      expect(result).toBe(false);
      expect(copy).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  });

  describe("hasArchivedSkill", () => {
    it("returns true when archive exists", async () => {
      vi.mocked(directoryExists).mockResolvedValue(true);

      const result = await hasArchivedSkill("/project", "web-framework-react" as SkillId);

      expect(result).toBe(true);
      expect(directoryExists).toHaveBeenCalledWith(
        "/project/.claude/skills/_archived/web-framework-react",
      );
    });

    it("returns false when no archive exists", async () => {
      vi.mocked(directoryExists).mockResolvedValue(false);

      const result = await hasArchivedSkill("/project", "web-framework-react" as SkillId);

      expect(result).toBe(false);
      expect(directoryExists).toHaveBeenCalledWith(
        "/project/.claude/skills/_archived/web-framework-react",
      );
    });
  });
});
