import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES, DIRS, FILES, SOURCE_PATHS } from "../pages/constants.js";
import { createTempDir, cleanupTempDir, ensureBinaryExists } from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLI } from "../fixtures/cli.js";
import type { SkillId } from "../../src/cli/types/index.js";

const SKILL_ID = "web-testing-info-e2e";

/**
 * Creates a minimal skills source directory that the `info` command can load.
 *
 * The source loader expects:
 *   <sourceDir>/src/skills/<skillId>/SKILL.md
 *   <sourceDir>/src/skills/<skillId>/metadata.yaml (with category, author, displayName, cliDescription)
 */
async function createSkillSource(
  tempDir: string,
  options?: {
    skillId?: string;
    skillMd?: string;
    metadataYaml?: string;
    description?: string;
  },
): Promise<{ sourceDir: string; skillId: SkillId }> {
  const skillId = (options?.skillId ?? SKILL_ID) as SkillId; // fabricated E2E test ID
  const description = options?.description ?? "A test skill for info E2E";
  const sourceDir = path.join(tempDir, "source");
  const skillDir = path.join(sourceDir, SOURCE_PATHS.SKILLS_DIR, skillId);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, FILES.SKILL_MD),
    options?.skillMd ??
      `---
name: ${skillId}
description: ${description}
author: "@test"
---

# Info Test Skill

This is test content for the info command E2E tests.
`,
  );

  await writeFile(
    path.join(skillDir, FILES.METADATA_YAML),
    options?.metadataYaml ??
      `category: web-testing
domain: web
slug: info-e2e
author: "@test"
displayName: info-e2e
cliDescription: ${description}
contentHash: "e2e-info-test-hash"
`,
  );

  return { sourceDir, skillId };
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

      const { exitCode, stdout } = await CLI.run(["info", "--help"], { dir: tempDir });

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

      const { exitCode, output } = await CLI.run(["info"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
      expect(output).toContain("Missing 1 required arg");
      expect(output).toContain("skill");
    });
  });

  describe("with valid source", () => {
    it("should display skill information", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await CLI.run(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
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

      const { exitCode, stdout } = await CLI.run(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Local Status: Not installed");
    });

    it("should show local status as installed when skill exists locally", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const project = await ProjectBuilder.editable({
        skills: [skillId],
      });
      tempDir = path.dirname(project.dir);
      const projectDir = project.dir;

      // ProjectBuilder.editable metadata lacks displayName required by discoverLocalSkills.
      // Overwrite with complete metadata so the local skill is discovered.
      const localSkillMetadataPath = path.join(
        projectDir,
        DIRS.CLAUDE,
        DIRS.SKILLS,
        skillId,
        FILES.METADATA_YAML,
      );
      await writeFile(
        localSkillMetadataPath,
        `category: web-testing\nauthor: "@test"\ndomain: web\ndisplayName: info-e2e\nslug: info-e2e\ncontentHash: "e2e-hash"\n`,
      );

      const { exitCode, stdout } = await CLI.run(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        { dir: projectDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Local Status: Installed");
    });
  });

  describe("nonexistent skill", () => {
    it("should error when skill is not found", async () => {
      tempDir = await createTempDir();
      const { sourceDir } = await createSkillSource(tempDir);

      const { exitCode, output } = await CLI.run(
        ["info", "nonexistent-skill-xyz", "--source", sourceDir],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("not found");
    });

    it("should suggest search command when skill is not found", async () => {
      tempDir = await createTempDir();
      const { sourceDir } = await createSkillSource(tempDir);

      const { exitCode, output } = await CLI.run(
        ["info", "nonexistent-skill-xyz", "--source", sourceDir],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("search");
    });
  });

  describe("relationship display", () => {
    it("should show requires, conflicts, and recommends sections", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await CLI.run(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Requires:");
      expect(stdout).toContain("Conflicts with:");
      expect(stdout).toContain("Recommended:");
    });
  });

  describe("with E2E source", () => {
    it("should display skill details from E2E source", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, stdout } = await CLI.run(
        ["info", "web-framework-react", "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
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

      const { exitCode, stdout } = await CLI.run(
        ["info", "web-testing-vitest", "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Author: @agents-inc");
    });
  });

  describe("content preview", () => {
    it("should succeed with preview enabled (default)", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await CLI.run(["info", skillId, "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(`Skill: ${skillId}`);
      expect(stdout).toContain("Description:");
    });

    it("should hide content preview with --no-preview", async () => {
      tempDir = await createTempDir();
      const { sourceDir, skillId } = await createSkillSource(tempDir);

      const { exitCode, stdout } = await CLI.run(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).not.toContain("Content Preview");
    });
  });

  describe("invalid source", () => {
    it("should error when --source points to nonexistent path", async () => {
      tempDir = await createTempDir();

      const { exitCode, output } = await CLI.run(
        ["info", SKILL_ID, "--source", "/nonexistent/path/to/source"],
        { dir: tempDir },
      );

      expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe("long description", () => {
    it("should handle skill with very long description without crashing", async () => {
      tempDir = await createTempDir();

      const longDescription =
        "This is a very long description that exceeds five hundred characters to verify that the info command handles long descriptions properly without crashing. " +
        "It contains multiple sentences to simulate a realistic skill description that might be found in a production marketplace. " +
        "The description covers various aspects of the skill including its purpose, usage patterns, and integration points. " +
        "Additional content is included to push the total length well beyond the five hundred character threshold that was specified in the test plan. " +
        "This final sentence ensures we are comfortably over the limit.";

      const longSkillId = "web-testing-long-desc";
      const { sourceDir, skillId } = await createSkillSource(tempDir, {
        skillId: longSkillId,
        description: longDescription,
        skillMd: `---\nname: ${longSkillId}\ndescription: ${longDescription}\nauthor: "@test"\n---\n\n# Long Description Skill\n\n${longDescription}\n`,
        metadataYaml: `category: web-testing\ndomain: web\nslug: long-desc\nauthor: "@test"\ndisplayName: long-desc-test\ncliDescription: ${longDescription}\ncontentHash: "e2e-long-desc-hash"\n`,
      });

      const { exitCode, stdout } = await CLI.run(
        ["info", skillId, "--source", sourceDir, "--no-preview"],
        { dir: tempDir },
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain(`Skill: ${skillId}`);
      expect(stdout).toContain("Description:");
      expect(stdout).toContain(longDescription.slice(0, 50));
    });
  });

  describe("partial match suggestions", () => {
    it("should suggest similar skills when partial ID matches", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, output } = await CLI.run(["info", "web-framework", "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("not found");
      expect(output).toContain("Did you mean");
      expect(output).toContain("web-framework-react");
    });

    it("should suggest meta-reviewing skills when querying meta-reviewing", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, output } = await CLI.run(
        ["info", "meta-reviewing", "--source", sourceDir],
        {
          dir: tempDir,
        },
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("not found");
      expect(output).toContain("Did you mean");
      expect(output).toContain("meta-reviewing-");
    });
  });
});
