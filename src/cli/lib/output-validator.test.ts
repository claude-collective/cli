import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateCompiledAgent, printOutputValidationResult } from "./output-validator";
import type { ValidationResult } from "../../types";
import type { AgentName } from "../types-matrix";

// =============================================================================
// Helpers
// =============================================================================

/**
 * Generate valid compiled agent content with all required sections.
 * Uses enough lines to exceed the 50-line minimum.
 */
function createValidAgentContent(overrides?: {
  name?: string;
  description?: string;
  tools?: string;
  includeRole?: boolean;
  includeCorePrinciples?: boolean;
  lineCount?: number;
}): string {
  const {
    name = "web-developer",
    description = "A web developer agent",
    tools = "Read, Write, Glob",
    includeRole = true,
    includeCorePrinciples = true,
    lineCount = 60,
  } = overrides ?? {};

  const lines: string[] = [];

  // Frontmatter
  lines.push("---");
  lines.push(`name: ${name}`);
  lines.push(`description: ${description}`);
  lines.push(`tools: ${tools}`);
  lines.push("---");
  lines.push("");

  // Role section
  if (includeRole) {
    lines.push("<role>");
    lines.push("You are a web developer specializing in React.");
    lines.push("</role>");
    lines.push("");
  }

  // Core Principles section
  if (includeCorePrinciples) {
    lines.push("<core_principles>");
    lines.push("## Core Principles");
    lines.push("");
    lines.push("1. Write clean code");
    lines.push("2. Test everything");
    lines.push("3. Follow conventions");
    lines.push("</core_principles>");
    lines.push("");
  }

  // Pad to desired line count
  while (lines.length < lineCount) {
    lines.push("Additional content line for testing purposes.");
  }

  return lines.join("\n");
}

// =============================================================================
// Tests
// =============================================================================

