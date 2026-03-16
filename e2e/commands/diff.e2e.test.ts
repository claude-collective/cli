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
import { renderSkillMd } from "../../src/cli/lib/__tests__/content-generators.js";

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
    await createLocalSkill(tempDir, "web-testing-playwright-e2e", {
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
    await createLocalSkill(tempDir, "web-testing-playwright-e2e", {
      metadata: 'author: "@test"\ncontentHash: "abc123"\ndisplayName: my-test-skill\n',
    });

    const { exitCode } = await runCLI(["diff"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("should report error when specifying a nonexistent skill name", async () => {
    tempDir = await createTempDir();
    await createLocalSkill(tempDir, "web-testing-playwright-e2e", {
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
    const localDirName = "web-styling-tailwind";

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
      renderSkillMd(
        localDirName,
        "Locally modified content",
        `# ${localDirName}\n\nThis content has been locally modified.`,
      ),
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

    const targetLocalDir = "web-meta-framework-nextjs";
    const otherLocalDir = "web-testing-cypress-e2e";

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

    const localDirName = "web-testing-cypress-e2e";

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
      renderSkillMd(localDirName, "Different content", "# Changed"),
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
    const localDirName = "web-testing-cypress-e2e";
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
    const localDirName = "web-testing-cypress-e2e";
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
    const localDirName = "web-testing-cypress-e2e";
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

  it("should display help text with --help flag", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["diff", "--help"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(stdout).toContain("USAGE");
    expect(stdout).toContain("--quiet");
    expect(stdout).toContain("--source");
  });

  it("should compare all forked skills when multiple exist", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const reactFork = "web-meta-framework-nextjs";
    const vitestFork = "web-testing-cypress-e2e";

    const reactDir = await createLocalSkill(tempDir, reactFork, {
      description: "Modified react skill",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${reactFork}`,
        "forkedFrom:",
        "  skillId: web-framework-react",
        '  contentHash: "stale-hash"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(
      path.join(reactDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(reactFork, "Locally modified react", "# Modified React"),
    );

    const vitestDir = await createLocalSkill(tempDir, vitestFork, {
      description: "Modified vitest skill",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${vitestFork}`,
        "forkedFrom:",
        "  skillId: web-testing-vitest",
        '  contentHash: "stale-hash"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    await writeFile(
      path.join(vitestDir, STANDARD_FILES.SKILL_MD),
      renderSkillMd(vitestFork, "Locally modified vitest", "# Modified Vitest"),
    );

    const { combined } = await runCLI(["diff", "--source", e2e.sourceDir], tempDir);

    expect(combined).toContain("web-framework-react");
    expect(combined).toContain("web-testing-vitest");
    expect(combined).toMatch(/Found differences in 2 skill/);
  });

  it("should use --source flag to override default source", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const localDirName = "web-testing-cypress-e2e";

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
      renderSkillMd(localDirName, "Locally modified", "# Changed"),
    );

    const { combined } = await runCLI(["diff", "--source", e2e.sourceDir], tempDir);

    expect(combined).toContain(`Loaded from local: ${e2e.sourceDir}`);
    expect(combined).toContain("web-testing-vitest");
    expect(combined).toMatch(/Found differences in \d+ skill/);
  });

  // BUG: When a forked skill references a source skill that no longer exists,
  // the diff command sets diffOutput to "Source skill 'X' no longer exists" but
  // hasDiff is false, so the message is never displayed to the user. The output
  // incorrectly says "up to date" instead of warning about the missing source skill.
  // (src/cli/commands/diff.ts:59-67 — diffOutput is set but hasDiff remains false)
  it.fails("should warn when forked skill references a deleted source skill", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();

    const localDirName = "web-pwa-offline-first";

    await createLocalSkill(tempDir, localDirName, {
      description: "Fork of a skill that was removed from source",
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        "  skillId: web-nonexistent-deleted-skill",
        '  contentHash: "old-hash"',
        "  date: 2026-01-01",
      ].join("\n"),
    });

    const { combined } = await runCLI(["diff", "--source", e2e.sourceDir], tempDir);

    expect(combined).toContain("no longer exists");
  });
});
