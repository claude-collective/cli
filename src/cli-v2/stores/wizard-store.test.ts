/**
 * Unit tests for the wizard store (Zustand state management).
 *
 * Tests state transitions without UI rendering for fast feedback.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useWizardStore } from "./wizard-store";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";
import type { ResolvedStack } from "../types-matrix";

const PRESELECTED_COUNT = DEFAULT_PRESELECTED_SKILLS.length;

// =============================================================================
// Mock Data
// =============================================================================

const createMockStack = (id: string, skillIds: string[]): ResolvedStack => ({
  id,
  name: `Stack ${id}`,
  description: `Test stack ${id}`,
  allSkillIds: skillIds,
  requiredSkillIds: [],
  optionalSkillIds: skillIds,
  suggestedAgents: [],
});

// =============================================================================
// Tests
// =============================================================================

describe("WizardStore", () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useWizardStore.getState().reset();
  });

  // ===========================================================================
  // Initial State
  // ===========================================================================

  describe("initial state", () => {
    it("should start at approach step", () => {
      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should have preselected methodology skills", () => {
      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toHaveLength(PRESELECTED_COUNT);
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(selectedSkills).toContain(skill);
      }
    });

    it("should have no selected stack", () => {
      const { selectedStack } = useWizardStore.getState();
      expect(selectedStack).toBeNull();
    });

    it("should have expert mode off", () => {
      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(false);
    });

    it("should default to local install mode", () => {
      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });

    it("should have empty navigation history", () => {
      const { history } = useWizardStore.getState();
      expect(history).toEqual([]);
    });

    it("should have empty visited categories", () => {
      const { visitedCategories } = useWizardStore.getState();
      expect(visitedCategories.size).toBe(0);
    });
  });

  // ===========================================================================
  // Step Navigation
  // ===========================================================================

  describe("step navigation", () => {
    it("should update step with setStep", () => {
      const store = useWizardStore.getState();
      store.setStep("stack");

      const { step } = useWizardStore.getState();
      expect(step).toBe("stack");
    });

    it("should track navigation history when setting step", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setStep("confirm");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["approach", "stack"]);
    });

    it("should go back through history", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.setStep("confirm");
      store.goBack();

      const { step, history } = useWizardStore.getState();
      expect(step).toBe("stack");
      expect(history).toEqual(["approach"]);
    });

    it("should return to approach when history is empty", () => {
      const store = useWizardStore.getState();

      store.setStep("stack");
      store.goBack();
      store.goBack(); // Extra goBack when already at approach

      const { step } = useWizardStore.getState();
      expect(step).toBe("approach");
    });

    it("should navigate through full wizard flow", () => {
      const store = useWizardStore.getState();

      // Simulate stack approach flow
      store.setStep("stack");
      expect(useWizardStore.getState().step).toBe("stack");

      store.setStep("confirm");
      expect(useWizardStore.getState().step).toBe("confirm");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["approach", "stack"]);
    });

    it("should navigate through browse approach flow", () => {
      const store = useWizardStore.getState();

      // Simulate browse by category flow
      store.setStep("category");
      expect(useWizardStore.getState().step).toBe("category");

      store.setStep("subcategory");
      expect(useWizardStore.getState().step).toBe("subcategory");

      store.setStep("confirm");
      expect(useWizardStore.getState().step).toBe("confirm");

      const { history } = useWizardStore.getState();
      expect(history).toEqual(["approach", "category", "subcategory"]);
    });
  });

  // ===========================================================================
  // Skill Selection
  // ===========================================================================

  describe("skill selection", () => {
    it("should toggle skill on", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");

      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toContain("react (@vince)");
    });

    it("should toggle skill off", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");
      store.toggleSkill("react (@vince)");

      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).not.toContain("react (@vince)");
    });

    it("should allow multiple skill selection", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");
      store.toggleSkill("zustand (@vince)");
      store.toggleSkill("vitest (@vince)");

      const { selectedSkills } = useWizardStore.getState();
      // 3 new skills + preselected methodology skills
      expect(selectedSkills).toHaveLength(PRESELECTED_COUNT + 3);
      expect(selectedSkills).toContain("react (@vince)");
      expect(selectedSkills).toContain("zustand (@vince)");
      expect(selectedSkills).toContain("vitest (@vince)");
    });

    it("should remove only the toggled skill", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");
      store.toggleSkill("zustand (@vince)");
      store.toggleSkill("vitest (@vince)");
      store.toggleSkill("zustand (@vince)"); // Toggle off

      const { selectedSkills } = useWizardStore.getState();
      // 2 remaining + preselected methodology skills
      expect(selectedSkills).toHaveLength(PRESELECTED_COUNT + 2);
      expect(selectedSkills).toContain("react (@vince)");
      expect(selectedSkills).not.toContain("zustand (@vince)");
      expect(selectedSkills).toContain("vitest (@vince)");
    });

    it("should maintain skill order with preselected first", () => {
      const store = useWizardStore.getState();

      store.toggleSkill("react (@vince)");
      store.toggleSkill("zustand (@vince)");
      store.toggleSkill("vitest (@vince)");

      const { selectedSkills } = useWizardStore.getState();
      // Preselected skills come first, then toggled skills in order
      expect(selectedSkills[PRESELECTED_COUNT]).toBe("react (@vince)");
      expect(selectedSkills[PRESELECTED_COUNT + 1]).toBe("zustand (@vince)");
      expect(selectedSkills[PRESELECTED_COUNT + 2]).toBe("vitest (@vince)");
    });
  });

  // ===========================================================================
  // Stack Selection
  // ===========================================================================

  describe("stack selection", () => {
    it("should select stack and populate skills with preselected", () => {
      const store = useWizardStore.getState();
      const mockStack = createMockStack("nextjs-fullstack", [
        "react (@vince)",
        "zustand (@vince)",
        "hono (@vince)",
      ]);

      store.selectStack(mockStack);

      const { selectedStack, selectedSkills } = useWizardStore.getState();
      expect(selectedStack?.id).toBe("nextjs-fullstack");
      // Should include preselected methodology skills + stack skills
      expect(selectedSkills).toContain("react (@vince)");
      expect(selectedSkills).toContain("zustand (@vince)");
      expect(selectedSkills).toContain("hono (@vince)");
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(selectedSkills).toContain(skill);
      }
    });

    it("should replace stack skills when changing stack but keep preselected", () => {
      const store = useWizardStore.getState();

      const stack1 = createMockStack("stack1", ["react (@vince)"]);
      const stack2 = createMockStack("stack2", ["vue (@vince)"]);

      store.selectStack(stack1);
      const skills1 = useWizardStore.getState().selectedSkills;
      expect(skills1).toContain("react (@vince)");
      expect(skills1).not.toContain("vue (@vince)");

      store.selectStack(stack2);
      const skills2 = useWizardStore.getState().selectedSkills;
      expect(skills2).toContain("vue (@vince)");
      expect(skills2).not.toContain("react (@vince)");
      // Preselected skills should still be there
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(skills2).toContain(skill);
      }
    });

    it("should keep preselected skills when stack is deselected", () => {
      const store = useWizardStore.getState();
      const mockStack = createMockStack("test", ["skill1", "skill2"]);

      store.selectStack(mockStack);
      store.selectStack(null);

      const { selectedStack, selectedSkills } = useWizardStore.getState();
      expect(selectedStack).toBeNull();
      // Stack skills are cleared but preselected methodology skills remain
      expect(selectedSkills).not.toContain("skill1");
      expect(selectedSkills).not.toContain("skill2");
      expect(selectedSkills).toHaveLength(PRESELECTED_COUNT);
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(selectedSkills).toContain(skill);
      }
    });
  });

  // ===========================================================================
  // Mode Toggles
  // ===========================================================================

  describe("mode toggles", () => {
    it("should toggle expert mode on", () => {
      const store = useWizardStore.getState();

      store.toggleExpertMode();

      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(true);
    });

    it("should toggle expert mode off", () => {
      const store = useWizardStore.getState();

      store.toggleExpertMode();
      store.toggleExpertMode();

      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(false);
    });

    it("should toggle install mode to plugin", () => {
      const store = useWizardStore.getState();

      store.toggleInstallMode();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("plugin");
    });

    it("should toggle install mode back to local", () => {
      const store = useWizardStore.getState();

      store.toggleInstallMode();
      store.toggleInstallMode();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });
  });

  // ===========================================================================
  // Category Navigation
  // ===========================================================================

  describe("category navigation", () => {
    it("should set current category", () => {
      const store = useWizardStore.getState();

      store.setCategory("frontend");

      const { currentTopCategory } = useWizardStore.getState();
      expect(currentTopCategory).toBe("frontend");
    });

    it("should set current subcategory", () => {
      const store = useWizardStore.getState();

      store.setSubcategory("frontend/framework");

      const { currentSubcategory } = useWizardStore.getState();
      expect(currentSubcategory).toBe("frontend/framework");
    });

    it("should mark category as visited", () => {
      const store = useWizardStore.getState();

      store.markCategoryVisited("frontend");
      store.markCategoryVisited("backend");

      const { visitedCategories } = useWizardStore.getState();
      expect(visitedCategories.has("frontend")).toBe(true);
      expect(visitedCategories.has("backend")).toBe(true);
      expect(visitedCategories.size).toBe(2);
    });

    it("should not duplicate visited categories", () => {
      const store = useWizardStore.getState();

      store.markCategoryVisited("frontend");
      store.markCategoryVisited("frontend");

      const { visitedCategories } = useWizardStore.getState();
      expect(visitedCategories.size).toBe(1);
    });
  });

  // ===========================================================================
  // Last Selected Values
  // ===========================================================================

  describe("last selected values", () => {
    it("should track last selected category", () => {
      const store = useWizardStore.getState();

      store.setLastSelectedCategory("frontend");

      const { lastSelectedCategory } = useWizardStore.getState();
      expect(lastSelectedCategory).toBe("frontend");
    });

    it("should track last selected subcategory", () => {
      const store = useWizardStore.getState();

      store.setLastSelectedSubcategory("frontend/framework");

      const { lastSelectedSubcategory } = useWizardStore.getState();
      expect(lastSelectedSubcategory).toBe("frontend/framework");
    });

    it("should track last selected skill", () => {
      const store = useWizardStore.getState();

      store.setLastSelectedSkill("react (@vince)");

      const { lastSelectedSkill } = useWizardStore.getState();
      expect(lastSelectedSkill).toBe("react (@vince)");
    });

    it("should track last selected approach", () => {
      const store = useWizardStore.getState();

      store.setLastSelectedApproach("stack");

      const { lastSelectedApproach } = useWizardStore.getState();
      expect(lastSelectedApproach).toBe("stack");
    });

    it("should allow clearing last selected values", () => {
      const store = useWizardStore.getState();

      store.setLastSelectedCategory("frontend");
      store.setLastSelectedCategory(null);

      const { lastSelectedCategory } = useWizardStore.getState();
      expect(lastSelectedCategory).toBeNull();
    });
  });

  // ===========================================================================
  // Reset
  // ===========================================================================

  describe("reset", () => {
    it("should reset to initial state with preselected skills", () => {
      const store = useWizardStore.getState();

      // Make some changes
      store.setStep("category");
      store.toggleSkill("react (@vince)");
      store.toggleExpertMode();
      store.markCategoryVisited("frontend");
      store.setLastSelectedCategory("frontend");

      // Reset
      store.reset();

      const state = useWizardStore.getState();
      expect(state.step).toBe("approach");
      // Should have preselected skills after reset
      expect(state.selectedSkills).toHaveLength(PRESELECTED_COUNT);
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(state.selectedSkills).toContain(skill);
      }
      expect(state.expertMode).toBe(false);
      expect(state.visitedCategories.size).toBe(0);
      expect(state.lastSelectedCategory).toBeNull();
    });

    it("should accept initial skills on reset combined with preselected", () => {
      const store = useWizardStore.getState();

      store.reset({
        initialSkills: ["react (@vince)", "zustand (@vince)"],
      });

      const { step, selectedSkills } = useWizardStore.getState();
      expect(step).toBe("category"); // Skips approach when skills provided
      // Should have preselected + initial skills
      expect(selectedSkills).toContain("react (@vince)");
      expect(selectedSkills).toContain("zustand (@vince)");
      for (const skill of DEFAULT_PRESELECTED_SKILLS) {
        expect(selectedSkills).toContain(skill);
      }
    });

    it("should accept hasLocalSkills option", () => {
      const store = useWizardStore.getState();

      store.reset({ hasLocalSkills: true });

      const { expertMode } = useWizardStore.getState();
      expect(expertMode).toBe(true);
    });

    it("should skip approach step when initial skills provided", () => {
      const store = useWizardStore.getState();

      store.reset({ initialSkills: ["react (@vince)"] });

      const { step } = useWizardStore.getState();
      expect(step).toBe("category");
    });

    it("should preserve install mode as local on reset", () => {
      const store = useWizardStore.getState();

      store.toggleInstallMode(); // Switch to plugin
      store.reset();

      const { installMode } = useWizardStore.getState();
      expect(installMode).toBe("local");
    });
  });

  // ===========================================================================
  // Complex Flows
  // ===========================================================================

  describe("complex flows", () => {
    it("should handle complete stack selection flow", () => {
      const store = useWizardStore.getState();
      const mockStack = createMockStack("fullstack", [
        "react (@vince)",
        "zustand (@vince)",
        "hono (@vince)",
      ]);

      // Step 1: Choose stack approach
      store.setStep("stack");

      // Step 2: Select stack
      store.selectStack(mockStack);
      store.setStep("confirm");

      // Verify final state
      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.selectedStack?.id).toBe("fullstack");
      // 3 stack skills + preselected methodology skills
      expect(state.selectedSkills).toHaveLength(PRESELECTED_COUNT + 3);
      expect(state.history).toEqual(["approach", "stack"]);
    });

    it("should handle complete browse flow with navigation", () => {
      const store = useWizardStore.getState();

      // Navigate forward
      store.setStep("category");
      store.setCategory("frontend");
      store.markCategoryVisited("frontend");

      store.setStep("subcategory");
      store.setSubcategory("frontend/framework");

      // Select skill
      store.toggleSkill("react (@vince)");

      // Navigate back and select another
      store.goBack();
      store.setCategory("backend");
      store.markCategoryVisited("backend");
      store.setStep("subcategory");
      store.setSubcategory("backend/api");
      store.toggleSkill("hono (@vince)");

      // Proceed to confirm
      store.setStep("confirm");

      // Verify final state
      const state = useWizardStore.getState();
      expect(state.step).toBe("confirm");
      expect(state.selectedSkills).toContain("react (@vince)");
      expect(state.selectedSkills).toContain("hono (@vince)");
      expect(state.visitedCategories.has("frontend")).toBe(true);
      expect(state.visitedCategories.has("backend")).toBe(true);
    });

    it("should preserve selections when going back", () => {
      const store = useWizardStore.getState();

      // Make selections
      store.toggleSkill("react (@vince)");
      store.setStep("category");
      store.setStep("subcategory");

      // Go back
      store.goBack();
      store.goBack();

      // Selections should be preserved
      const { selectedSkills } = useWizardStore.getState();
      expect(selectedSkills).toContain("react (@vince)");
    });
  });
});
