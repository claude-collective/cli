import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  renderSkillMd,
  agentsPath,
  skillsPath,
  writeProjectConfig,
  addForkedFromMetadata,
} from "../helpers/test-utils.js";
import { ProjectBuilder } from "../fixtures/project-builder.js";
import { EXIT_CODES, DIRS, FILES } from "../pages/constants.js";
import { CLI } from "../fixtures/cli.js";
import "../matchers/setup.js";

describe("uninstall command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  it("should display help text with --help flag", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await CLI.run(["uninstall", "--help"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Remove");
    expect(stdout).toContain("--yes");
    expect(stdout).toContain("--all");
  });

  it("should warn when no installation is found", async () => {
    tempDir = await createTempDir();

    const { exitCode, output } = await CLI.run(["uninstall", "--yes"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("Nothing to uninstall");
    expect(output).toContain("is not installed");
    expect(output).toContain("No changes made");
  });

  it("should remove skills and agents with --yes", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    await addForkedFromMetadata(projectDir);

    // Overwrite config with source field so skills match
    await writeProjectConfig(projectDir, {
      name: "test-edit-project",
      skills: [{ id: "web-framework-react", scope: "project", source: "eject" }],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    // Verify files exist before uninstall
    const skillsDir = skillsPath(projectDir);
    const agentsDir = agentsPath(projectDir);
    expect(await directoryExists(skillsDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);

    const { exitCode, stdout } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Skills and agents should be removed
    await expect({ dir: projectDir }).toHaveNoLocalSkills();
    expect(await directoryExists(agentsDir)).toBe(false);

    // Config should be preserved intact (uninstall --yes does not remove .claude-src/)
    await expect({ dir: projectDir }).toHaveConfig({
      skillIds: ["web-framework-react"],
      agents: ["web-developer"],
    });
  });

  it("should also remove config directory with --all --yes", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    await addForkedFromMetadata(projectDir);

    const configDir = path.join(projectDir, DIRS.CLAUDE_SRC);
    expect(await directoryExists(configDir)).toBe(true);

    const { exitCode, stdout } = await CLI.run(["uninstall", "--all", "--yes"], {
      dir: projectDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Config directory should be removed with --all
    expect(await directoryExists(configDir)).toBe(false);

    // Skills and agents should also be removed
    await expect({ dir: projectDir }).toHaveNoLocalSkills();
    const agentsDir = agentsPath(projectDir);
    expect(await directoryExists(agentsDir)).toBe(false);
  });

  it("should remove skills directory when all skills are CLI-managed", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    await addForkedFromMetadata(projectDir);

    const skillsDir = skillsPath(projectDir);
    expect(await directoryExists(skillsDir)).toBe(true);

    const { exitCode } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // Skills directory should be fully removed when all skills matched
    await expect({ dir: projectDir }).toHaveNoLocalSkills();

    // Agents directory should also be removed
    const agentsDir = agentsPath(projectDir);
    expect(await directoryExists(agentsDir)).toBe(false);
  });

  it("should remove agents directory when config exists", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    await addForkedFromMetadata(projectDir);

    const agentsDir = agentsPath(projectDir);
    expect(await directoryExists(agentsDir)).toBe(true);

    const { exitCode, stdout } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("CLI-compiled");
    expect(await directoryExists(agentsDir)).toBe(false);

    // Skills should also be removed
    await expect({ dir: projectDir }).toHaveNoLocalSkills();
  });

  it("should preserve agents not listed in config", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    // ProjectBuilder.editable() generates config with agents: ["web-developer"]
    // Add an extra agent file NOT in the config
    const agentsDir = agentsPath(projectDir);
    await writeFile(path.join(agentsDir, "my-custom-agent.md"), "# Custom Agent");

    const { exitCode } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    // Custom agent should be preserved (not in config.agents)
    expect(await fileExists(path.join(agentsDir, "my-custom-agent.md"))).toBe(true);

    // CLI-managed agent (web-developer) should be removed
    expect(await fileExists(path.join(agentsDir, "web-developer.md"))).toBe(false);
  });

  it("should skip user-created skills without forkedFrom metadata", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    // Create a user-created skill with no forkedFrom metadata
    const userSkillDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "my-custom-skill");
    await mkdir(userSkillDir, { recursive: true });
    await writeFile(
      path.join(userSkillDir, FILES.SKILL_MD),
      renderSkillMd("my-custom-skill", "User created", "# My Custom Skill"),
    );
    await writeFile(
      path.join(userSkillDir, FILES.METADATA_YAML),
      'author: "@user"\ncontentHash: "user-hash"\n',
    );

    await addForkedFromMetadata(projectDir);

    const { exitCode, output } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // User-created skill should be skipped
    expect(output).toContain("Skipping");
    expect(output).toContain("my-custom-skill");

    // User skill should still exist, CLI-managed skill should be removed
    await expect({ dir: projectDir }).toHaveLocalSkills(["my-custom-skill"]);
    expect(
      await directoryExists(path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "web-framework-react")),
    ).toBe(false);
  });

  it("should skip all skills when only user-created skills exist", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");
    const userSkillDir = path.join(projectDir, DIRS.CLAUDE, DIRS.SKILLS, "my-custom-skill");
    await mkdir(userSkillDir, { recursive: true });

    await writeFile(
      path.join(userSkillDir, FILES.SKILL_MD),
      renderSkillMd("my-custom-skill", "User created", "# My Custom Skill"),
    );
    await writeFile(
      path.join(userSkillDir, FILES.METADATA_YAML),
      'author: "@user"\ncontentHash: "user-hash"\n',
    );

    const { exitCode, output } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("Skipping");
    expect(output).toContain("my-custom-skill");
    expect(await directoryExists(userSkillDir)).toBe(true);
  });

  it("should print removal list before proceeding with --yes", async () => {
    const project = await ProjectBuilder.editable();
    tempDir = path.dirname(project.dir);
    const projectDir = project.dir;

    await addForkedFromMetadata(projectDir);

    const { exitCode, stdout } = await CLI.run(["uninstall", "--yes"], { dir: projectDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    // --yes should print what will be removed (without interactive prompt)
    expect(stdout).toContain("The following will be removed:");
    expect(stdout).toContain("CLI-managed files:");
  });

  it("should report nothing to uninstall for empty directory with HOME override", async () => {
    tempDir = await createTempDir();
    const globalHome = path.join(tempDir, "global-home");
    const emptyDir = path.join(tempDir, "empty-project");
    await mkdir(globalHome, { recursive: true });
    await mkdir(emptyDir, { recursive: true });

    // Global home has config but no skills/agents
    await writeProjectConfig(globalHome, {
      name: "global-test",
      skills: [],
      agents: [],
    });

    const { exitCode, output } = await CLI.run(
      ["uninstall", "--yes"],
      { dir: emptyDir },
      { env: { HOME: globalHome } },
    );

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    // No local skills or agents in the empty project dir
    expect(output).toContain("Nothing to uninstall");
  });

  it("should succeed with --yes --all when config dir exists but no skills", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    // Write only config — no skills or agents directories
    await writeProjectConfig(projectDir, {
      name: "config-only-test",
      skills: [],
      agents: [],
    });

    const configDir = path.join(projectDir, DIRS.CLAUDE_SRC);
    expect(await directoryExists(configDir)).toBe(true);

    const { exitCode } = await CLI.run(["uninstall", "--all", "--yes"], {
      dir: projectDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    // Config dir should be removed with --all
    expect(await directoryExists(configDir)).toBe(false);

    // Skills and agents dirs should not exist either
    await expect({ dir: projectDir }).toHaveNoLocalSkills();
    const agentsDir = path.join(projectDir, DIRS.CLAUDE, DIRS.AGENTS);
    expect(await directoryExists(agentsDir)).toBe(false);
  });
});
