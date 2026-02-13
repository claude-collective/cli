import { create } from "zustand";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";
import type {
  BoundSkill,
  Domain,
  DomainSelections,
  SkillAssignment,
  SkillId,
  Subcategory,
} from "../types/index.js";
import { typedEntries, typedKeys } from "../utils/typed-object.js";

const ALL_DOMAINS: Domain[] = ["web", "web-extras", "api", "cli", "mobile", "shared"];

export type WizardStep =
  | "approach" // Choose stack template or build from scratch
  | "stack" // Select pre-built stack (if approach=stack) or domains (if approach=scratch)
  | "build" // CategoryGrid for technology selection
  | "sources" // Choose skill sources (recommended vs custom)
  | "confirm"; // Final confirmation

export type WizardState = {
  step: WizardStep;

  approach: "stack" | "scratch" | null;
  selectedStackId: string | null;
  stackAction: "defaults" | "customize" | null;

  selectedDomains: Domain[];

  currentDomainIndex: number;
  domainSelections: DomainSelections;

  focusedRow: number;
  focusedCol: number;

  showDescriptions: boolean;
  expertMode: boolean;

  installMode: "plugin" | "local";

  sourceSelections: Partial<Record<SkillId, string>>;
  customizeSources: boolean;

  showSettings: boolean;
  enabledSources: Record<string, boolean>;

  boundSkills: BoundSkill[];

  history: WizardStep[];

  setStep: (step: WizardStep) => void;
  setApproach: (approach: "stack" | "scratch") => void;
  selectStack: (stackId: string | null) => void;
  setStackAction: (action: "defaults" | "customize") => void;
  /** Pre-populate domainSelections from a stack's technology mappings */
  populateFromStack: (
    stack: { agents: Record<string, Partial<Record<Subcategory, SkillAssignment[]>>> },
    categories: Partial<Record<Subcategory, { domain?: Domain }>>,
  ) => void;
  populateFromSkillIds: (
    skillIds: SkillId[],
    skills: Partial<Record<SkillId, { category: string; displayName?: string }>>,
    categories: Partial<Record<Subcategory, { domain?: Domain }>>,
  ) => void;
  toggleDomain: (domain: Domain) => void;
  toggleTechnology: (
    domain: Domain,
    subcategory: Subcategory,
    technology: SkillId,
    exclusive: boolean,
  ) => void;
  nextDomain: () => boolean;
  prevDomain: () => boolean;
  setFocus: (row: number, col: number) => void;
  toggleShowDescriptions: () => void;
  toggleExpertMode: () => void;
  toggleInstallMode: () => void;
  setSourceSelection: (skillId: SkillId, sourceId: string) => void;
  setCustomizeSources: (customize: boolean) => void;
  toggleSettings: () => void;
  setEnabledSources: (sources: Record<string, boolean>) => void;
  bindSkill: (skill: BoundSkill) => void;
  goBack: () => void;
  reset: () => void;

  getAllSelectedTechnologies: () => SkillId[];
  getCurrentDomain: () => Domain | null;
  getSelectedSkills: () => SkillId[];
};

const createInitialState = () => ({
  step: "approach" as WizardStep,
  approach: null as "stack" | "scratch" | null,
  selectedStackId: null as string | null,
  stackAction: null as "defaults" | "customize" | null,
  selectedDomains: [] as Domain[],
  currentDomainIndex: 0,
  domainSelections: {} as DomainSelections,
  focusedRow: 0,
  focusedCol: 0,
  showDescriptions: false,
  expertMode: false,
  installMode: "local" as "plugin" | "local",
  sourceSelections: {} as Partial<Record<SkillId, string>>,
  customizeSources: false,
  showSettings: false,
  enabledSources: {} as Record<string, boolean>,
  boundSkills: [] as BoundSkill[],
  history: [] as WizardStep[],
});

