import { mkdir } from "fs/promises";
import path from "path";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { CLAUDE_DIR } from "../../src/cli/consts.js";
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

  it("should accept --refresh flag without INVALID_ARGS error", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(
      [
        "new",
        "agent",
        "refresh-test",
        "--refresh",
        "--non-interactive",
        "--purpose",
        "Test refresh",
      ],
      tempDir,
    );

    // --refresh is a valid flag, so the command should NOT exit with INVALID_ARGS.
    // It fails at source resolution (no agent-summoner in a fresh temp dir),
    // which produces EXIT_CODES.ERROR — confirming the flag was accepted.
    expect(exitCode).not.toBe(EXIT_CODES.INVALID_ARGS);
    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(combined).toContain("Agent name: refresh-test");
    expect(combined).toContain("Purpose: Test refresh");
  });

  // BUG: The command accepts any string as agent name without validation.
  // Agent names with spaces or uppercase should be rejected since agents
  // are stored as directory names (e.g., .claude/agents/_custom/<name>/).
  // Currently the command passes the name straight through to the prompt.
  it.fails("should reject agent name with spaces", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(
      ["new", "agent", "my agent", "--non-interactive", "--purpose", "Test invalid name"],
      tempDir,
    );

    // Agent names are used as directory names, so spaces should be rejected.
    expect(exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toMatch(/invalid.*name/i);
  });

  // BUG: The command does not check whether an agent directory already exists
  // before proceeding. It should either error with a message about the existing
  // agent or require a --force flag to overwrite.
  it.fails("should error when agent directory already exists", async () => {
    tempDir = await createTempDir();

    const agentName = "existing-agent";
    const agentDir = path.join(tempDir, CLAUDE_DIR, "agents", "_custom", agentName);
    await mkdir(agentDir, { recursive: true });

    const { exitCode, combined } = await runCLI(
      ["new", "agent", agentName, "--non-interactive", "--purpose", "Test existing agent"],
      tempDir,
    );

    // The command should detect the existing agent directory and error out,
    // rather than silently proceeding to overwrite.
    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(combined).toMatch(/already exists/i);
  });
});
