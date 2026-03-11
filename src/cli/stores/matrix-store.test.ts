import { describe, it, expect } from "vitest";
import { useMatrixStore, getSkill, getMatrix, findSkill } from "./matrix-store";
import { createMockMatrix, SKILLS } from "../lib/__tests__/helpers";
import type { SkillId, SkillSlug } from "../types";

describe("MatrixStore", () => {

  describe("setMatrix and getMatrix", () => {
    it("should store and retrieve the matrix", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);

      const retrieved = useMatrixStore.getState().getMatrix();
      expect(retrieved).toBe(matrix);
    });
  });

  describe("reset", () => {
    it("should clear the matrix back to null", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);
      useMatrixStore.getState().reset();

      expect(useMatrixStore.getState().matrix).toBeNull();
    });
  });

  describe("getMatrix", () => {
    it("should throw when store is not populated", () => {
      expect(() => useMatrixStore.getState().getMatrix()).toThrow(
        "Matrix store not initialized",
      );
    });
  });

  describe("getSkill", () => {
    it("should return a skill by SkillId", () => {
      const reactSkill = SKILLS.react;
      const matrix = createMockMatrix(reactSkill);

      useMatrixStore.getState().setMatrix(matrix);

      const result = useMatrixStore.getState().getSkill("web-framework-react");
      expect(result).toBe(reactSkill);
    });

    it("should return a skill by SkillSlug via slugMap", () => {
      const reactSkill = SKILLS.react;
      const matrix = createMockMatrix(reactSkill);

      useMatrixStore.getState().setMatrix(matrix);

      const result = useMatrixStore.getState().getSkill("react");
      expect(result).toBe(reactSkill);
    });

    it("should return undefined for unknown ID", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);

      const result = useMatrixStore.getState().getSkill("web-framework-nonexistent" as SkillId);
      expect(result).toBeUndefined();
    });

    it("should return undefined for unknown slug", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);

      const result = useMatrixStore.getState().getSkill("nonexistent" as SkillSlug);
      expect(result).toBeUndefined();
    });

    it("should return undefined when store is not populated", () => {
      const result = useMatrixStore.getState().getSkill("web-framework-react");
      expect(result).toBeUndefined();
    });
  });

  describe("standalone selectors", () => {
    it("should look up a skill via the standalone getSkill selector", () => {
      const reactSkill = SKILLS.react;
      const matrix = createMockMatrix(reactSkill);

      useMatrixStore.getState().setMatrix(matrix);

      const result = getSkill("web-framework-react");
      expect(result).toBe(reactSkill);
    });

    it("should return the matrix via the standalone getMatrix selector", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);

      const result = getMatrix();
      expect(result).toBe(matrix);
    });

    it("should throw via the standalone getSkill selector for missing skill", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);

      expect(() => getSkill("web-framework-nonexistent" as SkillId)).toThrow(
        "Skill 'web-framework-nonexistent' not found in matrix store",
      );
    });

    it("should return undefined via findSkill for missing skill", () => {
      const matrix = createMockMatrix(SKILLS.react);

      useMatrixStore.getState().setMatrix(matrix);

      const result = findSkill("web-framework-nonexistent" as SkillId);
      expect(result).toBeUndefined();
    });

    it("should return a skill via findSkill when found", () => {
      const reactSkill = SKILLS.react;
      const matrix = createMockMatrix(reactSkill);

      useMatrixStore.getState().setMatrix(matrix);

      const result = findSkill("web-framework-react");
      expect(result).toBe(reactSkill);
    });

    it("should throw via the standalone getMatrix selector when not populated", () => {
      expect(() => getMatrix()).toThrow("Matrix store not initialized");
    });
  });
});
