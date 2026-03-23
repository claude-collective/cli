import path from "path";
import { createHash } from "crypto";
import { mkdir } from "fs/promises";
import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { EXIT_CODES, FILES, SOURCE_PATHS } from "../pages/constants.js";
import {
  createTempDir,
  cleanupTempDir,
  createLocalSkill,
  ensureBinaryExists,
  readTestFile,
} from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLI } from "../fixtures/cli.js";

const HASH_PREFIX_LENGTH = 7;

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
    }
  });

  it("should warn when no local skills exist", async () => {
    tempDir = await createTempDir();

    const { exitCode, output } = await CLI.run(["outdated"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("No local skills found");
  });

  it("should output JSON when --json flag is used with no local skills", async () => {
    tempDir = await createTempDir();

    const { exitCode, stdout } = await CLI.run(["outdated", "--json"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.skills).toStrictEqual([]);
    expect(parsed.summary.outdated).toBe(0);
  });

  it("should suggest init or edit when no local skills", async () => {
    tempDir = await createTempDir();

    const { exitCode, output } = await CLI.run(["outdated"], { dir: tempDir });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("init");
  });

  it("should show skill as current when content hash matches source", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-cypress-e2e";
    const sourceSkillMdPath = path.join(
      sourceDir,
      SOURCE_PATHS.SKILLS_DIR,
      sourceSkillId,
      FILES.SKILL_MD,
    );

    // Compute the hash the same way the CLI does: SHA-256 prefix of the source SKILL.md
    const sourceContent = await readTestFile(sourceSkillMdPath);
    const matchingHash = createHash("sha256")
      .update(sourceContent)
      .digest("hex")
      .slice(0, HASH_PREFIX_LENGTH);

    // Use a different local directory name to avoid overwriting the source skill in the matrix.
    // forkedFrom.skillId still points to the source skill for comparison.
    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        `  contentHash: "${matchingHash}"`,
        "  date: 2026-01-01",
      ].join("\n"),
    });

    const { exitCode, output } = await CLI.run(["outdated", "--source", sourceDir], {
      dir: tempDir,
    });

    // Should show "current" status for the skill
    expect(output).toContain("current");
    expect(output).toContain(sourceSkillId);
    // Should exit with 0 when all skills are up to date
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  it("should detect outdated skill when content hash differs from source", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-framework-react";
    const localDirName = "web-meta-framework-nextjs";

    // Use a different local directory name to avoid overwriting the source skill in the matrix.
    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    const { exitCode, output } = await CLI.run(["outdated", "--source", sourceDir], {
      dir: tempDir,
    });

    // Should show "outdated" status for the skill
    expect(output).toContain("outdated");
    expect(output).toContain(sourceSkillId);
    // Should exit with non-zero when outdated skills are found
    expect(exitCode).toBe(EXIT_CODES.ERROR);
  });

  it("should output JSON with outdated skill info", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-framework-react";
    const localDirName = "web-meta-framework-nextjs";

    // Use a different local directory name to avoid overwriting the source skill in the matrix.
    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    const { exitCode, stdout } = await CLI.run(["outdated", "--json", "--source", sourceDir], {
      dir: tempDir,
    });

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.summary.outdated).toBe(1);

    // Find the outdated skill in the results
    const outdatedSkill = parsed.skills.find((s: { id: string }) => s.id === sourceSkillId);
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
    await createLocalSkill(tempDir, "web-utilities-native-js", {
      metadata: 'author: "@test"\ndisplayName: web-utilities-native-js\n',
    });

    const { exitCode, output } = await CLI.run(["outdated", "--source", sourceDir], {
      dir: tempDir,
    });

    // Should show "local-only" status
    expect(output).toContain("local-only");
    // Should exit with 0 since local-only is not "outdated"
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
  });

  describe("help", () => {
    it("should display outdated help", async () => {
      tempDir = await createTempDir();

      const { exitCode, stdout } = await CLI.run(["outdated", "--help"], { dir: tempDir });

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Check which local skills are out of date");
      expect(stdout).toContain("--json");
      expect(stdout).toContain("--source");
    });
  });

  it("should output JSON with current skill info when content hash matches", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    const sourceSkillId = "web-testing-vitest";
    const localDirName = "web-testing-cypress-e2e";
    const sourceSkillMdPath = path.join(
      sourceDir,
      SOURCE_PATHS.SKILLS_DIR,
      sourceSkillId,
      FILES.SKILL_MD,
    );

    const sourceContent = await readTestFile(sourceSkillMdPath);
    const matchingHash = createHash("sha256")
      .update(sourceContent)
      .digest("hex")
      .slice(0, HASH_PREFIX_LENGTH);

    await createLocalSkill(tempDir, localDirName, {
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${localDirName}`,
        "forkedFrom:",
        `  skillId: ${sourceSkillId}`,
        `  contentHash: "${matchingHash}"`,
        "  date: 2026-01-01",
      ].join("\n"),
    });

    const { exitCode, stdout } = await CLI.run(["outdated", "--json", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.SUCCESS);

    const parsed = JSON.parse(stdout);
    expect(parsed).toHaveProperty("skills");
    expect(parsed).toHaveProperty("summary");
    expect(parsed.summary.current).toBeGreaterThanOrEqual(1);
    expect(parsed.summary.outdated).toBe(0);

    const currentSkill = parsed.skills.find(
      (s: { id: string; status: string }) => s.id === sourceSkillId && s.status === "current",
    );
    expect(currentSkill).toBeDefined();
    expect(currentSkill.localHash).toBe(matchingHash);
    expect(currentSkill.sourceHash).toBe(matchingHash);
  });

  it("should show summary with counts of each status", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    // Create one outdated skill (distinct dir name to preserve source entry in matrix)
    await createLocalSkill(tempDir, "web-meta-framework-nextjs", {
      metadata: [
        'author: "@agents-inc"',
        "displayName: web-meta-framework-nextjs",
        "forkedFrom:",
        "  skillId: web-framework-react",
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    // Create one local-only skill (no forkedFrom)
    await createLocalSkill(tempDir, "web-utilities-native-js", {
      metadata: 'author: "@test"\ndisplayName: web-utilities-native-js\n',
    });

    const { exitCode, output } = await CLI.run(["outdated", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.ERROR);

    // Should show summary line with counts
    expect(output).toContain("Summary:");
    expect(output).toContain("outdated");
    expect(output).toContain("local-only");
  });

  it("should handle --source with an empty source directory gracefully", async () => {
    tempDir = await createTempDir();
    const emptySourceDir = path.join(tempDir, "empty-source");
    await mkdir(emptySourceDir, { recursive: true });

    // Create a local skill so we get past the "no local skills" guard
    await createLocalSkill(tempDir, "web-utilities-native-js", {
      metadata: 'author: "@test"\ndisplayName: web-utilities-native-js\n',
    });

    const { exitCode, output } = await CLI.run(["outdated", "--source", emptySourceDir], {
      dir: tempDir,
    });

    // With an empty source (no skills at all), local skills should show as local-only
    // and the command should exit successfully (no outdated skills)
    expect(exitCode).toBe(EXIT_CODES.SUCCESS);
    expect(output).toContain("local-only");
  });

  it("should show mixed statuses for current, outdated, and local-only skills", async () => {
    const e2e = await createE2ESource();
    sourceTempDir = e2e.tempDir;
    tempDir = await createTempDir();
    const sourceDir = e2e.sourceDir;

    // 1. Create a CURRENT skill (matching contentHash)
    const currentSourceId = "web-testing-vitest";
    const currentLocalDir = "web-testing-cypress-e2e";
    const currentSourceMdPath = path.join(
      sourceDir,
      SOURCE_PATHS.SKILLS_DIR,
      currentSourceId,
      FILES.SKILL_MD,
    );
    const sourceContent = await readTestFile(currentSourceMdPath);
    const matchingHash = createHash("sha256")
      .update(sourceContent)
      .digest("hex")
      .slice(0, HASH_PREFIX_LENGTH);

    await createLocalSkill(tempDir, currentLocalDir, {
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${currentLocalDir}`,
        "forkedFrom:",
        `  skillId: ${currentSourceId}`,
        `  contentHash: "${matchingHash}"`,
        "  date: 2026-01-01",
      ].join("\n"),
    });

    // 2. Create an OUTDATED skill (stale contentHash)
    const outdatedSourceId = "web-framework-react";
    const outdatedLocalDir = "web-meta-framework-nextjs";

    await createLocalSkill(tempDir, outdatedLocalDir, {
      metadata: [
        'author: "@agents-inc"',
        `displayName: ${outdatedLocalDir}`,
        "forkedFrom:",
        `  skillId: ${outdatedSourceId}`,
        '  contentHash: "0000000"',
        "  date: 2025-01-01",
      ].join("\n"),
    });

    // 3. Create a LOCAL-ONLY skill (no forkedFrom)
    await createLocalSkill(tempDir, "web-utilities-native-js", {
      metadata: 'author: "@test"\ndisplayName: web-utilities-native-js\n',
    });

    // Verify human-readable output contains all three statuses
    const { exitCode, output } = await CLI.run(["outdated", "--source", sourceDir], {
      dir: tempDir,
    });

    expect(exitCode).toBe(EXIT_CODES.ERROR);
    expect(output).toContain("current");
    expect(output).toContain("outdated");
    expect(output).toContain("local-only");
    expect(output).toContain("Summary:");

    // Verify JSON output has correct per-skill status
    const { stdout: jsonStdout } = await CLI.run(["outdated", "--json", "--source", sourceDir], {
      dir: tempDir,
    });

    const parsed = JSON.parse(jsonStdout);
    expect(parsed.summary.current).toBeGreaterThanOrEqual(1);
    expect(parsed.summary.outdated).toBe(1);
    expect(parsed.summary.localOnly).toBeGreaterThanOrEqual(1);

    const currentSkill = parsed.skills.find(
      (s: { id: string; status: string }) => s.id === currentSourceId && s.status === "current",
    );
    expect(currentSkill).toBeDefined();
    expect(currentSkill.localHash).toBe(matchingHash);

    const outdatedSkill = parsed.skills.find(
      (s: { id: string; status: string }) => s.id === outdatedSourceId && s.status === "outdated",
    );
    expect(outdatedSkill).toBeDefined();
    expect(outdatedSkill.localHash).toBe("0000000");

    const localOnlySkill = parsed.skills.find((s: { status: string }) => s.status === "local-only");
    expect(localOnlySkill).toBeDefined();
  });
});