export const useWizardStore = create<WizardState>((set, get) => ({
  ...createInitialState(),

  setStep: (step) =>
    set((state) => ({
      step,
      history: [...state.history, state.step],
      focusedRow: 0,
      focusedCol: 0,
    })),

  setApproach: (approach) => set({ approach }),

  selectStack: (stackId) => set({ selectedStackId: stackId }),

  setStackAction: (action) => set({ stackAction: action }),

  populateFromStack: (stack, categories) =>
    set(() => {
      const domainSelections: DomainSelections = {};
      const domains = new Set<Domain>();

      for (const agentConfig of Object.values(stack.agents)) {
        for (const [subcat, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
          agentConfig,
        )) {
          const category = categories[subcat];
          const domain = category?.domain;

          if (!domain || !assignments) {
            continue;
          }

          domains.add(domain);

          if (!domainSelections[domain]) {
            domainSelections[domain] = {};
          }

          if (!domainSelections[domain][subcat]) {
            domainSelections[domain][subcat] = [];
          }

          for (const assignment of assignments) {
            if (!domainSelections[domain][subcat].includes(assignment.id)) {
              domainSelections[domain][subcat].push(assignment.id);
            }
          }
        }
      }

      return {
        domainSelections,
        selectedDomains: ALL_DOMAINS,
      };
    }),

  populateFromSkillIds: (skillIds, skills, categories) =>
    set(() => {
      const domainSelections: DomainSelections = {};
      const domains = new Set<Domain>();

      for (const skillId of skillIds) {
        const skill = skills[skillId];
        if (!skill?.category || !skill.displayName) {
          console.warn(
            `Installed skill '${skillId}' is missing from the marketplace — it may have been removed or renamed`,
          );
          continue;
        }

        // Boundary cast: category is a Subcategory at the data boundary
        const subcat = skill.category as Subcategory;
        const domain = categories[subcat]?.domain;
        if (!domain) {
          console.warn(
            `Installed skill '${skillId}' has unknown category '${skill.category}' — skipping`,
          );
          continue;
        }

        domains.add(domain);
        if (!domainSelections[domain]) domainSelections[domain] = {};
        if (!domainSelections[domain][subcat]) domainSelections[domain][subcat] = [];

        // Boundary cast: display name resolved to SkillId downstream by resolveAlias
        const techAsId = skill.displayName as SkillId;
        if (!domainSelections[domain][subcat].includes(techAsId)) {
          domainSelections[domain][subcat].push(techAsId);
        }
      }

      return { domainSelections, selectedDomains: ALL_DOMAINS };
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

  toggleTechnology: (domain, subcategory, technology, exclusive) =>
    set((state) => {
      const currentSelections = state.domainSelections[domain]?.[subcategory] || [];
      const isSelected = currentSelections.includes(technology);

      let newSelections: SkillId[];
      if (exclusive) {
        newSelections = isSelected ? [] : [technology];
      } else {
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

  toggleShowDescriptions: () => set((state) => ({ showDescriptions: !state.showDescriptions })),

  toggleExpertMode: () => set((state) => ({ expertMode: !state.expertMode })),

  toggleInstallMode: () =>
    set((state) => ({
      installMode: state.installMode === "plugin" ? "local" : "plugin",
    })),

  setSourceSelection: (skillId, sourceId) =>
    set((state) => ({
      sourceSelections: { ...state.sourceSelections, [skillId]: sourceId },
    })),

  setCustomizeSources: (customize) => set({ customizeSources: customize }),

  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  setEnabledSources: (sources) => set({ enabledSources: sources }),

  bindSkill: (skill) =>
    set((state) => {
      const exists = state.boundSkills.some(
        (b) => b.id === skill.id && b.sourceUrl === skill.sourceUrl,
      );
      if (exists) return state;
      return { boundSkills: [...state.boundSkills, skill] };
    }),

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

  getAllSelectedTechnologies: () => {
    const state = get();
    const technologies: SkillId[] = [];
    for (const domain of typedKeys<Domain>(state.domainSelections)) {
      const domainSel = state.domainSelections[domain];
      if (!domainSel) continue;
      for (const subcategory of typedKeys<Subcategory>(domainSel)) {
        const techs = domainSel[subcategory];
        if (techs) technologies.push(...techs);
      }
    }
    return technologies;
  },

  getCurrentDomain: () => {
    const state = get();
    return state.selectedDomains[state.currentDomainIndex] || null;
  },

  getSelectedSkills: () => {
    return [...DEFAULT_PRESELECTED_SKILLS];
  },
}));
