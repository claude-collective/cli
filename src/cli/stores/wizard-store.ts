import { create } from "zustand";
import { DEFAULT_PRESELECTED_SKILLS } from "../consts";
import { resolveAlias } from "../lib/matrix/index.js";
import type {
  BoundSkill,
  Domain,
  DomainSelections,
  MergedSkillsMatrix,
  SkillAlias,
  SkillAssignment,
  SkillId,
  Subcategory,
  SubcategorySelections,
} from "../types/index.js";
import { warn } from "../utils/logger.js";
import { typedEntries, typedKeys } from "../utils/typed-object.js";

const ALL_DOMAINS: Domain[] = ["web", "web-extras", "api", "cli", "mobile", "shared"];

const DEFAULT_SOURCE_ID = "public";
const DEFAULT_SOURCE_LABEL = "Public";

/** Sort priority: local first, then public, then private/other */
const SOURCE_SORT_ORDER: Record<string, number> = {
  local: 0,
  public: 1,
  private: 2,
};

const SOURCE_DISPLAY_NAMES: Record<string, string> = {
  public: "Public",
  local: "Local",
};

const DEFAULT_SORT_PRIORITY = 3;

function formatSourceLabel(source: {
  name: string;
  version?: string;
  installed?: boolean;
}): string {
  const displayName = SOURCE_DISPLAY_NAMES[source.name] ?? source.name;
  const prefix = source.installed ? "\u2713 " : "";
  const versionSuffix = source.version ? ` \u00B7 v${source.version}` : "";
  return `${prefix}${displayName}${versionSuffix}`;
}

type SkillLookupEntry = { category: string; displayName?: string };

function resolveSkillForPopulation(
  skillId: SkillId,
  skills: Partial<Record<SkillId, SkillLookupEntry>>,
  categories: Partial<Record<Subcategory, { domain?: Domain }>>,
): { domain: Domain; subcat: Subcategory; techId: SkillId } | null {
  const skill = skills[skillId];
  if (!skill?.category || !skill.displayName) {
    warn(
      `Installed skill '${skillId}' is missing from the marketplace — it may have been removed or renamed`,
    );
    return null;
  }

  // Boundary cast: category is a Subcategory at the data boundary
  const subcat = skill.category as Subcategory;
  const domain = categories[subcat]?.domain;
  if (!domain) {
    warn(`Installed skill '${skillId}' has unknown category '${skill.category}' — skipping`);
    return null;
  }

  // Boundary cast: display name resolved to SkillId downstream by resolveAlias
  return { domain, subcat, techId: skill.displayName as SkillId };
}

function buildBoundSkillOptions(
  boundSkills: BoundSkill[],
  alias: SkillAlias,
  selectedSource: string,
): { id: string; label: string; selected: boolean; installed: boolean }[] {
  return boundSkills
    .filter((b) => b.boundTo === alias)
    .map((bound) => ({
      id: bound.sourceName,
      label: formatSourceLabel({
        name: bound.sourceName,
        installed: false,
      }),
      selected: selectedSource === bound.sourceName,
      installed: false,
    }));
}

/** Extract the alias from a skill ID or use displayName from the matrix */
function getSkillAlias(skillId: SkillId, matrix: MergedSkillsMatrix): SkillAlias {
  const displayName = matrix.displayNames?.[skillId];
  if (displayName) return displayName;
  // Fallback: use the last segment of the skill ID (e.g., "web-framework-react" -> "react")
  const segments = skillId.split("-");
  const fallback = segments[segments.length - 1] || skillId;
  warn(`No display name found for skill '${skillId}', using fallback alias '${fallback}'`);
  return fallback;
}

/**
 * Wizard step identifiers for the multi-step init/edit flow.
 *
 * Progression: stack -> build -> sources -> confirm
 * The "stack" step shows all stacks + "Start from scratch" in a unified list.
 * Navigation is tracked via the `history` stack for goBack() support.
 */
export type WizardStep =
  | "stack" // Unified first step: select stack or "Start from scratch", then domain selection
  | "build" // CategoryGrid for technology selection
  | "sources" // Choose skill sources (recommended vs custom)
  | "confirm"; // Final confirmation

