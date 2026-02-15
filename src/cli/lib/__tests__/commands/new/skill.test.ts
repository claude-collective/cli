import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, readFile } from "fs/promises";
import { runCliCommand, fileExists, directoryExists } from "../../helpers";
import { EXIT_CODES } from "../../../exit-codes";
import {
  validateSkillName,
  toTitleCase,
  generateSkillMd,
  generateMetadataYaml,
} from "../../../../commands/new/skill";

const LOCAL_SKILLS_DIR = ".claude/skills";

describe("validateSkillName", () => {
  it("should return null for valid kebab-case name", () => {
    expect(validateSkillName("my-skill")).toBeNull();
  });

  it("should return null for single word lowercase name", () => {
    expect(validateSkillName("react")).toBeNull();
  });

  it("should return null for name with numbers", () => {
    expect(validateSkillName("web3-utils")).toBeNull();
  });

  it("should return error for uppercase characters", () => {
    const result = validateSkillName("MySkill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for spaces", () => {
    const result = validateSkillName("my skill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for empty string", () => {
    const result = validateSkillName("");
    expect(result).not.toBeNull();
    expect(result).toContain("required");
  });

  it("should return error for whitespace-only string", () => {
    const result = validateSkillName("   ");
    expect(result).not.toBeNull();
    expect(result).toContain("required");
  });

  it("should return error for name starting with number", () => {
    const result = validateSkillName("3d-utils");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });

  it("should return error for name starting with hyphen", () => {
    const result = validateSkillName("-my-skill");
    expect(result).not.toBeNull();
    expect(result).toContain("kebab-case");
  });
});

describe("toTitleCase", () => {
  it("should convert kebab-case to Title Case", () => {
    expect(toTitleCase("web-framework")).toBe("Web Framework");
  });

  it("should handle single word", () => {
    expect(toTitleCase("react")).toBe("React");
  });

  it("should handle multiple hyphens", () => {
    expect(toTitleCase("my-cool-patterns")).toBe("My Cool Patterns");
  });
});

describe("generateSkillMd", () => {
  it("should contain frontmatter with skill id", () => {
    const content = generateSkillMd("my-skill", "@local");
    expect(content).toContain("---");
    expect(content).toContain("name: my-skill (@local)");
  });

  it("should contain description field in frontmatter", () => {
    const content = generateSkillMd("my-skill", "@local");
    expect(content).toContain("description:");
  });

  it("should contain title-cased heading", () => {
    const content = generateSkillMd("web-framework", "@vince");
    expect(content).toContain("# Web Framework");
  });

  it("should use author in skill id", () => {
    const content = generateSkillMd("my-skill", "@custom-author");
    expect(content).toContain("name: my-skill (@custom-author)");
  });
});

describe("generateMetadataYaml", () => {
  it("should contain category field", () => {
    const content = generateMetadataYaml("my-skill", "@local", "local");
    expect(content).toContain("category: local");
  });

  it("should contain author field", () => {
    const content = generateMetadataYaml("my-skill", "@vince", "local");
    expect(content).toContain('author: "@vince"');
  });

  it("should contain title-cased cli_name", () => {
    const content = generateMetadataYaml("web-framework", "@local", "local");
    expect(content).toContain("cli_name: Web Framework");
  });

  it("should use provided category", () => {
    const content = generateMetadataYaml("my-skill", "@local", "web/framework");
    expect(content).toContain("category: web/framework");
  });
});

describe("new:skill command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-new-skill-test-"));
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("argument validation", () => {
    it("should reject missing name argument", async () => {
      const { error } = await runCliCommand(["new:skill"]);

      // oclif should report missing required arg
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should reject non-kebab-case name with uppercase", async () => {
      const { error } = await runCliCommand(["new:skill", "MySkill"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.INVALID_ARGS);
    });

    it("should reject name with spaces", async () => {
      const { error } = await runCliCommand(["new:skill", "my skill"]);

      // oclif may treat the second word as an extra arg or validation fails
      expect(error?.oclif?.exit).toBeDefined();
    });
  });

  describe("file creation", () => {
    it("should create SKILL.md and metadata.yaml in .claude/skills/{name}/", async () => {
      await runCliCommand(["new:skill", "my-test-skill"]);

      const skillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "my-test-skill");
      const skillMdPath = path.join(skillDir, "SKILL.md");
      const metadataPath = path.join(skillDir, "metadata.yaml");

      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(skillMdPath)).toBe(true);
      expect(await fileExists(metadataPath)).toBe(true);
    });

    it("should write correct SKILL.md content", async () => {
      await runCliCommand(["new:skill", "my-test-skill"]);

      const skillMdPath = path.join(projectDir, LOCAL_SKILLS_DIR, "my-test-skill", "SKILL.md");
      const content = await readFile(skillMdPath, "utf-8");

      expect(content).toContain("name: my-test-skill");
      expect(content).toContain("# My Test Skill");
      expect(content).toContain("description:");
    });

    it("should write correct metadata.yaml content", async () => {
      await runCliCommand(["new:skill", "my-test-skill"]);

      const metadataPath = path.join(
        projectDir,
        LOCAL_SKILLS_DIR,
        "my-test-skill",
        "metadata.yaml",
      );
      const content = await readFile(metadataPath, "utf-8");

      expect(content).toContain("category: local");
      expect(content).toContain("cli_name: My Test Skill");
      expect(content).toContain("version: 1");
    });
  });

  describe("flags", () => {
    it("should accept --author flag and use it in generated files", async () => {
      await runCliCommand(["new:skill", "custom-skill", "--author", "@vince"]);

      const skillMdPath = path.join(projectDir, LOCAL_SKILLS_DIR, "custom-skill", "SKILL.md");
      const content = await readFile(skillMdPath, "utf-8");

      expect(content).toContain("@vince");
    });

    it("should accept --category flag and use it in metadata", async () => {
      await runCliCommand(["new:skill", "custom-skill", "--category", "web/framework"]);

      const metadataPath = path.join(projectDir, LOCAL_SKILLS_DIR, "custom-skill", "metadata.yaml");
      const content = await readFile(metadataPath, "utf-8");

      expect(content).toContain("category: web/framework");
    });

    it("should not create files with --dry-run flag", async () => {
      await runCliCommand(["new:skill", "dry-run-skill", "--dry-run"]);

      const skillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "dry-run-skill");
      expect(await directoryExists(skillDir)).toBe(false);
    });
  });

  describe("existing skill handling", () => {
    it("should error if skill directory already exists without --force", async () => {
      // Create the skill directory first
      const skillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "existing-skill");
      await mkdir(skillDir, { recursive: true });

      const { error } = await runCliCommand(["new:skill", "existing-skill"]);

      expect(error?.oclif?.exit).toBe(EXIT_CODES.ERROR);
    });

    it("should overwrite existing skill with --force flag", async () => {
      // Create the skill directory first
      const skillDir = path.join(projectDir, LOCAL_SKILLS_DIR, "existing-skill");
      await mkdir(skillDir, { recursive: true });

      const { error } = await runCliCommand(["new:skill", "existing-skill", "--force"]);

      // Should not exit with error
      expect(error?.oclif?.exit).toBeUndefined();

      // Files should exist after overwrite
      const skillMdPath = path.join(skillDir, "SKILL.md");
      expect(await fileExists(skillMdPath)).toBe(true);
    });
  });
});
