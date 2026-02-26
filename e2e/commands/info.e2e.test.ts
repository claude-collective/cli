import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createEditableProject,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, STANDARD_DIRS, STANDARD_FILES, SKILLS_DIR_PATH } from "../../src/cli/consts.js";
import type { SkillId } from "../../src/cli/types/index.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

const SKILL_ID: SkillId = "web-testing-info-e2e";

/**
 * Creates a minimal skills source directory that the `info` command can load.
 *
 * The source loader expects:
 *   <sourceDir>/src/skills/<skillId>/SKILL.md
 *   <sourceDir>/src/skills/<skillId>/metadata.yaml (with category, author, cliName, cliDescription)
 */
async function createSkillSource(
  tempDir: string,
): Promise<{ sourceDir: string; skillId: SkillId }> {
  const sourceDir = path.join(tempDir, "source");
  const skillDir = path.join(sourceDir, SKILLS_DIR_PATH, SKILL_ID);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, STANDARD_FILES.SKILL_MD),
    `---
name: ${SKILL_ID}
description: A test skill for info E2E
tags:
  - test
  - e2e
author: "@test"
---

# Info Test Skill

This is test content for the info command E2E tests.
`,
  );

  await writeFile(
    path.join(skillDir, STANDARD_FILES.METADATA_YAML),
    `category: web-testing
author: "@test"
cliName: info-e2e
cliDescription: A test skill for info E2E
contentHash: "e2e-info-test-hash"
`,
  );

  return { sourceDir, skillId: SKILL_ID };
}

describe("info command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("help", () => {
    it("should display info help text", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["info", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("USAGE");
      expect(stdout).toContain("SKILL");
      expect(stdout).toContain("--source");
      expect(stdout).toContain("--preview");
      expect(stdout).toContain("Skill ID or alias to look up");
    });
  });

  describe("missing arguments", () => {
    it("should error when no skill argument is provided", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(["info"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(combined).toContain("Missing 1 required arg");
      expect(combined).toContain("skill");
    });
  });

  describe("with valid source", () => {
    it("should display skill information", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(`Skill: ${skillId}`);
      expect(stdout).toContain("Author: @test");
      expect(stdout).toContain("Category: web-testing");
      expect(stdout).toContain("Description:");
      expect(stdout).toContain("A test skill for info E2E");
    });

    it("should show local status as not installed", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Local Status: Not installed");
    });

    it("should show local status as installed when skill exists locally", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const projectDir = await createEditableProject(tempDir, {
        skills: [skillId],
      });

      // createEditableProject metadata lacks cliName required by discoverLocalSkills.
      // Overwrite with complete metadata so the local skill is discovered.
      const localSkillMetadataPath = path.join(
        projectDir,
        CLAUDE_DIR,
        STANDARD_DIRS.SKILLS,
        skillId,
        STANDARD_FILES.METADATA_YAML,
      );
      await writeFile(
        localSkillMetadataPath,
        `category: web-testing\nauthor: "@test"\ncliName: info-e2e\ncontentHash: "e2e-hash"\n`,
      );

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        projectDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Local Status: Installed");
    });
  });

  describe("nonexistent skill", () => {
    it("should error when skill is not found", async () => {
      tempDir = await createTempDir();
      const { sourceDir } = await createSkillSource(tempDir);

      const { exitCode, combined } = await runCLI(
        ["info", "nonexistent-skill-xyz", "--source", sourceDir],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("not found");
    });

    it("should suggest search command when skill is not found", async () => {
      tempDir = await createTempDir();
      const { sourceDir } = await createSkillSource(tempDir);

      const { exitCode, combined } = await runCLI(
        ["info", "nonexistent-skill-xyz", "--source", sourceDir],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("search");
    });
  });

  describe("relationship display", () => {
    it("should show requires, conflicts, and recommends sections", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Requires:");
      expect(stdout).toContain("Conflicts with:");
      expect(stdout).toContain("Recommends:");
    });
  });

  describe("with E2E source", () => {
    it("should display skill details from E2E source", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, stdout } = await runCLI(
        ["info", "web-framework-react", "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Skill: web-framework-react");
      expect(stdout).toContain("Category: web-framework");
      expect(stdout).toContain("Description:");
      expect(stdout).toContain("React framework for building user interfaces");
    });

    it("should display author from E2E source skill", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, stdout } = await runCLI(
        ["info", "web-testing-vitest", "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Author: @agents-inc");
    });
  });

  describe("content preview", () => {
    it("should succeed with preview enabled (default)", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(`Skill: ${skillId}`);
      expect(stdout).toContain("Description:");
    });

    it("should hide content preview with --no-preview", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).not.toContain("Content Preview");
    });
  });

  describe("metadata display", () => {
    it("should show tags in skill info", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await runCLI(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Tags:");
      expect(stdout).toContain("test");
      expect(stdout).toContain("e2e");
    });
  });

  describe("partial match suggestions", () => {
    it("should suggest similar skills when partial ID matches", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, combined } = await runCLI(
        ["info", "web-framework", "--source", sourceDir],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("not found");
      expect(combined).toContain("Did you mean");
      expect(combined).toContain("web-framework-react");
    });

    it("should suggest methodology skills when querying meta", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, combined } = await runCLI(
        ["info", "meta-methodology", "--source", sourceDir],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("not found");
      expect(combined).toContain("Did you mean");
      expect(combined).toContain("meta-methodology-");
    });
  });
});
