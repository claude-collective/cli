import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import { mkdir } from "fs/promises";
import { runCliCommand, createTempDir, cleanupTempDir } from "../../helpers";
import { buildAgentPrompt } from "../../../../commands/new/agent";

describe("buildAgentPrompt", () => {
  it("should include agent name in prompt", () => {
    const result = buildAgentPrompt("my-agent", "test purpose", "/output/dir");
    expect(result).toContain('"my-agent"');
  });

  it("should include purpose in prompt", () => {
    const result = buildAgentPrompt("my-agent", "Manages database migrations", "/output/dir");
    expect(result).toContain("Manages database migrations");
  });

  it("should include output directory in prompt", () => {
    const result = buildAgentPrompt("my-agent", "test purpose", "/output/dir");
    expect(result).toContain("/output/dir");
  });

  it("should include custom: true instruction", () => {
    const result = buildAgentPrompt("my-agent", "test purpose", "/output/dir");
    expect(result).toContain("`custom: true`");
    expect(result).toContain("metadata.yaml");
  });

  it("should include all required instructions", () => {
    const result = buildAgentPrompt("my-agent", "test purpose", "/output/dir");
    expect(result).toContain("metadata.yaml");
    expect(result).toContain("intro.md");
    expect(result).toContain("workflow.md");
    expect(result).toContain("examples.md");
    expect(result).toContain("critical-requirements.md");
  });
});

describe("new:agent command", () => {
  let tempDir: string;
  let projectDir: string;
  let originalCwd: string;

  beforeEach(async () => {
    originalCwd = process.cwd();
    tempDir = await createTempDir("cc-new-agent-test-");
    projectDir = path.join(tempDir, "project");
    await mkdir(projectDir, { recursive: true });
    process.chdir(projectDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await cleanupTempDir(tempDir);
  });

  async function expectFlagAccepted(args: string[]): Promise<void> {
    const { error } = await runCliCommand(args);
    const output = error?.message || "";
    expect(output.toLowerCase()).not.toContain("unknown flag");
  }

  describe("argument validation", () => {
    it("should reject missing name argument", async () => {
      const { error } = await runCliCommand(["new:agent"]);

      // oclif should report missing required arg
      expect(error?.oclif?.exit).toBeDefined();
    });

    it("should accept name argument without parsing error", async () => {
      // Command will proceed past arg parsing (may fail later at source/fetch)
      const { error } = await runCliCommand(["new:agent", "my-agent", "--purpose", "test"]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });

  describe("flag acceptance", () => {
    it("should accept --purpose flag without parsing error", async () => {
      await expectFlagAccepted([
        "new:agent",
        "my-agent",
        "--purpose",
        "Manages database migrations",
      ]);
    });

    it("should accept --source flag without parsing error", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "--source", "/some/path"]);
    });

    it("should accept --non-interactive flag without parsing error", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "--non-interactive"]);
    });

    it("should accept -p shorthand for purpose flag", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "-p", "test purpose"]);
    });

    it("should accept -n shorthand for non-interactive flag", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "-n"]);
    });

    it("should accept -s shorthand for source flag (from base command)", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "-s", "/some/source"]);
    });

    it("should accept --refresh flag without parsing error", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "--refresh"]);
    });

    it("should accept -r shorthand for refresh flag", async () => {
      await expectFlagAccepted(["new:agent", "my-agent", "-r"]);
    });
  });

  describe("error handling", () => {
    it("should pass arg and flag parsing with all flags combined", async () => {
      // Providing valid args/flags should not trigger parsing errors.
      // The command may still fail at runtime (e.g., claude CLI not found)
      // but should not fail with "unknown flag" or "missing required arg".
      const { error } = await runCliCommand([
        "new:agent",
        "test-agent",
        "--purpose",
        "testing",
        "--non-interactive",
      ]);

      const output = error?.message || "";
      expect(output.toLowerCase()).not.toContain("unknown flag");
      expect(output.toLowerCase()).not.toContain("missing required arg");
      expect(output.toLowerCase()).not.toContain("unexpected argument");
    });
  });
});
