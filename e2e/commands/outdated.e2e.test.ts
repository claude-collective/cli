import path from "path";
import { createHash } from "crypto";
import { readFile } from "fs/promises";
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
import { HASH_PREFIX_LENGTH, SKILLS_DIR_PATH, STANDARD_FILES } from "../../src/cli/consts.js";

describe("outdated command", () => {
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

    const { exitCode, combined } = await runCLI(["outdated"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("No local skills found");
  });

  it("should output JSON when --json flag is used with no local skills", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await runCLI(["outdated", "--json"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.skills).toEqual([]);
    expect(parsed.summary.outdated).toBe(0);
  });

  it("should suggest init or edit when no local skills", async () => {
    tempDir = await createTempDir();

    const { exitCode, combined } = await runCLI(["outdated"], tempDir);

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(combined).toContain("init");
  });

  it("should show skill as current when content hash matches source", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-vitest-fork" as const;
    const sourceSkillMdPath = path.join(
      sourceDir,
      SKILLS_DIR_PATH,
      "web-testing",
      sourceSkillId,
      STANDARD_FILES.SKILL_MD,
    );

    // Compute the hash the same way the CLI does: SHA-256 prefix of the source SKILL.md
    const sourceContent = await readFile(sourceSkillMdPath, "utf-8");
    const matchingHash = createHash("sha256")
      .update(sourceContent)
      .digest("hex")
      .slice(0, HASH_PREFIX_LENGTH);

    // Use a different local directory name to avoid overwriting the source skill in the matrix.
    // forkedFrom.skillId still points to the source skill for comparison.
    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `cliName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        `  contentHash: "${matchingHash}"`,
        "  date: 2026-01-01",
      ].join("\n"),
    });

    const { exitCode, combined } = await runCLI(
      ["outdated", "--source", sourceDir],
      tempDir,
    );

    // Should show "current" status for the skill
    expect(combined).toContain("current");
    expect(combined).toContain(sourceSkillId);
    // Should exit with 0 when all skills are up to date
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("should detect outdated skill when content hash differs from source", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-framework-react";
    const localDirName = "web-framework-react-fork" as const;

    // Use a different local directory name to avoid overwriting the source skill in the matrix.
    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `cliName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    const { exitCode, combined } = await runCLI(
      ["outdated", "--source", sourceDir],
      tempDir,
    );

    // Should show "outdated" status for the skill
    expect(combined).toContain("outdated");
    expect(combined).toContain(sourceSkillId);
    // Should exit with non-zero when outdated skills are found
    expect(exitCode).toBe(EXIT_CODES.ERROR);
  });

  it("should output JSON with outdated skill info", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-framework-react";
    const localDirName = "web-framework-react-fork" as const;

    // Use a different local directory name to avoid overwriting the source skill in the matrix.
    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `cliName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    const { exitCode, stdout } = await runCLI(
      ["outdated", "--json", "--source", sourceDir],
      tempDir,
    );

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.summary.outdated).toBe(1);

    // Find the outdated skill in the results
    const outdatedSkill = parsed.skills.find(
      (s: { id: string }) => s.id === sourceSkillId,
    );
    expect(outdatedSkill).toBeDefined();
    expect(outdatedSkill.status).toBe("outdated");
    expect(outdatedSkill.localHash).toBe("0000000");
    expect(outdatedSkill.sourceHash).toEqual(expect.any(String));
  });

  it("should show local-only for skills without forkedFrom metadata", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    // Create a local skill without forkedFrom metadata
    await createLocalSkill(tempDir, "web-custom-local-skill", {
      metadata: 'author: "@test"\ncliName: web-custom-local-skill\n',
    });

    const { exitCode, combined } = await runCLI(
      ["outdated", "--source", sourceDir],
      tempDir,
    );

    // Should show "local-only" status
    expect(combined).toContain("local-only");
    // Should exit with 0 since local-only is not "outdated"
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("should show summary with counts of each status", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    // Create one outdated skill (distinct dir name to preserve source entry in matrix)
    await createLocalSkill(tempDir, "web-framework-react-fork" as const, {
      metadata: [
        'author: "@agents-inc"',
        "cliName: web-framework-react-fork",
        "forkedFrom:",
        "  skillId: web-framework-react",
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    // Create one local-only skill (no forkedFrom)
    await createLocalSkill(tempDir, "web-custom-local-skill", {
      metadata: 'author: "@test"\ncliName: web-custom-local-skill\n',
    });

    const { exitCode, combined } = await runCLI(
      ["outdated", "--source", sourceDir],
      tempDir,
    );

    expect(exitCode).toBe(EXIT_CODES.ERROR);

    // Should show summary line with counts
    expect(combined).toContain("Summary:");
    expect(combined).toContain("outdated");
    expect(combined).toContain("local-only");
  });
});
