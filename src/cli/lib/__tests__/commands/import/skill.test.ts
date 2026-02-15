import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { parse as parseYaml } from "yaml";
import { runCliCommand, fileExists, directoryExists } from "../../helpers";
import { EXIT_CODES } from "../../../exit-codes";
const LOCAL_SKILLS_DIR = ".claude/skills";
const SKILL_MD_FILE = "SKILL.md";
const METADATA_YAML_FILE = "metadata.yaml";

// Plain directory name (no slashes/colons) so parseGitHubSource passes it
// through as-is and fetchFromSource treats it as a local path relative to cwd
const LOCAL_SOURCE_NAME = "testrepo";

async function createLocalSource(
  projectDir: string,
  skills: string[],
  options?: { subdir?: string; withMetadata?: boolean },
): Promise<void> {
  const subdir = options?.subdir ?? "skills";
  const skillsDir = path.join(projectDir, LOCAL_SOURCE_NAME, subdir);

  for (const skillName of skills) {
    const skillDir = path.join(skillsDir, skillName);
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, SKILL_MD_FILE),
      `# ${skillName}\n\nThis is the ${skillName} skill.\n`,
    );

    if (options?.withMetadata) {
      await writeFile(path.join(skillDir, METADATA_YAML_FILE), `version: 1\nauthor: "@external"\n`);
    }
  }
}

