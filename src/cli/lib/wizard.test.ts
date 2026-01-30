import { describe, it, expect } from "vitest";
import {
  createInitialState,
  pushHistory,
  popHistory,
  formatSkillOption,
  formatStackOption,
  formatExpertModeOption,
  formatInstallModeOption,
  BACK_VALUE,
  CONTINUE_VALUE,
  EXPERT_MODE_VALUE,
  INSTALL_MODE_VALUE,
  type WizardState,
  type WizardStep,
} from "./wizard";
import type {
  MergedSkillsMatrix,
  ResolvedSkill,
  ResolvedStack,
  SkillOption,
} from "../types-matrix";

/**
 * Create a minimal ResolvedSkill for testing
 */
function createSkill(
  id: string,
  overrides: Partial<ResolvedSkill> = {},
): ResolvedSkill {
  return {
    id,
    name: id,
    description: `Description for ${id}`,
    category: "framework",
    categoryExclusive: true,
    tags: [],
    author: "@test",
    version: "1",
    conflictsWith: [],
    recommends: [],
    recommendedBy: [],
    requires: [],
    requiredBy: [],
    alternatives: [],
    discourages: [],
    requiresSetup: [],
    providesSetupFor: [],
    path: `skills/${id}/`,
    ...overrides,
  };
}

/**
 * Create a minimal MergedSkillsMatrix for testing
 */
function createMatrix(
  skills: Record<string, ResolvedSkill> = {},
  stacks: ResolvedStack[] = [],
): MergedSkillsMatrix {
  return {
    version: "1.0.0",
    categories: {},
    skills,
    suggestedStacks: stacks,
    aliases: {},
    aliasesReverse: {},
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Create a minimal ResolvedStack for testing
 */
function createStack(
  id: string,
  overrides: Partial<ResolvedStack> = {},
): ResolvedStack {
  return {
    id,
    name: `Stack ${id}`,
    description: `Description for ${id}`,
    audience: ["developers"],
    skills: {},
    allSkillIds: [],
    philosophy: "Test philosophy",
    ...overrides,
  };
}

/**
 * Create a minimal SkillOption for testing formatSkillOption
 */
function createSkillOption(overrides: Partial<SkillOption> = {}): SkillOption {
  return {
    id: "skill-id",
    name: "Skill Name",
    description: "Skill description",
    disabled: false,
    discouraged: false,
    recommended: false,
    selected: false,
    alternatives: [],
    ...overrides,
  };
}

/**
 * Create a fresh WizardState for testing state transitions
 */
function createWizardState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: "approach",
    selectedSkills: [],
    history: [],
    currentTopCategory: null,
    currentSubcategory: null,
    visitedCategories: new Set(),
    selectedStack: null,
    lastSelectedCategory: null,
    lastSelectedSubcategory: null,
    lastSelectedSkill: null,
    lastSelectedApproach: null,
    expertMode: false,
    installMode: "local",
    ...overrides,
  };
}

