import { create } from "zustand";
import type { ResolvedStack } from "../types-matrix";

export type WizardStep =
  | "approach"
  | "stack"
  | "category"
  | "subcategory"
  | "confirm";

export interface WizardState {
  // Current step
  step: WizardStep;

  // Selections
  selectedSkills: string[];
  selectedStack: ResolvedStack | null;

  // Modes
  expertMode: boolean;
  installMode: "plugin" | "local";

  // Navigation
  history: WizardStep[];
  currentTopCategory: string | null;
  currentSubcategory: string | null;
  visitedCategories: Set<string>;

  // Last selected values (for initialValue in prompts)
  lastSelectedCategory: string | null;
  lastSelectedSubcategory: string | null;
  lastSelectedSkill: string | null;
  lastSelectedApproach: string | null;

  // Actions
  setStep: (step: WizardStep) => void;
  toggleSkill: (skillId: string) => void;
  selectStack: (stack: ResolvedStack | null) => void;
  toggleExpertMode: () => void;
  toggleInstallMode: () => void;
  setCategory: (category: string | null) => void;
  setSubcategory: (subcategory: string | null) => void;
  setLastSelectedCategory: (category: string | null) => void;
  setLastSelectedSubcategory: (subcategory: string | null) => void;
  setLastSelectedSkill: (skillId: string | null) => void;
  setLastSelectedApproach: (approach: string | null) => void;
  markCategoryVisited: (category: string) => void;
  goBack: () => void;
  reset: (options?: {
    initialSkills?: string[];
    hasLocalSkills?: boolean;
  }) => void;
}

const createInitialState = (options?: {
  initialSkills?: string[];
  hasLocalSkills?: boolean;
}) => {
  const hasInitialSkills =
    options?.initialSkills && options.initialSkills.length > 0;

  return {
    step: (hasInitialSkills ? "category" : "approach") as WizardStep,
    selectedSkills: options?.initialSkills ? [...options.initialSkills] : [],
    selectedStack: null,
    expertMode: options?.hasLocalSkills ?? false,
    installMode: "local" as "plugin" | "local",
    history: [] as WizardStep[],
    currentTopCategory: null,
    currentSubcategory: null,
    visitedCategories: new Set<string>(),
    lastSelectedCategory: null,
    lastSelectedSubcategory: null,
    lastSelectedSkill: null,
    lastSelectedApproach: null,
  };
};

export const useWizardStore = create<WizardState>((set, get) => ({
  ...createInitialState(),

  setStep: (step) =>
    set((state) => ({
      step,
      history: [...state.history, state.step],
    })),

  toggleSkill: (skillId) =>
    set((state) => {
      const isSelected = state.selectedSkills.includes(skillId);
      return {
        selectedSkills: isSelected
          ? state.selectedSkills.filter((id) => id !== skillId)
          : [...state.selectedSkills, skillId],
      };
    }),

  selectStack: (stack) =>
    set({
      selectedStack: stack,
      selectedSkills: stack ? [...stack.allSkillIds] : [],
    }),

  toggleExpertMode: () =>
    set((state) => ({
      expertMode: !state.expertMode,
    })),

  toggleInstallMode: () =>
    set((state) => ({
      installMode: state.installMode === "plugin" ? "local" : "plugin",
    })),

  setCategory: (category) =>
    set({
      currentTopCategory: category,
    }),

  setSubcategory: (subcategory) =>
    set({
      currentSubcategory: subcategory,
    }),

  setLastSelectedCategory: (category) =>
    set({
      lastSelectedCategory: category,
    }),

  setLastSelectedSubcategory: (subcategory) =>
    set({
      lastSelectedSubcategory: subcategory,
    }),

  setLastSelectedSkill: (skillId) =>
    set({
      lastSelectedSkill: skillId,
    }),

  setLastSelectedApproach: (approach) =>
    set({
      lastSelectedApproach: approach,
    }),

  markCategoryVisited: (category) =>
    set((state) => {
      const visited = new Set(state.visitedCategories);
      visited.add(category);
      return { visitedCategories: visited };
    }),

  goBack: () =>
    set((state) => {
      const history = [...state.history];
      const previousStep = history.pop();
      return {
        step: previousStep || "approach",
        history,
      };
    }),

  reset: (options) => set(createInitialState(options)),
}));
