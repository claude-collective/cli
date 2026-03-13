import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createEditableProject,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  readTestFile,
  writeProjectConfig,
  runCLI,
  EXIT_CODES,
  FORKED_FROM_METADATA,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";

/**
 * Uninstall preservation E2E tests.
 *
 * Tests that `uninstall --yes` preserves user-authored content while removing
 * CLI-managed artifacts, and that `uninstall --all --yes` removes everything
 * including .claude-src/.
 *
 * Gap 10 from e2e-test-gaps.md:
 * - 10a: Ejected templates preserved by --yes, removed by --all
 * - 10b: --all removes .claude-src entirely including ejected content
 * - 10c: Custom agent source in .claude-src preserved by --yes
 * - 10d: Only config-tracked agents removed, non-config agents preserved
 * - 10e: .claude/ directory preserved when it contains non-CLI content
 */

/** Add forkedFrom metadata to the default skill created by createEditableProject */
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

describe("uninstall preservation behavior", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should preserve ejected templates in .claude-src after uninstall --yes", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);
    await addForkedFromMetadata(projectDir);

    // Eject templates to .claude-src/agents/_templates/
    const ejectResult = await runCLI(["eject", "templates"], projectDir);
    expect(ejectResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    // Verify ejected template exists before uninstall
    const templatePath = path.join(projectDir, CLAUDE_SRC_DIR, "agents", "_templates", "agent.liquid");
    expect(await fileExists(templatePath)).toBe(true);

    // Run uninstall --yes (without --all)
    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // .claude-src/ (including ejected templates) should be preserved
    expect(await fileExists(templatePath)).toBe(true);

    // Compiled artifacts should be removed
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    expect(await directoryExists(agentsDir)).toBe(false);

    const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    expect(await directoryExists(skillsDir)).toBe(false);
  });

  it("should remove .claude-src entirely with --all including ejected content", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);
    await addForkedFromMetadata(projectDir);

    // Eject templates
    const ejectResult = await runCLI(["eject", "templates"], projectDir);
    expect(ejectResult.exitCode).toBe(EXIT_CODES.SUCCESS);

    const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
    expect(await directoryExists(claudeSrcDir)).toBe(true);

    // Run uninstall --all --yes
    const { exitCode, stdout } = await runCLI(["uninstall", "--all", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // .claude-src/ should be removed entirely
    expect(await directoryExists(claudeSrcDir)).toBe(false);
  });

  it("should preserve custom agent source in .claude-src/agents after uninstall --yes", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir, {
      skills: ["web-framework-react"],
      agents: ["web-developer"],
      domains: ["web"],
    });
    await addForkedFromMetadata(projectDir);

    // Create a custom agent source directory in .claude-src/agents/
    const customAgentSrcDir = path.join(projectDir, CLAUDE_SRC_DIR, "agents", "my-custom-agent");
    await mkdir(customAgentSrcDir, { recursive: true });
    await writeFile(
      path.join(customAgentSrcDir, STANDARD_FILES.AGENT_METADATA_YAML),
      'id: my-custom-agent\ntitle: My Custom Agent\ndescription: A user-defined agent\ntools:\n  - Read\n',
    );
    await writeFile(
      path.join(customAgentSrcDir, STANDARD_FILES.INTRO_MD),
      "# My Custom Agent\n\nThis is a custom agent created by the user.",
    );

    // Create compiled output for the custom agent in .claude/agents/
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await writeFile(
      path.join(agentsDir, "my-custom-agent.md"),
      "---\nname: my-custom-agent\n---\n# Custom Agent compiled",
    );

    // Add the custom agent to config so uninstall will track it
    await writeProjectConfig(projectDir, {
      name: "test-edit-project",
      skills: [{ id: "web-framework-react", scope: "project", source: "local" }],
      agents: [
        { name: "web-developer", scope: "project" },
        { name: "my-custom-agent", scope: "project" },
      ],
      domains: ["web"],
    });

    // Run uninstall --yes
    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Custom agent SOURCE in .claude-src/ should be preserved (--yes does not touch .claude-src/)
    expect(await directoryExists(customAgentSrcDir)).toBe(true);
    expect(await fileExists(path.join(customAgentSrcDir, STANDARD_FILES.AGENT_METADATA_YAML))).toBe(true);
    expect(await fileExists(path.join(customAgentSrcDir, STANDARD_FILES.INTRO_MD))).toBe(true);

    // Compiled agent artifact in .claude/agents/ should be removed (it was in config)
    expect(await fileExists(path.join(agentsDir, "my-custom-agent.md"))).toBe(false);
  });

  it("should remove only config-tracked agents and preserve others", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir, {
      skills: ["web-framework-react"],
      agents: ["web-developer"],
      domains: ["web"],
    });
    await addForkedFromMetadata(projectDir);

    // Config tracks only web-developer. Create compiled agent files for both
    // a tracked agent AND an extra non-tracked agent.
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await writeFile(
      path.join(agentsDir, "web-developer.md"),
      "---\nname: web-developer\n---\n# Web Developer Agent",
    );
    await writeFile(
      path.join(agentsDir, "extra-agent.md"),
      "---\nname: extra-agent\n---\n# Extra Agent (not in config)",
    );

    // Verify both exist before uninstall
    expect(await fileExists(path.join(agentsDir, "web-developer.md"))).toBe(true);
    expect(await fileExists(path.join(agentsDir, "extra-agent.md"))).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Config-tracked agent should be removed
    expect(await fileExists(path.join(agentsDir, "web-developer.md"))).toBe(false);

    // Non-config agent should be preserved
    expect(await fileExists(path.join(agentsDir, "extra-agent.md"))).toBe(true);
  });

  it("should preserve .claude directory when it contains non-CLI content", async () => {
    tempDir = await createTempDir();
    const projectDir = await createEditableProject(tempDir);
    await addForkedFromMetadata(projectDir);

    // Add a user-created file to .claude/ that the CLI does not manage
    const claudeDir = path.join(projectDir, CLAUDE_DIR);
    await writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({ permissions: { allow: ["Read(*)"] }, userPreference: "keep-me" }),
    );

    // Verify structure before uninstall
    const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    expect(await directoryExists(skillsDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);
    expect(await fileExists(path.join(claudeDir, "settings.json"))).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // .claude/ directory should still exist because it has user content
    expect(await directoryExists(claudeDir)).toBe(true);

    // User content should be preserved
    expect(await fileExists(path.join(claudeDir, "settings.json"))).toBe(true);
    const settingsContent = await readTestFile(path.join(claudeDir, "settings.json"));
    const settings = JSON.parse(settingsContent);
    expect(settings.userPreference).toBe("keep-me");

    // CLI-managed subdirectories should be removed
    expect(await directoryExists(skillsDir)).toBe(false);
    expect(await directoryExists(agentsDir)).toBe(false);

    // Verify the "Kept .claude/" message appears
    expect(stdout).toContain("Kept .claude/");
  });
});
