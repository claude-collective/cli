import { create } from "zustand";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";

/** All available domains that the build step should cycle through */
const ALL_DOMAINS = ["web", "api", "cli", "mobile", "shared"];

// Step types for the wizard
export type WizardStep =
  | "approach" // Choose stack template or build from scratch
  | "stack" // Select pre-built stack (if approach=stack) or domains (if approach=scratch)
  | "build" // CategoryGrid for technology selection
  | "confirm"; // Final confirmation

export interface WizardState {
  // ─────────────────────────────────────────────────────────────────
  // Current step
  // ─────────────────────────────────────────────────────────────────
  step: WizardStep;

  // ─────────────────────────────────────────────────────────────────
  // Flow tracking
  // ─────────────────────────────────────────────────────────────────
  approach: "stack" | "scratch" | null;
  selectedStackId: string | null;
  stackAction: "defaults" | "customize" | null; // For stack flow after selection

  // ─────────────────────────────────────────────────────────────────
  // Domain selection (scratch flow or customize flow)
  // ─────────────────────────────────────────────────────────────────
  selectedDomains: string[]; // ['web', 'api', 'cli', 'mobile']

  // ─────────────────────────────────────────────────────────────────
  // Build step state
  // ─────────────────────────────────────────────────────────────────
  currentDomainIndex: number; // Which domain we're configuring (0-based)
  domainSelections: Record<string, Record<string, string[]>>;
  // e.g., { web: { framework: ['react'], styling: ['scss-modules'] } }
  // Note: array supports multi-select categories

  // ─────────────────────────────────────────────────────────────────
  // Grid navigation state
  // ─────────────────────────────────────────────────────────────────
  focusedRow: number;
  focusedCol: number;

  // ─────────────────────────────────────────────────────────────────
  // Skill source state
  // ─────────────────────────────────────────────────────────────────
  currentRefineIndex: number; // Which skill we're refining
  skillSources: Record<string, string>; // technology -> selected skill ID

  // ─────────────────────────────────────────────────────────────────
  // UI state
  // ─────────────────────────────────────────────────────────────────
  showDescriptions: boolean;
  expertMode: boolean;

  // ─────────────────────────────────────────────────────────────────
  // Modes
  // ─────────────────────────────────────────────────────────────────
  installMode: "plugin" | "local";

  // ─────────────────────────────────────────────────────────────────
  // Navigation history
  // ─────────────────────────────────────────────────────────────────
  history: WizardStep[];

  // ─────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────
  setStep: (step: WizardStep) => void;
  setApproach: (approach: "stack" | "scratch") => void;
  selectStack: (stackId: string | null) => void;
  setStackAction: (action: "defaults" | "customize") => void;
  /** Pre-populate domainSelections from a stack's technology mappings */
  populateFromStack: (
    stack: { agents: Record<string, Record<string, string>> },
    categories: Record<string, { domain?: string }>,
  ) => void;
  toggleDomain: (domain: string) => void;
  setDomainSelection: (domain: string, subcategory: string, technologies: string[]) => void;
  toggleTechnology: (
    domain: string,
    subcategory: string,
    technology: string,
    exclusive: boolean,
  ) => void;
  setCurrentDomainIndex: (index: number) => void;
  nextDomain: () => boolean; // Returns true if moved to next domain, false if at end
  prevDomain: () => boolean; // Returns true if moved to prev domain, false if at start
  setFocus: (row: number, col: number) => void;
  setSkillSource: (technology: string, skillId: string) => void;
  setCurrentRefineIndex: (index: number) => void;
  toggleShowDescriptions: () => void;
  toggleExpertMode: () => void;
  toggleInstallMode: () => void;
  goBack: () => void;
  reset: () => void;

  // ─────────────────────────────────────────────────────────────────
  // Computed getters (derive from state)
  // ─────────────────────────────────────────────────────────────────
  getAllSelectedTechnologies: () => string[];
  getCurrentDomain: () => string | null;
  getSelectedSkills: () => string[]; // All selected skills including preselected
}

const createInitialState = () => ({
  step: "approach" as WizardStep,
  approach: null as "stack" | "scratch" | null,
  selectedStackId: null as string | null,
  stackAction: null as "defaults" | "customize" | null,
  selectedDomains: [] as string[],
  currentDomainIndex: 0,
  domainSelections: {} as Record<string, Record<string, string[]>>,
  focusedRow: 0,
  focusedCol: 0,
  currentRefineIndex: 0,
  skillSources: {} as Record<string, string>,
  showDescriptions: false,
  expertMode: false,
  installMode: "local" as "plugin" | "local",
  history: [] as WizardStep[],
});

