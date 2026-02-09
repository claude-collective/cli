import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { discoverLocalSkills } from "./local-skill-loader";

describe("local-skill-loader", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-local-skill-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe("discoverLocalSkills", () => {
    it("returns null when .claude/skills/ does not exist", async () => {
      const result = await discoverLocalSkills(tempDir);
      expect(result).toBeNull();
    });

    it("returns empty skills array when directory exists but is empty", async () => {
      await mkdir(path.join(tempDir, ".claude", "skills"), { recursive: true });

      const result = await discoverLocalSkills(tempDir);

      expect(result).not.toBeNull();
      expect(result?.skills).toEqual([]);
      expect(result?.localSkillsPath).toBe(path.join(tempDir, ".claude/skills"));
    });

    it("discovers skills regardless of name prefix", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const normalSkillDir = path.join(skillsDir, "my-normal-skill");
      await mkdir(normalSkillDir, { recursive: true });

      // Create valid metadata and SKILL.md
      await writeFile(
        path.join(normalSkillDir, "metadata.yaml"),
        `cli_name: My Normal Skill\ncli_description: A normal skill`,
      );
      await writeFile(
        path.join(normalSkillDir, "SKILL.md"),
        `---\nname: my-normal-skill (@local)\ndescription: A normal skill\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result).not.toBeNull();
      expect(result?.skills).toHaveLength(1);
      expect(result?.skills[0].id).toBe("my-normal-skill (@local)");
      expect(result?.skills[0].name).toBe("My Normal Skill @local");
      expect(result?.skills[0].category).toBe("local");
      expect(result?.skills[0].author).toBe("@local");
      expect(result?.skills[0].local).toBe(true);
      expect(result?.skills[0].localPath).toBe(".claude/skills/my-normal-skill/");
    });

    it("skips skill without metadata.yaml", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "no-metadata");
      await mkdir(skillDir, { recursive: true });

      // Only create SKILL.md, no metadata.yaml
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: no-metadata (@local)\ndescription: Missing metadata\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("skips skill without SKILL.md", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "no-skillmd");
      await mkdir(skillDir, { recursive: true });

      // Only create metadata.yaml, no SKILL.md
      await writeFile(path.join(skillDir, "metadata.yaml"), `cli_name: No Skill MD`);

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("skips skill with metadata.yaml missing cli_name", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "no-cli-name");
      await mkdir(skillDir, { recursive: true });

      // Create metadata.yaml without cli_name
      await writeFile(path.join(skillDir, "metadata.yaml"), `cli_description: Just a description`);
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: no-cli-name (@local)\ndescription: Missing cli_name\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("skips skill with invalid SKILL.md frontmatter", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "bad-frontmatter");
      await mkdir(skillDir, { recursive: true });

      await writeFile(path.join(skillDir, "metadata.yaml"), `cli_name: Bad Frontmatter Skill`);
      // SKILL.md without proper frontmatter (missing name)
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\ndescription: Only description, no name\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toEqual([]);
    });

    it("uses cli_description from metadata.yaml when provided", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "with-desc");
      await mkdir(skillDir, { recursive: true });

      await writeFile(
        path.join(skillDir, "metadata.yaml"),
        `cli_name: Desc Skill\ncli_description: Custom CLI description`,
      );
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: desc-skill (@local)\ndescription: Frontmatter description\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].description).toBe("Custom CLI description");
    });

    it("falls back to frontmatter description when cli_description not provided", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "fallback-desc");
      await mkdir(skillDir, { recursive: true });

      await writeFile(path.join(skillDir, "metadata.yaml"), `cli_name: Fallback Skill`);
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: fallback-skill (@local)\ndescription: Frontmatter description\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills[0].description).toBe("Frontmatter description");
    });

    it("discovers multiple valid skills", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");

      // Create two valid skills
      const skill1Dir = path.join(skillsDir, "skill-one");
      const skill2Dir = path.join(skillsDir, "skill-two");
      await mkdir(skill1Dir, { recursive: true });
      await mkdir(skill2Dir, { recursive: true });

      await writeFile(path.join(skill1Dir, "metadata.yaml"), `cli_name: Skill One`);
      await writeFile(
        path.join(skill1Dir, "SKILL.md"),
        `---\nname: skill-one (@local)\ndescription: First skill\n---\nContent`,
      );

      await writeFile(path.join(skill2Dir, "metadata.yaml"), `cli_name: Skill Two`);
      await writeFile(
        path.join(skill2Dir, "SKILL.md"),
        `---\nname: skill-two (@local)\ndescription: Second skill\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);

      expect(result?.skills).toHaveLength(2);
      const skillIds = result?.skills.map((s) => s.id).sort();
      expect(skillIds).toEqual(["skill-one (@local)", "skill-two (@local)"]);
    });

    it("sets correct extracted metadata properties", async () => {
      const skillsDir = path.join(tempDir, ".claude", "skills");
      const skillDir = path.join(skillsDir, "full-skill");
      await mkdir(skillDir, { recursive: true });

      await writeFile(
        path.join(skillDir, "metadata.yaml"),
        `cli_name: Full Skill\ncli_description: Complete skill for testing`,
      );
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        `---\nname: full-skill (@local)\ndescription: Complete skill\n---\nContent`,
      );

      const result = await discoverLocalSkills(tempDir);
      const skill = result?.skills[0];

      // Identity
      expect(skill?.id).toBe("full-skill (@local)");
      expect(skill?.directoryPath).toBe("full-skill");
      expect(skill?.name).toBe("Full Skill @local");
      expect(skill?.description).toBe("Complete skill for testing");

      // Catalog data
      expect(skill?.category).toBe("local");
      expect(skill?.categoryExclusive).toBe(false);
      expect(skill?.author).toBe("@local");
      expect(skill?.tags).toEqual([]);

      // Relationships (empty for local skills)
      expect(skill?.compatibleWith).toEqual([]);
      expect(skill?.conflictsWith).toEqual([]);
      expect(skill?.requires).toEqual([]);
      expect(skill?.requiresSetup).toEqual([]);
      expect(skill?.providesSetupFor).toEqual([]);

      // Location
      expect(skill?.path).toBe(".claude/skills/full-skill/");
      expect(skill?.local).toBe(true);
      expect(skill?.localPath).toBe(".claude/skills/full-skill/");
    });
  });
});