/**
 * Wizard store state and actions.
 *
 * The store uses a composition pattern: small, focused actions that each mutate
 * one or two state fields. Wizard step components compose these actions to build
 * up the full selection state incrementally (domains -> subcategories -> skills -> sources).
 *
 * State flow: unified stack/scratch selection -> domain selection -> per-domain skill
 * selection (build step) -> source customization -> confirmation.
 */
export type WizardState = {
  step: WizardStep;

  approach: "stack" | "scratch" | null;
  selectedStackId: string | null;
  stackAction: "defaults" | "customize" | null;

  selectedDomains: Domain[];

  currentDomainIndex: number;
  domainSelections: DomainSelections;

  showDescriptions: boolean;
  expertMode: boolean;

  installMode: "plugin" | "local";

  sourceSelections: Partial<Record<SkillId, string>>;
  customizeSources: boolean;

  showSettings: boolean;
  showHelp: boolean;
  enabledSources: Record<string, boolean>;

  boundSkills: BoundSkill[];

  history: WizardStep[];

  /**
   * Navigate to a wizard step, pushing the current step onto history.
   * @param step - Target step to navigate to
   *
   * Side effects: sets `step`, appends previous step to `history`
   */
  setStep: (step: WizardStep) => void;
  /**
   * Set the wizard approach (stack-based or build-from-scratch).
   * @param approach - "stack" to use a pre-built template, "scratch" to select skills manually, null to reset
   *
   * Side effects: sets `approach`
   */
  setApproach: (approach: "stack" | "scratch" | null) => void;
  /**
   * Select a stack by ID, or null to deselect.
   * @param stackId - Stack identifier from suggestedStacks, or null to clear
   *
   * Side effects: sets `selectedStackId`
   */
  selectStack: (stackId: string | null) => void;
  /**
   * Set how to apply the selected stack.
   * @param action - "defaults" to use stack as-is, "customize" to enter the build step
   *
   * Side effects: sets `stackAction`
   */
  setStackAction: (action: "defaults" | "customize") => void;
  /**
   * Pre-populate domainSelections from a stack's agent-to-skill mappings.
   *
   * Iterates all agents in the stack, resolving each subcategory's skill assignments
   * to the appropriate domain. Enables all domains and deduplicates skill IDs.
   *
   * @param stack - Stack definition with agent-level skill assignments
   * @param stack.agents - Record of agent name to `{ subcategory: SkillAssignment[] }` mappings
   * @param categories - Category definitions used to resolve subcategory -> domain mapping
   *
   * Side effects: sets `domainSelections`, sets `selectedDomains` to ALL_DOMAINS
   */
  populateFromStack: (
    stack: { agents: Record<string, Partial<Record<Subcategory, SkillAssignment[]>>> },
    categories: Partial<Record<Subcategory, { domain?: Domain }>>,
  ) => void;
  /**
   * Pre-populate domainSelections from a flat list of installed skill IDs.
   *
   * Used by `cc edit` to restore wizard state from existing project config.
   * Looks up each skill's category and domain, warns for unresolvable skills.
   *
   * @param skillIds - Flat array of currently installed skill IDs
   * @param skills - Skill lookup providing category and displayName per skill ID
   * @param categories - Category definitions used to resolve subcategory -> domain mapping
   *
   * Side effects: sets `domainSelections`, sets `selectedDomains` to ALL_DOMAINS
   */
  populateFromSkillIds: (
    skillIds: SkillId[],
    skills: Partial<Record<SkillId, { category: string; displayName?: string }>>,
    categories: Partial<Record<Subcategory, { domain?: Domain }>>,
  ) => void;
  /**
   * Toggle a domain on or off in the selectedDomains list.
   * @param domain - Domain to toggle
   *
   * Side effects: adds or removes from `selectedDomains`
   */
  toggleDomain: (domain: Domain) => void;
  /**
   * Toggle a skill selection within a domain's subcategory.
   *
   * When exclusive is true (radio behavior), selecting a new skill replaces any
   * existing selection in that subcategory. When false (checkbox behavior),
   * the skill is added to or removed from the selection array.
   *
   * @param domain - Domain containing the subcategory
   * @param subcategory - Subcategory within the domain
   * @param technology - Skill ID to toggle
   * @param exclusive - If true, only one skill can be selected per subcategory (radio)
   *
   * Side effects: updates `domainSelections[domain][subcategory]`
   */
  toggleTechnology: (
    domain: Domain,
    subcategory: Subcategory,
    technology: SkillId,
    exclusive: boolean,
  ) => void;
  /**
   * Advance to the next domain in the build step.
   * @returns true if advanced, false if already at the last domain
   *
   * Side effects: increments `currentDomainIndex`
   */
  nextDomain: () => boolean;
  /**
   * Go back to the previous domain in the build step.
   * @returns true if moved back, false if already at the first domain
   *
   * Side effects: decrements `currentDomainIndex`
   */
  prevDomain: () => boolean;
  /** Toggle skill description visibility in the build step grid. */
  toggleShowDescriptions: () => void;
  /** Toggle expert mode (shows advanced/niche skills in the build step). */
  toggleExpertMode: () => void;
  /** Toggle between "plugin" and "local" install modes. */
  toggleInstallMode: () => void;
  /**
   * Set which source provides a specific skill.
   * @param skillId - Skill to configure the source for
   * @param sourceId - Source identifier (e.g., "public", "local", marketplace name)
   *
   * Side effects: updates `sourceSelections[skillId]`. No-op with warning if either param is empty.
   */
  setSourceSelection: (skillId: SkillId, sourceId: string) => void;
  /**
   * Enable or disable source customization on the sources step.
   * @param customize - true to show per-skill source pickers
   *
   * Side effects: sets `customizeSources`
   */
  setCustomizeSources: (customize: boolean) => void;
  /** Toggle the settings overlay (source management). */
  toggleSettings: () => void;
  /** Toggle the help overlay (hotkey reference). */
  toggleHelp: () => void;
  /**
   * Replace the full set of enabled/disabled sources.
   * @param sources - Record of source name to enabled boolean. Empty-string keys are filtered out.
   *
   * Side effects: sets `enabledSources`
   */
  setEnabledSources: (sources: Record<string, boolean>) => void;
  /**
   * Add a bound skill from search to the wizard's bound skills list.
   * Duplicates (same id + sourceUrl) are silently skipped with a warning.
   *
   * @param skill - Bound skill to add (foreign skill tied to a subcategory alias)
   *
   * Side effects: appends to `boundSkills`
   */
  bindSkill: (skill: BoundSkill) => void;
  /**
   * Navigate to the previous wizard step using the history stack.
   * Falls back to "stack" if history is empty.
   *
   * Side effects: pops from `history`, sets `step` to the popped value
   */
  goBack: () => void;
  /** Reset all wizard state to initial values. */
  reset: () => void;

  /**
   * Collect all selected skill IDs across all domains and subcategories.
   * @returns Flat array of every selected SkillId (may contain duplicates if shared across domains)
   */
  getAllSelectedTechnologies: () => SkillId[];
  /**
   * Group selected skill IDs by domain.
   * @returns Partial record mapping each domain with selections to its skill ID array
   */
  getSelectedTechnologiesPerDomain: () => Partial<Record<Domain, SkillId[]>>;
  /**
   * Get the domain currently visible in the build step.
   * @returns The domain at currentDomainIndex, or null if no domains are selected
   */
  getCurrentDomain: () => Domain | null;
  /** Returns the foundational methodology skills that are always preselected (DEFAULT_PRESELECTED_SKILLS). */
  getDefaultMethodologySkills: () => SkillId[];
  /**
   * Count total selected technologies across all domains.
   * @returns Number of selected skill IDs
   */
  getTechnologyCount: () => number;
  /**
   * Compute which wizard steps are completed and which are skipped.
   * Used by WizardTabs to render step progress indicators.
   * @returns Object with completedSteps and skippedSteps string arrays
   */
  getStepProgress: () => { completedSteps: string[]; skippedSteps: string[] };
  /** @returns true if there is a next domain after the current one */
  canGoToNextDomain: () => boolean;
  /** @returns true if there is a previous domain before the current one */
  canGoToPreviousDomain: () => boolean;
  /**
   * Find the parent domain for a sub-domain (e.g., web-extras -> web).
   * @param domain - Domain to look up
   * @param matrix - Merged skills matrix containing category definitions with parent_domain
   * @returns The parent domain, or undefined if the domain has no parent
   */
  getParentDomain: (domain: Domain, matrix: MergedSkillsMatrix) => Domain | undefined;
  /**
   * Get the current selections of a domain's parent domain.
   * Used for framework-first filtering: web-extras inherits web's framework selections.
   *
   * @param domain - Sub-domain to find parent selections for
   * @param matrix - Merged skills matrix containing category definitions
   * @returns The parent domain's SubcategorySelections, or undefined if no parent
   */
  getParentDomainSelections: (
    domain: Domain,
    matrix: MergedSkillsMatrix,
  ) => SubcategorySelections | undefined;
  /**
   * Build the source selection rows for the sources step UI.
   *
   * For each selected technology, resolves the canonical skill ID, looks up available
   * sources from the matrix, merges in any bound skills from search, and determines
   * which source is currently selected. Sources are sorted: local first, then public,
   * then private/other.
   *
   * @param matrix - Merged skills matrix with resolved skills and their available sources
   * @returns Array of row objects, one per selected technology, each containing:
   *   - `skillId` - Canonical resolved skill ID
   *   - `displayName` - Human-readable skill alias
   *   - `alias` - Same as displayName (for backward compatibility)
   *   - `options` - Available sources with selection state and install status
   */
  buildSourceRows: (matrix: MergedSkillsMatrix) => {
    skillId: SkillId;
    displayName: SkillAlias;
    alias: SkillAlias;
    options: { id: string; label: string; selected: boolean; installed: boolean }[];
  }[];
};

