import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import path from "path";
import os from "os";
import { mkdtemp, rm, mkdir, writeFile } from "fs/promises";
import { validateAllSchemas, printValidationResults } from "./schema-validator";
import type { FullValidationResult } from "./schema-validator";

describe("schema-validator", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), "schema-validator-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
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

      // There are 7 validation targets defined in schema-validator.ts
      const EXPECTED_TARGET_COUNT = 7;
      expect(result.results).toHaveLength(EXPECTED_TARGET_COUNT);
      expect(result.summary.totalSchemas).toBe(EXPECTED_TARGET_COUNT);
    });

    it("should include schema names in results", async () => {
      const result = await validateAllSchemas(tempDir);

      const schemaNames = result.results.map((r) => r.schemaName);
      expect(schemaNames).toContain("Skills Matrix");
      expect(schemaNames).toContain("Skill Metadata");
      expect(schemaNames).toContain("Stack Config");
      expect(schemaNames).toContain("Agent Definition");
    });

    it("should validate a valid agent.yaml file", async () => {
      // Create a valid agent.yaml matching the inline Zod agentValidationSchema
      // Required fields: id, title, description, tools
      const agentDir = path.join(tempDir, "src", "agents", "test-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, "agent.yaml"),
        [
          "id: test-agent",
          "title: Test Agent",
          "description: A test agent for validation",
          "tools:",
          "  - Read",
          "  - Write",
        ].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      // Find the Agent Definition result
      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toBeDefined();
      expect(agentResult!.totalFiles).toBe(1);
      expect(agentResult!.validFiles).toBe(1);
      expect(agentResult!.valid).toBe(true);
      expect(agentResult!.invalidFiles).toHaveLength(0);
    });

    it("should detect invalid agent.yaml file", async () => {
      // Create an invalid agent.yaml (missing required "description" and "tools" fields)
      const agentDir = path.join(tempDir, "src", "agents", "bad-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(
        path.join(agentDir, "agent.yaml"),
        ["id: bad-agent", "title: Bad Agent"].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toBeDefined();
      expect(agentResult!.valid).toBe(false);
      expect(agentResult!.totalFiles).toBe(1);
      expect(agentResult!.validFiles).toBe(0);
      expect(agentResult!.invalidFiles).toHaveLength(1);
      expect(agentResult!.invalidFiles[0].errors.length).toBeGreaterThan(0);
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
      expect(stackResult).toBeDefined();
      expect(stackResult!.totalFiles).toBe(1);
      expect(stackResult!.validFiles).toBe(1);
      expect(stackResult!.valid).toBe(true);
    });

    it("should validate multiple files and aggregate results", async () => {
      // Create two valid agents and one invalid
      for (const name of ["agent-one", "agent-two"]) {
        const dir = path.join(tempDir, "src", "agents", name);
        await mkdir(dir, { recursive: true });
        await writeFile(
          path.join(dir, "agent.yaml"),
          [
            `id: ${name}`,
            `title: Agent ${name}`,
            "description: Valid agent",
            "tools:",
            "  - Read",
          ].join("\n"),
        );
      }

      const invalidDir = path.join(tempDir, "src", "agents", "agent-bad");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(
        path.join(invalidDir, "agent.yaml"),
        ["id: agent-bad"].join("\n"), // missing required fields
      );

      const result = await validateAllSchemas(tempDir);

      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toBeDefined();
      expect(agentResult!.totalFiles).toBe(3);
      expect(agentResult!.validFiles).toBe(2);
      expect(agentResult!.invalidFiles).toHaveLength(1);
      expect(agentResult!.valid).toBe(false);

      // Overall result should be invalid due to the bad agent
      expect(result.valid).toBe(false);
      expect(result.summary.invalidFiles).toBeGreaterThanOrEqual(1);
    });

    it("should set overall valid to false when any target has invalid files", async () => {
      // Agent missing required fields (title, description, tools) will fail Zod validation
      const agentDir = path.join(tempDir, "src", "agents", "incomplete-agent");
      await mkdir(agentDir, { recursive: true });
      await writeFile(path.join(agentDir, "agent.yaml"), "id: incomplete-agent\n");

      const result = await validateAllSchemas(tempDir);

      expect(result.valid).toBe(false);
    });

    it("should report correct summary totals", async () => {
      // 1 valid agent + 1 invalid agent
      const validDir = path.join(tempDir, "src", "agents", "valid-agent");
      await mkdir(validDir, { recursive: true });
      await writeFile(
        path.join(validDir, "agent.yaml"),
        "id: valid\ntitle: Valid\ndescription: Valid\ntools:\n  - Read\n",
      );

      const invalidDir = path.join(tempDir, "src", "agents", "invalid-agent");
      await mkdir(invalidDir, { recursive: true });
      await writeFile(path.join(invalidDir, "agent.yaml"), "id: invalid\n");

      const result = await validateAllSchemas(tempDir);

      expect(result.summary.totalFiles).toBe(2);
      expect(result.summary.validFiles).toBe(1);
      expect(result.summary.invalidFiles).toBe(1);
    });

    it("should handle YAML parse errors gracefully", async () => {
      const agentDir = path.join(tempDir, "src", "agents", "bad-yaml");
      await mkdir(agentDir, { recursive: true });
      await writeFile(path.join(agentDir, "agent.yaml"), "id: [invalid: yaml: :::");

      const result = await validateAllSchemas(tempDir);

      const agentResult = result.results.find((r) => r.schemaName === "Agent Definition");
      expect(agentResult).toBeDefined();
      // YAML parsing may either succeed with weird data or fail
      // Either way, the function should not throw
      expect(agentResult!.totalFiles).toBe(1);
    });

    it("should validate skill frontmatter from SKILL.md files", async () => {
      // Validated by inline skillFrontmatterValidationSchema (Zod .strict())
      // Required: name, description. Optional: model, disable-model-invocation, etc.

      // Create a SKILL.md with valid frontmatter in src/skills
      const skillDir = path.join(tempDir, "src", "skills", "test-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
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
      expect(frontmatterResult).toBeDefined();
      expect(frontmatterResult!.totalFiles).toBe(1);
      expect(frontmatterResult!.validFiles).toBe(1);
      expect(frontmatterResult!.valid).toBe(true);
    });

    it("should detect invalid skill frontmatter", async () => {
      // Create a SKILL.md with missing description (required by Zod schema)
      const skillDir = path.join(tempDir, "src", "skills", "bad-skill");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        ["---", "name: bad-skill", "---", "", "# Bad Skill"].join("\n"),
      );

      const result = await validateAllSchemas(tempDir);

      const frontmatterResult = result.results.find((r) => r.schemaName === "Skill Frontmatter");
      expect(frontmatterResult).toBeDefined();
      expect(frontmatterResult!.totalFiles).toBe(1);
      expect(frontmatterResult!.validFiles).toBe(0);
      expect(frontmatterResult!.valid).toBe(false);
      expect(frontmatterResult!.invalidFiles).toHaveLength(1);
    });

    it("should handle SKILL.md without frontmatter", async () => {
      const skillDir = path.join(tempDir, "src", "skills", "no-frontmatter");
      await mkdir(skillDir, { recursive: true });
      await writeFile(
        path.join(skillDir, "SKILL.md"),
        "# No Frontmatter\n\nJust content without YAML.",
      );

      const result = await validateAllSchemas(tempDir);

      const frontmatterResult = result.results.find((r) => r.schemaName === "Skill Frontmatter");
      expect(frontmatterResult).toBeDefined();
      expect(frontmatterResult!.totalFiles).toBe(1);
      expect(frontmatterResult!.validFiles).toBe(0);
      expect(frontmatterResult!.invalidFiles[0].errors[0]).toContain("frontmatter");
    });
  });

  describe("printValidationResults", () => {
    it("should print summary header", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

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

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Schema Validation Summary");
      expect(output).toContain("Total schemas checked: 3");
      expect(output).toContain("Total files: 10");
      expect(output).toContain("Valid: 10");
      expect(output).toContain("Invalid: 0");

      consoleSpy.mockRestore();
    });

    it("should print success message when all valid", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

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

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("All schemas validated successfully");

      consoleSpy.mockRestore();
    });

    it("should print failure message when invalid", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

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
                file: "src/agents/bad/agent.yaml",
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

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Validation failed");

      consoleSpy.mockRestore();
    });

    it("should display per-schema results with check/cross marks", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

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

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("Agent Definition: 3/3 valid");
      expect(output).toContain("Skill Metadata: 1/2 valid");

      consoleSpy.mockRestore();
    });

    it("should display file-level errors for invalid files", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

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
                file: "src/agents/broken/agent.yaml",
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

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      expect(output).toContain("src/agents/broken/agent.yaml");
      expect(output).toContain("Missing required field: tools");
      expect(output).toContain("Missing required field: description");

      consoleSpy.mockRestore();
    });

    it("should skip schemas with zero files in per-schema output", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

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

      const output = consoleSpy.mock.calls.map((c) => c[0]).join("\n");
      // "Agent Definition" with 0 files should be skipped
      expect(output).not.toContain("Agent Definition");
      // "Skill Metadata" with 5 files should be shown
      expect(output).toContain("Skill Metadata: 5/5 valid");

      consoleSpy.mockRestore();
    });
  });
});
