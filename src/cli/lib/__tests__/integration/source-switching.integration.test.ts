import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "fs/promises";

import {
  archiveLocalSkill,
  restoreArchivedSkill,
  hasArchivedSkill,
} from "../../skills/source-switcher";
import { installLocal } from "../../installation/local-installer";
import { recompileAgents } from "../../agents/agent-recompiler";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestSkill,
} from "../fixtures/create-test-source";
import type { ProjectConfig, SkillId } from "../../../types";
import { LOCAL_SKILLS_PATH, ARCHIVED_SKILLS_DIR_NAME } from "../../../consts";
import {
  createMockSkill,
  createMockMatrix,
  fileExists,
  directoryExists,
  readTestYaml,
  buildWizardResult,
  buildSourceResult,
} from "../helpers";

function buildMatrixFromTestSkills(skills: TestSkill[]) {
  const matrixSkills = Object.fromEntries(
    skills.map((skill) => [
      skill.name,
      createMockSkill(skill.name, skill.category, {
        description: skill.description,
        tags: skill.tags ?? [],
        author: skill.author,
        path: `skills/${skill.category}/${skill.name}/`,
      }),
    ]),
  );
  return createMockMatrix(matrixSkills);
}

function buildMatrixWithLocalOverrides(localSkillIds: SkillId[]) {
  const matrixSkills = Object.fromEntries(
    SWITCHABLE_SKILLS.map((skill) => [
      skill.name,
      createMockSkill(skill.name, skill.category, {
        description: skill.description,
        tags: skill.tags ?? [],
        author: skill.author,
        path: `skills/${skill.category}/${skill.name}/`,
        ...(localSkillIds.includes(skill.name)
          ? { local: true, localPath: `.claude/skills/${skill.name}` }
          : {}),
      }),
    ]),
  );
  return createMockMatrix(matrixSkills);
}