describe("import:skill command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-import-skill-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("argument validation", () => {
    it("should reject missing source argument", async () => {
      const { error } = await runCliCommand(["import:skill"]);

      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should require at least one of --skill, --all, or --list", async () => {
      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should reject --skill and --all together", async () => {
      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "my-skill",
        "--all",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });
  });

  describe("flag validation", () => {
    it("should accept --subdir flag", async () => {
      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "custom-dir",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --force flag", async () => {
      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--all",
        "--force",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --refresh flag", async () => {
      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--refresh",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept --dry-run flag", async () => {
      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--all",
        "--dry-run",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -n shorthand for --skill", async () => {
      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "-n", "my-skill"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -a shorthand for --all", async () => {
      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "-a"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });

    it("should accept -l shorthand for --list", async () => {
      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "-l"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
    });
  });

  describe("source format parsing", () => {
    // These tests verify parseGitHubSource behavior indirectly by checking
    // that the command does not error on format parsing for different source styles.
    // All formats will fail on fetch (network error) but should not fail on
    // format parsing itself.

    it("should accept full GitHub URL format", async () => {
      const { error } = await runCliCommand([
        "import:skill",
        "https://github.com/owner/repo",
        "--list",
      ]);

      // Should not error on source format parsing (will fail on network)
      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("invalid source format");
    });

    it("should accept github: prefix format", async () => {
      const { error } = await runCliCommand(["import:skill", "github:owner/repo", "--list"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("invalid source format");
    });

    it("should accept gh: prefix format", async () => {
      const { error } = await runCliCommand(["import:skill", "gh:owner/repo", "--list"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("invalid source format");
    });

    it("should accept bare owner/repo format", async () => {
      const { error } = await runCliCommand(["import:skill", "owner/repo", "--list"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("invalid source format");
    });
  });

  describe("--list mode", () => {
    it("should list available skills without error", async () => {
      await createLocalSource(projectDir, ["react-patterns", "testing-utils"]);

      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--list"]);

      // Should complete without error exit code
      expect(error?.oclif?.exit).toBeUndefined();
    });

    it("should error when source has no valid skills", async () => {
      // Create source with empty skills directory (no SKILL.md files)
      const skillsDir = path.join(projectDir, LOCAL_SOURCE_NAME, "skills");
      await mkdir(skillsDir, { recursive: true });

      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--list"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });
  });

  describe("--skill import", () => {
    it("should import a specific skill to .claude/skills/", async () => {
      await createLocalSource(projectDir, ["react-patterns", "testing-utils"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "react-patterns",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Verify skill was copied to the destination
      const destSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "react-patterns");
      expect(await directoryExists(destSkillDir)).toBe(true);
      expect(await fileExists(path.join(destSkillDir, SKILL_MD_FILE))).toBe(true);
    });

    it("should error when requested skill does not exist in source", async () => {
      await createLocalSource(projectDir, ["existing-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "nonexistent-skill",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should inject forked_from metadata into metadata.yaml", async () => {
      await createLocalSource(projectDir, ["my-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "my-skill",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Read the created metadata.yaml
      const metadataPath = path.join(projectDir, LOCAL_SKILLS_DIR, "my-skill", METADATA_YAML_FILE);
      expect(await fileExists(metadataPath)).toBe(true);

      const content = await readFile(metadataPath, "utf-8");
      const metadata = parseYaml(content);

      expect(metadata.forked_from).toBeDefined();
      expect(metadata.forked_from.skill_name).toBe("my-skill");
      expect(metadata.forked_from.source).toBe(LOCAL_SOURCE_NAME);
      expect(metadata.forked_from.content_hash).toBeDefined();
      expect(metadata.forked_from.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("should preserve existing metadata.yaml and add forked_from", async () => {
      await createLocalSource(projectDir, ["my-skill"], { withMetadata: true });

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "my-skill",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      const metadataPath = path.join(projectDir, LOCAL_SKILLS_DIR, "my-skill", METADATA_YAML_FILE);
      const content = await readFile(metadataPath, "utf-8");
      const metadata = parseYaml(content);

      // Original metadata fields should be preserved
      expect(metadata.version).toBe(1);
      expect(metadata.author).toBe("@external");
      // forked_from should be injected
      expect(metadata.forked_from).toBeDefined();
      expect(metadata.forked_from.skill_name).toBe("my-skill");
    });
  });

  describe("--all import", () => {
    it("should import all skills from the repository", async () => {
      const skillNames = ["skill-alpha", "skill-beta", "skill-gamma"];
      await createLocalSource(projectDir, skillNames);

      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--all"]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Verify all skills were imported
      for (const name of skillNames) {
        const destDir = path.join(projectDir, LOCAL_SKILLS_DIR, name);
        expect(await directoryExists(destDir)).toBe(true);
        expect(await fileExists(path.join(destDir, SKILL_MD_FILE))).toBe(true);
      }
    });

    it("should error when source has no valid skills with --all", async () => {
      // Create source with a directory but no SKILL.md
      const invalidSkillDir = path.join(projectDir, LOCAL_SOURCE_NAME, "skills", "invalid-skill");
      await mkdir(invalidSkillDir, { recursive: true });
      await writeFile(path.join(invalidSkillDir, "README.md"), "# Not a skill");

      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--all"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });
  });

  describe("--force flag behavior", () => {
    it("should skip existing skills without --force", async () => {
      await createLocalSource(projectDir, ["existing-skill"]);

      // Pre-create the destination skill directory
      const destSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "existing-skill");
      await mkdir(destSkillDir, { recursive: true });
      await writeFile(path.join(destSkillDir, SKILL_MD_FILE), "# Original content\n");

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "existing-skill",
      ]);

      // Command should complete (skipping is not an error)
      expect(error?.oclif?.exit).toBeUndefined();

      // Original content should be preserved (not overwritten)
      const content = await readFile(path.join(destSkillDir, SKILL_MD_FILE), "utf-8");
      expect(content).toBe("# Original content\n");
    });

    it("should overwrite existing skills with --force", async () => {
      await createLocalSource(projectDir, ["existing-skill"]);

      // Pre-create the destination skill directory with old content
      const destSkillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "existing-skill");
      await mkdir(destSkillDir, { recursive: true });
      await writeFile(path.join(destSkillDir, SKILL_MD_FILE), "# Original content\n");

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "existing-skill",
        "--force",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Content should be overwritten with the source version
      const content = await readFile(path.join(destSkillDir, SKILL_MD_FILE), "utf-8");
      expect(content).toContain("existing-skill");
      expect(content).not.toBe("# Original content\n");
    });
  });

  describe("--subdir flag behavior", () => {
    it("should look for skills in custom subdirectory", async () => {
      await createLocalSource(projectDir, ["custom-skill"], { subdir: "custom-dir" });

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--skill",
        "custom-skill",
        "--subdir",
        "custom-dir",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      const destDir = path.join(projectDir, LOCAL_SKILLS_DIR, "custom-skill");
      expect(await directoryExists(destDir)).toBe(true);
    });

    it("should error when custom subdirectory does not exist", async () => {
      await createLocalSource(projectDir, ["some-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "nonexistent-subdir",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should block path traversal with .. sequences", async () => {
      await createLocalSource(projectDir, ["some-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "../../../etc",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
      expect(error?.message).toContain("escapes repository boundary");
    });

    it("should block absolute paths in --subdir", async () => {
      await createLocalSource(projectDir, ["some-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "/etc/passwd",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
      expect(error?.message).toContain("must be a relative path");
    });

    it("should block null bytes in --subdir", async () => {
      await createLocalSource(projectDir, ["some-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "skills\x00/../../../etc",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
      expect(error?.message).toContain("null bytes");
    });

    it("should block intermediate traversal in --subdir", async () => {
      await createLocalSource(projectDir, ["some-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "skills/../../../etc/passwd",
      ]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
      expect(error?.message).toContain("escapes repository boundary");
    });

    it("should allow nested subdirectories within repository", async () => {
      await createLocalSource(projectDir, ["nested-skill"], { subdir: "deep/nested/skills" });

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--list",
        "--subdir",
        "deep/nested/skills",
      ]);

      // Should succeed (no exit code error), listing skills from nested subdir
      expect(error?.oclif?.exit).toBeUndefined();
    });
  });

  describe("--dry-run mode", () => {
    it("should not create files in dry-run mode", async () => {
      await createLocalSource(projectDir, ["dry-run-skill"]);

      const { error } = await runCliCommand([
        "import:skill",
        LOCAL_SOURCE_NAME,
        "--all",
        "--dry-run",
      ]);

      expect(error?.oclif?.exit).toBeUndefined();

      // Verify no skills were actually created
      const destDir = path.join(projectDir, LOCAL_SKILLS_DIR, "dry-run-skill");
      expect(await directoryExists(destDir)).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should error when source directory does not exist", async () => {
      // Use a source name that doesn't exist on the filesystem
      const { error } = await runCliCommand(["import:skill", "nonexistent-source", "--list"]);

      // fetchFromSource will throw for non-existent local paths
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should error when skills subdirectory is missing", async () => {
      // Create the source dir but without a "skills" subdirectory
      await mkdir(path.join(projectDir, LOCAL_SOURCE_NAME), { recursive: true });

      const { error } = await runCliCommand(["import:skill", LOCAL_SOURCE_NAME, "--list"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });
  });
});
