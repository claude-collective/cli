import { execa } from "execa";
import { describe, it, expect, beforeAll } from "vitest";
import { BIN_RUN, ensureBinaryExists, stripAnsi, EXIT_CODES, OCLIF_EXIT_CODES } from "../helpers/test-utils.js";

describe("help and version", () => {
  beforeAll(ensureBinaryExists);

  it("should display top-level help with --help flag", async () => {
    const result = await execa("node", [BIN_RUN, "--help"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("USAGE");
    expect(stdout).toContain("COMMANDS");
    expect(stdout).toContain("compile");
    expect(stdout).toContain("init");
    expect(stdout).toContain("doctor");
    expect(stdout).toContain("validate");
    expect(stdout).toContain("config");
    expect(stdout).toContain("edit");
    expect(stdout).toContain("eject");
    expect(stdout).toContain("list");
  });

  it("should display compile-specific help", async () => {
    const result = await execa("node", [BIN_RUN, "compile", "--help"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Compile agents");
    expect(stdout).toContain("--dry-run");
    expect(stdout).toContain("--output");
    expect(stdout).toContain("--verbose");
    expect(stdout).toContain("--source");
  });

  it("should display init-specific help", async () => {
    const result = await execa("node", [BIN_RUN, "init", "--help"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("init");
    expect(stdout).toContain("USAGE");
  });

  it("should display doctor-specific help", async () => {
    const result = await execa("node", [BIN_RUN, "doctor", "--help"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Diagnose");
    expect(stdout).toContain("--verbose");
    expect(stdout).toContain("--source");
  });

  it("should display validate-specific help", async () => {
    const result = await execa("node", [BIN_RUN, "validate", "--help"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Validate");
    expect(stdout).toContain("--plugins");
    expect(stdout).toContain("--all");
    expect(stdout).toContain("--source");
  });

  it("should display help using 'help <command>' syntax", async () => {
    const result = await execa("node", [BIN_RUN, "help", "compile"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("Compile agents");
    expect(stdout).toContain("--output");
  });

  it("should display version with --version flag", async () => {
    const result = await execa("node", [BIN_RUN, "--version"], { reject: false });
    const stdout = stripAnsi(result.stdout);

    expect(result.exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toMatch(/@agents-inc\/cli\/\d+\.\d+\.\d+/);
  });

  it("should show error for unknown command", async () => {
    const result = await execa("node", [BIN_RUN, "nonexistent-command"], { reject: false });
    const combined = stripAnsi(result.stdout + result.stderr);

    expect(result.exitCode).toBe(OCLIF_EXIT_CODES.UNKNOWN_COMMAND);
    expect(combined).toContain("is not a");
  });

  it("should show error for invalid flag on compile", async () => {
    const result = await execa("node", [BIN_RUN, "compile", "--invalid-flag"], { reject: false });
    const combined = stripAnsi(result.stdout + result.stderr);

    expect(result.exitCode).toBe(EXIT_CODES.INVALID_ARGS);
    expect(combined).toContain("Nonexistent flag");
  });
});
