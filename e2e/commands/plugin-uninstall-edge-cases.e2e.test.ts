import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  runCLI,
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  readTestFile,
  renderSkillMd,
  writeProjectConfig,
  EXIT_CODES,
  FORKED_FROM_METADATA,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";

/**
 * Plugin-mode uninstall E2E tests — edge cases.
 *
 * P-UNINSTALL-3: Uninstall with plugin config but no real plugins installed.
 *   - Config references plugin-mode skills, but no plugins exist on disk.
 *   - Verifies uninstall completes gracefully and cleans up local files.
 *
 * Also tests:
 *   - Preserving non-CLI plugins in settings.json
 *   - Uninstall when Claude CLI is not on PATH
 *   - --all flag behavior
 *
 * Reference: e2e-framework-design.md, Section 4.3
 */

describe("uninstall with plugin config but no installed plugins", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should complete gracefully when config references plugins that are not installed", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "phantom-plugin-project",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "nonexistent-marketplace",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");
  });

  it("should remove local skills and agents even without plugin uninstall", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "no-plugins-project",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "some-marketplace",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    expect(await directoryExists(skillDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);

    const { exitCode } = await runCLI(["uninstall", "--yes"], projectDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    expect(await directoryExists(skillDir)).toBe(false);
    expect(await directoryExists(agentsDir)).toBe(false);
  });

  it("should handle settings.json with plugins that are not in config", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "local-only-project",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "local",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const claudeDir = path.join(projectDir, CLAUDE_DIR);
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Read(*)"] },
        enabledPlugins: {
          "manual-plugin@some-marketplace": true,
        },
      }),
    );

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    expect(await directoryExists(skillDir)).toBe(false);
  });

  it("should also remove config with --all flag when no plugins exist", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "all-flag-test",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "fake-marketplace",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const configDir = path.join(projectDir, CLAUDE_SRC_DIR);
    expect(await directoryExists(configDir)).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--all", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    expect(await directoryExists(configDir)).toBe(false);
  });
});

describe("uninstall preserves non-CLI plugins", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should preserve manually-placed plugins in settings.json after uninstall", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "preserve-manual-plugins-test",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "some-marketplace",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const claudeDir = path.join(projectDir, CLAUDE_DIR);
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Read(*)"] },
        enabledPlugins: {
          "web-framework-react@some-marketplace": true,
          "manual-plugin@other-marketplace": true,
        },
      }),
    );

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
    const settingsExists = await fileExists(settingsPath);

    if (settingsExists) {
      const settingsContent = await readTestFile(settingsPath);
      const settings = JSON.parse(settingsContent);

      expect(settings.enabledPlugins?.["manual-plugin@other-marketplace"]).toBe(true);
    }

    expect(await directoryExists(skillDir)).toBe(false);
  });

  it("should not remove enabledPlugins entries that are not in config", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "multi-plugin-test",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "marketplace-a",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const claudeDir = path.join(projectDir, CLAUDE_DIR);
    await mkdir(claudeDir, { recursive: true });
    await writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Read(*)"] },
        enabledPlugins: {
          "web-framework-react@marketplace-a": true,
          "some-other-skill@marketplace-b": true,
          "third-party-tool@external-source": true,
        },
      }),
    );

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
    const settingsExists = await fileExists(settingsPath);

    if (settingsExists) {
      const settingsContent = await readTestFile(settingsPath);
      const settings = JSON.parse(settingsContent);

      expect(settings.enabledPlugins?.["some-other-skill@marketplace-b"]).toBe(true);
      expect(settings.enabledPlugins?.["third-party-tool@external-source"]).toBe(true);
    }
  });
});

describe("uninstall without Claude CLI on PATH", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should complete uninstall when claude binary is not available", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    await writeProjectConfig(projectDir, {
      name: "no-claude-cli-test",
      skills: [
        {
          id: "web-framework-react",
          scope: "project",
          source: "some-marketplace",
        },
      ],
      agents: [{ name: "web-developer", scope: "project" }],
      domains: ["web"],
    });

    const skillDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS, "web-framework-react");
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(path.join(skillDir, STANDARD_FILES.METADATA_YAML), FORKED_FROM_METADATA);

    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const claudeDir = path.join(projectDir, CLAUDE_DIR);
    await writeFile(
      path.join(claudeDir, "settings.json"),
      JSON.stringify({
        permissions: { allow: ["Read(*)"] },
        enabledPlugins: {
          "web-framework-react@some-marketplace": true,
        },
      }),
    );

    expect(await directoryExists(skillDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);

    // Use a minimal PATH that includes node and basic Unix utilities but NOT claude.
    const minimalPath = [path.dirname(process.execPath), "/usr/bin", "/bin"].join(":");

    const { exitCode, stdout, stderr } = await runCLI(["uninstall", "--yes"], projectDir, {
      env: {
        PATH: minimalPath,
        HOME: projectDir,
      },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    expect(await directoryExists(skillDir)).toBe(false);

    expect(await directoryExists(agentsDir)).toBe(false);

    expect(stderr).not.toContain("claude");
    expect(stdout).not.toContain("claude: command not found");
  });
});
