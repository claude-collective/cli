import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { renderSkillMd } from "../../src/cli/lib/__tests__/content-generators.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import {
  SKILL_CATEGORIES_PATH,
  SKILL_RULES_PATH,
  SKILLS_DIR_PATH,
  STANDARD_FILES,
} from "../../src/cli/consts.js";

describe("validate command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("source validation", () => {
    it("should fail when source directory does not exist", async () => {
      tempDir = await createTempDir();
      const nonexistentDir = path.join(tempDir, "nonexistent");

      const { exitCode, combined } = await runCLI(
        ["validate", "--source", nonexistentDir],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("does not exist");
    });

    it("should report error for empty source directory without skills structure", async () => {
      tempDir = await createTempDir();

      const { exitCode, combined } = await runCLI(["validate", "--source", tempDir], tempDir);

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("Checked 0 skill(s)");
      expect(combined).toContain("1 error(s)");
    });
  });

  describe("plugin validation", () => {
    it("should fail when validating a nonexistent plugin path", async () => {
      tempDir = await createTempDir();
      const nonexistentPlugin = path.join(tempDir, "no-such-plugin");

      const { exitCode, combined } = await runCLI(["validate", nonexistentPlugin], tempDir);

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("Validating plugin:");
    });

    it("should fail when validating an empty directory as plugin", async () => {
      tempDir = await createTempDir();
      const emptyPluginDir = path.join(tempDir, "empty-plugin");
      await mkdir(emptyPluginDir, { recursive: true });

      const { exitCode, combined } = await runCLI(["validate", emptyPluginDir], tempDir);

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("Validating plugin:");
    });
  });

  describe("help", () => {
    it("should display validate help", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await runCLI(["validate", "--help"], tempDir);

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Validate");
      expect(stdout).toContain("--source");
      expect(stdout).toContain("--plugins");
    });
  });

  describe("E2E source validation", () => {
    it("should validate a source and report skill count", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // E2E source metadata is incomplete (missing cliDescription, usageGuidance),
      // so validate correctly reports errors and exits 1
      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("Validating source:");
      expect(combined).toMatch(/Checked \d+ skill\(s\)/);
    });

    it("should report error and warning counts for a source", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // E2E source has validation errors from incomplete metadata
      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toMatch(/Result: \d+ error\(s\), \d+ warning\(s\)/);
    });

    it("should report zero errors for a fully valid source", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "valid-source");
      const skillDir = path.join(sourceDir, SKILLS_DIR_PATH, "web-valid-skill");
      await mkdir(skillDir, { recursive: true });

      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-valid-skill", "A fully valid test skill", "# Valid Skill"),
      );

      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        [
          `author: "@test"`,
          `category: web-testing`,
          `slug: vitest`,
          `displayName: web-valid-skill`,
          `cliDescription: A fully valid test skill`,
          `usageGuidance: Use for testing`,
          `contentHash: "abc1234"`,
        ].join("\n") + "\n",
      );

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      expect(combined).toContain("Checked 1 skill(s)");
      expect(combined).toContain("0 error(s)");
    });
  });

  describe("invalid YAML", () => {
    it("should detect malformed metadata.yaml", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "bad-source");
      const skillDir = path.join(sourceDir, SKILLS_DIR_PATH, "web-bad-skill");
      await mkdir(skillDir, { recursive: true });

      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-bad-skill", "A broken skill", "# Bad Skill"),
      );

      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        `{{{invalid yaml content\n  broken: [unmatched`,
      );

      const { exitCode, combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("1 error(s)");
    });

    it("should detect missing required metadata fields", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "incomplete-source");
      const skillDir = path.join(sourceDir, SKILLS_DIR_PATH, "web-incomplete-skill");
      await mkdir(skillDir, { recursive: true });

      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-incomplete-skill", "Missing fields", "# Incomplete"),
      );

      // metadata.yaml with no required fields
      await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), `someRandomKey: value\n`);

      const { exitCode, combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("error");
    });
  });

  describe("plugin validation with built plugins", () => {
    it("should validate plugins after building from E2E source", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode: buildExitCode, stdout: buildStdout } = await runCLI(
        ["build", "plugins"],
        sourceDir,
      );
      expect(buildExitCode).toBe(EXIT_CODES.SUCCESS);
      expect(buildStdout).toContain("Plugin compilation complete!");

      const { exitCode, combined } = await runCLI(["validate", "--plugins"], sourceDir);

      // E2E source metadata is incomplete, so built plugins have validation errors
      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("Validating plugin");
    });
  });

  describe("verbose output", () => {
    it("should show additional details with --verbose on plugin validation", async () => {
      tempDir = await createTempDir();
      const emptyPluginDir = path.join(tempDir, "empty-plugin");
      await mkdir(emptyPluginDir, { recursive: true });

      const { exitCode, combined } = await runCLI(
        ["validate", emptyPluginDir, "--verbose"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(combined).toContain("Validating plugin:");
    });
  });

  describe("source override with --source flag", () => {
    it("should validate E2E source skills via --source flag and report exact skill count", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // E2E source has exactly 10 skills across web, api, and shared domains
      expect(combined).toContain("Checked 10 skill(s)");
      expect(combined).toContain("Validating source:");
    });
  });

  describe("relationship metadata validation", () => {
    it("should detect unresolved relationship references via matrix health check", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "rel-source");

      // Create two valid skills with domain field (required by rawMetadataSchema)
      const skillADir = path.join(
        sourceDir,
        SKILLS_DIR_PATH,
        "web-framework",
        "web-framework-alpha",
      );
      const skillBDir = path.join(sourceDir, SKILLS_DIR_PATH, "web-testing", "web-testing-beta");
      await mkdir(skillADir, { recursive: true });
      await mkdir(skillBDir, { recursive: true });

      await writeFile(
        path.join(skillADir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-framework-alpha", "Alpha framework skill", "# Alpha"),
      );
      await writeFile(
        path.join(skillADir, STANDARD_FILES.METADATA_YAML),
        [
          `author: "@test"`,
          `category: web-framework`,
          `domain: web`,
          `slug: react`,
          `displayName: web-framework-alpha`,
          `cliDescription: Alpha framework for testing`,
          `usageGuidance: Use for testing relationship validation`,
          `contentHash: "ab12cd3"`,
        ].join("\n") + "\n",
      );

      await writeFile(
        path.join(skillBDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-testing-beta", "Beta testing skill", "# Beta"),
      );
      await writeFile(
        path.join(skillBDir, STANDARD_FILES.METADATA_YAML),
        [
          `author: "@test"`,
          `category: web-testing`,
          `domain: web`,
          `slug: vitest`,
          `displayName: web-testing-beta`,
          `cliDescription: Beta testing framework`,
          `usageGuidance: Use for testing relationship validation`,
          `contentHash: "de45fa6"`,
        ].join("\n") + "\n",
      );

      // Create skill-categories.ts with full CategoryDefinition objects
      const categoriesDir = path.join(sourceDir, path.dirname(SKILL_CATEGORIES_PATH));
      await mkdir(categoriesDir, { recursive: true });
      await writeFile(
        path.join(sourceDir, SKILL_CATEGORIES_PATH),
        `export default {
  version: "1.0.0",
  categories: {
    "web-framework": {
      id: "web-framework",
      displayName: "Framework",
      description: "Web frameworks",
      domain: "web",
      exclusive: true,
      required: false,
      order: 1,
    },
    "web-testing": {
      id: "web-testing",
      displayName: "Testing",
      description: "Testing tools",
      domain: "web",
      exclusive: false,
      required: false,
      order: 2,
    },
  },
};\n`,
      );

      // Create skill-rules.ts with a conflict referencing a slug not present in this source.
      // The matrix health check should detect the unresolved reference.
      await writeFile(
        path.join(sourceDir, SKILL_RULES_PATH),
        `export default {
  version: "1.0.0",
  aliases: {},
  relationships: {
    conflicts: [
      {
        skills: ["react", "angular-standalone"],
        reason: "Testing unresolved reference detection",
      },
    ],
    discourages: [],
    recommends: [],
    requires: [],
    alternatives: [],
  },
};\n`,
      );

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // Slug resolution should detect the unresolved slug (angular-standalone not in source)
      expect(combined).toContain("Checked 2 skill(s)");
      expect(combined).toContain("Unresolved slug");
      expect(combined).toContain("angular-standalone");
    });
  });

  describe("duplicate skill IDs", () => {
    // BUG: The source validator does not detect duplicate skill IDs across categories.
    // When the same skill ID appears in two different category directories, the second
    // silently overwrites the first during matrix merging. The validator should detect
    // and report this as an error or warning.
    it.fails("should detect duplicate skill IDs across different categories", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "dup-source");

      // Create the same skill ID under two different category directories
      const skillDirA = path.join(
        sourceDir,
        SKILLS_DIR_PATH,
        "web-framework",
        "web-framework-react",
      );
      const skillDirB = path.join(sourceDir, SKILLS_DIR_PATH, "web-testing", "web-framework-react");
      await mkdir(skillDirA, { recursive: true });
      await mkdir(skillDirB, { recursive: true });

      // First occurrence under web-framework category
      await writeFile(
        path.join(skillDirA, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-framework-react", "React in framework category", "# React (framework)"),
      );
      await writeFile(
        path.join(skillDirA, STANDARD_FILES.METADATA_YAML),
        [
          `author: "@test"`,
          `category: web-framework`,
          `slug: react`,
          `displayName: web-framework-react`,
          `cliDescription: React framework skill`,
          `usageGuidance: Use for building React applications`,
          `contentHash: "react-fw"`,
        ].join("\n") + "\n",
      );

      // Second occurrence under web-testing category (same skill ID)
      await writeFile(
        path.join(skillDirB, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-framework-react", "React in testing category", "# React (testing)"),
      );
      await writeFile(
        path.join(skillDirB, STANDARD_FILES.METADATA_YAML),
        [
          `author: "@test"`,
          `category: web-testing`,
          `slug: react`,
          `displayName: web-framework-react`,
          `cliDescription: React testing skill`,
          `usageGuidance: Use for testing React applications`,
          `contentHash: "react-test"`,
        ].join("\n") + "\n",
      );

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // Validator should detect the duplicate skill ID and report it
      expect(combined).toContain("duplicate");
      expect(combined).toContain("web-framework-react");
    });
  });
});
