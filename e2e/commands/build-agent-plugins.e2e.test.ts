import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  ensureBinaryExists,
  cleanupTempDir,
  createTempDir,
  fileExists,
  readTestFile,
  runCLI,
  EXIT_CODES,
  INSTALL_TIMEOUT_MS,
  SETUP_TIMEOUT_MS,
} from "../helpers/test-utils.js";

/**
 * E2E tests for `build plugins --agents-dir`: agent plugin compilation.
 *
 * Investigation findings:
 *
 * 1. `build plugins` compiles SKILL plugins by default (from `src/skills/`).
 *    Agent plugins are ONLY compiled when the `--agents-dir` flag is passed.
 *
 * 2. `compileAllAgentPlugins()` in `agent-plugin-compiler.ts` expects
 *    pre-compiled `.md` files with YAML frontmatter (`name` and `description`
 *    fields required). It does NOT consume raw agent source directories
 *    (`metadata.yaml` + `intro.md` + `workflow.md`).
 *
 * 3. The existing `createE2EPluginSource()` helper runs `build plugins`
 *    WITHOUT `--agents-dir`, so no agent plugins are built in existing tests.
 *
 * 4. Each agent plugin is output to `<outputDir>/agent-<name>/` with:
 *    - `.claude-plugin/plugin.json` (manifest with `agents: "./agents/"`)
 *    - `agents/<name>.md` (copy of the source .md file)
 *
 * The workflow for agent plugins is:
 *   Compiled agent .md (with frontmatter) ->
 *   `build plugins --agents-dir <dir>` ->
 *   `dist/plugins/agent-<name>/` (plugin package)
 */

const AGENT_NAMES = ["web-developer", "api-developer"] as const;
const EXPECTED_AGENT_COUNT = 2;

/** Creates a minimal agent .md file with valid YAML frontmatter. */
function createAgentMd(name: string, description: string, body?: string): string {
  const content = body ?? `# ${name}\n\nYou are a ${description}.`;
  return `---\nname: ${name}\ndescription: ${description}\n---\n\n${content}`;
}

