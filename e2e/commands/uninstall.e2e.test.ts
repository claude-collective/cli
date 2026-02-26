import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createEditableProject,
  ensureBinaryExists,
  directoryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import {
  CLAUDE_DIR,
  CLAUDE_SRC_DIR,
  STANDARD_FILES,
  STANDARD_DIRS,
} from "../../src/cli/consts.js";

const FORKED_FROM_METADATA = [
  'author: "@test"',
  'contentHash: "e2e-hash-web-framework-react"',
  "forkedFrom:",
  "  skillId: web-framework-react",
  '  contentHash: "e2e-hash"',
  "  date: 2026-01-01",
].join("\n") + "\n";

async function addForkedFromMetadata(projectDir: string): Promise<void> {
  const metadataPath = path.join(
    projectDir,
    CLAUDE_DIR,
    STANDARD_DIRS.SKILLS,
    "web-framework-react",
    STANDARD_FILES.METADATA_YAML,
  );
  await writeFile(metadataPath, FORKED_FROM_METADATA);
}

describe("uninstall command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should display help text with --help flag", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["uninstall", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Remove");
    expect(stdout).toContain("--yes");
    expect(stdout).toContain("--all");
    expect(stdout).toContain("--dry-run");
  });

  it("should warn when no installation is found", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["uninstall", "--yes"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("Nothing to uninstall");
    expect(combined).toContain("is not installed");
    expect(combined).toContain("No changes made");
  });

  it("should remove skills and agents with --yes", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);

    await addForkedFromMetadata(projectDir);

    // Add a config.yaml source field so skills match
    const configPath = path.join(projectDir, CLAUDE_SRC_DIR, STANDARD_FILES.CONFIG_YAML);
    await writeFile(
      configPath,
      [
        "name: test-edit-project",
        "installMode: local",
        "skills:",
        "  - web-framework-react",
        "agents:",
        "  - web-developer",
        "domains:",
        "  - web",
      ].join("\n") + "\n",
    );

    // Verify files exist before uninstall
    const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    expect(await directoryExists(skillsDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Skills and agents should be removed
    expect(await directoryExists(skillsDir)).toBe(false);
    expect(await directoryExists(agentsDir)).toBe(false);

    // Config directory should still exist (not using --all)
    expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);
  });

  it("should also remove config directory with --all --yes", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);

    await addForkedFromMetadata(projectDir);

    const configDir = path.join(projectDir, CLAUDE_SRC_DIR);
    expect(await directoryExists(configDir)).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--all", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Config directory should be removed with --all
    expect(await directoryExists(configDir)).toBe(false);
  });

  it("should remove skills directory when all skills are CLI-managed", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);

    await addForkedFromMetadata(projectDir);

    const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    expect(await directoryExists(skillsDir)).toBe(true);

    const { exitCode } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // Skills directory should be fully removed when all skills matched
    expect(await directoryExists(skillsDir)).toBe(false);
  });

  it("should remove agents directory when config exists", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);

    await addForkedFromMetadata(projectDir);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    expect(await directoryExists(agentsDir)).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Removed compiled agents");
    expect(await directoryExists(agentsDir)).toBe(false);
  });

  it("should skip user-created skills without forkedFrom metadata", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);

    // Create a user-created skill with no forkedFrom metadata
    const userSkillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "my-custom-skill",
    );
    await mkdir(userSkillDir, { recursive: true });
    await writeFile(
      path.join(userSkillDir, STANDARD_FILES.SKILL_MD),
      "---\nname: my-custom-skill\ndescription: User created\n---\n\n# My Custom Skill\n",
    );
    await writeFile(
      path.join(userSkillDir, STANDARD_FILES.METADATA_YAML),
      'author: "@user"\ncontentHash: "user-hash"\n',
    );

    await addForkedFromMetadata(projectDir);

    const { exitCode, combined } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // User-created skill should be skipped
    expect(combined).toContain("Skipping");
    expect(combined).toContain("my-custom-skill");

    // User skill should still exist
    expect(await directoryExists(userSkillDir)).toBe(true);

    // CLI-managed skill should be removed
    const cliSkillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    expect(await directoryExists(cliSkillDir)).toBe(false);
  });

  it("should support --dry-run flag without removing files", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);

    await addForkedFromMetadata(projectDir);

    const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");

    const { exitCode, stdout } = await runCLI(["uninstall", "--dry-run"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("[dry-run]");
    expect(stdout).toContain("no files were removed");

    // Files should NOT be removed in dry-run mode
    expect(await directoryExists(skillsDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);
  });
});
