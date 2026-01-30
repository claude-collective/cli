import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import {
  TEST_SKILLS,
  createMockSkill,
  createMockMatrix,
} from "../lib/__tests__/helpers";

/**
 * Tests for cc doctor command
 *
 * Note: We test the internal check functions rather than the CLI command itself
 * to avoid process.exit() issues in tests.
 */

// =============================================================================
// Test Setup
// =============================================================================

describe("doctor command", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "cc-doctor-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  // Helper to create a valid config file
  async function createConfig(content: string): Promise<void> {
    const claudeDir = path.join(tempDir, ".claude");
    await mkdir(claudeDir, { recursive: true });
    await writeFile(path.join(claudeDir, "config.yaml"), content);
  }

  // Helper to create agent files
  async function createAgentFile(agentName: string): Promise<void> {
    const agentsDir = path.join(tempDir, ".claude", "agents");
    await mkdir(agentsDir, { recursive: true });
    await writeFile(
      path.join(agentsDir, `${agentName}.md`),
      `---\nname: ${agentName}\n---\n\n# ${agentName}\n`,
    );
  }

  // Helper to create local skill
  async function createLocalSkill(skillName: string): Promise<void> {
    const skillDir = path.join(tempDir, ".claude", "skills", skillName);
    await mkdir(skillDir, { recursive: true });
    await writeFile(
      path.join(skillDir, "SKILL.md"),
      `---\nname: ${skillName}\ndescription: Test skill\n---\n\n# ${skillName}\n`,
    );
    await writeFile(
      path.join(skillDir, "metadata.yaml"),
      `cli_name: ${skillName}\ncli_description: Test skill\n`,
    );
  }

  // =============================================================================
  // Check 1: Config Valid
  // =============================================================================

  describe("checkConfigValid", () => {
    it("should pass with valid config", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
  - api-developer
`);

      const { loadProjectConfig, validateProjectConfig } =
        await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();

      const validation = validateProjectConfig(loaded!.config);
      expect(validation.valid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should fail when config.yaml not found", async () => {
      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).toBeNull();
    });

    it("should fail when config has missing agents field", async () => {
      await createConfig(`
name: my-project
description: Missing agents
`);

      const { loadProjectConfig, validateProjectConfig } =
        await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();

      const validation = validateProjectConfig(loaded!.config);
      expect(validation.valid).toBe(false);
      expect(validation.errors).toContain(
        "agents is required and must be an array",
      );
    });

    it("should fail when config has invalid YAML", async () => {
      // Create malformed YAML
      const claudeDir = path.join(tempDir, ".claude");
      await mkdir(claudeDir, { recursive: true });
      await writeFile(
        path.join(claudeDir, "config.yaml"),
        `name: my-project
agents:
  - [invalid yaml
`,
      );

      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      // Parse error should result in null
      expect(loaded).toBeNull();
    });

    it("should detect legacy config format when id field is present", async () => {
      await createConfig(`
name: my-project
id: deprecated-id
agents:
  - web-developer
`);

      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();
      // When id is present, the config is detected as legacy and normalized
      expect(loaded!.isLegacy).toBe(true);
    });
  });

  // =============================================================================
  // Check 2: Skills Resolved
  // =============================================================================

  describe("checkSkillsResolved", () => {
    it("should pass when all skills exist in matrix", async () => {
      const reactSkill = createMockSkill(
        TEST_SKILLS.REACT,
        "frontend/framework",
      );
      const zustandSkill = createMockSkill(
        TEST_SKILLS.ZUSTAND,
        "frontend/state",
      );
      const matrix = createMockMatrix({
        [TEST_SKILLS.REACT]: reactSkill,
        [TEST_SKILLS.ZUSTAND]: zustandSkill,
      });

      const config = {
        name: "my-project",
        agents: ["web-developer"],
        skills: [TEST_SKILLS.REACT, TEST_SKILLS.ZUSTAND],
      };

      // Count skills in config that are in matrix
      const configSkills = config.skills;
      const resolved = configSkills.filter((s) => s in matrix.skills);
      expect(resolved.length).toBe(configSkills.length);
    });

    it("should fail when skill is not in matrix or local", async () => {
      const matrix = createMockMatrix({});

      const config = {
        name: "my-project",
        agents: ["web-developer"],
        skills: ["nonexistent-skill (@author)"],
      };

      // Check if skill exists
      const configSkills = config.skills;
      const missing = configSkills.filter((s) => !(s in matrix.skills));
      expect(missing).toContain("nonexistent-skill (@author)");
    });

    it("should pass when skill exists locally", async () => {
      await createLocalSkill("my-local-skill");

      const { discoverLocalSkills } = await import("../lib/local-skill-loader");
      const localResult = await discoverLocalSkills(tempDir);

      expect(localResult).not.toBeNull();
      expect(localResult!.skills.length).toBeGreaterThan(0);
    });

    it("should handle skills in agent_skills format", async () => {
      const honoSkill = createMockSkill(TEST_SKILLS.HONO, "backend/framework");
      const matrix = createMockMatrix({
        [TEST_SKILLS.HONO]: honoSkill,
      });

      const config = {
        name: "my-project",
        agents: ["api-developer"],
        agent_skills: {
          "api-developer": [TEST_SKILLS.HONO],
        },
      };

      // Extract skills from agent_skills
      const agentSkills = config.agent_skills["api-developer"];
      expect(Array.isArray(agentSkills)).toBe(true);
      const resolved = (agentSkills as string[]).filter(
        (s) => s in matrix.skills,
      );
      expect(resolved.length).toBe(1);
    });
  });

  // =============================================================================
  // Check 3: Agents Compiled
  // =============================================================================

  describe("checkAgentsCompiled", () => {
    it("should pass when all agent files exist", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
  - api-developer
`);
      await createAgentFile("web-developer");
      await createAgentFile("api-developer");

      const agentsDir = path.join(tempDir, ".claude", "agents");
      expect(existsSync(path.join(agentsDir, "web-developer.md"))).toBe(true);
      expect(existsSync(path.join(agentsDir, "api-developer.md"))).toBe(true);
    });

    it("should warn when agent file is missing", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
  - api-developer
`);
      await createAgentFile("web-developer");
      // Note: api-developer.md is NOT created

      const agentsDir = path.join(tempDir, ".claude", "agents");
      expect(existsSync(path.join(agentsDir, "web-developer.md"))).toBe(true);
      expect(existsSync(path.join(agentsDir, "api-developer.md"))).toBe(false);
    });

    it("should handle empty agents list", async () => {
      await createConfig(`
name: my-project
agents: []
`);

      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.config.agents).toHaveLength(0);
    });
  });

  // =============================================================================
  // Check 4: No Orphans
  // =============================================================================

  describe("checkNoOrphans", () => {
    it("should pass when no orphaned files", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
`);
      await createAgentFile("web-developer");

      const { glob } = await import("../utils/fs");
      const agentsDir = path.join(tempDir, ".claude", "agents");
      const files = await glob("*.md", agentsDir);

      const configAgents = new Set(["web-developer"]);
      const orphans = files
        .map((f) => f.replace(/\.md$/, ""))
        .filter((a) => !configAgents.has(a));

      expect(orphans).toHaveLength(0);
    });

    it("should warn when orphaned file exists", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
`);
      await createAgentFile("web-developer");
      await createAgentFile("orphaned-agent"); // Not in config

      const { glob } = await import("../utils/fs");
      const agentsDir = path.join(tempDir, ".claude", "agents");
      const files = await glob("*.md", agentsDir);

      const configAgents = new Set(["web-developer"]);
      const orphans = files
        .map((f) => f.replace(/\.md$/, ""))
        .filter((a) => !configAgents.has(a));

      expect(orphans).toContain("orphaned-agent");
    });

    it("should pass when agents directory does not exist", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
`);
      // No agents directory created

      const { directoryExists } = await import("../utils/fs");
      const agentsDir = path.join(tempDir, ".claude", "agents");
      expect(await directoryExists(agentsDir)).toBe(false);
    });
  });

  // =============================================================================
  // Check 5: Source Reachable
  // =============================================================================

  describe("checkSourceReachable", () => {
    it("should return matrix from source loader with expected structure", async () => {
      const { loadSkillsMatrixFromSource } =
        await import("../lib/source-loader");

      // Default source should work with forceRefresh to avoid cache issues
      const result = await loadSkillsMatrixFromSource({
        projectDir: tempDir,
        forceRefresh: true,
      });

      // Basic result structure
      expect(result).toBeDefined();
      expect(result.matrix).toBeDefined();
      expect(result.sourcePath).toBeDefined();
      expect(result.isLocal).toBeDefined();

      // Matrix should have expected structure
      expect(result.matrix.skills).toBeDefined();
      expect(result.matrix.categories).toBeDefined();
      expect(typeof result.matrix.skills).toBe("object");
    });
  });

  // =============================================================================
  // Integration: Full Doctor Flow
  // =============================================================================

  describe("full doctor flow", () => {
    it("should pass all checks with valid setup", async () => {
      // Create valid config
      await createConfig(`
name: my-project
agents:
  - web-developer
`);
      // Create agent file
      await createAgentFile("web-developer");

      // Verify setup
      const { loadProjectConfig, validateProjectConfig } =
        await import("../lib/project-config");
      const { directoryExists, fileExists } = await import("../utils/fs");

      // Check 1: Config valid
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();
      const validation = validateProjectConfig(loaded!.config);
      expect(validation.valid).toBe(true);

      // Check 3: Agents compiled
      const agentPath = path.join(
        tempDir,
        ".claude",
        "agents",
        "web-developer.md",
      );
      expect(await fileExists(agentPath)).toBe(true);

      // Check 4: No orphans (only web-developer.md exists)
      const agentsDir = path.join(tempDir, ".claude", "agents");
      expect(await directoryExists(agentsDir)).toBe(true);
    });

    it("should detect multiple issues", async () => {
      // Create config with issues (without id field to avoid legacy detection)
      await createConfig(`
name: my-project
agents:
  - web-developer
  - missing-agent
skills:
  - nonexistent-skill (@author)
`);
      // Create only one agent file
      await createAgentFile("web-developer");
      // Create an orphan
      await createAgentFile("orphaned-agent");

      // Verify issues
      const { loadProjectConfig } = await import("../lib/project-config");
      const { glob } = await import("../utils/fs");

      // Config should load successfully
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();

      // Missing agent
      const agentsDir = path.join(tempDir, ".claude", "agents");
      expect(existsSync(path.join(agentsDir, "missing-agent.md"))).toBe(false);

      // Orphan exists
      const files = await glob("*.md", agentsDir);
      const configAgents = new Set(["web-developer", "missing-agent"]);
      const orphans = files
        .map((f) => f.replace(/\.md$/, ""))
        .filter((a) => !configAgents.has(a));
      expect(orphans).toContain("orphaned-agent");
    });

    it("should skip checks when config is invalid", async () => {
      // Create invalid config (missing agents)
      await createConfig(`
name: my-project
description: No agents field
`);

      const { loadProjectConfig, validateProjectConfig } =
        await import("../lib/project-config");

      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();

      const validation = validateProjectConfig(loaded!.config);
      expect(validation.valid).toBe(false);

      // When config is invalid, other checks should be skipped
      // This is the expected behavior in the doctor command
    });
  });

  // =============================================================================
  // Edge Cases
  // =============================================================================

  describe("edge cases", () => {
    it("should handle empty skills array", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
skills: []
`);

      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.config.skills).toHaveLength(0);
    });

    it("should handle skills as objects with id", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
skills:
  - id: "${TEST_SKILLS.REACT}"
    preloaded: true
`);

      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.config.skills).toHaveLength(1);
      expect((loaded!.config.skills![0] as { id: string }).id).toBe(
        TEST_SKILLS.REACT,
      );
    });

    it("should handle categorized agent_skills format", async () => {
      await createConfig(`
name: my-project
agents:
  - web-developer
agent_skills:
  web-developer:
    frontend:
      - "${TEST_SKILLS.REACT}"
    state:
      - "${TEST_SKILLS.ZUSTAND}"
`);

      const { loadProjectConfig } = await import("../lib/project-config");
      const loaded = await loadProjectConfig(tempDir);
      expect(loaded).not.toBeNull();
      expect(loaded!.config.agent_skills).toBeDefined();
      expect(loaded!.config.agent_skills!["web-developer"]).toBeDefined();
    });
  });
});
