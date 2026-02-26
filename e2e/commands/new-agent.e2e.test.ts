import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";

describe("new agent command", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should display help text", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["new", "agent", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Create a new custom agent");
    expect(stdout).toContain("--purpose");
    expect(stdout).toContain("--non-interactive");
  });

  it("should error when no agent name is provided", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["new", "agent"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Missing 1 required arg");
  });

  it("should log agent details when --purpose is provided", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(
      ["new", "agent", "test-agent", "--purpose", "A test agent"],
      tempDir,
    );

    // The command logs agent name and purpose before attempting to load the meta-agent.
    // In a fresh directory without a compiled agent-summoner, it fails at source resolution.
    expect(combined).toContain("Agent name: test-agent");
    expect(combined).toContain("Purpose: A test agent");
    expect(exitCode).toBe(EXIT_CODES.ERROR);
  });

  it("should show --refresh flag in help output", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["new", "agent", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("--refresh");
  });

  it("should include _custom directory in output path", async () => {
    tempDir = await createTempDir();

    const { combined } = await runCLI(
      ["new", "agent", "my-agent", "--purpose", "My custom agent"],
      tempDir,
    );

    // The command logs "Output: <path>/.claude/agents/_custom" before trying
    // to load the meta-agent (which fails in a fresh directory).
    expect(combined).toContain("Output:");
    expect(combined).toContain("_custom");
  });
});