const createInitialState = () => ({
  step: "stack" as WizardStep,
  approach: null as "stack" | "scratch" | null,
  selectedStackId: null as string | null,
  stackAction: null as "defaults" | "customize" | null,
  selectedDomains: [] as Domain[],
  currentDomainIndex: 0,
  domainSelections: {} as DomainSelections,
  showDescriptions: false,
  expertMode: false,
  installMode: "local" as "plugin" | "local",
  sourceSelections: {} as Partial<Record<SkillId, string>>,
  customizeSources: false,
  showSettings: false,
  showHelp: false,
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
      let skippedCount = 0;

      for (const skillId of skillIds) {
        const resolved = resolveSkillForPopulation(skillId, skills, categories);
        if (!resolved) {
          skippedCount++;
          continue;
        }

        const { domain, subcat, techId } = resolved;
        if (!domainSelections[domain]) domainSelections[domain] = {};
        if (!domainSelections[domain][subcat]) domainSelections[domain][subcat] = [];

        if (!domainSelections[domain][subcat].includes(techId)) {
          domainSelections[domain][subcat].push(techId);
        }
      }

      if (skippedCount > 0) {
        warn(`${skippedCount} installed skill(s) could not be resolved and were skipped`);
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
      });
      return true;
    }
    return false;
  },

  toggleShowDescriptions: () => set((state) => ({ showDescriptions: !state.showDescriptions })),

  toggleExpertMode: () => set((state) => ({ expertMode: !state.expertMode })),

  toggleInstallMode: () =>
    set((state) => ({
      installMode: state.installMode === "plugin" ? "local" : "plugin",
    })),

  setSourceSelection: (skillId, sourceId) =>
    set((state) => {
      if (!skillId) {
        warn("Ignoring setSourceSelection call with empty skillId");
        return state;
      }
      if (!sourceId) {
        warn(`Ignoring setSourceSelection call with empty sourceId for skill '${skillId}'`);
        return state;
      }
      return {
        sourceSelections: { ...state.sourceSelections, [skillId]: sourceId },
      };
    }),

  setCustomizeSources: (customize) => set({ customizeSources: customize }),

  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),

  setEnabledSources: (sources) => {
    const invalidKeys = Object.keys(sources).filter((key) => !key.trim());
    if (invalidKeys.length > 0) {
      warn("Ignoring setEnabledSources call with empty source name(s)");
    }
    const validSources = Object.fromEntries(Object.entries(sources).filter(([key]) => key.trim()));
    return set({ enabledSources: validSources });
  },

  bindSkill: (skill) =>
    set((state) => {
      const exists = state.boundSkills.some(
        (b) => b.id === skill.id && b.sourceUrl === skill.sourceUrl,
      );
      if (exists) {
        warn(`Skill '${skill.id}' from '${skill.sourceUrl}' is already bound — skipping duplicate`);
        return state;
      }
      return { boundSkills: [...state.boundSkills, skill] };
    }),

  goBack: () =>
    set((state) => {
      const history = [...state.history];
      const previousStep = history.pop();
      return {
        step: previousStep || "stack",
        history,
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

  getSelectedTechnologiesPerDomain: () => {
    const state = get();
    const result: Partial<Record<Domain, SkillId[]>> = {};
    for (const domain of typedKeys<Domain>(state.domainSelections)) {
      const domainSel = state.domainSelections[domain];
      if (!domainSel) continue;
      const techs: SkillId[] = [];
      for (const subcategory of typedKeys<Subcategory>(domainSel)) {
        const subTechs = domainSel[subcategory];
        if (subTechs) techs.push(...subTechs);
      }
      if (techs.length > 0) {
        result[domain] = techs;
      }
    }
    return result;
  },

  getCurrentDomain: () => {
    const state = get();
    return state.selectedDomains[state.currentDomainIndex] || null;
  },

  getDefaultMethodologySkills: () => {
    return [...DEFAULT_PRESELECTED_SKILLS];
  },

  getTechnologyCount: () => {
    return get().getAllSelectedTechnologies().length;
  },

  getStepProgress: () => {
    const state = get();
    const completed: string[] = [];
    const skipped: string[] = [];

    if (state.step !== "stack") {
      completed.push("stack");
    }

    if (state.approach === "stack" && state.selectedStackId && state.stackAction === "defaults") {
      skipped.push("build");
      skipped.push("sources");
    } else if (state.step === "confirm") {
      completed.push("build");
      completed.push("sources");
    } else if (state.step === "sources") {
      completed.push("build");
    }

    return { completedSteps: completed, skippedSteps: skipped };
  },

  canGoToNextDomain: () => {
    const state = get();
    return state.currentDomainIndex < state.selectedDomains.length - 1;
  },

  canGoToPreviousDomain: () => {
    const state = get();
    return state.currentDomainIndex > 0;
  },

  getParentDomain: (domain, matrix) => {
    const cat = Object.values(matrix.categories).find(
      (c) => c.domain === domain && c.parent_domain,
    );
    return cat?.parent_domain;
  },

  getParentDomainSelections: (domain, matrix) => {
    const state = get();
    const parentDomain = state.getParentDomain(domain, matrix);
    if (!parentDomain) return undefined;
    return state.domainSelections[parentDomain];
  },

  buildSourceRows: (matrix) => {
    const state = get();
    const selectedTechnologies = get().getAllSelectedTechnologies();
    const { sourceSelections, boundSkills } = state;

    return selectedTechnologies.map((tech) => {
      const skillId = resolveAlias(tech, matrix);
      const skill = matrix.skills[skillId];
      const selectedSource =
        sourceSelections[skillId] || skill?.activeSource?.name || DEFAULT_SOURCE_ID;
      const alias = getSkillAlias(skillId, matrix);

      const sortedSources = [...(skill?.availableSources || [])].sort(
        (a, b) =>
          (SOURCE_SORT_ORDER[a.type] ?? DEFAULT_SORT_PRIORITY) -
          (SOURCE_SORT_ORDER[b.type] ?? DEFAULT_SORT_PRIORITY),
      );

      const options =
        sortedSources.length > 0
          ? sortedSources.map((source) => ({
              id: source.name,
              label: formatSourceLabel({
                name: source.name,
                version: source.version,
                installed: source.installed,
              }),
              selected: selectedSource === source.name,
              installed: source.installed,
            }))
          : [
              {
                id: DEFAULT_SOURCE_ID,
                label: DEFAULT_SOURCE_LABEL,
                selected: selectedSource === DEFAULT_SOURCE_ID,
                installed: false,
              },
            ];

      options.push(...buildBoundSkillOptions(boundSkills, alias, selectedSource));

      return { skillId, displayName: alias, alias, options };
    });
  },
}));
