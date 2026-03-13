import path from "path";
import os from "os";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import {
  isClaudeCLIAvailable,
  claudePluginMarketplaceAdd,
  claudePluginInstall,
} from "../../src/cli/utils/exec.js";
import {
  createE2EPluginSource,
  type E2EPluginSource,
} from "../helpers/create-e2e-plugin-source.js";
import { verifyPluginInSettings, verifyNoPlugins } from "../helpers/plugin-assertions.js";
import {
  runCLI,
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  directoryExists,
  fileExists,
  listFiles,
  readTestFile,
  renderSkillMd,
  writeProjectConfig,
  EXIT_CODES,
  FORKED_FROM_METADATA,
} from "../helpers/test-utils.js";
import { CLAUDE_DIR, CLAUDE_SRC_DIR, STANDARD_FILES, STANDARD_DIRS } from "../../src/cli/consts.js";

/**
 * Plugin-mode uninstall E2E tests.
 *
 * P-UNINSTALL-1: Full plugin chain uninstall with Claude CLI
 *   - Builds a plugin source, registers marketplace, installs a plugin,
 *     sets up config, then runs `uninstall --yes` and verifies cleanup.
 *
 * P-UNINSTALL-3: Uninstall with plugin config but no real plugins installed.
 *   - Config references plugin-mode skills, but no plugins exist on disk.
 *   - Verifies uninstall completes gracefully and cleans up local files.
 *
 * Reference: e2e-framework-design.md, Section 4.3
 */

const claudeAvailable = await isClaudeCLIAvailable();

