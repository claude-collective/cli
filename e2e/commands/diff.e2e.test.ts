import path from "path";
import { readFile, writeFile } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import {
  createTempDir,
  cleanupTempDir,
  createLocalSkill,
  ensureBinaryExists,
  runCLI,
  EXIT_CODES,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { SKILLS_DIR_PATH, STANDARD_FILES } from "../../src/cli/consts.js";

describe("diff command", () => {
  let tempDir: string;
  let sourceTempDir: string | undefined;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (sourceTempDir) {
      await cleanupTempDir(sourceTempDir);
      sourceTempDir = undefined;
    }
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  it("should warn when no local skills exist", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["diff"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("No local skills found");
  });

  it("should handle --quiet flag with no local skills", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["diff", "--quiet"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout.trim()).toBe("");
  });

  it("should report no forkedFrom metadata for skills without it (message only)", async () => {
    tempDir = await createTempDir();
    await createLocalSkill(tempDir, "web-testing-e2e-skill", {
      metadata: 'author: "@test"\ncontentHash: "abc123"\ndisplayName: my-test-skill\n',
    });

    const { combined } = await runCLI(["diff"], tempDir);

    expect(combined).toContain("no forkedFrom metadata");
  });

  // BUG: diff exits code 1 even on success because this.exit(0) throws ExitError
  // inside a try/catch block, and the catch handler calls this.error() with exit: 1
  // (src/cli/commands/diff.ts:261-267)
  it.fails("should exit code 0 when no forkedFrom metadata and no diffs", async () => {
    tempDir = await createTempDir();
    await createLocalSkill(tempDir, "web-testing-e2e-skill", {
      metadata: 'author: "@test"\ncontentHash: "abc123"\ndisplayName: my-test-skill\n',
    });

    const { exitCode } = await runCLI(["diff"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("should report error when specifying a nonexistent skill name", async () => {
    tempDir = await createTempDir();
    await createLocalSkill(tempDir, "web-testing-e2e-skill", {
      metadata: 'author: "@test"\ndisplayName: my-test-skill\n',
    });

    const { exitCode, combined } = await runCLI(["diff", "nonexistent-skill"], tempDir);

    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("not found");
  });

  it("should show differences when forked skill diverges from source", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-vitest-local" as const;

    const skillDir = await createLocalSkill(tempDir, localDirName, {
      description: "Modified local version of the skill",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "stale-hash-that-wont-match"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      `---\nname: ${localDirName}\ndescription: Locally modified content\n---\n\n# ${localDirName}\n\nThis content has been locally modified.\n`,
    );

    const { exitCode, combined } = await runCLI(["diff", "--source", e2e.sourceDir], tempDir);

    expect(combined).toContain(sourceSkillId);
    expect(combined).toContain("---");
    expect(combined).toContain("+++");
    expect(combined).toMatch(/Found differences in \d+ skill/);
    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
  });

  it("should diff a specific skill by name", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const targetLocalDir = "web-framework-react-fork" as const;
    const otherLocalDir = "web-testing-vitest-fork" as const;

    await createLocalSkill(tempDir, targetLocalDir, {
      description: "Modified react skill",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${targetLocalDir}`,
        "forkedFrom:",
        "  skillId: web-framework-react",
        '  contentHash: "stale-hash"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await createLocalSkill(tempDir, otherLocalDir, {
      description: "Another skill",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${otherLocalDir}`,
        "forkedFrom:",
        "  skillId: web-testing-vitest",
        '  contentHash: "stale-hash"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    const { combined } = await runCLI(["diff", targetLocalDir, "--source", e2e.sourceDir], tempDir);

    expect(combined).toContain("web-framework-react");
    expect(combined).toContain(targetLocalDir);
    expect(combined).toMatch(/Found differences in 1 skill/);
  });

  it("should exit silently with --quiet when differences exist", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const localDirName = "web-testing-vitest-fork" as const;

    const skillDir = await createLocalSkill(tempDir, localDirName, {
      description: "Modified skill",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        "  skillId: web-testing-vitest",
        '  contentHash: "stale-hash"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(
      path.join(skillDir, STANDARD_FILES.SKILL_MD),
      `---\nname: ${localDirName}\ndescription: Different content\n---\n\n# Changed\n`,
    );

    const { exitCode, stdout } = await runCLI(
      ["diff", "--quiet", "--source", e2e.sourceDir],
      tempDir,
    );

    expect(stdout.trim()).toBe("");
    expect(exitCode).not.toBe(EXIT_CODES.SUCCESS);
  });

  it("should report all forked skills up to date when content matches (message only)", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-vitest-fork" as const;
    const sourceSkillMdPath = path.join(
      e2e.sourceDir,
      SKILLS_DIR_PATH,
      "web-testing",
      sourceSkillId,
      STANDARD_FILES.SKILL_MD,
    );

    const sourceContent = await readFile(sourceSkillMdPath, "utf-8");

    const skillDir = await createLocalSkill(tempDir, localDirName, {
      description: "Next generation testing framework",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "placeholder"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(path.join(skillDir, STANDARD_FILES.SKILL_MD), sourceContent);

    const { combined } = await runCLI(["diff", "--source", e2e.sourceDir], tempDir);

    // Exit code assertion is in the it.fails test below (known bug: this.exit(0) throws ExitError)
    expect(combined).toContain("up to date");
  });

  // BUG: diff exits code 1 even on success because this.exit(0) throws ExitError
  // inside a try/catch block, and the catch handler calls this.error() with exit: 1
  // (src/cli/commands/diff.ts:261-267)
  it.fails("should exit code 0 when all forked skills are up to date", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-vitest-fork" as const;
    const sourceSkillMdPath = path.join(
      e2e.sourceDir,
      SKILLS_DIR_PATH,
      "web-testing",
      sourceSkillId,
      STANDARD_FILES.SKILL_MD,
    );

    const sourceContent = await readFile(sourceSkillMdPath, "utf-8");

    const skillDir = await createLocalSkill(tempDir, localDirName, {
      description: "Next generation testing framework",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "placeholder"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(path.join(skillDir, STANDARD_FILES.SKILL_MD), sourceContent);

    const { exitCode, combined } = await runCLI(["diff", "--source", e2e.sourceDir], tempDir);

    expect(combined).toContain("up to date");
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  // BUG: --quiet with no diffs should exit 0, but this.exit(0) throws ExitError
  // caught by the generic catch block (src/cli/commands/diff.ts:261-267)
  it.fails("should exit code 0 with --quiet when no diffs exist", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-vitest-fork" as const;
    const sourceSkillMdPath = path.join(
      e2e.sourceDir,
      SKILLS_DIR_PATH,
      "web-testing",
      sourceSkillId,
      STANDARD_FILES.SKILL_MD,
    );

    const sourceContent = await readFile(sourceSkillMdPath, "utf-8");

    const skillDir = await createLocalSkill(tempDir, localDirName, {
      description: "Next generation testing framework",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "placeholder"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(path.join(skillDir, STANDARD_FILES.SKILL_MD), sourceContent);

    const { exitCode } = await runCLI(["diff", "--quiet", "--source", e2e.sourceDir], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });
});