const SWITCHABLE_SKILLS: TestSkill[] = [
  {
    id: "web-framework-react",
    name: "web-framework-react",
    description: "React framework for building user interfaces",
    category: "web-framework",
    author: "@test",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework for building user interfaces
---

# React (Marketplace Version)

React is a JavaScript library for building user interfaces.
Use component-based architecture with JSX.
`,
  },
  {
    id: "web-state-zustand",
    name: "web-state-zustand",
    description: "Bear necessities state management",
    category: "web-client-state",
    author: "@test",
    tags: ["state", "zustand"],
    content: `---
name: web-state-zustand
description: Bear necessities state management
---

# Zustand (Marketplace Version)

Zustand is a minimal state management library for React.
`,
  },
  {
    id: "api-framework-hono",
    name: "api-framework-hono",
    description: "Lightweight web framework for the edge",
    category: "api-api",
    author: "@test",
    tags: ["api", "hono"],
    content: `---
name: api-framework-hono
description: Lightweight web framework for the edge
---

# Hono (Marketplace Version)

Hono is a fast web framework for the edge.
`,
  },
  {
    id: "web-testing-vitest",
    name: "web-testing-vitest",
    description: "Next generation testing framework",
    category: "web-testing",
    author: "@test",
    tags: ["testing", "vitest"],
    content: `---
name: web-testing-vitest
description: Next generation testing framework
---

# Vitest (Marketplace Version)

Vitest is a fast unit test framework powered by Vite.
`,
  },
];

// Local versions of the same skills (different content to verify switching)
const LOCAL_SKILL_VARIANTS: TestSkill[] = [
  {
    id: "web-framework-react",
    name: "web-framework-react",
    description: "React framework (local customized version)",
    category: "web-framework",
    author: "@local-user",
    tags: ["react", "web"],
    content: `---
name: web-framework-react
description: React framework (local customized version)
---

# React (Local Version)

This is my customized React skill with project-specific patterns.
`,
  },
  {
    id: "web-state-zustand",
    name: "web-state-zustand",
    description: "Zustand state management (local customized version)",
    category: "web-client-state",
    author: "@local-user",
    tags: ["state", "zustand"],
    content: `---
name: web-state-zustand
description: Zustand state management (local customized version)
---

# Zustand (Local Version)

My customized Zustand patterns with project-specific stores.
`,
  },
];

const REACT_SKILL_ID: SkillId = "web-framework-react";
const ZUSTAND_SKILL_ID: SkillId = "web-state-zustand";
const ALL_SKILL_NAMES = SWITCHABLE_SKILLS.map((s) => s.name);

describe("Integration: Multi-Source Source Switching E2E", () => {
  let dirs: TestDirs;

  beforeEach(async () => {
    dirs = await createTestSource({
      skills: SWITCHABLE_SKILLS,
      localSkills: LOCAL_SKILL_VARIANTS,
    });
  });

  afterEach(async () => {
    await cleanupTestSource(dirs);
  });

  describe("Scenario 1: Archive and restore with real file system", () => {
    it("should archive a local skill to _archived directory", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      const archivedDir = path.join(
        dirs.projectDir,
        LOCAL_SKILLS_PATH,
        ARCHIVED_SKILLS_DIR_NAME,
        REACT_SKILL_ID,
      );

      // Verify local skill exists before archiving
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(path.join(skillDir, "SKILL.md"))).toBe(true);

      // Archive
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);

      // Verify original skill directory is gone
      expect(await directoryExists(skillDir)).toBe(false);

      // Verify archived copy exists
      expect(await directoryExists(archivedDir)).toBe(true);
      expect(await fileExists(path.join(archivedDir, "SKILL.md"))).toBe(true);

      // Verify archived content preserves original content
      const archivedContent = await readFile(path.join(archivedDir, "SKILL.md"), "utf-8");
      expect(archivedContent).toContain("Local Version");
    });

    it("should restore a previously archived skill", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      const archivedDir = path.join(
        dirs.projectDir,
        LOCAL_SKILLS_PATH,
        ARCHIVED_SKILLS_DIR_NAME,
        REACT_SKILL_ID,
      );

      // Archive first
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(false);
      expect(await directoryExists(archivedDir)).toBe(true);

      // Restore
      const restored = await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);

      expect(restored).toBe(true);

      // Verify skill is back in original location
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(path.join(skillDir, "SKILL.md"))).toBe(true);

      // Verify archived copy is removed
      expect(await directoryExists(archivedDir)).toBe(false);

      // Verify content is the original local version
      const restoredContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(restoredContent).toContain("Local Version");
    });

    it("should detect archived skill existence correctly", async () => {
      // No archive initially
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(false);

      // Archive skill
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);

      // Archive now exists
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);

      // Restore
      await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);

      // Archive gone again
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(false);
    });

    it("should handle archiving multiple skills independently", async () => {
      // Archive both
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      await archiveLocalSkill(dirs.projectDir, ZUSTAND_SKILL_ID);

      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(true);

      // Restore only one
      await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);

      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(false);
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(true);

      // Verify first is restored, second still archived
      const reactDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      const zustandDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, ZUSTAND_SKILL_ID);
      expect(await directoryExists(reactDir)).toBe(true);
      expect(await directoryExists(zustandDir)).toBe(false);
    });

    it("should return false when restoring a non-existent archive", async () => {
      // No archive exists, restore should return false
      const restored = await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(restored).toBe(false);

      // Skill should still be in its original location (unchanged)
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(true);
    });
  });

  describe("Scenario 2: Local to marketplace switching (local -> public)", () => {
    it("should archive local skills when switching to marketplace source", async () => {
      // Simulate what the edit command does: detect source changes
      // User had local source, now selects "public" (marketplace)
      const sourceChanges = new Map<SkillId, { from: string; to: string }>([
        [REACT_SKILL_ID, { from: "local", to: "public" }],
        [ZUSTAND_SKILL_ID, { from: "local", to: "public" }],
      ]);

      // Apply source switches (mirrors edit.tsx lines 188-195)
      for (const [skillId, change] of sourceChanges) {
        if (change.from === "local") {
          await archiveLocalSkill(dirs.projectDir, skillId);
        }
        if (change.to === "local") {
          await restoreArchivedSkill(dirs.projectDir, skillId);
        }
      }

      // Verify both skills are archived
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(true);

      // Verify original directories are removed
      const reactDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      const zustandDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, ZUSTAND_SKILL_ID);
      expect(await directoryExists(reactDir)).toBe(false);
      expect(await directoryExists(zustandDir)).toBe(false);

      // Verify archived content is the local version
      const archivedReactContent = await readFile(
        path.join(
          dirs.projectDir,
          LOCAL_SKILLS_PATH,
          ARCHIVED_SKILLS_DIR_NAME,
          REACT_SKILL_ID,
          "SKILL.md",
        ),
        "utf-8",
      );
      expect(archivedReactContent).toContain("Local Version");
    });

    it("should install from source and recompile after switching to marketplace", async () => {
      const matrix = buildMatrixFromTestSkills(SWITCHABLE_SKILLS);

      // Step 1: Archive local skills that are switching to marketplace
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      await archiveLocalSkill(dirs.projectDir, ZUSTAND_SKILL_ID);

      // Step 2: Run installLocal with all skills from marketplace
      const wizardResult = buildWizardResult(ALL_SKILL_NAMES, {
        selectedAgents: ["web-developer"],
        sourceSelections: {
          [REACT_SKILL_ID]: "public",
          [ZUSTAND_SKILL_ID]: "public",
        },
      });
      const sourceResult = buildSourceResult(matrix, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Step 3: Verify skills were installed
      expect(installResult.copiedSkills.length).toBe(SWITCHABLE_SKILLS.length);

      // Step 4: Verify config was generated
      expect(await fileExists(installResult.configPath)).toBe(true);
      const config = await readTestYaml<ProjectConfig>(installResult.configPath);
      expect(config.skills).toBeDefined();
      expect(config.skills?.length).toBe(SWITCHABLE_SKILLS.length);

      // Step 5: Verify agents were compiled
      expect(installResult.compiledAgents.length).toBeGreaterThan(0);

      // Step 6: Verify archived local skills are preserved
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(true);

      // Step 7: Recompile agents to verify consistency
      const recompileResult = await recompileAgents({
        pluginDir: dirs.projectDir,
        sourcePath: dirs.sourceDir,
        projectDir: dirs.projectDir,
        outputDir: path.join(dirs.projectDir, ".claude", "agents"),
      });

      expect(recompileResult.failed.length).toBe(0);
      expect(recompileResult.compiled.length).toBeGreaterThan(0);
    });
  });

  describe("Scenario 3: Marketplace to local switching (public -> local)", () => {
    it("should restore archived local skills when switching back to local source", async () => {
      // Simulate prior state: skills were previously archived (switched to marketplace)
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      await archiveLocalSkill(dirs.projectDir, ZUSTAND_SKILL_ID);

      // Verify archived state
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(true);

      // Now simulate switching back to local
      const sourceChanges = new Map<SkillId, { from: string; to: string }>([
        [REACT_SKILL_ID, { from: "public", to: "local" }],
        [ZUSTAND_SKILL_ID, { from: "public", to: "local" }],
      ]);

      // Apply source switches (mirrors edit.tsx lines 188-195)
      for (const [skillId, change] of sourceChanges) {
        if (change.from === "local") {
          await archiveLocalSkill(dirs.projectDir, skillId);
        }
        if (change.to === "local") {
          await restoreArchivedSkill(dirs.projectDir, skillId);
        }
      }

      // Verify skills are restored to original location
      const reactDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      const zustandDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, ZUSTAND_SKILL_ID);
      expect(await directoryExists(reactDir)).toBe(true);
      expect(await directoryExists(zustandDir)).toBe(true);

      // Verify archives are cleaned up
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(false);
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(false);

      // Verify restored content is the original local version
      const reactContent = await readFile(path.join(reactDir, "SKILL.md"), "utf-8");
      expect(reactContent).toContain("Local Version");

      const zustandContent = await readFile(path.join(zustandDir, "SKILL.md"), "utf-8");
      expect(zustandContent).toContain("Local Version");
    });

    it("should install from restored local skills and recompile agents", async () => {
      // Step 1: Simulate switching from marketplace back to local
      // First archive (simulates the initial local -> marketplace switch)
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      await archiveLocalSkill(dirs.projectDir, ZUSTAND_SKILL_ID);

      // Then restore (simulates switching back to local)
      await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);
      await restoreArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID);

      // Step 2: Build matrix with restored skills marked as local
      const matrixWithLocal = buildMatrixWithLocalOverrides([REACT_SKILL_ID, ZUSTAND_SKILL_ID]);

      // Step 3: Install with local source selections
      const wizardResult = buildWizardResult(ALL_SKILL_NAMES, {
        selectedAgents: ["web-developer"],
        sourceSelections: {
          [REACT_SKILL_ID]: "local",
          [ZUSTAND_SKILL_ID]: "local",
        },
      });
      const sourceResult = buildSourceResult(matrixWithLocal, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Step 4: Verify installation
      expect(installResult.copiedSkills.length).toBe(SWITCHABLE_SKILLS.length);

      // Verify local skills are marked as local in copied results
      const localCopied = installResult.copiedSkills.filter((s) => s.local);
      expect(localCopied.length).toBeGreaterThanOrEqual(2);

      // Step 5: Verify agents compile successfully
      expect(installResult.compiledAgents.length).toBeGreaterThan(0);
      for (const agentName of installResult.compiledAgents) {
        const agentPath = path.join(dirs.projectDir, ".claude", "agents", `${agentName}.md`);
        expect(await fileExists(agentPath)).toBe(true);
      }
    });
  });

  describe("Scenario 4: Bidirectional round-trip (local -> marketplace -> local)", () => {
    it("should preserve local skill content through a full round-trip switch", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);

      // Read original local content
      const originalContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(originalContent).toContain("Local Version");

      // Step 1: Switch local -> marketplace (archive)
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(false);
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);

      // Step 2: Switch marketplace -> local (restore)
      const restored = await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(restored).toBe(true);
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(false);

      // Step 3: Verify content is identical to original
      const restoredContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(restoredContent).toBe(originalContent);
    });

    it("should handle full pipeline round-trip with compile verification", async () => {
      // --- Phase 1: Initial install with local source ---
      const matrixWithLocal = buildMatrixWithLocalOverrides([REACT_SKILL_ID]);

      const wizardResult1 = buildWizardResult(ALL_SKILL_NAMES, {
        selectedAgents: ["web-developer"],
        sourceSelections: { [REACT_SKILL_ID]: "local" },
      });
      const sourceResult1 = buildSourceResult(matrixWithLocal, dirs.sourceDir);

      const install1 = await installLocal({
        wizardResult: wizardResult1,
        sourceResult: sourceResult1,
        projectDir: dirs.projectDir,
      });

      const initialAgentCount = install1.compiledAgents.length;
      expect(initialAgentCount).toBeGreaterThan(0);

      // --- Phase 2: Switch to marketplace (archive local skill) ---
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);

      // Recompile with marketplace source
      const recompile1 = await recompileAgents({
        pluginDir: dirs.projectDir,
        sourcePath: dirs.sourceDir,
        projectDir: dirs.projectDir,
        outputDir: path.join(dirs.projectDir, ".claude", "agents"),
      });
      expect(recompile1.failed.length).toBe(0);

      // --- Phase 3: Switch back to local (restore archived skill) ---
      const restored = await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(restored).toBe(true);

      // Recompile again with local source
      const recompile2 = await recompileAgents({
        pluginDir: dirs.projectDir,
        sourcePath: dirs.sourceDir,
        projectDir: dirs.projectDir,
        outputDir: path.join(dirs.projectDir, ".claude", "agents"),
      });
      expect(recompile2.failed.length).toBe(0);
      expect(recompile2.compiled.length).toBeGreaterThan(0);

      // Verify agents still exist after round-trip
      for (const agentName of recompile2.compiled) {
        const agentPath = path.join(dirs.projectDir, ".claude", "agents", `${agentName}.md`);
        expect(await fileExists(agentPath)).toBe(true);
        const content = await readFile(agentPath, "utf-8");
        expect(content.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Scenario 5: Mixed source selections in edit flow", () => {
    it("should handle mixed source selections where some skills switch and others stay", async () => {
      // React switches local -> marketplace, zustand stays local
      const sourceChanges = new Map<SkillId, { from: string; to: string }>([
        [REACT_SKILL_ID, { from: "local", to: "public" }],
        // ZUSTAND_SKILL_ID is NOT in sourceChanges (stays local)
      ]);

      // Apply source switches
      for (const [skillId, change] of sourceChanges) {
        if (change.from === "local") {
          await archiveLocalSkill(dirs.projectDir, skillId);
        }
        if (change.to === "local") {
          await restoreArchivedSkill(dirs.projectDir, skillId);
        }
      }

      // React is archived
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
      const reactDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      expect(await directoryExists(reactDir)).toBe(false);

      // Zustand is untouched (still local)
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(false);
      const zustandDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, ZUSTAND_SKILL_ID);
      expect(await directoryExists(zustandDir)).toBe(true);

      // Verify zustand content is still the local version
      const zustandContent = await readFile(path.join(zustandDir, "SKILL.md"), "utf-8");
      expect(zustandContent).toContain("Local Version");
    });

    it("should handle simultaneous bidirectional switches", async () => {
      // First, archive zustand to simulate a prior marketplace switch
      await archiveLocalSkill(dirs.projectDir, ZUSTAND_SKILL_ID);

      // Now simulate: react goes local -> marketplace, zustand goes marketplace -> local
      const sourceChanges = new Map<SkillId, { from: string; to: string }>([
        [REACT_SKILL_ID, { from: "local", to: "public" }],
        [ZUSTAND_SKILL_ID, { from: "public", to: "local" }],
      ]);

      for (const [skillId, change] of sourceChanges) {
        if (change.from === "local") {
          await archiveLocalSkill(dirs.projectDir, skillId);
        }
        if (change.to === "local") {
          await restoreArchivedSkill(dirs.projectDir, skillId);
        }
      }

      // React: archived (switched to marketplace)
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
      const reactDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      expect(await directoryExists(reactDir)).toBe(false);

      // Zustand: restored (switched back to local)
      expect(await hasArchivedSkill(dirs.projectDir, ZUSTAND_SKILL_ID)).toBe(false);
      const zustandDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, ZUSTAND_SKILL_ID);
      expect(await directoryExists(zustandDir)).toBe(true);

      const zustandContent = await readFile(path.join(zustandDir, "SKILL.md"), "utf-8");
      expect(zustandContent).toContain("Local Version");
    });
  });

  describe("Scenario 6: Edge cases and error handling", () => {
    it("should handle archiving a skill that does not exist locally", async () => {
      const nonExistentSkill = "web-framework-nonexistent" as SkillId;

      // Should not throw, just warn
      await archiveLocalSkill(dirs.projectDir, nonExistentSkill);

      // No archive should be created
      expect(await hasArchivedSkill(dirs.projectDir, nonExistentSkill)).toBe(false);
    });

    it("should handle restoring when no archive exists", async () => {
      // Don't archive first, just try to restore
      const restored = await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);

      expect(restored).toBe(false);

      // Original should still be there
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(true);
    });

    it("should handle archiving the same skill twice", async () => {
      // Archive first time
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);

      // Archive second time (skill dir no longer exists) - should warn, not crash
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await hasArchivedSkill(dirs.projectDir, REACT_SKILL_ID)).toBe(true);
    });

    it("should preserve metadata.yaml through archive/restore cycle", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);

      // Read original metadata
      const originalMetadata = await readFile(path.join(skillDir, "metadata.yaml"), "utf-8");

      // Archive and restore
      await archiveLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      await restoreArchivedSkill(dirs.projectDir, REACT_SKILL_ID);

      // Verify metadata is preserved
      const restoredMetadata = await readFile(path.join(skillDir, "metadata.yaml"), "utf-8");
      expect(restoredMetadata).toBe(originalMetadata);
    });
  });
});