describe("wizard", () => {
  describe("constants", () => {
    it("should export BACK_VALUE constant", () => {
      expect(BACK_VALUE).toBe("__back__");
    });

    it("should export CONTINUE_VALUE constant", () => {
      expect(CONTINUE_VALUE).toBe("__continue__");
    });

    it("should export EXPERT_MODE_VALUE constant", () => {
      expect(EXPERT_MODE_VALUE).toBe("__expert_mode__");
    });

    it("should export INSTALL_MODE_VALUE constant", () => {
      expect(INSTALL_MODE_VALUE).toBe("__install_mode__");
    });
  });

  describe("createInitialState", () => {
    describe("P1-11: approach selection (stack vs scratch)", () => {
      it("should start at approach step with empty options", () => {
        const state = createInitialState();
        expect(state.currentStep).toBe("approach");
      });

      it("should start at category step when initialSkills provided", () => {
        const state = createInitialState({
          initialSkills: ["skill-a", "skill-b"],
        });
        expect(state.currentStep).toBe("category");
      });

      it("should copy initialSkills to selectedSkills", () => {
        const state = createInitialState({
          initialSkills: ["skill-a", "skill-b"],
        });
        expect(state.selectedSkills).toEqual(["skill-a", "skill-b"]);
      });

      it("should have empty selectedSkills by default", () => {
        const state = createInitialState();
        expect(state.selectedSkills).toEqual([]);
      });

      it("should not modify original initialSkills array", () => {
        const original = ["skill-a"];
        const state = createInitialState({ initialSkills: original });
        state.selectedSkills.push("skill-b");
        expect(original).toEqual(["skill-a"]);
      });
    });

    describe("P1-12: install mode toggle", () => {
      it("should have installMode default to local", () => {
        const state = createInitialState();
        expect(state.installMode).toBe("local");
      });

      it("should have installMode as local regardless of other options", () => {
        const state = createInitialState({
          initialSkills: ["skill-a"],
          hasLocalSkills: true,
        });
        expect(state.installMode).toBe("local");
      });
    });

    describe("P1-13: expert mode toggle", () => {
      it("should have expertMode default to false", () => {
        const state = createInitialState();
        expect(state.expertMode).toBe(false);
      });

      it("should have expertMode false when hasLocalSkills is false", () => {
        const state = createInitialState({ hasLocalSkills: false });
        expect(state.expertMode).toBe(false);
      });

      it("should have expertMode true when hasLocalSkills is true", () => {
        const state = createInitialState({ hasLocalSkills: true });
        expect(state.expertMode).toBe(true);
      });

      it("should have expertMode false when hasLocalSkills is undefined", () => {
        const state = createInitialState({});
        expect(state.expertMode).toBe(false);
      });
    });

    describe("initial state properties", () => {
      it("should have empty history", () => {
        const state = createInitialState();
        expect(state.history).toEqual([]);
      });

      it("should have null currentTopCategory", () => {
        const state = createInitialState();
        expect(state.currentTopCategory).toBeNull();
      });

      it("should have null currentSubcategory", () => {
        const state = createInitialState();
        expect(state.currentSubcategory).toBeNull();
      });

      it("should have empty visitedCategories set", () => {
        const state = createInitialState();
        expect(state.visitedCategories.size).toBe(0);
      });

      it("should have null selectedStack", () => {
        const state = createInitialState();
        expect(state.selectedStack).toBeNull();
      });

      it("should have null lastSelectedCategory", () => {
        const state = createInitialState();
        expect(state.lastSelectedCategory).toBeNull();
      });

      it("should have null lastSelectedSubcategory", () => {
        const state = createInitialState();
        expect(state.lastSelectedSubcategory).toBeNull();
      });

      it("should have null lastSelectedSkill", () => {
        const state = createInitialState();
        expect(state.lastSelectedSkill).toBeNull();
      });

      it("should have null lastSelectedApproach", () => {
        const state = createInitialState();
        expect(state.lastSelectedApproach).toBeNull();
      });
    });
  });

  describe("history management (P1-15)", () => {
    describe("pushHistory", () => {
      it("should push current step to history", () => {
        const state = createWizardState({ currentStep: "approach" });
        pushHistory(state);
        expect(state.history).toEqual(["approach"]);
      });

      it("should push multiple steps to history", () => {
        const state = createWizardState({ currentStep: "approach" });
        pushHistory(state);
        state.currentStep = "stack";
        pushHistory(state);
        state.currentStep = "category";
        pushHistory(state);
        expect(state.history).toEqual(["approach", "stack", "category"]);
      });

      it("should not change currentStep when pushing", () => {
        const state = createWizardState({ currentStep: "category" });
        pushHistory(state);
        expect(state.currentStep).toBe("category");
      });
    });

    describe("popHistory", () => {
      it("should return null for empty history", () => {
        const state = createWizardState({ history: [] });
        const result = popHistory(state);
        expect(result).toBeNull();
      });

      it("should return and remove last step from history", () => {
        const state = createWizardState({
          history: ["approach", "stack"] as WizardStep[],
        });
        const result = popHistory(state);
        expect(result).toBe("stack");
        expect(state.history).toEqual(["approach"]);
      });

      it("should return last step when popping single item", () => {
        const state = createWizardState({
          history: ["approach"] as WizardStep[],
        });
        const result = popHistory(state);
        expect(result).toBe("approach");
        expect(state.history).toEqual([]);
      });

      it("should support multiple back navigations", () => {
        const state = createWizardState({
          history: ["approach", "stack", "category"] as WizardStep[],
        });

        expect(popHistory(state)).toBe("category");
        expect(state.history).toEqual(["approach", "stack"]);

        expect(popHistory(state)).toBe("stack");
        expect(state.history).toEqual(["approach"]);

        expect(popHistory(state)).toBe("approach");
        expect(state.history).toEqual([]);

        expect(popHistory(state)).toBeNull();
      });
    });

    describe("back navigation integration", () => {
      it("should correctly restore previous step on back", () => {
        const state = createWizardState({ currentStep: "approach" });

        // Simulate forward navigation: approach -> stack
        pushHistory(state);
        state.currentStep = "stack";

        // Simulate back navigation
        const previousStep = popHistory(state);
        if (previousStep) {
          state.currentStep = previousStep;
        }

        expect(state.currentStep).toBe("approach");
        expect(state.history).toEqual([]);
      });

      it("should correctly handle category back navigation clearing state", () => {
        const stack = createStack("react-stack", {
          allSkillIds: ["react", "zustand", "tailwind"],
        });
        const state = createWizardState({
          currentStep: "category",
          history: ["approach", "stack"] as WizardStep[],
          selectedStack: stack,
          selectedSkills: ["react", "zustand", "tailwind"],
        });

        // Simulate back from category (should clear stack and skills)
        state.selectedStack = null;
        state.selectedSkills = [];
        const previousStep = popHistory(state);
        if (previousStep) {
          state.currentStep = previousStep;
        }

        expect(state.currentStep).toBe("stack");
        expect(state.selectedStack).toBeNull();
        expect(state.selectedSkills).toEqual([]);
      });
    });
  });

  describe("P1-14: stack selection and skill pre-population", () => {
    describe("stack selection state transitions", () => {
      it("should set selectedStack when a stack is selected", () => {
        const stack = createStack("react-stack", {
          name: "React Stack",
          allSkillIds: ["react", "zustand"],
        });
        const state = createWizardState({ currentStep: "stack" });

        // Simulate stack selection
        state.selectedStack = stack;
        expect(state.selectedStack).toBe(stack);
        expect(state.selectedStack?.id).toBe("react-stack");
      });

      it("should copy stack allSkillIds to selectedSkills", () => {
        const stack = createStack("react-stack", {
          allSkillIds: ["react", "zustand", "tailwind"],
        });
        const state = createWizardState({ currentStep: "stack" });

        // Simulate stack selection pre-populating skills
        state.selectedStack = stack;
        state.selectedSkills = [...stack.allSkillIds];

        expect(state.selectedSkills).toEqual(["react", "zustand", "tailwind"]);
      });

      it("should not modify stack allSkillIds when modifying selectedSkills", () => {
        const stack = createStack("react-stack", {
          allSkillIds: ["react", "zustand"],
        });
        const state = createWizardState({ currentStep: "stack" });

        state.selectedStack = stack;
        state.selectedSkills = [...stack.allSkillIds];

        // Modify selectedSkills
        state.selectedSkills.push("tailwind");

        expect(stack.allSkillIds).toEqual(["react", "zustand"]);
        expect(state.selectedSkills).toEqual(["react", "zustand", "tailwind"]);
      });
    });

    describe("category transitions", () => {
      it("should transition from stack to category after selection", () => {
        const state = createWizardState({
          currentStep: "stack",
          history: ["approach"] as WizardStep[],
        });

        // Simulate stack selection -> category transition (stack now goes directly to category)
        pushHistory(state);
        state.currentStep = "category";

        expect(state.currentStep).toBe("category");
        expect(state.history).toEqual(["approach", "stack"]);
      });

      it("should transition to confirm from category on CONTINUE", () => {
        const state = createWizardState({
          currentStep: "category",
          history: ["approach", "stack"] as WizardStep[],
          selectedSkills: ["react", "zustand"],
        });

        // Simulate CONTINUE_VALUE selection -> confirm transition
        pushHistory(state);
        state.currentStep = "confirm";

        expect(state.currentStep).toBe("confirm");
        expect(state.history).toEqual(["approach", "stack", "category"]);
        // selectedSkills should be preserved
        expect(state.selectedSkills).toEqual(["react", "zustand"]);
      });
    });
  });

  describe("formatters", () => {
    describe("formatSkillOption", () => {
      it("should format basic skill option", () => {
        const option = createSkillOption({
          id: "react",
          name: "React",
          description: "A JavaScript library for building user interfaces",
        });

        const result = formatSkillOption(option);

        expect(result.value).toBe("react");
        expect(result.label).toBe("React");
        expect(result.hint).toBe(
          "A JavaScript library for building user interfaces",
        );
      });

      it("should format selected skill with checkmark", () => {
        const option = createSkillOption({
          name: "React",
          selected: true,
        });

        const result = formatSkillOption(option);

        expect(result.label).toContain("React");
        // The label is styled with pc.green, so we check the checkmark is present
      });

      it("should format disabled skill with reason", () => {
        const option = createSkillOption({
          name: "Zustand",
          disabled: true,
          disabledReason: "Conflicts with Redux (already selected)",
        });

        const result = formatSkillOption(option);

        expect(result.label).toContain("Zustand");
        expect(result.label).toContain("disabled");
      });

      it("should format disabled skill with short reason only", () => {
        const option = createSkillOption({
          name: "Zustand",
          disabled: true,
          disabledReason: "Conflicts with Redux (already selected)",
        });

        const result = formatSkillOption(option);

        // Should use short reason (before parentheses)
        expect(result.label).toContain("conflicts with redux");
      });

      it("should format discouraged skill", () => {
        const option = createSkillOption({
          name: "Legacy CSS",
          discouraged: true,
        });

        const result = formatSkillOption(option);

        expect(result.label).toContain("Legacy CSS");
        expect(result.label).toContain("not recommended");
      });

      it("should format recommended skill", () => {
        const option = createSkillOption({
          name: "TypeScript",
          recommended: true,
        });

        const result = formatSkillOption(option);

        expect(result.label).toContain("TypeScript");
        // The (recommended) part is styled with pc.green
      });

      it("should prioritize selected over other states", () => {
        const option = createSkillOption({
          name: "React",
          selected: true,
          recommended: true,
          discouraged: true,
        });

        const result = formatSkillOption(option);

        // When selected, should show checkmark, not other states
        expect(result.label).not.toContain("recommended");
        expect(result.label).not.toContain("not recommended");
      });

      it("should prioritize disabled over discouraged and recommended", () => {
        const option = createSkillOption({
          name: "React",
          disabled: true,
          recommended: true,
          discouraged: true,
        });

        const result = formatSkillOption(option);

        expect(result.label).toContain("disabled");
        expect(result.label).not.toContain("recommended)");
      });

      it("should prioritize discouraged over recommended", () => {
        const option = createSkillOption({
          name: "React",
          discouraged: true,
          recommended: true,
        });

        const result = formatSkillOption(option);

        expect(result.label).toContain("not recommended");
      });
    });

    describe("formatStackOption", () => {
      it("should format stack with all properties", () => {
        const stack = createStack("react-stack", {
          name: "React Modern",
          description: "React with Zustand and Tailwind",
        });

        const result = formatStackOption(stack);

        expect(result.value).toBe("react-stack");
        expect(result.label).toBe("React Modern");
        expect(result.hint).toBe("React with Zustand and Tailwind");
      });

      it("should use stack id as value", () => {
        const stack = createStack("my-custom-stack");

        const result = formatStackOption(stack);

        expect(result.value).toBe("my-custom-stack");
      });
    });

    describe("formatExpertModeOption", () => {
      it("should format expert mode OFF option", () => {
        const result = formatExpertModeOption(false);

        expect(result.value).toBe(EXPERT_MODE_VALUE);
        expect(result.label).toContain("Expert Mode");
        expect(result.label).toContain("OFF");
        expect(result.hint).toContain("enable");
        expect(result.hint).toContain("conflicting skills");
      });

      it("should format expert mode ON option", () => {
        const result = formatExpertModeOption(true);

        expect(result.value).toBe(EXPERT_MODE_VALUE);
        expect(result.label).toContain("Expert Mode");
        expect(result.label).toContain("ON");
        expect(result.hint).toContain("disable");
        expect(result.hint).toContain("any skill combination");
      });
    });

    describe("formatInstallModeOption", () => {
      it("should format local install mode option as recommended", () => {
        const result = formatInstallModeOption("local");

        expect(result.value).toBe(INSTALL_MODE_VALUE);
        expect(result.label).toContain("Install Mode");
        expect(result.label).toContain("Local");
        expect(result.hint).toContain(".claude/skills/");
        expect(result.hint).toContain("customization");
        expect(result.hint).toContain("recommended");
      });

      it("should format plugin install mode option", () => {
        const result = formatInstallModeOption("plugin");

        expect(result.value).toBe(INSTALL_MODE_VALUE);
        expect(result.label).toContain("Install Mode");
        expect(result.label).toContain("Plugin");
        expect(result.hint).toContain("native Claude plugins");
        expect(result.hint).not.toContain("recommended");
      });
    });
  });

  describe("state transitions", () => {
    describe("approach step transitions", () => {
      it("should transition to stack step when stack is selected", () => {
        const state = createWizardState({ currentStep: "approach" });

        // Simulate selecting "stack" approach
        pushHistory(state);
        state.currentStep = "stack";

        expect(state.currentStep).toBe("stack");
        expect(state.history).toEqual(["approach"]);
      });

      it("should transition to category step when scratch is selected", () => {
        const state = createWizardState({ currentStep: "approach" });

        // Simulate selecting "scratch" approach
        pushHistory(state);
        state.currentStep = "category";

        expect(state.currentStep).toBe("category");
        expect(state.history).toEqual(["approach"]);
      });

      it("should toggle expertMode when EXPERT_MODE_VALUE selected", () => {
        const state = createWizardState({
          currentStep: "approach",
          expertMode: false,
        });

        // Simulate toggle
        state.expertMode = !state.expertMode;

        expect(state.expertMode).toBe(true);

        // Toggle again
        state.expertMode = !state.expertMode;

        expect(state.expertMode).toBe(false);
      });

      it("should toggle installMode when INSTALL_MODE_VALUE selected", () => {
        const state = createWizardState({
          currentStep: "approach",
          installMode: "local",
        });

        // Simulate toggle
        state.installMode = state.installMode === "plugin" ? "local" : "plugin";

        expect(state.installMode).toBe("plugin");

        // Toggle again
        state.installMode = state.installMode === "plugin" ? "local" : "plugin";

        expect(state.installMode).toBe("local");
      });

      it("should preserve lastSelectedApproach for toggles", () => {
        const state = createWizardState({ currentStep: "approach" });

        // Simulate toggling expert mode
        state.lastSelectedApproach = EXPERT_MODE_VALUE;
        state.expertMode = true;

        expect(state.lastSelectedApproach).toBe(EXPERT_MODE_VALUE);

        // When moving to a new step, lastSelectedApproach is cleared
        state.lastSelectedApproach = null;
        pushHistory(state);
        state.currentStep = "stack";

        expect(state.lastSelectedApproach).toBeNull();
      });
    });

    describe("category step transitions", () => {
      it("should transition to subcategory when category selected", () => {
        const state = createWizardState({
          currentStep: "category",
          history: ["approach"] as WizardStep[],
        });

        pushHistory(state);
        state.currentTopCategory = "frontend";
        state.currentStep = "subcategory";

        expect(state.currentStep).toBe("subcategory");
        expect(state.currentTopCategory).toBe("frontend");
      });

      it("should transition to confirm when CONTINUE_VALUE selected", () => {
        const state = createWizardState({
          currentStep: "category",
          history: ["approach"] as WizardStep[],
          selectedSkills: ["react"],
        });

        state.lastSelectedCategory = CONTINUE_VALUE;
        pushHistory(state);
        state.currentStep = "confirm";

        expect(state.currentStep).toBe("confirm");
        expect(state.lastSelectedCategory).toBe(CONTINUE_VALUE);
      });

      it("should go back to approach when BACK_VALUE from category (scratch path)", () => {
        const state = createWizardState({
          currentStep: "category",
          history: ["approach"] as WizardStep[],
        });

        const previousStep = popHistory(state);
        if (previousStep) {
          state.currentStep = previousStep;
        } else {
          state.currentStep = "approach";
        }

        expect(state.currentStep).toBe("approach");
      });
    });

    describe("subcategory step transitions", () => {
      it("should mark category as visited on back", () => {
        const state = createWizardState({
          currentStep: "subcategory",
          currentTopCategory: "frontend",
          history: ["approach", "category"] as WizardStep[],
        });

        // Simulate back - adds to visitedCategories
        if (state.currentTopCategory) {
          state.visitedCategories.add(state.currentTopCategory);
        }
        state.currentTopCategory = null;
        state.lastSelectedSubcategory = null;
        const previousStep = popHistory(state);
        if (previousStep) {
          state.currentStep = previousStep;
        }

        expect(state.visitedCategories.has("frontend")).toBe(true);
        expect(state.currentTopCategory).toBeNull();
        expect(state.currentStep).toBe("category");
      });
    });

    describe("confirm step transitions", () => {
      it("should allow back navigation from confirm", () => {
        const state = createWizardState({
          currentStep: "confirm",
          history: ["approach", "category"] as WizardStep[],
        });

        const previousStep = popHistory(state);
        if (previousStep) {
          state.currentStep = previousStep;
        }

        expect(state.currentStep).toBe("category");
      });
    });
  });

  describe("install mode state persistence", () => {
    it("should persist installMode across state transitions", () => {
      const state = createWizardState({
        currentStep: "approach",
        installMode: "local",
      });

      // Transition through multiple steps
      pushHistory(state);
      state.currentStep = "stack";

      pushHistory(state);
      state.currentStep = "category";

      pushHistory(state);
      state.currentStep = "confirm";

      // installMode should be preserved
      expect(state.installMode).toBe("local");
    });

    it("should persist installMode after toggling", () => {
      const state = createWizardState({
        currentStep: "approach",
        installMode: "plugin",
      });

      // Toggle to local
      state.installMode = "local";

      // Continue to stack selection
      pushHistory(state);
      state.currentStep = "stack";

      expect(state.installMode).toBe("local");
    });
  });

  describe("expert mode state persistence", () => {
    it("should persist expertMode across state transitions", () => {
      const state = createWizardState({
        currentStep: "approach",
        expertMode: true,
      });

      // Transition through multiple steps
      pushHistory(state);
      state.currentStep = "category";

      pushHistory(state);
      state.currentStep = "subcategory";

      pushHistory(state);
      state.currentStep = "confirm";

      // expertMode should be preserved
      expect(state.expertMode).toBe(true);
    });

    it("should start with expertMode true when hasLocalSkills detected", () => {
      const state = createInitialState({ hasLocalSkills: true });

      // Transition through steps
      pushHistory(state);
      state.currentStep = "category";

      expect(state.expertMode).toBe(true);
    });
  });

  describe("P2-20: stack selection pre-populates but skills are editable", () => {
    it("should pre-populate selectedSkills from stack.allSkillIds", () => {
      const stack = createStack("test-stack", {
        allSkillIds: ["skill-1", "skill-2", "skill-3"],
      });

      const state = createWizardState({ currentStep: "stack" });

      // Simulate stack selection (mirrors wizard.ts lines 605-612)
      state.selectedStack = stack;
      state.selectedSkills = [...stack.allSkillIds];

      expect(state.selectedSkills).toEqual(["skill-1", "skill-2", "skill-3"]);
      expect(state.selectedStack).toBe(stack);
    });

    it("should allow transition to category step for editing", () => {
      const stack = createStack("react-stack", {
        allSkillIds: ["react", "zustand", "tailwind"],
      });

      const state = createWizardState({
        currentStep: "category",
        history: ["approach", "stack"] as WizardStep[],
        selectedStack: stack,
        selectedSkills: ["react", "zustand", "tailwind"],
      });

      // Stack selection goes directly to category view
      pushHistory(state);
      state.currentStep = "category";

      expect(state.currentStep).toBe("category");
      expect(state.history).toEqual(["approach", "stack", "category"]);
      // selectedSkills should be preserved for editing
      expect(state.selectedSkills).toEqual(["react", "zustand", "tailwind"]);
    });

    it("should preserve skill modifications after editing", () => {
      const stack = createStack("react-stack", {
        allSkillIds: ["react", "zustand", "tailwind"],
      });

      const state = createWizardState({
        currentStep: "category",
        history: ["approach", "stack", "category"] as WizardStep[],
        selectedStack: stack,
        selectedSkills: ["react", "zustand", "tailwind"],
      });

      // Simulate user adding a new skill
      state.selectedSkills.push("vitest");
      expect(state.selectedSkills).toEqual([
        "react",
        "zustand",
        "tailwind",
        "vitest",
      ]);

      // Simulate user removing a skill
      const indexToRemove = state.selectedSkills.indexOf("zustand");
      state.selectedSkills.splice(indexToRemove, 1);
      expect(state.selectedSkills).toEqual(["react", "tailwind", "vitest"]);

      // Modifications persist through state
      expect(state.selectedStack).toBe(stack);
      expect(state.selectedStack?.allSkillIds).toEqual([
        "react",
        "zustand",
        "tailwind",
      ]);
    });

    it("should allow final selection to differ from original stack", () => {
      const stack = createStack("react-stack", {
        allSkillIds: ["react", "zustand", "tailwind"],
      });

      const state = createWizardState({
        currentStep: "confirm",
        history: ["approach", "stack", "category", "category"] as WizardStep[],
        selectedStack: stack,
        selectedSkills: ["react", "vitest", "playwright"],
      });

      // Final selectedSkills is completely different from stack.allSkillIds
      expect(state.selectedSkills).not.toEqual(stack.allSkillIds);
      expect(state.selectedSkills).toHaveLength(3);
      expect(state.selectedSkills).toContain("react");
      expect(state.selectedSkills).not.toContain("zustand");
      expect(state.selectedSkills).not.toContain("tailwind");
      expect(state.selectedSkills).toContain("vitest");
      expect(state.selectedSkills).toContain("playwright");

      // Stack reference is preserved (useful for tracking origin)
      expect(state.selectedStack).toBe(stack);
    });
  });

  describe("edge cases", () => {
    it("should handle empty initialSkills array as no initial skills", () => {
      const state = createInitialState({ initialSkills: [] });
      expect(state.currentStep).toBe("approach");
      expect(state.selectedSkills).toEqual([]);
    });

    it("should handle stack with empty allSkillIds", () => {
      const stack = createStack("empty-stack", { allSkillIds: [] });
      const state = createWizardState();

      state.selectedStack = stack;
      state.selectedSkills = [...stack.allSkillIds];

      expect(state.selectedSkills).toEqual([]);
    });

    it("should handle back from first step (no history)", () => {
      const state = createWizardState({
        currentStep: "approach",
        history: [],
      });

      const previousStep = popHistory(state);
      expect(previousStep).toBeNull();

      // Fallback to approach
      state.currentStep = previousStep || "approach";
      expect(state.currentStep).toBe("approach");
    });

    it("should handle multiple skills in selectedSkills", () => {
      const state = createWizardState({
        selectedSkills: [
          "react",
          "zustand",
          "tailwind",
          "typescript",
          "vitest",
        ],
      });

      expect(state.selectedSkills).toHaveLength(5);
    });
  });
});
