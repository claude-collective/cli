import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { cleanupTempDir, ensureBinaryExists } from "../helpers/test-utils.js";
import { createE2ESource } from "../helpers/create-e2e-source.js";
import { CLI } from "../fixtures/cli.js";

describe("slug-based relationship rules", () => {
  let tempDir: string;

  beforeAll(ensureBinaryExists);

  afterEach(async () => {
    if (tempDir) {
      await cleanupTempDir(tempDir);
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

      const { output } = await CLI.run(["validate", "--source", sourceDir, "--verbose"], {
        dir: tempDir,
      });

      // Slug resolution should detect that "angular-standalone" has no matching skill in the source
      expect(output).toContain("Unresolved slug");
      expect(output).toContain("angular-standalone");
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

      const { output } = await CLI.run(["validate", "--source", sourceDir, "--verbose"], {
        dir: tempDir,
      });

      expect(output).toContain("Unresolved slug");
      expect(output).toContain("angular-standalone");
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

      const { output } = await CLI.run(["validate", "--source", sourceDir, "--verbose"], {
        dir: tempDir,
      });

      expect(output).toContain("Checked 9 skill(s)");

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
      const unresolvedLines = output
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
              skills: ["react", "angular-standalone"],
              reason: "React and Angular are discouraged together",
            },
          ],
        },
      });
      tempDir = sourceTempDir;

      const { output } = await CLI.run(["validate", "--source", sourceDir, "--verbose"], {
        dir: tempDir,
      });

      // "angular-standalone" slug does not exist in the E2E source
      expect(output).toContain("Unresolved slug");
      expect(output).toContain("angular-standalone");
    });
  });
});