describe("build agent plugins", () => {
  let tempDir: string;
  let agentsDir: string;
  let sourceDir: string;

  beforeAll(async () => {
    await ensureBinaryExists();

    tempDir = await createTempDir();
    sourceDir = path.join(tempDir, "source");
    agentsDir = path.join(sourceDir, "compiled-agents");

    await mkdir(agentsDir, { recursive: true });

    // Create pre-compiled agent .md files (the format compileAllAgentPlugins expects)
    for (const agentName of AGENT_NAMES) {
      await writeFile(
        path.join(agentsDir, `${agentName}.md`),
        createAgentMd(agentName, `E2E test agent for ${agentName}`),
      );
    }
  }, INSTALL_TIMEOUT_MS);

  afterAll(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
    }
  });

  describe("build plugins with --agents-dir flag", () => {
    let buildResult: Awaited<ReturnType<typeof runCLI>>;
    const outputDir = "dist/plugins";

    beforeAll(async () => {
      // We also need a minimal skills directory for the skills portion.
      // Create an empty skills dir so the skill compilation doesn't fail.
      const skillsDir = path.join(sourceDir, "src", "skills");
      await mkdir(skillsDir, { recursive: true });

      buildResult = await runCLI(
        ["build", "plugins", "--agents-dir", agentsDir, "--skills-dir", skillsDir],
        sourceDir,
      );
    }, SETUP_TIMEOUT_MS);

    it("should exit with code 0", () => {
      expect(buildResult.exitCode).toBe(EXIT_CODES.SUCCESS);
    });

    it("should report compiled agent count in output", () => {
      expect(buildResult.stdout).toContain(`Compiled ${EXPECTED_AGENT_COUNT} agent plugins`);
    });

    it("should produce a plugin directory for each agent", async () => {
      const pluginsDir = path.join(sourceDir, outputDir);

      for (const agentName of AGENT_NAMES) {
        const agentPluginDir = path.join(pluginsDir, `agent-${agentName}`);
        const exists = await fileExists(path.join(agentPluginDir, ".claude-plugin", "plugin.json"));
        expect(exists, `Missing plugin manifest for agent-${agentName}`).toBe(true);
      }
    });

    it("should produce valid plugin.json with name, version, and agents path", async () => {
      const pluginsDir = path.join(sourceDir, outputDir);

      for (const agentName of AGENT_NAMES) {
        const manifestPath = path.join(
          pluginsDir,
          `agent-${agentName}`,
          ".claude-plugin",
          "plugin.json",
        );
        const content = await readTestFile(manifestPath);
        const manifest = JSON.parse(content);

        expect(manifest.name).toBe(`agent-${agentName}`);
        expect(typeof manifest.version).toBe("string");
        expect(manifest.agents).toBe("./agents/");
        expect(manifest.description).toBe(`E2E test agent for ${agentName}`);
      }
    });

    it("should copy agent .md files into the plugin's agents/ subdirectory", async () => {
      const pluginsDir = path.join(sourceDir, outputDir);

      for (const agentName of AGENT_NAMES) {
        const copiedAgentPath = path.join(
          pluginsDir,
          `agent-${agentName}`,
          "agents",
          `${agentName}.md`,
        );
        const exists = await fileExists(copiedAgentPath);
        expect(exists, `Missing copied agent .md for ${agentName}`).toBe(true);

        const content = await readTestFile(copiedAgentPath);
        expect(content).toContain(`name: ${agentName}`);
        expect(content).toContain(`description: E2E test agent for ${agentName}`);
      }
    });

    it("should report agent compilation success messages", () => {
      for (const agentName of AGENT_NAMES) {
        expect(buildResult.stdout).toContain(`agent-${agentName}`);
      }
    });
  });

  describe("build plugins without --agents-dir does not compile agents", () => {
    it("should not produce agent plugin directories when --agents-dir is omitted", async () => {
      const noAgentTempDir = await createTempDir();
      const noAgentSourceDir = path.join(noAgentTempDir, "source");
      const skillsDir = path.join(noAgentSourceDir, "src", "skills");
      await mkdir(skillsDir, { recursive: true });

      try {
        const result = await runCLI(
          ["build", "plugins", "--skills-dir", skillsDir],
          noAgentSourceDir,
        );
        expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
        // Output should NOT mention agent compilation
        expect(result.stdout).not.toContain("Compiling agent plugins");
        expect(result.stdout).not.toContain("agent plugins");
      } finally {
        await cleanupTempDir(noAgentTempDir);
      }
    });
  });

  describe("agent plugin edge cases", () => {
    it("should skip agents with missing frontmatter and compile valid ones", async () => {
      const edgeTempDir = await createTempDir();
      const edgeSourceDir = path.join(edgeTempDir, "source");
      const edgeAgentsDir = path.join(edgeSourceDir, "edge-agents");
      const edgeSkillsDir = path.join(edgeSourceDir, "src", "skills");
      await mkdir(edgeAgentsDir, { recursive: true });
      await mkdir(edgeSkillsDir, { recursive: true });

      // Valid agent
      await writeFile(
        path.join(edgeAgentsDir, "good-agent.md"),
        createAgentMd("good-agent", "A valid agent"),
      );

      // Invalid agent (no frontmatter)
      await writeFile(
        path.join(edgeAgentsDir, "bad-agent.md"),
        "# No frontmatter here\n\nJust plain markdown.",
      );

      try {
        const result = await runCLI(
          ["build", "plugins", "--agents-dir", edgeAgentsDir, "--skills-dir", edgeSkillsDir],
          edgeSourceDir,
        );

        // Build should still succeed (bad agents are warned, not fatal)
        expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

        // Should compile the valid agent
        expect(result.stdout).toContain("agent-good-agent");

        // Should have compiled 1 agent plugin (the valid one)
        expect(result.stdout).toContain("Compiled 1 agent plugins");

        // The valid agent's plugin directory should exist
        const pluginDir = path.join(edgeSourceDir, "dist", "plugins", "agent-good-agent");
        expect(await fileExists(path.join(pluginDir, ".claude-plugin", "plugin.json"))).toBe(true);
      } finally {
        await cleanupTempDir(edgeTempDir);
      }
    });

    it("should handle empty agents directory gracefully", async () => {
      const emptyTempDir = await createTempDir();
      const emptySourceDir = path.join(emptyTempDir, "source");
      const emptyAgentsDir = path.join(emptySourceDir, "empty-agents");
      const emptySkillsDir = path.join(emptySourceDir, "src", "skills");
      await mkdir(emptyAgentsDir, { recursive: true });
      await mkdir(emptySkillsDir, { recursive: true });

      try {
        const result = await runCLI(
          ["build", "plugins", "--agents-dir", emptyAgentsDir, "--skills-dir", emptySkillsDir],
          emptySourceDir,
        );

        expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
        expect(result.stdout).toContain("Compiled 0 agent plugins");
      } finally {
        await cleanupTempDir(emptyTempDir);
      }
    });

    it("should use custom --output-dir for agent plugin output", async () => {
      const customOutTempDir = await createTempDir();
      const customOutSourceDir = path.join(customOutTempDir, "source");
      const customAgentsDir = path.join(customOutSourceDir, "my-agents");
      const customSkillsDir = path.join(customOutSourceDir, "src", "skills");
      const customOutputDir = "custom-output/plugins";
      await mkdir(customAgentsDir, { recursive: true });
      await mkdir(customSkillsDir, { recursive: true });

      await writeFile(
        path.join(customAgentsDir, "test-agent.md"),
        createAgentMd("test-agent", "Agent for output dir test"),
      );

      try {
        const result = await runCLI(
          [
            "build",
            "plugins",
            "--agents-dir",
            customAgentsDir,
            "--skills-dir",
            customSkillsDir,
            "--output-dir",
            customOutputDir,
          ],
          customOutSourceDir,
        );

        expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);

        const manifestPath = path.join(
          customOutSourceDir,
          customOutputDir,
          "agent-test-agent",
          ".claude-plugin",
          "plugin.json",
        );
        expect(
          await fileExists(manifestPath),
          "Agent plugin should be in custom output directory",
        ).toBe(true);
      } finally {
        await cleanupTempDir(customOutTempDir);
      }
    });
  });
});
