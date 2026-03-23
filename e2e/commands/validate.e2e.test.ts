import path from "path";
import { CLI } from "../fixtures/cli.js";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES, FILES, SOURCE_PATHS } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  renderSkillMd,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";

/** Create a minimal valid skill in a source directory for validation tests. */
async function createValidationSkill(
  sourceDir: string,
  skillId: string,
  options: {
    metadataYaml: string;
    skillMdContent?: string;
    /** Subdirectory under src/skills/ (defaults to skillId) */
    subPath?: string;
  },
): Promise<string> {
  const subPath = options.subPath ?? skillId;
  const skillDir = path.join(sourceDir, SOURCE_PATHS.SKILLS_DIR, subPath);
  await mkdir(skillDir, { recursive: true });

  await writeFile(
    path.join(skillDir, FILES.SKILL_MD),
    options.skillMdContent ?? renderSkillMd(skillId, `Test skill ${skillId}`, `# ${skillId}`),
  );

  await writeFile(path.join(skillDir, FILES.METADATA_YAML), options.metadataYaml);

  return skillDir;
}

describe("validate command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe("source validation", () => {
    it("should fail when source directory does not exist", async () => {
      tempDir = await createTempDir();
      const nonexistentDir = path.join(tempDir, "nonexistent");

      const { exitCode, output } = await CLI.run(["validate", "--source", nonexistentDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("does not exist");
    });

    it("should report error for empty source directory without skills structure", async () => {
      tempDir = await createTempDir();

      const { exitCode, output } = await CLI.run(["validate", "--source", tempDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Checked 0 skill(s)");
      expect(output).toContain("1 error(s)");
    });
  });

  describe("plugin validation", () => {
    it("should fail when validating a nonexistent plugin path", async () => {
      tempDir = await createTempDir();
      const nonexistentPlugin = path.join(tempDir, "no-such-plugin");

      const { exitCode, output } = await CLI.run(["validate", nonexistentPlugin], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Validating plugin:");
    });

    it("should fail when validating an empty directory as plugin", async () => {
      tempDir = await createTempDir();
      const emptyPluginDir = path.join(tempDir, "empty-plugin");
      await mkdir(emptyPluginDir, { recursive: true });

      const { exitCode, output } = await CLI.run(["validate", emptyPluginDir], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Validating plugin:");
    });
  });

  describe("help", () => {
    it("should display validate help", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["validate", "--help"], { dir: tempDir });

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

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      // E2E source metadata is complete — only displayName mismatch warnings for methodology skills
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Validating source:");
      expect(output).toMatch(/Checked \d+ skill\(s\)/);
    });

    it("should report error and warning counts for a source", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      // E2E source metadata is complete — methodology skills have displayName mismatches (warnings only)
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toMatch(/Result: 0 error\(s\), \d+ warning\(s\)/);
    });

    it("should report zero errors for a fully valid source", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "valid-source");

      await createValidationSkill(sourceDir, "web-valid-skill", {
        skillMdContent: renderSkillMd(
          "web-valid-skill",
          "A fully valid test skill",
          "# Valid Skill",
        ),
        metadataYaml:
          [
            `author: "@test"`,
            `category: web-testing`,
            `slug: vitest`,
            `displayName: web-valid-skill`,
            `cliDescription: A fully valid test skill`,
            `usageGuidance: Use for testing`,
            `contentHash: "abc1234"`,
          ].join("\n") + "\n",
      });

      const { output } = await CLI.run(["validate", "--source", sourceDir], { dir: tempDir });

      expect(output).toContain("Checked 1 skill(s)");
      expect(output).toContain("0 error(s)");
    });
  });

  describe("invalid YAML", () => {
    it("should detect malformed metadata.yaml", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "bad-source");

      await createValidationSkill(sourceDir, "web-bad-skill", {
        skillMdContent: renderSkillMd("web-bad-skill", "A broken skill", "# Bad Skill"),
        metadataYaml: `{{{invalid yaml content\n  broken: [unmatched`,
      });

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("1 error(s)");
    });

    it("should detect missing required metadata fields", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "incomplete-source");

      await createValidationSkill(sourceDir, "web-incomplete-skill", {
        skillMdContent: renderSkillMd("web-incomplete-skill", "Missing fields", "# Incomplete"),
        metadataYaml: `someRandomKey: value\n`,
      });

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("error");
    });
  });

  describe("plugin validation with built plugins", () => {
    it("should validate plugins after building from E2E source", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { exitCode: buildExitCode, stdout: buildStdout } = await CLI.run(["build", "plugins"], {
        dir: sourceDir,
      });
      expect(buildExitCode).toBe(EXIT_CODES.SUCCESS);
      expect(buildStdout).toContain("Plugin compilation complete!");

      const { exitCode, output } = await CLI.run(["validate", "--plugins"], { dir: sourceDir });

      // E2E source metadata is incomplete, so built plugins have validation errors
      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Validating plugin");
    });
  });

  describe("verbose output", () => {
    it("should show additional details with --verbose on plugin validation", async () => {
      tempDir = await createTempDir();
      const emptyPluginDir = path.join(tempDir, "empty-plugin");
      await mkdir(emptyPluginDir, { recursive: true });

      const { exitCode, output } = await CLI.run(["validate", emptyPluginDir, "--verbose"], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Validating plugin:");
    });
  });

  describe("source override with --source flag", () => {
    it("should validate E2E source skills via --source flag and report exact skill count", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      const { output } = await CLI.run(["validate", "--source", sourceDir], { dir: tempDir });

      // E2E source has exactly 7 skills across web, api, and shared domains
      expect(output).toContain("Checked 7 skill(s)");
      expect(output).toContain("Validating source:");
    });
  });

  describe("relationship metadata validation", () => {
    it("should detect unresolved relationship references via matrix health check", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "rel-source");

      // Create two valid skills with domain field (required by rawMetadataSchema)
      await createValidationSkill(sourceDir, "web-framework-alpha", {
        subPath: "web-framework/web-framework-alpha",
        metadataYaml:
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
      });

      await createValidationSkill(sourceDir, "web-testing-beta", {
        subPath: "web-testing/web-testing-beta",
        metadataYaml:
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
      });

      // Create skill-categories.ts with full CategoryDefinition objects
      const categoriesDir = path.join(sourceDir, path.dirname(SOURCE_PATHS.SKILL_CATEGORIES));
      await mkdir(categoriesDir, { recursive: true });
      await writeFile(
        path.join(sourceDir, SOURCE_PATHS.SKILL_CATEGORIES),
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
      order: 1 },
    "web-testing": {
      id: "web-testing",
      displayName: "Testing",
      description: "Testing tools",
      domain: "web",
      exclusive: false,
      required: false,
      order: 2 } } };\n`,
      );

      // Create skill-rules.ts with a conflict referencing a slug not present in this source.
      // The matrix health check should detect the unresolved reference.
      await writeFile(
        path.join(sourceDir, SOURCE_PATHS.SKILL_RULES),
        `export default {
  version: "1.0.0",
  aliases: {},
  relationships: {
    conflicts: [
      {
        skills: ["react", "angular-standalone"],
        reason: "Testing unresolved reference detection" },
    ],
    discourages: [],
    recommends: [],
    requires: [],
    alternatives: [] } };\n`,
      );

      const { output } = await CLI.run(["validate", "--source", sourceDir, "--verbose"], {
        dir: tempDir,
      });

      // Slug resolution should detect the unresolved slug (angular-standalone not in source)
      expect(output).toContain("Checked 2 skill(s)");
      expect(output).toContain("Unresolved slug");
      expect(output).toContain("angular-standalone");
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

      // First occurrence under web-framework category
      await createValidationSkill(sourceDir, "web-framework-react", {
        subPath: "web-framework/web-framework-react",
        skillMdContent: renderSkillMd(
          "web-framework-react",
          "React in framework category",
          "# React (framework)",
        ),
        metadataYaml:
          [
            `author: "@test"`,
            `category: web-framework`,
            `slug: react`,
            `displayName: web-framework-react`,
            `cliDescription: React framework skill`,
            `usageGuidance: Use for building React applications`,
            `contentHash: "react-fw"`,
          ].join("\n") + "\n",
      });

      // Second occurrence under web-testing category (same skill ID)
      await createValidationSkill(sourceDir, "web-framework-react", {
        subPath: "web-testing/web-framework-react",
        skillMdContent: renderSkillMd(
          "web-framework-react",
          "React in testing category",
          "# React (testing)",
        ),
        metadataYaml:
          [
            `author: "@test"`,
            `category: web-testing`,
            `slug: react`,
            `displayName: web-framework-react`,
            `cliDescription: React testing skill`,
            `usageGuidance: Use for testing React applications`,
            `contentHash: "react-test"`,
          ].join("\n") + "\n",
      });

      const { output } = await CLI.run(["validate", "--source", sourceDir], { dir: tempDir });

      // Validator should detect the duplicate skill ID and report it
      expect(output).toContain("duplicate");
      expect(output).toContain("web-framework-react");
    });
  });

  describe("--all flag with plugin directory", () => {
    it("should validate all plugins in directory after build", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      // Build plugins first
      const { exitCode: buildExitCode } = await CLI.run(["build", "plugins"], { dir: sourceDir });
      expect(buildExitCode).toBe(EXIT_CODES.SUCCESS);

      // Use --all to validate all built plugins in the plugin-manifest directory
      const pluginDir = path.join(sourceDir, "plugin-manifest");
      const { output } = await CLI.run(["validate", pluginDir, "--all"], { dir: sourceDir });

      // Should report plugin validation summary with total/valid/invalid counts
      expect(output).toContain("Validating all plugins in:");
      expect(output).toContain("Total plugins:");
      expect(output).toContain("Valid:");
      expect(output).toContain("Invalid:");
    });
  });

  describe("--plugins flag validates plugins in cwd", () => {
    it("should validate plugins in current directory when --plugins is used", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource();
      tempDir = sourceTempDir;

      // Build plugins first so there are plugin files to validate
      const { exitCode: buildExitCode } = await CLI.run(["build", "plugins"], { dir: sourceDir });
      expect(buildExitCode).toBe(EXIT_CODES.SUCCESS);

      // Validate plugins using --plugins flag (validates in cwd)
      const { output } = await CLI.run(["validate", "--plugins"], { dir: sourceDir });

      // Should attempt plugin validation in current directory
      expect(output).toContain("Validating plugin");
    });

    it("should fail when --plugins used in directory with no plugins", async () => {
      tempDir = await createTempDir();

      const { exitCode, output } = await CLI.run(["validate", "--plugins"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Validating plugin:");
    });
  });

  describe("malformed metadata.yaml in source", () => {
    it("should report YAML parse errors for corrupted metadata files", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "corrupt-source");

      await createValidationSkill(sourceDir, "web-corrupt-skill", {
        subPath: "web-corrupt/web-corrupt-skill",
        skillMdContent: renderSkillMd("web-corrupt-skill", "Corrupt metadata", "# Corrupt"),
        metadataYaml: `: : : [broken\nyaml: {{{`,
      });

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Checked");
      // Should report parse failure or schema validation errors
      expect(output).toMatch(/error/i);
    });
  });

  describe("missing SKILL.md in source", () => {
    it("should report error when metadata.yaml exists without SKILL.md", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "missing-skillmd-source");

      // Create skills directory with only metadata.yaml, no SKILL.md
      const skillDir = path.join(sourceDir, SOURCE_PATHS.SKILLS_DIR, "web-orphan-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, FILES.METADATA_YAML),
        [
          `author: "@test"`,
          `category: web-testing`,
          `slug: orphan`,
          `displayName: web-orphan-skill`,
          `cliDescription: Missing SKILL.md`,
          `usageGuidance: Should fail validation`,
          `contentHash: "orphan1"`,
        ].join("\n") + "\n",
      );

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.ERROR);
      expect(output).toContain("Missing SKILL.md");
      expect(output).toContain("1 error(s)");
    });
  });

  describe("fully valid source", () => {
    it("should pass cleanly with zero errors and zero warnings", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "clean-source");

      // Create a skill where displayName matches directory name (no warning)
      // Use a valid slug from the enum and a valid 7-char hex contentHash
      await createValidationSkill(sourceDir, "web-testing-vitest", {
        subPath: "web-testing/web-testing-vitest",
        skillMdContent: renderSkillMd("web-testing-vitest", "Vitest testing framework", "# Vitest"),
        metadataYaml:
          [
            `author: "@test"`,
            `category: web-testing`,
            `domain: web`,
            `slug: vitest`,
            `displayName: web-testing-vitest`,
            `cliDescription: Vitest testing framework`,
            `usageGuidance: Use for testing JavaScript applications`,
            `contentHash: "a1b2c3d"`,
          ].join("\n") + "\n",
      });

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir], {
        dir: tempDir,
      });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Checked 1 skill(s)");
      expect(output).toContain("0 error(s), 0 warning(s)");
      expect(output).toContain("Source validated successfully");
    });
  });

  describe("--verbose on source validation", () => {
    it("should show verbose output with issue details on source validation", async () => {
      tempDir = await createTempDir();
      const sourceDir = path.join(tempDir, "verbose-source");

      // Create a skill with displayName mismatch to trigger a warning
      // Use a valid slug enum value and valid 7-char hex contentHash
      await createValidationSkill(sourceDir, "web-testing-vitest", {
        subPath: "web-testing/web-testing-vitest",
        skillMdContent: renderSkillMd("web-testing-vitest", "Vitest test framework", "# Vitest"),
        metadataYaml:
          [
            `author: "@test"`,
            `category: web-testing`,
            `domain: web`,
            `slug: vitest`,
            `displayName: Vitest Test Framework`,
            `cliDescription: Vitest test framework`,
            `usageGuidance: Use for testing with Vitest`,
            `contentHash: "b2c3d4e"`,
          ].join("\n") + "\n",
      });

      const { exitCode, output } = await CLI.run(["validate", "--source", sourceDir, "--verbose"], {
        dir: tempDir,
      });

      // Should succeed (warnings only) and show the displayName mismatch warning
      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(output).toContain("Validating source:");
      expect(output).toContain("Checked 1 skill(s)");
      expect(output).toContain("displayName");
      expect(output).toContain("does not match directory name");
    });
  });
});