describe.skipIf(!claudeAvailable)(
  "uninstall with plugins calls Claude CLI",
  () => {
    let fixture: E2EPluginSource;
    let projectDir: string;
    let projectTempDir: string;
    // Real HOME is needed so the CLI can find the plugin registry at
    // ~/.claude/plugins/installed_plugins.json (written by claudePluginInstall).
    const realHome = process.env.HOME || os.homedir();

    beforeAll(async () => {
      await ensureBinaryExists();

      // Step 1: Build plugin source (source -> build plugins -> build marketplace)
      fixture = await createE2EPluginSource();

      // Step 2: Create an isolated project directory
      projectTempDir = await createTempDir();
      projectDir = path.join(projectTempDir, "project");
      await mkdir(projectDir, { recursive: true });

      // Step 3: Register marketplace with Claude CLI
      await claudePluginMarketplaceAdd(fixture.sourceDir);

      // Step 4: Install a plugin via Claude CLI
      const pluginRef = `web-framework-react@${fixture.marketplaceName}`;
      await claudePluginInstall(pluginRef, "project", projectDir);

      // Step 5: Create config.ts referencing the installed plugin
      await writeProjectConfig(projectDir, {
        name: "plugin-uninstall-test",
        skills: [
          {
            id: "web-framework-react",
            scope: "project",
            source: fixture.marketplaceName,
          },
        ],
        agents: [{ name: "web-developer", scope: "project" }],
        domains: ["web"],
      });

      // Step 6: Create local skill with forkedFrom metadata (so skill uninstall works)
      const skillDir = path.join(
        projectDir,
        CLAUDE_DIR,
        STANDARD_DIRS.SKILLS,
        "web-framework-react",
      );
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
      );
      await writeFile(
        path.join(skillDir, STANDARD_FILES.METADATA_YAML),
        FORKED_FROM_METADATA,
      );

      // Step 7: Create agents directory
      const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
      await mkdir(agentsDir, { recursive: true });
      await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

      // Note: No createPermissionsFile() here. The claudePluginInstall() call
      // in Step 4 creates .claude/settings.json with enabledPlugins. We must
      // not overwrite it with a permissions-only file.
    }, 120_000);

    afterAll(async () => {
      if (fixture) await cleanupTempDir(fixture.tempDir);
      if (projectTempDir) await cleanupTempDir(projectTempDir);
    });

    describe("pre-conditions", () => {
      it("should have the plugin registered in settings before uninstall", async () => {
        const pluginKey = `web-framework-react@${fixture.marketplaceName}`;
        const isRegistered = await verifyPluginInSettings(projectDir, pluginKey);
        expect(isRegistered).toBe(true);
      });
    });

    describe("after uninstall --yes", () => {
      let uninstallResult: Awaited<ReturnType<typeof runCLI>>;

      beforeAll(async () => {
        // Use real HOME so the CLI finds the plugin registry and can call
        // `claude plugin uninstall` to deregister the plugin.
        uninstallResult = await runCLI(["uninstall", "--yes"], projectDir, {
          env: { HOME: realHome },
        });
      }, 60_000);

      it("should exit with code 0", () => {
        expect(uninstallResult.exitCode).toBe(EXIT_CODES.SUCCESS);
      });

      it("should report uninstall complete in output", () => {
        expect(uninstallResult.stdout).toContain("Uninstall complete!");
      });

      it("should report per-plugin uninstall messages", () => {
        // The uninstall command logs "  Uninstalled plugin '<name>'" per plugin
        expect(uninstallResult.stdout).toContain("Uninstalled plugin");
      });

      it("should clean up plugin from settings", async () => {
        await verifyNoPlugins(projectDir);
      });

      it("should remove CLI-managed skill directories", async () => {
        const skillsDir = path.join(projectDir, CLAUDE_DIR, STANDARD_DIRS.SKILLS);
        // Skills directory should be removed or empty (all skills were CLI-managed)
        if (await directoryExists(skillsDir)) {
          const entries = await listFiles(skillsDir);
          expect(entries.length).toBe(0);
        }
      });

      it("should remove CLI-compiled agent files", async () => {
        const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
        // Agents directory should be removed (all agents were CLI-compiled)
        expect(await directoryExists(agentsDir)).toBe(false);
      });

      it("should preserve config directory (without --all)", async () => {
        expect(await directoryExists(path.join(projectDir, CLAUDE_SRC_DIR))).toBe(true);
      });
    });
  },
);

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

    // Create config that references plugin-mode skills (with a marketplace source)
    // but do NOT install any plugins via Claude CLI.
    // The uninstall command will detect skills in config but no matching
    // enabledPlugins in settings.json, so cliPluginNames will be empty.
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

    // Create local skill with forkedFrom metadata so the skill removal logic works
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    // Create agents directory with a compiled agent
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    // Should succeed: no plugins to uninstall, but local files are cleaned up
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

    // Create skill with forkedFrom metadata
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    // Create agents
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    // Verify files exist before uninstall
    expect(await directoryExists(skillDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);

    const { exitCode } = await runCLI(["uninstall", "--yes"], projectDir);
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    // Skills and agents should be removed even though no plugins were uninstalled
    expect(await directoryExists(skillDir)).toBe(false);
    expect(await directoryExists(agentsDir)).toBe(false);
  });

  it("should handle settings.json with plugins that are not in config", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    // Create config with NO plugin skills (only local source)
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

    // Create settings.json with plugins NOT in config (manually placed)
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

    // Create skill with forkedFrom
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    // Create agents
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // The manually placed plugin should NOT be uninstalled (not in config intersection)
    // But local files should still be cleaned up
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

    // Create skill with forkedFrom
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    const configDir = path.join(projectDir, CLAUDE_SRC_DIR);
    expect(await directoryExists(configDir)).toBe(true);

    const { exitCode, stdout } = await runCLI(["uninstall", "--all", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Config should be removed with --all
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

    // Config references a plugin skill from "some-marketplace"
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

    // Create settings.json with BOTH a config-tracked plugin AND a manual plugin.
    // The config-tracked key matches `${skill.id}@${skill.source}` from config.
    // The manual plugin is NOT in config, so it should survive uninstall.
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

    // Create local skill with forkedFrom metadata
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    // Create agents directory
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Read settings.json after uninstall to verify manual plugin survived
    const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
    const settingsExists = await fileExists(settingsPath);

    if (settingsExists) {
      const settingsContent = await readTestFile(settingsPath);
      const settings = JSON.parse(settingsContent);

      // Manual plugin must still be present — it was never in the config intersection
      expect(settings.enabledPlugins?.["manual-plugin@other-marketplace"]).toBe(true);
    }

    // Local skill files should be cleaned up regardless
    expect(await directoryExists(skillDir)).toBe(false);
  });

  it("should not remove enabledPlugins entries that are not in config", async () => {
    tempDir = await createTempDir();
    const projectDir = path.join(tempDir, "project");

    // Config references TWO plugin skills from different sources
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

    // settings.json has plugins from multiple sources, only one matches config
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

    // Create local skill with forkedFrom metadata
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React"),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    // Create agents directory
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    const { exitCode, stdout } = await runCLI(["uninstall", "--yes"], projectDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Verify non-config plugins survive in settings.json
    const settingsPath = path.join(projectDir, CLAUDE_DIR, "settings.json");
    const settingsExists = await fileExists(settingsPath);

    if (settingsExists) {
      const settingsContent = await readTestFile(settingsPath);
      const settings = JSON.parse(settingsContent);

      // These plugins were NOT in config, so they must survive
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

    // Config references plugin skills
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

    // Create local skill with forkedFrom metadata
    const skillDir = path.join(
      projectDir,
      CLAUDE_DIR,
      STANDARD_DIRS.SKILLS,
      "web-framework-react",
    );
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd("web-framework-react", "React framework", "# React\n\nTest content."),
    );
    await writeFile(
      path.join(skillDir, STANDARD_FILES.METADATA_YAML),
      FORKED_FROM_METADATA,
    );

    // Create agents directory
    const agentsDir = path.join(projectDir, CLAUDE_DIR, "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(path.join(agentsDir, "web-developer.md"), "---\nname: web-developer\n---\n");

    // Create settings.json with matching enabledPlugins
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

    // Verify files exist before uninstall
    expect(await directoryExists(skillDir)).toBe(true);
    expect(await directoryExists(agentsDir)).toBe(true);

    // Use a minimal PATH that includes node and basic Unix utilities but NOT claude.
    // process.execPath gives the absolute path to the node binary.
    const minimalPath = [
      path.dirname(process.execPath),
      "/usr/bin",
      "/bin",
    ].join(":");

    const { exitCode, stdout, stderr } = await runCLI(["uninstall", "--yes"], projectDir, {
      env: {
        PATH: minimalPath,
        HOME: projectDir,
      },
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Uninstall complete!");

    // Local skill directories should be removed
    expect(await directoryExists(skillDir)).toBe(false);

    // Agent directories should be removed
    expect(await directoryExists(agentsDir)).toBe(false);

    // Should not contain errors about missing claude binary
    expect(stderr).not.toContain("claude");
    expect(stdout).not.toContain("claude: command not found");
  });
});
