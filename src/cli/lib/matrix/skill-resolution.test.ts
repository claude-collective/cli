import { describe, it, expect, vi } from "vitest";

import { createMockExtractedSkill, createMockMatrixConfig } from "../__tests__/helpers";
import { FRAMEWORK_CATEGORY } from "../__tests__/mock-data/mock-categories.js";
import {
  MERGE_BASIC_MATRIX,
  CONFLICT_MATRIX,
  ALTERNATIVES_MATRIX,
  REQUIRES_MATRIX,
  EMPTY_MATRIX_CONFIG,
  UNRESOLVED_CONFLICT_MATRIX,
} from "../__tests__/mock-data/mock-matrices.js";
import {
  REACT_EXTRACTED,
  REACT_EXTRACTED_BASIC,
  VUE_EXTRACTED_BASIC,
  ZUSTAND_EXTRACTED,
  JOTAI_EXTRACTED,
} from "../__tests__/mock-data/mock-skills.js";

vi.mock("../../utils/logger");

import { mergeMatrixWithSkills, synthesizeCategory } from "./skill-resolution";
import type { CategoryPath, Category, SkillId } from "../../types";

describe("skill-resolution", () => {
  describe("mergeMatrixWithSkills", () => {
    it("merges matrix config with extracted skills into resolved format", () => {
      const merged = mergeMatrixWithSkills(
        MERGE_BASIC_MATRIX.categories,
        MERGE_BASIC_MATRIX.relationships,
        [REACT_EXTRACTED],
      );

      expect(merged.version).toBe("1.0.0");
      expect(merged.skills["web-framework-react"]).toBeDefined();
      expect(merged.skills["web-framework-react"]!.id).toBe("web-framework-react");
    });

    it("resolves conflict references between skills", () => {
      const merged = mergeMatrixWithSkills(
        CONFLICT_MATRIX.categories,
        CONFLICT_MATRIX.relationships,
        [REACT_EXTRACTED_BASIC, VUE_EXTRACTED_BASIC],
      );

      const reactSkill = merged.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      expect(reactSkill!.conflictsWith).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillId: "web-framework-vue-composition-api" }),
        ]),
      );
    });

    it("handles empty skills array", () => {
      const merged = mergeMatrixWithSkills(
        EMPTY_MATRIX_CONFIG.categories,
        EMPTY_MATRIX_CONFIG.relationships,
        [],
      );

      expect(Object.keys(merged.skills)).toHaveLength(0);
      expect(merged.suggestedStacks).toEqual([]);
    });

    it("builds slugToId map from extracted skill metadata", () => {
      const reactWithSlug = createMockExtractedSkill("web-framework-react", {
        description: "React",
        slug: "react" as import("../../types").SkillSlug,
      });
      const merged = mergeMatrixWithSkills(
        EMPTY_MATRIX_CONFIG.categories,
        EMPTY_MATRIX_CONFIG.relationships,
        [reactWithSlug],
      );

      expect(merged.slugMap.slugToId.react).toBe("web-framework-react");
      expect(merged.slugMap.idToSlug["web-framework-react"]).toBe("react");
    });

    it("drops unresolved conflict references instead of passing through", () => {
      const merged = mergeMatrixWithSkills(
        UNRESOLVED_CONFLICT_MATRIX.categories,
        UNRESOLVED_CONFLICT_MATRIX.relationships,
        [REACT_EXTRACTED_BASIC],
      );

      const reactSkill = merged.skills["web-framework-react"];
      expect(reactSkill).toBeDefined();
      // Unresolved "nonexistent" slug should be dropped, not passed through as-is
      expect(reactSkill!.conflictsWith).toEqual([]);
    });

    it("resolves alternative groups correctly between skills", () => {
      const merged = mergeMatrixWithSkills(
        ALTERNATIVES_MATRIX.categories,
        ALTERNATIVES_MATRIX.relationships,
        [ZUSTAND_EXTRACTED, JOTAI_EXTRACTED],
      );

      const zustand = merged.skills["web-state-zustand"];
      const jotai = merged.skills["web-state-jotai"];
      expect(zustand!.alternatives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillId: "web-state-jotai", purpose: "State management" }),
        ]),
      );
      expect(jotai!.alternatives).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillId: "web-state-zustand", purpose: "State management" }),
        ]),
      );
    });

    it("resolves require rules correctly", () => {
      const merged = mergeMatrixWithSkills(
        REQUIRES_MATRIX.categories,
        REQUIRES_MATRIX.relationships,
        [ZUSTAND_EXTRACTED, REACT_EXTRACTED_BASIC],
      );

      const zustand = merged.skills["web-state-zustand"];
      expect(zustand!.requires).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            skillIds: expect.arrayContaining(["web-framework-react"]),
            reason: "Zustand needs React",
          }),
        ]),
      );
    });

    it("resolves recommendations from flat recommends list", () => {
      const matrixConfig = createMockMatrixConfig(
        { "web-framework": FRAMEWORK_CATEGORY },
        {
          relationships: {
            recommends: [{ skill: "zustand", reason: "Best state management" }],
          },
        },
      );

      const merged = mergeMatrixWithSkills(matrixConfig.categories, matrixConfig.relationships, [
        REACT_EXTRACTED_BASIC,
        ZUSTAND_EXTRACTED,
      ]);

      const zustand = merged.skills["web-state-zustand"];
      expect(zustand).toBeDefined();
      expect(zustand!.isRecommended).toBe(true);
      expect(zustand!.recommendedReason).toBe("Best state management");

      const react = merged.skills["web-framework-react"];
      expect(react).toBeDefined();
      expect(react!.isRecommended).toBe(false);
    });

    it("returns empty relationship fields when no relationships reference a skill", () => {
      const merged = mergeMatrixWithSkills(
        MERGE_BASIC_MATRIX.categories,
        MERGE_BASIC_MATRIX.relationships,
        [REACT_EXTRACTED_BASIC],
      );

      const react = merged.skills["web-framework-react"];
      expect(react).toBeDefined();
      expect(react!.compatibleWith).toEqual([]);
      expect(react!.isRecommended).toBe(false);
    });
  });

  describe("auto-synthesis", () => {
    it("synthesizes missing categories for skills with unknown category", () => {
      // Boundary cast: intentionally custom category not in built-in union
      const skill = createMockExtractedSkill("web-custom-tool" as SkillId, {
        category: "devops-iac" as CategoryPath,
        domain: "web",
      });

      const merged = mergeMatrixWithSkills({}, EMPTY_MATRIX_CONFIG.relationships, [skill]);

      // Boundary cast: accessing synthesized custom category key
      const synthesized = merged.categories["devops-iac" as Category];
      expect(synthesized).toBeDefined();
      expect(synthesized!.displayName).toBe("Devops Iac");
      expect(synthesized!.exclusive).toBe(true);
      expect(synthesized!.required).toBe(false);
      expect(synthesized!.order).toBe(999);
    });

    it("uses skill domain field for synthesized category domain", () => {
      // Boundary cast: intentionally custom category not in built-in union
      const skill = createMockExtractedSkill("web-custom-tool" as SkillId, {
        category: "devops-iac" as CategoryPath,
        domain: "api",
      });

      const merged = mergeMatrixWithSkills({}, EMPTY_MATRIX_CONFIG.relationships, [skill]);

      expect(merged.categories["devops-iac" as Category]!.domain).toBe("api");
    });

    it("passes skill domain to synthesized category regardless of prefix", () => {
      const skill = createMockExtractedSkill("web-custom-tool" as SkillId, {
        // Boundary cast: intentionally custom category not in built-in union
        category: "web-custom" as CategoryPath,
        domain: "cli",
      });

      const merged = mergeMatrixWithSkills({}, EMPTY_MATRIX_CONFIG.relationships, [skill]);

      expect(merged.categories["web-custom" as Category]!.domain).toBe("cli");
    });

    it("synthesized category uses skill domain even for unknown prefixes", () => {
      // Boundary cast: intentionally custom category not in built-in union
      const skill = createMockExtractedSkill("web-custom-tool" as SkillId, {
        category: "devops-iac" as CategoryPath,
        domain: "shared",
      });

      const merged = mergeMatrixWithSkills({}, EMPTY_MATRIX_CONFIG.relationships, [skill]);

      expect(merged.categories["devops-iac" as Category]!.domain).toBe("shared");
    });

    it("does not synthesize categories that already exist", () => {
      const existingCategories = {
        "web-framework": FRAMEWORK_CATEGORY,
      };

      const merged = mergeMatrixWithSkills(existingCategories, EMPTY_MATRIX_CONFIG.relationships, [
        REACT_EXTRACTED_BASIC,
      ]);

      expect(merged.categories["web-framework"]).toBe(FRAMEWORK_CATEGORY);
    });
  });

  describe("synthesizeCategory", () => {
    it("creates category with provided domain", () => {
      // Boundary cast: custom category not in built-in union
      const cat = synthesizeCategory("web-custom" as Category, "web");
      expect(cat.domain).toBe("web");
      expect(cat.displayName).toBe("Web Custom");
    });

    it("creates category with explicit domain override", () => {
      // Boundary cast: custom category not in built-in union
      const cat = synthesizeCategory("devops-iac" as Category, "api");
      expect(cat.domain).toBe("api");
    });

    it("uses the provided domain regardless of category prefix", () => {
      // Boundary cast: custom category not in built-in union
      const cat = synthesizeCategory("devops-iac" as Category, "cli");
      expect(cat.domain).toBe("cli");
    });
  });
});
