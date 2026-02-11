import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SkillId } from "../../types";

// Mock file system and logger (manual mocks from __mocks__ directories)
vi.mock("../../utils/fs");
vi.mock("../../utils/logger");

// Mock versioning
vi.mock("../versioning", () => ({
  hashFile: vi.fn(),
  getCurrentDate: vi.fn().mockReturnValue("2026-01-15"),
}));

import {
  readForkedFromMetadata,
  getLocalSkillsWithMetadata,
  computeSourceHash,
  compareSkills,
  injectForkedFromMetadata,
} from "./skill-metadata";
import { fileExists, readFile, writeFile, listDirectories } from "../../utils/fs";
import { hashFile } from "../versioning";
import { warn } from "../../utils/logger";
import { stringify as stringifyYaml } from "yaml";

// =============================================================================
// Fixtures
// =============================================================================

function createValidMetadataYaml(skillId: string, contentHash: string, date: string): string {
  return stringifyYaml({
    forked_from: {
      skill_id: skillId,
      content_hash: contentHash,
      date,
    },
  });
}

function createMetadataWithoutForkedFrom(): string {
  return stringifyYaml({
    version: 1,
    author: "@test",
  });
}

function createMetadataWithSchemaComment(skillId: string, contentHash: string): string {
  return `# yaml-language-server: $schema=../schema.json\n${createValidMetadataYaml(skillId, contentHash, "2026-01-01")}`;
}

// =============================================================================
// Tests
// =============================================================================

