import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "fs/promises";

import { deleteLocalSkill } from "../../skills/source-switcher";
import { installLocal } from "../../installation/local-installer";
import {
  createTestSource,
  cleanupTestSource,
  type TestDirs,
  type TestSkill,
} from "../fixtures/create-test-source";
import type { ProjectConfig, SkillId } from "../../../types";
import { LOCAL_SKILLS_PATH } from "../../../consts";
import {
  createMockSkill,
  createMockMatrix,
  fileExists,
  directoryExists,
  readTestTsConfig,
  buildWizardResult,
  buildSkillConfigs,
  buildSourceResult,
} from "../helpers";
import type { SkillConfig } from "../../../types/config";

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
    domain: "web",
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
    domain: "web",
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
    domain: "api",
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
    domain: "web",
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

const LOCAL_SKILL_VARIANTS: TestSkill[] = [
  {
    id: "web-framework-react",
    name: "web-framework-react",
    description: "React framework (local customized version)",
    category: "web-framework",
    author: "@local-user",
    domain: "web",
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
    domain: "web",
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

describe("Integration: Source Switching with Delete", () => {
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

  describe("Delete local skill", () => {
    it("should delete a local skill directory completely", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);

      // Verify skill exists before deleting
      expect(await directoryExists(skillDir)).toBe(true);
      expect(await fileExists(path.join(skillDir, "SKILL.md"))).toBe(true);

      // Delete
      await deleteLocalSkill(dirs.projectDir, REACT_SKILL_ID);

      // Verify skill directory is gone
      expect(await directoryExists(skillDir)).toBe(false);

      // Verify NO _archived directory was created
      const archivedDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, "_archived");
      expect(await directoryExists(archivedDir)).toBe(false);
    });

    it("should handle deleting a non-existent skill silently", async () => {
      const nonExistentSkill = "web-framework-nonexistent";

      // Should not throw
      await deleteLocalSkill(dirs.projectDir, nonExistentSkill);
    });

    it("should handle deleting the same skill twice", async () => {
      // Delete once
      await deleteLocalSkill(dirs.projectDir, REACT_SKILL_ID);

      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(false);

      // Delete again - should not throw
      await deleteLocalSkill(dirs.projectDir, REACT_SKILL_ID);
    });
  });

  describe("Delete and re-copy from source", () => {
    it("should delete local skill then re-copy from source (content matches source, not local edits)", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);

      // Read local content first (should contain "Local Version")
      const localContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(localContent).toContain("Local Version");

      // Delete the local skill
      await deleteLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(false);

      // Re-copy from source using installLocal
      const matrix = buildMatrixFromTestSkills(SWITCHABLE_SKILLS);
      const skillConfigs: SkillConfig[] = ALL_SKILL_NAMES.map((id) => ({
        id,
        scope: "project" as const,
        source: id === REACT_SKILL_ID ? "local" : "local",
      }));
      const wizardResult = buildWizardResult(skillConfigs, {
        selectedAgents: ["web-developer"],
      });
      const sourceResult = buildSourceResult(matrix, dirs.sourceDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Read the re-copied content - should contain "Marketplace Version" (from source), NOT "Local Version"
      const reCopiedContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(reCopiedContent).toContain("Marketplace Version");
      expect(reCopiedContent).not.toContain("Local Version");
    });

    it("should handle full install pipeline after deleting local skills", async () => {
      // Delete react skill
      await deleteLocalSkill(dirs.projectDir, REACT_SKILL_ID);

      // Run installLocal with all skills
      const matrix = buildMatrixFromTestSkills(SWITCHABLE_SKILLS);
      const wizardResult = buildWizardResult(buildSkillConfigs(ALL_SKILL_NAMES), {
        selectedAgents: ["web-developer"],
      });
      const sourceResult = buildSourceResult(matrix, dirs.sourceDir);

      const installResult = await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Verify all skills copied
      expect(installResult.copiedSkills.length).toBe(SWITCHABLE_SKILLS.length);

      // Verify config generated
      expect(await fileExists(installResult.configPath)).toBe(true);
      const config = await readTestTsConfig<ProjectConfig>(installResult.configPath);
      expect(config.skills).toBeDefined();
      expect(config.skills?.length).toBe(SWITCHABLE_SKILLS.length);

      // Verify agents compiled
      expect(installResult.compiledAgents.length).toBeGreaterThan(0);

      // Verify NO _archived directory exists
      const archivedDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, "_archived");
      expect(await directoryExists(archivedDir)).toBe(false);
    });
  });

  describe("Mode migration: local to plugin to local round-trip", () => {
    it("should delete local skills when switching to plugin, re-copy when switching back", async () => {
      const skillDir = path.join(dirs.projectDir, LOCAL_SKILLS_PATH, REACT_SKILL_ID);

      // Read original local content
      const originalContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(originalContent).toContain("Local Version");

      // Delete (simulates local -> plugin switch)
      await deleteLocalSkill(dirs.projectDir, REACT_SKILL_ID);
      expect(await directoryExists(skillDir)).toBe(false);

      // Re-copy from source (simulates plugin -> local switch)
      const matrix = buildMatrixFromTestSkills(SWITCHABLE_SKILLS);
      const roundTripConfigs: SkillConfig[] = ALL_SKILL_NAMES.map((id) => ({
        id,
        scope: "project" as const,
        source: id === REACT_SKILL_ID ? "local" : "local",
      }));
      const wizardResult = buildWizardResult(roundTripConfigs, {
        selectedAgents: ["web-developer"],
      });
      const sourceResult = buildSourceResult(matrix, dirs.sourceDir);

      await installLocal({
        wizardResult,
        sourceResult,
        projectDir: dirs.projectDir,
      });

      // Content should be marketplace version (NOT preserved local edits)
      const reCopiedContent = await readFile(path.join(skillDir, "SKILL.md"), "utf-8");
      expect(reCopiedContent).toContain("Marketplace Version");
      expect(reCopiedContent).not.toContain("Local Version");
    });
  });
});
