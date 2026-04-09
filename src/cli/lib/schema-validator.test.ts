import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import { mkdir, writeFile } from "fs/promises";
import { validateAllSchemas, printValidationResults } from "./schema-validator";
import type { FullValidationResult } from "./schema-validator";
import { createTempDir, cleanupTempDir } from "./__tests__/helpers";
import { renderAgentYaml } from "./__tests__/content-generators";
import { CLAUDE_DIR, PLUGIN_MANIFEST_FILE, STANDARD_DIRS, STANDARD_FILES } from "../consts";

describe("schema-validator", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir("schema-validator-test-");
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe("validateAllSchemas", () => {
    it("should return valid result when no data files exist", async () => {
      // Empty directory - no files to validate means all targets pass with 0 files
      const result = await validateAllSchemas(tempDir);

      expect(result.valid).toBe(true);
      expect(result.summary.totalFiles).toBe(0);
      expect(result.summary.validFiles).toBe(0);
      expect(result.summary.invalidFiles).toBe(0);
    });

    it("should return results for all VALIDATION_TARGETS", async () => {
      const result = await validateAllSchemas(tempDir);

      // There are 14 validation targets defined in schema-validator.ts
      const EXPECTED_TARGET_COUNT = 14;
      expect(result.results).toHaveLength(EXPECTED_TARGET_COUNT);
      expect(result.summary.totalSchemas).toBe(EXPECTED_TARGET_COUNT);
    });

    it("should include schema names in results", async () => {
      const result = await validateAllSchemas(tempDir);

      const schemaNames = result.results.map((r) => r.schemaName);
      expect(schemaNames).toContain("Skill Categories");
      expect(schemaNames).toContain("Skill Rules");
      expect(schemaNames).toContain("Skill Metadata");
      expect(schemaNames).toContain("Stack Config");
      expect(schemaNames).toContain("Agent Definition");
    });

    it("should validate a valid metadata.yaml file", async () => {
      // Create a valid metadata.yaml matching the inline Zod agentValidationSchema
      // Required fields: id, title, description, tools
      const agentDir = path.join(tempDir, "src", "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, STANDARD_FILES.METADATA_YAML),
        renderAgentYaml("test-agent", "A test agent for validation", { title: "Test Agent" }),
      );

      const result = await validateAllSchemas(tempDir);

      // Find the Agent Definition result
      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true, invalidFiles: [] }),
      );
    });

    it("should detect invalid metadata.yaml file", async () => {
      // Create an invalid metadata.yaml (missing required "description" and "tools" fields)
      const agentDir = path.join(tempDir, "src", "agents", "bad-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, STANDARD_FILES.METADATA_YAML),
        ["id: bad-agent", "title: Bad Agent"].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toStrictEqual(
        expect.objectContaining({ valid: false, totalFiles: 1, validFiles: 0 }),
      );
      expect(agentResult!.invalidFiles).toHaveLength(1);
      expect(agentResult!.invalidFiles[0].errors).toHaveLength(2);
    });

    it("should validate stack config files", async () => {
      // Stack config validated by inline stackConfigValidationSchema (Zod)
      // Required: name, version, author, skills (array of {id}), agents (array of kebab-case strings)
      const stackDir = path.join(tempDir, "src", "stacks", "my-stack");
      await mkdir(stackDir, { recursive: true });
      await writeFile(
        path.join(stackDir, "config.yaml"),
        [
          "id: my-stack",
          "name: My Stack",
          "version: '1.0.0'",
          "author: '@test'",
          "description: A test stack",
          "skills:",
          "  - id: web-framework-react",
          "agents:",
          "  - web-developer",
        ].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const stackResult = result.results.find((r) => r.schemaName === "Stack Config");
      expect(stackResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true }),
      );
    });

    it("should validate multiple files and aggregate results", async () => {
      // Create two valid agents and one invalid
      for (const name of ["agent-one", "agent-two"]) {
        const dir = path.join(tempDir, "src", "agents", name);
        await mkdir(dir, { recursive: true });
        await writeFile(
          path.join(dir, STANDARD_FILES.METADATA_YAML),
          renderAgentYaml(name, "Valid agent", { title: `Agent ${name}`, tools: ["Read"] }),
        );
      }

      const invalidDir = path.join(tempDir, "src", "agents", "agent-bad");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(
        path.join(invalidDir, STANDARD_FILES.METADATA_YAML),
        ["id: agent-bad"].join("\n"), // missing required fields
      );

      const result = await validateAllSchemas(tempDir);

      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 3, validFiles: 2, valid: false }),
      );
      expect(agentResult!.invalidFiles).toHaveLength(1);

      // Overall result should be invalid due to the bad agent
      expect(result.valid).toBe(false);
      expect(result.summary.invalidFiles).toBeGreaterThanOrEqual(1);
    });

    it("should set overall valid to false when any target has invalid files", async () => {
      // Agent missing required fields (title, description, tools) will fail Zod validation
      const agentDir = path.join(tempDir, "src", "agents", "incomplete-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(path.join(agentDir, STANDARD_FILES.METADATA_YAML), "id: incomplete-agent\n");

      const result = await validateAllSchemas(tempDir);

      expect(result.valid).toBe(false);
    });

    it("should report correct summary totals", async () => {
      // 1 valid agent + 1 invalid agent
      const validDir = path.join(tempDir, "src", "agents", "valid-agent");
      await mkdir(validDir, { recursive: true });
      await writeFile(
        path.join(validDir, STANDARD_FILES.METADATA_YAML),
        renderAgentYaml("valid", "Valid", { title: "Valid", tools: ["Read"] }),
      );

      const invalidDir = path.join(tempDir, "src", "agents", "invalid-agent");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(path.join(invalidDir, STANDARD_FILES.METADATA_YAML), "id: invalid\n");

      const result = await validateAllSchemas(tempDir);

      expect(result.summary.totalFiles).toBe(2);
      expect(result.summary.validFiles).toBe(1);
      expect(result.summary.invalidFiles).toBe(1);
    });

    it("should handle YAML parse errors gracefully", async () => {
      const agentDir = path.join(tempDir, "src", "agents", "bad-yaml");
      await mkdir(agentDir, { recursive: true });
      await writeFile(path.join(agentDir, STANDARD_FILES.METADATA_YAML), "id: [invalid: yaml: :::");

      const result = await validateAllSchemas(tempDir);

      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      // YAML parsing may either succeed with weird data or fail
      // Either way, the function should not throw
      expect(agentResult).toStrictEqual(expect.objectContaining({ totalFiles: 1 }));
    });

    it("should validate skill frontmatter from SKILL.md files", async () => {
      // Validated by inline skillFrontmatterValidationSchema (Zod .strict())
      // Required: name, description. Optional: model, disable-model-invocation, etc.

      // Create a SKILL.md with valid frontmatter in src/skills
      const skillDir = path.join(tempDir, "src", STANDARD_DIRS.SKILLS, "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        [
          "---",
          "name: test-skill",
          "description: A test skill",
          "---",
          "",
          "# Test Skill",
          "",
          "Content here.",
        ].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const frontmatterResult = result.results.find((r) => r.schemaName === "Skill Frontmatter");
      expect(frontmatterResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true }),
      );
    });

    it("should detect invalid skill frontmatter", async () => {
      // Create a SKILL.md with missing description (required by Zod schema)
      const skillDir = path.join(tempDir, "src", STANDARD_DIRS.SKILLS, "bad-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        ["---", "name: bad-skill", "---", "", "# Bad Skill"].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const frontmatterResult = result.results.find((r) => r.schemaName === "Skill Frontmatter");
      expect(frontmatterResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 0, valid: false }),
      );
      expect(frontmatterResult!.invalidFiles).toHaveLength(1);
    });

    it("should handle SKILL.md without frontmatter", async () => {
      const skillDir = path.join(tempDir, "src", STANDARD_DIRS.SKILLS, "no-frontmatter");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, STANDARD_FILES.SKILL_MD),
        "# No Frontmatter\n\nJust content without YAML.",
      );

      const result = await validateAllSchemas(tempDir);

      const frontmatterResult = result.results.find((r) => r.schemaName === "Skill Frontmatter");
      expect(frontmatterResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 0 }),
      );
      expect(frontmatterResult!.invalidFiles[0].errors[0]).toContain("frontmatter");
    });

    it("should validate skill metadata.yaml files", async () => {
      const metadataDir = path.join(
        tempDir,
        "src",
        STANDARD_DIRS.SKILLS,
        "web",
        "framework",
        "react",
      );
      await mkdir(metadataDir, { recursive: true });
      await writeFile(
        path.join(metadataDir, STANDARD_FILES.METADATA_YAML),
        [
          "author: '@test'",
          "category: web-framework",
          "displayName: React",
          "cliDescription: React component patterns and hooks",
          "usageGuidance: When building React components and hooks",
          "slug: react",
        ].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const metadataResult = result.results.find((r) => r.schemaName === "Skill Metadata");
      expect(metadataResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true }),
      );
    });

    it("should detect invalid skill metadata.yaml", async () => {
      const metadataDir = path.join(tempDir, "src", STANDARD_DIRS.SKILLS, "invalid-skill");
      await mkdir(metadataDir, { recursive: true });
      // Missing required fields: category, displayName, cliDescription, usageGuidance
      await writeFile(path.join(metadataDir, STANDARD_FILES.METADATA_YAML), "author: '@test'\n");

      const result = await validateAllSchemas(tempDir);

      const metadataResult = result.results.find((r) => r.schemaName === "Skill Metadata");
      expect(metadataResult).toStrictEqual(expect.objectContaining({ valid: false }));
      expect(metadataResult!.invalidFiles).toHaveLength(1);
    });

    it("should validate plugin manifest JSON files", async () => {
      const pluginDir = path.join(tempDir, CLAUDE_DIR, "plugins", "test-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(
        path.join(pluginDir, PLUGIN_MANIFEST_FILE),
        JSON.stringify({
          name: "test-plugin",
          version: "1.0.0",
          description: "A test plugin",
        }),
      );

      const result = await validateAllSchemas(tempDir);

      const pluginResult = result.results.find((r) => r.schemaName === "Plugin Manifest");
      expect(pluginResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true }),
      );
    });

    it("should detect invalid plugin manifest (invalid JSON)", async () => {
      const pluginDir = path.join(tempDir, CLAUDE_DIR, "plugins", "bad-plugin");
      await mkdir(pluginDir, { recursive: true });
      await writeFile(path.join(pluginDir, PLUGIN_MANIFEST_FILE), "not valid json {{{");

      const result = await validateAllSchemas(tempDir);

      const pluginResult = result.results.find((r) => r.schemaName === "Plugin Manifest");
      expect(pluginResult).toStrictEqual(expect.objectContaining({ valid: false }));
      expect(pluginResult!.invalidFiles).toHaveLength(1);
      expect(pluginResult!.invalidFiles[0].errors[0]).toContain("Failed to parse");
    });

    it("should validate project source config (config in .claude-src)", async () => {
      const srcDir = path.join(tempDir, ".claude-src");
      await mkdir(srcDir, { recursive: true });
      await writeFile(
        path.join(srcDir, "config.yaml"),
        [
          "name: My Project",
          "description: A test project",
          "agents:",
          "  - web-developer",
          "skills:",
          "  - web-framework-react",
        ].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const configResult = result.results.find((r) => r.schemaName === "Project Source Config");
      expect(configResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true }),
      );
    });

    it("should validate stack skill frontmatter in src/stacks", async () => {
      const stackSkillDir = path.join(
        tempDir,
        "src",
        "stacks",
        "my-stack",
        STANDARD_DIRS.SKILLS,
        "react",
      );
      await mkdir(stackSkillDir, { recursive: true });
      await writeFile(
        path.join(stackSkillDir, STANDARD_FILES.SKILL_MD),
        [
          "---",
          "name: web-framework-react",
          "description: React component patterns",
          "---",
          "",
          "# React Skill",
        ].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const stackFrontmatterResult = result.results.find(
        (r) => r.schemaName === "Stack Skill Frontmatter",
      );
      expect(stackFrontmatterResult).toStrictEqual(
        expect.objectContaining({ totalFiles: 1, validFiles: 1, valid: true }),
      );
    });
  });

  describe("printValidationResults", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("should print summary header", () => {
      const result: FullValidationResult = {
        valid: true,
        results: [],
        summary: {
          totalSchemas: 3,
          totalFiles: 10,
          validFiles: 10,
          invalidFiles: 0,
        },
      };

      printValidationResults(result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("Schema Validation Summary");
      expect(output).toContain("Total schemas checked: 3");
      expect(output).toContain("Total files: 10");
      expect(output).toContain("Valid: 10");
      expect(output).toContain("Invalid: 0");
    });

    it("should print success message when all valid", () => {
      const result: FullValidationResult = {
        valid: true,
        results: [],
        summary: {
          totalSchemas: 0,
          totalFiles: 0,
          validFiles: 0,
          invalidFiles: 0,
        },
      };

      printValidationResults(result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("All schemas validated successfully");
    });

    it("should print failure message when invalid", () => {
      const result: FullValidationResult = {
        valid: false,
        results: [
          {
            schemaName: "Agent Definition",
            valid: false,
            totalFiles: 1,
            validFiles: 0,
            invalidFiles: [
              {
                file: "src/agents/bad/metadata.yaml",
                errors: ["Missing required field: tools"],
              },
            ],
          },
        ],
        summary: {
          totalSchemas: 1,
          totalFiles: 1,
          validFiles: 0,
          invalidFiles: 1,
        },
      };

      printValidationResults(result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("Validation failed");
    });

    it("should display per-schema results with check/cross marks", () => {
      const result: FullValidationResult = {
        valid: false,
        results: [
          {
            schemaName: "Agent Definition",
            valid: true,
            totalFiles: 3,
            validFiles: 3,
            invalidFiles: [],
          },
          {
            schemaName: "Skill Metadata",
            valid: false,
            totalFiles: 2,
            validFiles: 1,
            invalidFiles: [
              {
                file: "src/skills/bad/metadata.yaml",
                errors: ["category: must be a string"],
              },
            ],
          },
        ],
        summary: {
          totalSchemas: 2,
          totalFiles: 5,
          validFiles: 4,
          invalidFiles: 1,
        },
      };

      printValidationResults(result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("Agent Definition: 3/3 valid");
      expect(output).toContain("Skill Metadata: 1/2 valid");
    });

    it("should display file-level errors for invalid files", () => {
      const result: FullValidationResult = {
        valid: false,
        results: [
          {
            schemaName: "Agent Definition",
            valid: false,
            totalFiles: 1,
            validFiles: 0,
            invalidFiles: [
              {
                file: "src/agents/broken/metadata.yaml",
                errors: ["Missing required field: tools", "Missing required field: description"],
              },
            ],
          },
        ],
        summary: {
          totalSchemas: 1,
          totalFiles: 1,
          validFiles: 0,
          invalidFiles: 1,
        },
      };

      printValidationResults(result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      expect(output).toContain("src/agents/broken/metadata.yaml");
      expect(output).toContain("Missing required field: tools");
      expect(output).toContain("Missing required field: description");
    });

    it("should skip schemas with zero files in per-schema output", () => {
      const result: FullValidationResult = {
        valid: true,
        results: [
          {
            schemaName: "Agent Definition",
            valid: true,
            totalFiles: 0,
            validFiles: 0,
            invalidFiles: [],
          },
          {
            schemaName: "Skill Metadata",
            valid: true,
            totalFiles: 5,
            validFiles: 5,
            invalidFiles: [],
          },
        ],
        summary: {
          totalSchemas: 2,
          totalFiles: 5,
          validFiles: 5,
          invalidFiles: 0,
        },
      };

      printValidationResults(result);

      const output = consoleSpy.mock.calls.map((c: unknown[]) => c[0]).join("\n");
      // "Agent Definition" with 0 files should be skipped
      expect(output).not.toContain("Agent Definition");
      // "Skill Metadata" with 5 files should be shown
      expect(output).toContain("Skill Metadata: 5/5 valid");
    });
  });
});
