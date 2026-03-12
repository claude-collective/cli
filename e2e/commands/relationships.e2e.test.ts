import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { cleanupTempDir, ensureBinaryExists, runCLI, EXIT_CODES } from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import type { SkillSlug } from "../../src/cli/types/index.js";

describe("slug-based relationship rules", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
      tempDir = undefined!;
    }
  });

  describe("conflict rules", () => {
    it("should detect unresolved conflict references via validate", async () => {
      // "angular" slug does not exist in the E2E source — should be flagged as unresolved
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          conflicts: [
            {
              skills: ["react", "angular-standalone"],
              reason: "React and Angular are mutually exclusive frameworks",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // Matrix health check should detect that "angular" has no matching skill in the source
      expect(combined).toContain("unresolved reference");
      expect(combined).toContain("angular-standalone");
    });

    it("should resolve conflict slugs to canonical IDs shown in info output", async () => {
      // Both "react" and "zustand" slugs exist in the E2E source
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          conflicts: [
            {
              skills: ["react", "zustand"],
              reason: "Test conflict between react and zustand",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      // Query react's info — should show zustand as a canonical ID conflict
      const { exitCode, stdout } = await runCLI(
        ["info", "web-framework-react", "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      // The resolved conflict should use canonical SkillId, not the slug
      expect(stdout).toContain("Conflicts with:");
      expect(stdout).toContain("web-state-zustand");
    });
  });

  describe("require rules", () => {
    it("should detect unresolved require references via validate", async () => {
      // "angular" is a valid SkillSlug but does not exist in the E2E source.
      // The slug must be valid for the rules file to pass schema validation,
      // but the matrix health check will then detect it as unresolved.
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          requires: [
            {
              skill: "zustand",
              needs: ["angular-standalone"],
              reason: "Zustand needs Angular (testing unresolved reference)",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      expect(combined).toContain("unresolved reference");
      expect(combined).toContain("angular-standalone");
    });

    it("should resolve require slugs to canonical IDs shown in info output", async () => {
      // Both slugs are valid in the E2E source
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          requires: [
            {
              skill: "zustand",
              needs: ["react"],
              reason: "Zustand requires React as a framework",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      // Query zustand's info — should show react requirement as canonical ID
      const { exitCode, stdout } = await runCLI(
        ["info", "web-state-zustand", "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Requires:");
      expect(stdout).toContain("web-framework-react");
    });
  });

  describe("recommend rules", () => {
    it("should mark a skill as recommended via slug-based recommend rule", async () => {
      // Use "hono" which is NOT in the default recommends list, so we can
      // verify the source-specific recommend rule takes effect.
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          recommends: [
            {
              skill: "hono",
              reason: "Hono is the recommended API framework for E2E testing",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      const { exitCode, stdout } = await runCLI(
        ["info", "api-framework-hono", "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Recommended: Yes");
      expect(stdout).toContain("Hono is the recommended API framework for E2E testing");
    });

    it("should not mark a non-recommended skill as recommended", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          recommends: [
            {
              skill: "hono",
              reason: "Hono is the recommended API framework for E2E testing",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      // React IS in the default recommends list, so we need to check a skill
      // that's truly not recommended. "anti-over-engineering" is a methodology skill
      // that has no recommend entry in either default or source rules.
      const { exitCode, stdout } = await runCLI(
        ["info", "meta-methodology-anti-over-engineering", "--source", sourceDir, "--no-preview"],
        tempDir,
      );

      expect(exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(stdout).toContain("Recommended: No");
    });
  });

  describe("valid source slugs are not reported as unresolved", () => {
    it("should not flag E2E source slugs as unresolved references", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          conflicts: [
            {
              skills: ["react", "hono"],
              reason: "Test conflict with valid slugs only",
            },
          ],
          requires: [
            {
              skill: "zustand",
              needs: ["react"],
              reason: "Zustand requires React",
            },
          ],
          recommends: [
            {
              skill: "vitest",
              reason: "Vitest is recommended",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      expect(combined).toContain("Checked 10 skill(s)");

      // Default rules may produce unresolved references for slugs not in E2E source
      // (e.g., "angular", "vue"), but E2E source slugs should all resolve cleanly.
      // When a slug resolves, its canonical SkillId (e.g., "web-framework-react")
      // exists in matrix.skills, so it won't be flagged as unresolved.
      // When a slug does NOT resolve, the raw slug string passes through as the
      // reference — only those unresolved raw slugs appear in the warning messages.
      //
      // Message format: "Skill 'X' has unresolved reference 'Y' in 'field'"
      // X = the skill that has the reference (canonical ID, may be an E2E skill)
      // Y = the unresolved reference (the slug that couldn't be resolved)
      // We check that Y (the unresolved part) is never an E2E skill's resolved ID.
      const unresolvedRefPattern = /has unresolved reference '([^']+)'/;
      const unresolvedLines = combined
        .split("\n")
        .filter((line) => line.includes("unresolved reference"));

      const unresolvedRefs = unresolvedLines
        .map((line) => unresolvedRefPattern.exec(line)?.[1])
        .filter(Boolean);

      // None of the E2E source canonical IDs should appear as unresolved references
      for (const ref of unresolvedRefs) {
        expect(ref).not.toBe("web-framework-react");
        expect(ref).not.toBe("web-testing-vitest");
        expect(ref).not.toBe("web-state-zustand");
        expect(ref).not.toBe("api-framework-hono");
      }
    });
  });

  describe("discourages rules", () => {
    it("should detect unresolved discourages references via validate", async () => {
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          discourages: [
            {
              skills: ["react", "vue-composition-api"],
              reason: "React and Vue are discouraged together",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      const { combined } = await runCLI(["validate", "--source", sourceDir], tempDir);

      // "vue-composition-api" slug does not exist in the E2E source
      expect(combined).toContain("unresolved reference");
      expect(combined).toContain("vue-composition-api");
    });
  });

  describe("multiple rule types combined", () => {
    it("should resolve all relationship types from slugs to canonical IDs", async () => {
      // Use "hono" for recommends since it's NOT in default recommends.
      // "react" and "vitest" are in default recommends, so we can't verify
      // source-specific reason text for them.
      const { sourceDir, tempDir: sourceTempDir } = await createE2ESource({
        relationships: {
          conflicts: [
            {
              skills: ["react", "hono"],
              reason: "Framework conflict for testing",
            },
          ],
          requires: [
            {
              skill: "vitest",
              needs: ["react"],
              reason: "Vitest needs React in this test",
            },
          ],
          recommends: [
            {
              skill: "hono",
              reason: "Hono is the best API framework",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      // Verify react shows hono as conflict (canonical ID)
      const reactInfo = await runCLI(
        ["info", "web-framework-react", "--source", sourceDir, "--no-preview"],
        tempDir,
      );
      expect(reactInfo.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(reactInfo.stdout).toContain("Conflicts with:");
      expect(reactInfo.stdout).toContain("api-framework-hono");

      // Verify vitest shows react as requirement (canonical ID)
      const vitestInfo = await runCLI(
        ["info", "web-testing-vitest", "--source", sourceDir, "--no-preview"],
        tempDir,
      );
      expect(vitestInfo.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(vitestInfo.stdout).toContain("Requires:");
      expect(vitestInfo.stdout).toContain("web-framework-react");

      // Verify hono shows as recommended
      const honoInfo = await runCLI(
        ["info", "api-framework-hono", "--source", sourceDir, "--no-preview"],
        tempDir,
      );
      expect(honoInfo.exitCode).toBe(EXIT_CODES.SUCCESS);
      expect(honoInfo.stdout).toContain("Recommended: Yes");
      expect(honoInfo.stdout).toContain("Hono is the best API framework");
    });
  });
});