describe("skill-metadata", () => {
  describe("readForkedFromMetadata", () => {
    it("returns forked_from metadata when metadata.yaml exists and is valid", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", "abc1234", "2026-01-01"),
      );

      const result = await readForkedFromMetadata("/project/.claude/skills/react");

      expect(result).toEqual({
        skill_id: "web-framework-react",
        content_hash: "abc1234",
        date: "2026-01-01",
      });
      expect(fileExists).toHaveBeenCalledWith("/project/.claude/skills/react/metadata.yaml");
    });

    it("returns null when metadata.yaml does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await readForkedFromMetadata("/project/.claude/skills/react");

      expect(result).toBeNull();
      expect(readFile).not.toHaveBeenCalled();
    });

    it("returns null when metadata.yaml has no forked_from field", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(createMetadataWithoutForkedFrom());

      const result = await readForkedFromMetadata("/project/.claude/skills/react");

      expect(result).toBeNull();
    });

    it("returns null and warns when metadata.yaml has invalid data", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(
        stringifyYaml({
          forked_from: {
            // Missing required fields: skill_id, content_hash, date
            invalid_field: "bad",
          },
        }),
      );

      const result = await readForkedFromMetadata("/project/.claude/skills/react");

      expect(result).toBeNull();
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("Invalid metadata.yaml"));
    });

    it("returns null and warns when forked_from has wrong types", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(readFile).mockResolvedValue(
        stringifyYaml({
          forked_from: {
            skill_id: 123, // Should be string
            content_hash: "abc",
            date: "2026-01-01",
          },
        }),
      );

      const result = await readForkedFromMetadata("/project/.claude/skills/react");

      expect(result).toBeNull();
      expect(warn).toHaveBeenCalled();
    });
  });

  describe("getLocalSkillsWithMetadata", () => {
    it("returns empty map when local skills directory does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await getLocalSkillsWithMetadata("/project");

      expect(result.size).toBe(0);
    });

    it("returns skills with forked_from metadata", async () => {
      // First call: check if .claude/skills exists
      // Second call: check if metadata.yaml exists for "react" skill
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true); // metadata.yaml
      vi.mocked(listDirectories).mockResolvedValue(["react"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", "abc1234", "2026-01-01"),
      );

      const result = await getLocalSkillsWithMetadata("/project");

      expect(result.size).toBe(1);
      // Key is the skill_id from forked_from metadata
      expect(result.has("web-framework-react")).toBe(true);
      const entry = result.get("web-framework-react");
      expect(entry?.dirName).toBe("react");
      expect(entry?.forkedFrom).toEqual({
        skill_id: "web-framework-react",
        content_hash: "abc1234",
        date: "2026-01-01",
      });
    });

    it("uses directory name as key when no forked_from metadata", async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true); // metadata.yaml
      vi.mocked(listDirectories).mockResolvedValue(["custom-skill"]);
      vi.mocked(readFile).mockResolvedValue(createMetadataWithoutForkedFrom());

      const result = await getLocalSkillsWithMetadata("/project");

      expect(result.size).toBe(1);
      expect(result.has("custom-skill")).toBe(true);
      expect(result.get("custom-skill")?.forkedFrom).toBeNull();
    });

    it("handles multiple skills with mixed metadata", async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true) // metadata.yaml for react
        .mockResolvedValueOnce(false); // no metadata.yaml for custom
      vi.mocked(listDirectories).mockResolvedValue(["react", "custom"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", "abc1234", "2026-01-01"),
      );

      const result = await getLocalSkillsWithMetadata("/project");

      expect(result.size).toBe(2);
      expect(result.has("web-framework-react")).toBe(true);
      expect(result.has("custom")).toBe(true);
      expect(result.get("custom")?.forkedFrom).toBeNull();
    });
  });

  describe("computeSourceHash", () => {
    it("returns hash when SKILL.md exists at source path", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(hashFile).mockResolvedValue("abc1234");

      const result = await computeSourceHash("/source", "web/framework/react");

      expect(result).toBe("abc1234");
      expect(hashFile).toHaveBeenCalledWith("/source/src/web/framework/react/SKILL.md");
    });

    it("returns null when SKILL.md does not exist", async () => {
      vi.mocked(fileExists).mockResolvedValue(false);

      const result = await computeSourceHash("/source", "web/framework/react");

      expect(result).toBeNull();
      expect(hashFile).not.toHaveBeenCalled();
    });

    it("computes hash for correct file path", async () => {
      vi.mocked(fileExists).mockResolvedValue(true);
      vi.mocked(hashFile).mockResolvedValue("def5678");

      await computeSourceHash("/my/source", "api/database/drizzle");

      expect(fileExists).toHaveBeenCalledWith("/my/source/src/api/database/drizzle/SKILL.md");
    });
  });

  describe("compareSkills", () => {
    it("returns local-only status for skills without forked_from", async () => {
      // Mock getLocalSkillsWithMetadata (via its dependencies)
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir exists
        .mockResolvedValueOnce(false); // no metadata.yaml
      vi.mocked(listDirectories).mockResolvedValue(["custom-skill"]);

      const result = await compareSkills("/project", "/source", {});

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("local-only");
      expect(result[0].localHash).toBeNull();
      expect(result[0].sourceHash).toBeNull();
      expect(result[0].dirName).toBe("custom-skill");
    });

    it("returns current status when hashes match", async () => {
      const MATCHING_HASH = "abc1234";

      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true) // metadata.yaml
        .mockResolvedValueOnce(true); // SKILL.md at source
      vi.mocked(listDirectories).mockResolvedValue(["react"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", MATCHING_HASH, "2026-01-01"),
      );
      vi.mocked(hashFile).mockResolvedValue(MATCHING_HASH);

      const sourceSkills = {
        "web-framework-react": { path: "web/framework/react" },
      };

      const result = await compareSkills("/project", "/source", sourceSkills);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("current");
      expect(result[0].localHash).toBe(MATCHING_HASH);
      expect(result[0].sourceHash).toBe(MATCHING_HASH);
      expect(result[0].id).toBe("web-framework-react");
    });

    it("returns outdated status when hashes differ", async () => {
      const LOCAL_HASH = "abc1234";
      const SOURCE_HASH = "def5678";

      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true) // metadata.yaml
        .mockResolvedValueOnce(true); // SKILL.md at source
      vi.mocked(listDirectories).mockResolvedValue(["react"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", LOCAL_HASH, "2026-01-01"),
      );
      vi.mocked(hashFile).mockResolvedValue(SOURCE_HASH);

      const sourceSkills = {
        "web-framework-react": { path: "web/framework/react" },
      };

      const result = await compareSkills("/project", "/source", sourceSkills);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("outdated");
      expect(result[0].localHash).toBe(LOCAL_HASH);
      expect(result[0].sourceHash).toBe(SOURCE_HASH);
    });

    it("returns local-only when forked source skill no longer exists in source", async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true); // metadata.yaml
      vi.mocked(listDirectories).mockResolvedValue(["react"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", "abc1234", "2026-01-01"),
      );

      // Source skills does NOT include web-framework-react
      const sourceSkills = {
        "web-framework-vue": { path: "web/framework/vue" },
      };

      const result = await compareSkills("/project", "/source", sourceSkills);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("local-only");
      expect(result[0].id).toBe("web-framework-react");
    });

    it("returns local-only when source SKILL.md does not exist", async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true) // metadata.yaml
        .mockResolvedValueOnce(false); // SKILL.md NOT at source
      vi.mocked(listDirectories).mockResolvedValue(["react"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", "abc1234", "2026-01-01"),
      );

      const sourceSkills = {
        "web-framework-react": { path: "web/framework/react" },
      };

      const result = await compareSkills("/project", "/source", sourceSkills);

      expect(result).toHaveLength(1);
      expect(result[0].status).toBe("local-only");
      expect(result[0].sourceHash).toBeNull();
    });

    it("returns results sorted by skill ID", async () => {
      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(false) // no metadata.yaml for "zustand"
        .mockResolvedValueOnce(false); // no metadata.yaml for "auth"
      vi.mocked(listDirectories).mockResolvedValue(["zustand", "auth"]);

      const result = await compareSkills("/project", "/source", {});

      expect(result).toHaveLength(2);
      // Sorted alphabetically: "auth" before "zustand"
      expect(result[0].dirName).toBe("auth");
      expect(result[1].dirName).toBe("zustand");
    });

    it("returns empty array when no local skills exist", async () => {
      vi.mocked(fileExists).mockResolvedValueOnce(false); // .claude/skills dir doesn't exist

      const result = await compareSkills("/project", "/source", {});

      expect(result).toHaveLength(0);
    });

    it("includes sourcePath for matched skills", async () => {
      const MATCHING_HASH = "abc1234";

      vi.mocked(fileExists)
        .mockResolvedValueOnce(true) // .claude/skills dir
        .mockResolvedValueOnce(true) // metadata.yaml
        .mockResolvedValueOnce(true); // SKILL.md at source
      vi.mocked(listDirectories).mockResolvedValue(["react"]);
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("web-framework-react", MATCHING_HASH, "2026-01-01"),
      );
      vi.mocked(hashFile).mockResolvedValue(MATCHING_HASH);

      const sourceSkills = {
        "web-framework-react": { path: "web/framework/react" },
      };

      const result = await compareSkills("/project", "/source", sourceSkills);

      expect(result[0].sourcePath).toBe("web/framework/react");
    });
  });

  describe("injectForkedFromMetadata", () => {
    it("injects forked_from metadata into existing metadata.yaml", async () => {
      vi.mocked(readFile).mockResolvedValue(createMetadataWithoutForkedFrom());

      await injectForkedFromMetadata(
        "/project/.claude/skills/react",
        "web-framework-react" as SkillId,
        "abc1234",
      );

      expect(writeFile).toHaveBeenCalledWith(
        "/project/.claude/skills/react/metadata.yaml",
        expect.stringContaining("forked_from"),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("web-framework-react"),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("abc1234"),
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining("2026-01-15"), // From mocked getCurrentDate
      );
    });

    it("updates existing forked_from metadata", async () => {
      vi.mocked(readFile).mockResolvedValue(
        createValidMetadataYaml("old-skill-id", "old-hash", "2025-01-01"),
      );

      await injectForkedFromMetadata("/dest", "web-framework-react" as SkillId, "new-hash");

      const writtenContent = vi.mocked(writeFile).mock.calls[0][1];
      expect(writtenContent).toContain("web-framework-react");
      expect(writtenContent).toContain("new-hash");
      expect(writtenContent).not.toContain("old-skill-id");
      expect(writtenContent).not.toContain("old-hash");
    });

    it("strips yaml-language-server schema comment before parsing", async () => {
      vi.mocked(readFile).mockResolvedValue(
        createMetadataWithSchemaComment("web-framework-react", "abc1234"),
      );

      await injectForkedFromMetadata("/dest", "web-framework-react" as SkillId, "new-hash");

      // Should successfully write (no parse error from schema comment)
      expect(writeFile).toHaveBeenCalledTimes(1);
      const writtenContent = vi.mocked(writeFile).mock.calls[0][1];
      expect(writtenContent).toContain("new-hash");
    });

    it("throws when metadata.yaml contains unparseable YAML", async () => {
      vi.mocked(readFile).mockResolvedValue("not: [valid: yaml: {broken");

      await expect(
        injectForkedFromMetadata("/dest", "web-framework-react" as SkillId, "abc1234"),
      ).rejects.toThrow();
    });

    it("reads from correct metadata.yaml path", async () => {
      vi.mocked(readFile).mockResolvedValue(createMetadataWithoutForkedFrom());

      await injectForkedFromMetadata(
        "/project/skills/react",
        "web-framework-react" as SkillId,
        "abc1234",
      );

      expect(readFile).toHaveBeenCalledWith("/project/skills/react/metadata.yaml");
    });
  });
});
