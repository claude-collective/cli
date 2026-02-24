import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillId } from "../../types";

// Mock file system and logger (manual mocks from __mocks__ directories)
vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { archiveLocalSkill, restoreArchivedSkill, hasArchivedSkill } from "./source-switcher";
import { copy, directoryExists, ensureDir, remove } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";
import { extendSchemasWithCustomValues, resetSchemaExtensions } from "../schemas";

const ENOENT_ERROR = new Error(
  "ENOENT: no such file or directory, stat '/project/.claude/skills/web-framework-react'",
);

describe("source-switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("archiveLocalSkill", () => {
    it("moves skill to archived directory", async () => {
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
      await archiveLocalSkill("/project", "api-framework-hono" as SkillId);

      // ensureDir creates the _archived directory if needed
      expect(ensureDir).toHaveBeenCalledWith("/project/.claude/skills/_archived");
    });

    it("warns and returns early when copy fails (e.g. missing directory)", async () => {
      vi.mocked(copy).mockRejectedValueOnce(ENOENT_ERROR);

      await archiveLocalSkill("/project", "web-framework-react" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Failed to archive skill"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks path traversal in skill ID", async () => {
      await archiveLocalSkill("/project", "web-traversal-../../dangerous" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks skill ID with forward slashes", async () => {
      await archiveLocalSkill("/project", "web-framework-react/../../etc" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("blocks skill ID with backslashes", async () => {
      await archiveLocalSkill("/project", "web-framework-react\\..\\..\\etc" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("blocks null byte injection in skill ID", async () => {
      await archiveLocalSkill("/project", "web-skill-name\0../../passwd" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("blocks skill ID with uppercase characters", async () => {
      await archiveLocalSkill("/project", "Not-Valid-Id" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("blocks skill ID starting with a number", async () => {
      await archiveLocalSkill("/project", "123-invalid" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("accepts custom skill IDs registered via extendSchemasWithCustomValues()", async () => {
      extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });

      await archiveLocalSkill("/project", "acme-pipeline-deploy" as SkillId);

      expect(ensureDir).toHaveBeenCalledWith("/project/.claude/skills/_archived");
      expect(copy).toHaveBeenCalledWith(
        "/project/.claude/skills/acme-pipeline-deploy",
        "/project/.claude/skills/_archived/acme-pipeline-deploy",
      );
      expect(remove).toHaveBeenCalledWith("/project/.claude/skills/acme-pipeline-deploy");
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Archived"));

      resetSchemaExtensions();
    });
  });

  describe("restoreArchivedSkill", () => {
    it("restores from archived and returns true", async () => {
      const result = await restoreArchivedSkill("/project", "web-framework-react" as SkillId);

      expect(result).toBe(true);
      expect(copy).toHaveBeenCalledWith(
        "/project/.claude/skills/_archived/web-framework-react",
        "/project/.claude/skills/web-framework-react",
      );
      expect(remove).toHaveBeenCalledWith("/project/.claude/skills/_archived/web-framework-react");
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Restored"));
    });

    it("returns false when copy fails (e.g. no archive exists)", async () => {
      vi.mocked(copy).mockRejectedValueOnce(ENOENT_ERROR);

      const result = await restoreArchivedSkill("/project", "web-framework-react" as SkillId);

      expect(result).toBe(false);
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks path traversal and returns false", async () => {
      const result = await restoreArchivedSkill(
        "/project",
        "web-traversal-../../dangerous" as SkillId,
      );

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("blocks null byte injection and returns false", async () => {
      const result = await restoreArchivedSkill(
        "/project",
        "web-skill-name\0../../passwd" as SkillId,
      );

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(copy).not.toHaveBeenCalled();
    });

    it("restores custom skill IDs registered via extendSchemasWithCustomValues()", async () => {
      extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });

      const result = await restoreArchivedSkill("/project", "acme-pipeline-deploy" as SkillId);

      expect(result).toBe(true);
      expect(copy).toHaveBeenCalledWith(
        "/project/.claude/skills/_archived/acme-pipeline-deploy",
        "/project/.claude/skills/acme-pipeline-deploy",
      );
      expect(remove).toHaveBeenCalledWith("/project/.claude/skills/_archived/acme-pipeline-deploy");
      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Restored"));

      resetSchemaExtensions();
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

    it("blocks path traversal and returns false", async () => {
      const result = await hasArchivedSkill("/project", "web-traversal-../../dangerous" as SkillId);

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(directoryExists).not.toHaveBeenCalled();
    });

    it("blocks null byte injection and returns false", async () => {
      const result = await hasArchivedSkill("/project", "web-skill-name\0../../passwd" as SkillId);

      expect(result).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(directoryExists).not.toHaveBeenCalled();
    });

    it("checks archive for custom skill IDs registered via extendSchemasWithCustomValues()", async () => {
      extendSchemasWithCustomValues({ skillIds: ["acme-pipeline-deploy"] });
      vi.mocked(directoryExists).mockResolvedValue(true);

      const result = await hasArchivedSkill("/project", "acme-pipeline-deploy" as SkillId);

      expect(result).toBe(true);
      expect(directoryExists).toHaveBeenCalledWith(
        "/project/.claude/skills/_archived/acme-pipeline-deploy",
      );

      resetSchemaExtensions();
    });
  });
});