export const useWizardStore = create<WizardState>((set, get) => ({
  ...createInitialState(),

  setStep: (step) =>
    set((state) => ({
      step,
      history: [...state.history, state.step],
      // Reset focus when changing steps
      focusedRow: 0,
      focusedCol: 0,
    })),

  setApproach: (approach) => set({ approach }),

  selectStack: (stackId) => set({ selectedStackId: stackId }),

  setStackAction: (action) => set({ stackAction: action }),

  populateFromStack: (stack, categories) =>
    set(() => {
      const domainSelections: Record<string, Record<string, string[]>> = {};
      const domains = new Set<string>();

      // Iterate through all agents in the stack
      for (const agentConfig of Object.values(stack.agents)) {
        // Each agent has subcategory -> technology alias mappings
        for (const [subcategoryId, technologyAlias] of Object.entries(agentConfig)) {
          const category = categories[subcategoryId];
          const domain = category?.domain;

          if (!domain) {
            // Skip if subcategory doesn't have a domain (top-level categories)
            continue;
          }

          domains.add(domain);

          // Initialize domain if needed
          if (!domainSelections[domain]) {
            domainSelections[domain] = {};
          }

          // Initialize subcategory array if needed
          if (!domainSelections[domain][subcategoryId]) {
            domainSelections[domain][subcategoryId] = [];
          }

          // Add technology if not already present
          if (!domainSelections[domain][subcategoryId].includes(technologyAlias)) {
            domainSelections[domain][subcategoryId].push(technologyAlias);
          }
        }
      }

      return {
        domainSelections,
        selectedDomains: ALL_DOMAINS,
      };
    }),

  toggleDomain: (domain) =>
    set((state) => {
      const isSelected = state.selectedDomains.includes(domain);
      return {
        selectedDomains: isSelected
          ? state.selectedDomains.filter((d) => d !== domain)
          : [...state.selectedDomains, domain],
      };
    }),

  setDomainSelection: (domain, subcategory, technologies) =>
    set((state) => ({
      domainSelections: {
        ...state.domainSelections,
        [domain]: {
          ...state.domainSelections[domain],
          [subcategory]: technologies,
        },
      },
    })),

  toggleTechnology: (domain, subcategory, technology, exclusive) =>
    set((state) => {
      const currentSelections = state.domainSelections[domain]?.[subcategory] || [];
      const isSelected = currentSelections.includes(technology);

      let newSelections: string[];
      if (exclusive) {
        // For exclusive categories, toggle off if already selected, otherwise select only this one
        newSelections = isSelected ? [] : [technology];
      } else {
        // For multi-select categories, toggle the selection
        newSelections = isSelected
          ? currentSelections.filter((t) => t !== technology)
          : [...currentSelections, technology];
      }

      return {
        domainSelections: {
          ...state.domainSelections,
          [domain]: {
            ...state.domainSelections[domain],
            [subcategory]: newSelections,
          },
        },
      };
    }),

  setCurrentDomainIndex: (index) =>
    set({ currentDomainIndex: index, focusedRow: 0, focusedCol: 0 }),

  nextDomain: () => {
    const state = get();
    if (state.currentDomainIndex < state.selectedDomains.length - 1) {
      set({
        currentDomainIndex: state.currentDomainIndex + 1,
        focusedRow: 0,
        focusedCol: 0,
      });
      return true;
    }
    return false;
  },

  prevDomain: () => {
    const state = get();
    if (state.currentDomainIndex > 0) {
      set({
        currentDomainIndex: state.currentDomainIndex - 1,
        focusedRow: 0,
        focusedCol: 0,
      });
      return true;
    }
    return false;
  },

  setFocus: (row, col) => set({ focusedRow: row, focusedCol: col }),

  setSkillSource: (technology, skillId) =>
    set((state) => ({
      skillSources: {
        ...state.skillSources,
        [technology]: skillId,
      },
    })),

  setCurrentRefineIndex: (index) => set({ currentRefineIndex: index }),

  toggleShowDescriptions: () => set((state) => ({ showDescriptions: !state.showDescriptions })),

  toggleExpertMode: () => set((state) => ({ expertMode: !state.expertMode })),

  toggleInstallMode: () =>
    set((state) => ({
      installMode: state.installMode === "plugin" ? "local" : "plugin",
    })),

  goBack: () =>
    set((state) => {
      const history = [...state.history];
      const previousStep = history.pop();
      return {
        step: previousStep || "approach",
        history,
        focusedRow: 0,
        focusedCol: 0,
      };
    }),

  reset: () => set(createInitialState()),

  // ─────────────────────────────────────────────────────────────────
  // Computed getters
  // ─────────────────────────────────────────────────────────────────
  getAllSelectedTechnologies: () => {
    const state = get();
    const technologies: string[] = [];
    for (const domain of Object.keys(state.domainSelections)) {
      for (const subcategory of Object.keys(state.domainSelections[domain])) {
        technologies.push(...state.domainSelections[domain][subcategory]);
      }
    }
    return technologies;
  },

  getCurrentDomain: () => {
    const state = get();
    return state.selectedDomains[state.currentDomainIndex] || null;
  },

  getSelectedSkills: () => {
    const state = get();
    // Include preselected methodology skills plus resolved skill sources
    const skillIds: string[] = [...DEFAULT_PRESELECTED_SKILLS];
    for (const skillId of Object.values(state.skillSources)) {
      if (!skillIds.includes(skillId)) {
        skillIds.push(skillId);
      }
    }
    return skillIds;
  },
}));