describe("output-validator", () => {
  describe("validateCompiledAgent", () => {
    // =========================================================================
    // Valid content
    // =========================================================================

    it("should return valid for well-formed compiled agent content", () => {
      const content = createValidAgentContent();

      const result = validateCompiledAgent(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it("should return valid with all required sections present", () => {
      const content = createValidAgentContent({
        name: "api-developer",
        description: "Backend developer agent",
        tools: "Read, Write, Bash",
      });

      const result = validateCompiledAgent(content);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    // =========================================================================
    // Empty / missing content
    // =========================================================================

    it("should return invalid for empty string", () => {
      const result = validateCompiledAgent("");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Compiled output is empty");
      expect(result.warnings).toHaveLength(0);
    });

    it("should return invalid for whitespace-only string", () => {
      const result = validateCompiledAgent("   \n\n   ");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Compiled output is empty");
    });

    // =========================================================================
    // Frontmatter validation
    // =========================================================================

    it("should report error when frontmatter is missing", () => {
      const content = "# No frontmatter\n" + "Some content\n".repeat(60);

      const result = validateCompiledAgent(content);

      // Missing frontmatter should produce warnings/errors
      expect(result.warnings).toContain("Missing YAML frontmatter at start of file");
    });

    it("should report error when frontmatter name field is missing", () => {
      const content = [
        "---",
        "description: A developer agent",
        "tools: Read, Write",
        "---",
        "",
        "<role>Developer role</role>",
        "<core_principles>",
        "Core Principles here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      expect(result.errors).toContain("Frontmatter missing required field: name");
    });

    it("should report warning when frontmatter description field is missing", () => {
      const content = [
        "---",
        "name: web-developer",
        "tools: Read, Write",
        "---",
        "",
        "<role>Developer role</role>",
        "<core_principles>",
        "Core Principles here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      expect(result.warnings).toContain("Frontmatter missing field: description");
    });

    it("should report warning when frontmatter tools field is missing", () => {
      const content = [
        "---",
        "name: web-developer",
        "description: A developer agent",
        "---",
        "",
        "<role>Developer role</role>",
        "<core_principles>",
        "Core Principles here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      expect(result.warnings).toContain("Frontmatter missing field: tools");
    });

    it("should report error when frontmatter YAML is malformed", () => {
      const content = [
        "---",
        "name: [unclosed bracket",
        "---",
        "",
        "<role>Developer role</role>",
        "<core_principles>",
        "Core Principles here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      expect(result.errors).toContain("Failed to parse YAML frontmatter");
    });

    // =========================================================================
    // XML tag balance
    // =========================================================================

    it("should report error for unclosed XML tags", () => {
      const content = createValidAgentContent();
      // Add an unclosed tag
      const contentWithUnclosed = content + "\n<custom_section>\nSome content\n";

      const result = validateCompiledAgent(contentWithUnclosed);

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("Unclosed XML tag: <custom_section>")]),
      );
    });

    it("should report error for extra closing tags", () => {
      const content = createValidAgentContent();
      const contentWithExtra = content + "\n</orphan_tag>\n";

      const result = validateCompiledAgent(contentWithExtra);

      expect(result.errors).toEqual(
        expect.arrayContaining([expect.stringContaining("Extra closing tag: </orphan_tag>")]),
      );
    });

    it("should ignore XML tags inside backticks (code blocks)", () => {
      const content = createValidAgentContent();
      // Tags within backticks should be ignored
      const contentWithCodeTag = content + "\nUse `<custom_tag>` in your code.\n";

      const result = validateCompiledAgent(contentWithCodeTag);

      // Should NOT report unclosed tag for <custom_tag> since it's in backticks
      const customTagErrors = result.errors.filter((e) => e.includes("custom_tag"));
      expect(customTagErrors).toHaveLength(0);
    });

    it("should handle balanced XML tags without errors", () => {
      const content = createValidAgentContent();
      const contentWithBalancedTags = content + "\n<test_section>\nContent\n</test_section>\n";

      const result = validateCompiledAgent(contentWithBalancedTags);

      const testTagErrors = result.errors.filter((e) => e.includes("test_section"));
      expect(testTagErrors).toHaveLength(0);
    });

    // =========================================================================
    // Template artifacts
    // =========================================================================

    it("should warn about unprocessed {{ }} template variables", () => {
      const content = createValidAgentContent();
      const contentWithTemplate = content + "\nHello {{ user_name }}!\n";

      const result = validateCompiledAgent(contentWithTemplate);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Template artifacts found: 1 unprocessed {{ }} tags"),
        ]),
      );
    });

    it("should warn about unprocessed {% %} template control blocks", () => {
      const content = createValidAgentContent();
      const contentWithControl = content + "\n{% if condition %}\nContent\n{% endif %}\n";

      const result = validateCompiledAgent(contentWithControl);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Template artifacts found: 2 unprocessed {% %} tags"),
        ]),
      );
    });

    it("should not warn when no template artifacts are present", () => {
      const content = createValidAgentContent();

      const result = validateCompiledAgent(content);

      const templateWarnings = result.warnings.filter((w) => w.includes("Template artifacts"));
      expect(templateWarnings).toHaveLength(0);
    });

    // =========================================================================
    // Required patterns
    // =========================================================================

    it("should warn when <role> section is missing", () => {
      const content = createValidAgentContent({ includeRole: false });

      const result = validateCompiledAgent(content);

      expect(result.warnings).toContain("Missing <role> section");
    });

    it("should warn when Core Principles section is missing", () => {
      const content = createValidAgentContent({ includeCorePrinciples: false });

      const result = validateCompiledAgent(content);

      expect(result.warnings).toContain("Missing Core Principles section");
    });

    it("should accept core_principles as alternative to Core Principles", () => {
      // The check allows either "Core Principles" or "core_principles"
      const content = [
        "---",
        "name: web-developer",
        "description: A developer agent",
        "tools: Read, Write",
        "---",
        "",
        "<role>Developer role</role>",
        "",
        "<core_principles>",
        "Principles content here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      const principleWarnings = result.warnings.filter((w) => w.includes("Core Principles"));
      expect(principleWarnings).toHaveLength(0);
    });

    it("should warn when output is suspiciously short (under 50 lines)", () => {
      const content = createValidAgentContent({ lineCount: 30 });

      const result = validateCompiledAgent(content);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/Suspiciously short output: only \d+ lines/),
        ]),
      );
    });

    it("should not warn about length for content with 50+ lines", () => {
      const content = createValidAgentContent({ lineCount: 60 });

      const result = validateCompiledAgent(content);

      const lengthWarnings = result.warnings.filter((w) => w.includes("Suspiciously short"));
      expect(lengthWarnings).toHaveLength(0);
    });

    // =========================================================================
    // Validity flag
    // =========================================================================

    it("should be valid when only warnings are present (no errors)", () => {
      // Missing description and tools produce warnings, not errors
      const content = [
        "---",
        "name: web-developer",
        "---",
        "",
        "<role>Developer role</role>",
        "",
        "<core_principles>",
        "Core Principles here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      // Warnings present, but no errors
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should be invalid when errors are present (e.g. missing name)", () => {
      const content = [
        "---",
        "description: A developer agent",
        "tools: Read, Write",
        "---",
        "",
        "<role>Developer role</role>",
        "<core_principles>",
        "Core Principles here",
        "</core_principles>",
        ...Array.from({ length: 50 }, () => "Content line"),
      ].join("\n");

      const result = validateCompiledAgent(content);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    // =========================================================================
    // Multiple issues combined
    // =========================================================================

    it("should collect multiple errors and warnings together", () => {
      // Missing name (error) + missing role (warning) + template artifact (warning) + short (warning)
      const content = [
        "---",
        "description: A developer agent",
        "---",
        "",
        "{{ unprocessed_var }}",
        "Some short content",
      ].join("\n");

      const result = validateCompiledAgent(content);

      expect(result.valid).toBe(false);
      // Should have error for missing name
      expect(result.errors).toContain("Frontmatter missing required field: name");
      // Should have warnings for missing role, missing core principles, short output, template artifacts, missing tools
      expect(result.warnings.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ===========================================================================
  // printOutputValidationResult
  // ===========================================================================

  describe("printOutputValidationResult", () => {
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    });

    afterEach(() => {
      consoleSpy.mockRestore();
    });

    it("should print nothing when there are no errors and no warnings", () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: [],
      };

      printOutputValidationResult("web-developer" as AgentName, result);

      expect(consoleSpy).not.toHaveBeenCalled();
    });

    it("should print errors with agent name", () => {
      const result: ValidationResult = {
        valid: false,
        errors: ["Frontmatter missing required field: name", "Unclosed XML tag: <role>"],
        warnings: [],
      };

      printOutputValidationResult("web-developer" as AgentName, result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Validation errors for web-developer"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Frontmatter missing required field: name"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Unclosed XML tag: <role>"));
    });

    it("should print warnings with agent name", () => {
      const result: ValidationResult = {
        valid: true,
        errors: [],
        warnings: ["Missing <role> section", "Missing Core Principles section"],
      };

      printOutputValidationResult("api-developer" as AgentName, result);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Validation warnings for api-developer"),
      );
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("Missing <role> section"));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Missing Core Principles section"),
      );
    });

    it("should print both errors and warnings when both are present", () => {
      const result: ValidationResult = {
        valid: false,
        errors: ["Frontmatter missing required field: name"],
        warnings: ["Missing <role> section"],
      };

      printOutputValidationResult("cli-developer" as AgentName, result);

      const calls = consoleSpy.mock.calls.flat().join("\n");
      expect(calls).toContain("Validation errors for cli-developer");
      expect(calls).toContain("Validation warnings for cli-developer");
      expect(calls).toContain("Frontmatter missing required field: name");
      expect(calls).toContain("Missing <role> section");
    });

    it("should format each error and warning with a dash prefix", () => {
      const result: ValidationResult = {
        valid: false,
        errors: ["Error one"],
        warnings: ["Warning one"],
      };

      printOutputValidationResult("web-developer" as AgentName, result);

      expect(consoleSpy).toHaveBeenCalledWith("      - Error one");
      expect(consoleSpy).toHaveBeenCalledWith("      - Warning one");
    });
  });
});
