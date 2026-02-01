import { create } from "zustand";
// Note: ResolvedStack is from skills-matrix.yaml's suggested_stacks (for wizard skill selection)
// This is different from Stack in types-stacks.ts (for agent groupings in config/stacks.yaml)
import type { ResolvedStack } from "../types-matrix";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";

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

  // Start with default preselected skills (methodology), then add any initial skills
  const baseSkills = [...DEFAULT_PRESELECTED_SKILLS];
  const initialSkills = options?.initialSkills ?? [];
  const combinedSkills = [...new Set([...baseSkills, ...initialSkills])];

  return {
    step: (hasInitialSkills ? "category" : "approach") as WizardStep,
    selectedSkills: combinedSkills,
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
      // Include preselected skills (methodology) plus stack skills
      selectedSkills: stack
        ? [...new Set([...DEFAULT_PRESELECTED_SKILLS, ...stack.allSkillIds])]
        : [...DEFAULT_PRESELECTED_SKILLS],
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
