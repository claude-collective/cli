import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillId } from "../../types";

vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

import { deleteLocalSkill } from "./source-switcher";
import { remove } from "../../utils/fs";
import { verbose, warn } from "../../utils/logger";

describe("source-switcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("deleteLocalSkill", () => {
    it("calls remove() with correct skill path", async () => {
      await deleteLocalSkill("/project", "web-framework-react");

      expect(remove).toHaveBeenCalledWith("/project/.claude/skills/web-framework-react");
    });

    it("logs verbose message on success", async () => {
      await deleteLocalSkill("/project", "web-framework-react");

      expect(verbose).toHaveBeenCalledWith(expect.stringContaining("Deleted"));
    });

    it("silently handles missing skill directory", async () => {
      vi.mocked(remove).mockRejectedValueOnce(new Error("ENOENT: no such file or directory"));

      await deleteLocalSkill("/project", "web-framework-react");

      expect(warn).not.toHaveBeenCalled();
    });

    it("blocks path traversal in skill ID", async () => {
      // Boundary cast: deliberately invalid skill ID for security testing
      await deleteLocalSkill("/project", "web-traversal-../../dangerous" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks skill ID with forward slashes", async () => {
      // Boundary cast: deliberately invalid skill ID for security testing
      await deleteLocalSkill("/project", "web-framework-react/../../etc" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks skill ID with backslashes", async () => {
      // Boundary cast: deliberately invalid skill ID for security testing
      await deleteLocalSkill("/project", "web-framework-react\\..\\..\\etc" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks null byte injection", async () => {
      // Boundary cast: deliberately invalid skill ID for security testing
      await deleteLocalSkill("/project", "web-skill-name\0../../passwd" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks skill ID with uppercase characters", async () => {
      await deleteLocalSkill("/project", "Not-Valid-Id" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("blocks skill ID starting with a number", async () => {
      await deleteLocalSkill("/project", "123-invalid" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });

    it("rejects skill IDs without a valid domain prefix", async () => {
      // "acme-pipeline-deploy" doesn't match SKILL_ID_PATTERN (acme is not a valid domain prefix)
      await deleteLocalSkill("/project", "acme-pipeline-deploy" as SkillId);

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid skill ID"));
      expect(remove).not.toHaveBeenCalled();
    });
  });
});
