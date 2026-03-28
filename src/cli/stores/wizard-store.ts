import { unique, flatMap } from "remeda";
import { create } from "zustand";
import { BUILT_IN_DOMAIN_ORDER, DEFAULT_PUBLIC_SOURCE_NAME } from "../consts.js";
import type { InstallMode } from "../lib/installation/index.js";
import { deriveInstallMode as sharedDeriveInstallMode } from "../lib/installation/installation.js";
import type { AgentScopeConfig, SkillConfig } from "../types/config.js";
import { resolveAlias } from "../lib/matrix/index.js";
import { matrix, getSkillById, getCategoryDomain } from "../lib/matrix/matrix-provider.js";
import { isCompatibleWithSelectedFrameworks } from "../lib/wizard/index.js";
import type {
  AgentName,
  BoundSkill,
  Domain,
  DomainSelections,
  ResolvedSkill,
  SkillAlias,
  SkillAssignment,
  SkillId,
  SkillSource,
  Category,
  CategoryDomainMap,
  CategorySelections,
} from "../types/index.js";
import type { SourceOption } from "../components/wizard/source-grid.js";
import { warn } from "../utils/logger.js";
import { typedEntries, typedKeys } from "../utils/typed-object.js";

function createDefaultSkillConfig(id: SkillId): SkillConfig {
  const skill = matrix.skills[id];
  const primarySource = skill?.availableSources?.find((s) => s.primary)?.name;
  return { id, scope: "global", source: primarySource ?? DEFAULT_PUBLIC_SOURCE_NAME };
}

/** Derive all unique domains from a categories map, preserving built-in order then appending custom. */
function getAllDomainsFromCategories(categories: CategoryDomainMap): Domain[] {
  const allDomains = unique(
    Object.values(categories)
      .map((cat) => cat?.domain)
      .filter((d): d is Domain => d != null),
  );
  return [
    ...BUILT_IN_DOMAIN_ORDER,
    ...allDomains.filter((d) => !BUILT_IN_DOMAIN_ORDER.includes(d)),
  ];
}

/** Sort domains into canonical order: custom domains first (alphabetically), then built-in domains per BUILT_IN_DOMAIN_ORDER. */
function sortDomainsCanonically(domains: Domain[]): Domain[] {
  const builtInSet = new Set<Domain>(BUILT_IN_DOMAIN_ORDER);
  return [
    ...domains.filter((d) => !builtInSet.has(d)).sort(),
    ...BUILT_IN_DOMAIN_ORDER.filter((d) => domains.includes(d)),
  ];
}

/** Finds framework-incompatible skill IDs in web domain selections, respecting locked skills. */
function findIncompatibleWebSkills(
  webSelections: CategorySelections,
  lockedSkillIds: SkillId[],
): Set<SkillId> {
  const frameworkSelections = webSelections["web-framework"] ?? [];
  if (frameworkSelections.length === 0) return new Set();

  const selectedFrameworkIds = frameworkSelections.map((alias) => resolveAlias(alias));

  return new Set(
    flatMap(typedEntries(webSelections), ([cat, skills]) =>
      cat === "web-framework" || !skills
        ? []
        : skills.filter(
            (id) =>
              !lockedSkillIds.includes(id) &&
              !isCompatibleWithSelectedFrameworks(id, selectedFrameworkIds),
          ),
    ),
  );
}

/** Returns selections with the given skill IDs removed from all categories. */
function removeSkillsFromSelections(
  selections: CategorySelections,
  toRemove: Set<SkillId>,
): CategorySelections {
  return Object.fromEntries(
    typedEntries(selections).map(([cat, skills]) => [
      cat,
      skills?.filter((id) => !toRemove.has(id)) ?? [],
    ]),
  ) as CategorySelections; // Object.fromEntries widens to Record<string, ...>
}

/** Built-in agent names grouped by domain prefix. Custom domains return no preselected agents. */
const DOMAIN_AGENTS: Partial<Record<string, AgentName[]>> = {
  web: [
    "web-developer",
    "web-reviewer",
    "web-researcher",
    "web-tester",
    "web-pm",
    "web-architecture",
  ],
  api: ["api-developer", "api-reviewer", "api-researcher"],
  cli: ["cli-developer", "cli-tester", "cli-reviewer"],
};

/**
 * Fixed source sort tiers (lower = higher priority):
 * 1 = local/global (installed on disk -- type "local" or installed via plugin)
 * 2 = scoped marketplace (primary source from --source flag)
 * 3 = default public marketplace (Agents Inc)
 * 4 = third-party marketplaces (extra configured sources)
 */
const SOURCE_SORT_TIER_LOCAL = 1;
const SOURCE_SORT_TIER_SCOPED = 2;
const SOURCE_SORT_TIER_PUBLIC = 3;
const SOURCE_SORT_TIER_THIRD_PARTY = 4;

function getSourceSortTier(source: SkillSource): number {
  if (source.type === "local") return SOURCE_SORT_TIER_LOCAL;
  if (source.primary) return SOURCE_SORT_TIER_SCOPED;
  if (source.type === "public") return SOURCE_SORT_TIER_PUBLIC;
  return SOURCE_SORT_TIER_THIRD_PARTY;
}

export type SkillLookupEntry = Pick<ResolvedSkill, "category" | "displayName">;

function resolveSkillForPopulation(
  skillId: SkillId,
): { domain: Domain; subcat: Category; techId: SkillId } | null {
  const { skills } = matrix;
  const skill = skills[skillId];
  if (!skill?.category) {
    warn(
      `Installed skill '${skillId}' is missing from the marketplace — it may have been removed or renamed`,
    );
    return null;
  }

  const domain = getCategoryDomain(skill.category);
  if (!domain) {
    warn(`Installed skill '${skillId}' has unknown category '${skill.category}' — skipping`);
    return null;
  }

  // Boundary cast: domain lookup confirmed category exists in matrix
  const subcat = skill.category as Category;
  return { domain, subcat, techId: skillId };
}

function buildBoundSkillOptions(
  boundSkills: BoundSkill[],
  alias: SkillAlias,
  selectedSource: string,
): SourceOption[] {
  return boundSkills
    .filter((b) => b.boundTo === alias)
    .map((bound) => ({
      id: bound.sourceName,
      selected: selectedSource === bound.sourceName,
      installed: false,
    }));
}

/**
 * Wizard step identifiers for the multi-step init/edit flow.
 *
 * Progression: stack -> domains -> build -> sources -> agents -> confirm
 * The "stack" step shows all stacks + "Start from scratch" in a unified list.
 * The "domains" step shows domain selection (web, api, cli, mobile, shared).
 * Navigation is tracked via the `history` stack for goBack() support.
 */
export type WizardStep =
  | "stack" // Select stack or "Start from scratch"
  | "domains" // Select domains to configure
  | "build" // CategoryGrid for technology selection
  | "sources" // Choose skill sources (recommended vs custom)
  | "agents" // Select which agents to compile
  | "confirm"; // Final confirmation

/**
 * Wizard store state and actions.
 *
 * The store uses a composition pattern: small, focused actions that each mutate
 * one or two state fields. Wizard step components compose these actions to build
 * up the full selection state incrementally (domains -> categories -> skills -> sources).
 *
 * State flow: stack/scratch selection -> domain selection -> per-domain skill
 * selection (build step) -> source customization -> agent selection -> confirmation.
 */
export type WizardState = {
  step: WizardStep;

  approach: "stack" | "scratch" | null;
  selectedStackId: string | null;
  stackAction: "defaults" | "customize" | null;

  selectedDomains: Domain[];

  currentDomainIndex: number;
  domainSelections: DomainSelections;
  /** Snapshot of stack-provided domain selections for restoration on domain re-toggle */
  _stackDomainSelections: DomainSelections | null;

  showLabels: boolean;
  filterIncompatible: boolean;

  skillConfigs: SkillConfig[];
  focusedSkillId: SkillId | null;

  customizeSources: boolean;

  showSettings: boolean;
  showInfo: boolean;
  enabledSources: Record<string, boolean>;

  selectedAgents: AgentName[];
  agentConfigs: AgentScopeConfig[];
  focusedAgentId: AgentName | null;

  boundSkills: BoundSkill[];

  /** Skill IDs that cannot be toggled or removed (D9: existing global items in project context) */
  lockedSkillIds: SkillId[];
  /** Agent names that cannot be toggled or removed (D9: existing global agents in project context) */
  lockedAgentNames: AgentName[];

  /** When true, scope toggling is disabled (editing from ~/.claude/ with no project to move items to) */
  isEditingFromGlobalScope: boolean;

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
   * Iterates all agents in the stack, resolving each category's skill assignments
   * to the appropriate domain. Enables all domains and deduplicates skill IDs.
   *
   * @param stack - Stack definition with agent-level skill assignments
   * @param stack.agents - Record of agent name to `{ category: SkillAssignment[] }` mappings
   * @param categories - Category definitions used to resolve category -> domain mapping
   *
   * Side effects: sets `domainSelections`, sets `selectedDomains` to ALL_DOMAINS
   */
  populateFromStack: (stack: {
    agents: Record<string, Partial<Record<Category, SkillAssignment[]>>>;
  }) => void;
  /**
   * Pre-populate domainSelections from a flat list of installed skill IDs.
   *
   * Used by `agentsinc edit` to restore wizard state from existing project config.
   * Looks up each skill's category and domain, warns for unresolvable skills.
   *
   * @param skillIds - Flat array of currently installed skill IDs
   * @param skills - Skill lookup providing category and displayName per skill ID
   * @param categories - Category definitions used to resolve category -> domain mapping
   *
   * Side effects: sets `domainSelections`, sets `selectedDomains` to domains found in the provided skill IDs
   */
  populateFromSkillIds: (skillIds: SkillId[], savedConfigs?: SkillConfig[]) => void;
  /**
   * Toggle a domain on or off in the selectedDomains list.
   * @param domain - Domain to toggle
   *
   * Side effects: adds or removes from `selectedDomains`
   */
  toggleDomain: (domain: Domain) => void;
  /**
   * Toggle a skill selection within a domain's category.
   *
   * When exclusive is true (radio behavior), selecting a new skill replaces any
   * existing selection in that category. When false (checkbox behavior),
   * the skill is added to or removed from the selection array.
   *
   * @param domain - Domain containing the category
   * @param category - Category within the domain
   * @param technology - Skill ID to toggle
   * @param exclusive - If true, only one skill can be selected per category (radio)
   *
   * Side effects: updates `domainSelections[domain][category]`
   */
  toggleTechnology: (
    domain: Domain,
    category: Category,
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
  /**
   * Set the current domain index directly.
   * @param index - Index to set (0-based, must be within selectedDomains range)
   *
   * Side effects: sets `currentDomainIndex` if index is valid, otherwise no-op
   */
  setCurrentDomainIndex: (index: number) => void;
  /** Toggle compatibility label visibility on skill tags in the build step grid. */
  toggleShowLabels: () => void;
  /** Toggle filtering of incompatible skills in the build step grid. */
  toggleFilterIncompatible: () => void;
  /**
   * Derive the install mode from skillConfigs source values.
   * If all skills use "local" source, returns "local". If all use non-local, returns "plugin".
   * If mixed, returns "mixed". Returns "local" when no skills are configured.
   */
  deriveInstallMode: () => InstallMode;
  /**
   * Toggle the scope of a specific skill between "project" and "global".
   * @param skillId - Skill to toggle scope for
   *
   * Side effects: updates `skillConfigs` entry for the skill
   */
  toggleSkillScope: (skillId: SkillId) => void;
  /**
   * Update the source for a specific skill in skillConfigs.
   * @param skillId - Skill to update
   * @param source - Source identifier (e.g., "local", marketplace name)
   *
   * Side effects: updates `skillConfigs` entry for the skill
   */
  setSkillSource: (skillId: SkillId, source: string) => void;
  /**
   * Set the currently focused skill ID in the build step (for S hotkey).
   * @param id - Skill ID to focus, or null to clear
   *
   * Side effects: sets `focusedSkillId`
   */
  setFocusedSkillId: (id: SkillId | null) => void;
  /**
   * Set which source provides a specific skill.
   * @param skillId - Skill to configure the source for
   * @param sourceId - Source identifier (e.g., "public", "local", marketplace name)
   *
   * Side effects: updates `skillConfigs` entry for the skill. No-op with warning if either param is empty.
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
  /** Toggle the info overlay (selected skills and agents). */
  toggleInfo: () => void;
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
   * @param skill - Bound skill to add (foreign skill tied to a category alias)
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
  /**
   * Toggle an agent on or off in the selectedAgents list.
   * @param agent - Agent name to toggle
   *
   * Side effects: adds or removes from `selectedAgents`, syncs `agentConfigs`
   */
  toggleAgent: (agent: AgentName) => void;
  /**
   * Toggle the scope of a specific agent between "project" and "global".
   * @param agentName - Agent to toggle scope for
   *
   * Side effects: updates `agentConfigs` entry for the agent
   */
  toggleAgentScope: (agentName: AgentName) => void;
  /**
   * Set the currently focused agent ID in the agents step (for S hotkey).
   * @param id - Agent name to focus, or null to clear
   *
   * Side effects: sets `focusedAgentId`
   */
  setFocusedAgentId: (id: AgentName | null) => void;
  /**
   * Preselect agents based on selected domains from the first wizard step.
   * Matches domains against DOMAIN_AGENTS mapping.
   * Optional agents (meta/pattern) are excluded.
   *
   * Side effects: replaces `selectedAgents` with computed preselection
   */
  preselectAgentsFromDomains: () => void;
  /** Reset all wizard state to initial values. */
  reset: () => void;

  /**
   * Collect all selected skill IDs across all domains and categories.
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
  getStepProgress: () => { completedSteps: WizardStep[]; skippedSteps: WizardStep[] };
  /** @returns true if there is a next domain after the current one */
  canGoToNextDomain: () => boolean;
  /** @returns true if there is a previous domain before the current one */
  canGoToPreviousDomain: () => boolean;
  /** Set all selected skills to "local" source. */
  setAllSourcesLocal: () => void;
  /** Set all selected skills to their first non-local (marketplace) source. */
  setAllSourcesPlugin: () => void;

  /**
   * Build the source selection rows for the sources step UI.
   *
   * For each selected technology, resolves the canonical skill ID, looks up available
   * sources from the matrix, merges in any bound skills from search, and determines
   * which source is currently selected. Sources are sorted: local first, then public,
   * then private/other.
   *
   * @returns Array of row objects, one per selected technology, each containing:
   *   - `skillId` - Canonical resolved skill ID
   *   - `options` - Available sources with selection state and install status
   */
  buildSourceRows: () => {
    skillId: SkillId;
    options: SourceOption[];
  }[];
};

/** State-only fields from WizardState (excludes actions/getters). Used to type createInitialState(). */
type WizardStateData = Pick<
  WizardState,
  | "step"
  | "approach"
  | "selectedStackId"
  | "stackAction"
  | "selectedDomains"
  | "currentDomainIndex"
  | "domainSelections"
  | "_stackDomainSelections"
  | "showLabels"
  | "filterIncompatible"
  | "skillConfigs"
  | "focusedSkillId"
  | "customizeSources"
  | "showSettings"
  | "showInfo"
  | "enabledSources"
  | "selectedAgents"
  | "agentConfigs"
  | "focusedAgentId"
  | "boundSkills"
  | "lockedSkillIds"
  | "lockedAgentNames"
  | "isEditingFromGlobalScope"
  | "history"
>;

const createInitialState = (): WizardStateData => ({
  step: "stack",
  approach: null,
  selectedStackId: null,
  stackAction: null,
  selectedDomains: [],
  currentDomainIndex: 0,
  domainSelections: {},
  /** Snapshot of domainSelections from populateFromStack/populateFromSkillIds, used to restore on domain re-toggle */
  _stackDomainSelections: null,
  showLabels: false,
  filterIncompatible: false,
  skillConfigs: [],
  focusedSkillId: null,
  customizeSources: false,
  showSettings: false,
  showInfo: false,
  enabledSources: {},
  selectedAgents: [],
  agentConfigs: [],
  focusedAgentId: null,
  boundSkills: [],
  lockedSkillIds: [],
  lockedAgentNames: [],
  isEditingFromGlobalScope: false,
  history: [],
});

export const useWizardStore = create<WizardState>((set, get) => ({
  ...createInitialState(),

  setStep: (step) =>
    set((state) => ({
      step,
      history: [...state.history, state.step],
    })),

  setApproach: (approach) => set({ approach }),

  selectStack: (stackId) =>
    set({
      selectedStackId: stackId,
      domainSelections: {},
      _stackDomainSelections: null,
      selectedDomains: [],
      skillConfigs: [],
      selectedAgents: [],
      agentConfigs: [],
      boundSkills: [],
      currentDomainIndex: 0,
      stackAction: null,
    }),

  setStackAction: (action) => set({ stackAction: action }),

  populateFromStack: (stack) =>
    set(() => {
      const { categories } = matrix;
      const domainSelections: DomainSelections = {};
      const domains = new Set<Domain>();
      const allSkillIds = new Set<SkillId>();

      for (const agentConfig of Object.values(stack.agents)) {
        for (const [subcat, assignments] of typedEntries<Category, SkillAssignment[]>(
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
              allSkillIds.add(assignment.id);
            }
          }
        }
      }

      const skillConfigs: SkillConfig[] = [...allSkillIds].map(createDefaultSkillConfig);

      return {
        domainSelections,
        _stackDomainSelections: structuredClone(domainSelections),
        selectedDomains: sortDomainsCanonically([...domains]),
        skillConfigs,
      };
    }),

  populateFromSkillIds: (skillIds, savedConfigs) =>
    set(() => {
      const domainSelections: DomainSelections = {};
      const resolvedSkillIds: SkillId[] = [];
      let skippedCount = 0;

      for (const skillId of skillIds) {
        const resolved = resolveSkillForPopulation(skillId);
        if (!resolved) {
          skippedCount++;
          continue;
        }

        const { domain, subcat, techId } = resolved;
        if (!domainSelections[domain]) domainSelections[domain] = {};
        if (!domainSelections[domain][subcat]) domainSelections[domain][subcat] = [];

        if (!domainSelections[domain][subcat].includes(techId)) {
          domainSelections[domain][subcat].push(techId);
          resolvedSkillIds.push(techId);
        }
      }

      if (skippedCount > 0) {
        warn(`${skippedCount} installed skill(s) could not be resolved and were skipped`);
      }

      const selectedDomains = sortDomainsCanonically(typedKeys<Domain>(domainSelections));

      const skillConfigs: SkillConfig[] = resolvedSkillIds.map((id) => {
        const saved = savedConfigs?.find((sc) => sc.id === id);
        const skill = matrix.skills[id];
        const primarySource = skill?.availableSources?.find((s) => s.primary)?.name;
        return {
          id,
          scope: saved?.scope ?? "global",
          source: saved?.source ?? primarySource ?? DEFAULT_PUBLIC_SOURCE_NAME,
        };
      });

      return {
        domainSelections,
        _stackDomainSelections: structuredClone(domainSelections),
        selectedDomains,
        skillConfigs,
      };
    }),

  toggleDomain: (domain) =>
    set((state) => {
      const isSelected = state.selectedDomains.includes(domain);
      if (isSelected) {
        const { [domain]: _removed, ...remainingSelections } = state.domainSelections;

        // Collect all skill IDs being removed from this domain
        const removedSkillIds = new Set<SkillId>();
        if (_removed) {
          for (const skills of Object.values(_removed)) {
            if (skills) {
              for (const id of skills) {
                removedSkillIds.add(id);
              }
            }
          }
        }

        return {
          selectedDomains: state.selectedDomains.filter((d) => d !== domain),
          domainSelections: remainingSelections,
          skillConfigs: state.skillConfigs.filter((sc) => !removedSkillIds.has(sc.id)),
        };
      }

      // Restore stack selections for this domain if a stack snapshot exists
      const stackSelections = state._stackDomainSelections?.[domain];
      if (stackSelections) {
        // Also restore skillConfigs for the restored skills
        const restoredSkillIds: SkillId[] = [];
        for (const skills of Object.values(stackSelections)) {
          if (skills) restoredSkillIds.push(...skills);
        }
        const existingIds = new Set(state.skillConfigs.map((sc) => sc.id));
        const newConfigs = restoredSkillIds
          .filter((id) => !existingIds.has(id))
          .map(createDefaultSkillConfig);

        return {
          selectedDomains: sortDomainsCanonically([...state.selectedDomains, domain]),
          domainSelections: {
            ...state.domainSelections,
            [domain]: structuredClone(stackSelections),
          },
          skillConfigs: [...state.skillConfigs, ...newConfigs],
        };
      }

      return {
        selectedDomains: sortDomainsCanonically([...state.selectedDomains, domain]),
      };
    }),

  toggleTechnology: (domain, category, technology, exclusive) =>
    set((state) => {
      // D9: locked skills cannot be toggled
      if (state.lockedSkillIds.includes(technology)) return state;

      const currentSelections = state.domainSelections[domain]?.[category] || [];
      const isSelected = currentSelections.includes(technology);

      let newSelections: SkillId[];
      if (exclusive) {
        // D-161: If selecting a new skill in an exclusive category would deselect
        // a locked skill, reject the toggle — locked skills cannot be swapped out.
        if (!isSelected && currentSelections.some((id) => state.lockedSkillIds.includes(id))) {
          return state;
        }
        newSelections = isSelected ? [] : [technology];
      } else {
        newSelections = isSelected
          ? currentSelections.filter((t) => t !== technology)
          : [...currentSelections, technology];
      }

      // Sync skillConfigs: add entries for newly selected, remove entries for deselected
      const removed = currentSelections.filter((id) => !newSelections.includes(id));
      const added = newSelections.filter((id) => !currentSelections.includes(id));

      let updatedConfigs = state.skillConfigs.filter((sc) => !removed.includes(sc.id));
      for (const id of added) {
        if (!updatedConfigs.some((sc) => sc.id === id)) {
          updatedConfigs = [...updatedConfigs, createDefaultSkillConfig(id)];
        }
      }

      return {
        skillConfigs: updatedConfigs,
        domainSelections: {
          ...state.domainSelections,
          [domain]: {
            ...state.domainSelections[domain],
            [category]: newSelections,
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

  setCurrentDomainIndex: (index) => {
    const state = get();
    if (index >= 0 && index < state.selectedDomains.length) {
      set({ currentDomainIndex: index });
    }
  },

  toggleShowLabels: () => set((state) => ({ showLabels: !state.showLabels })),
  toggleFilterIncompatible: () =>
    set((state) => {
      if (state.filterIncompatible) return { filterIncompatible: false };

      const webSelections = state.domainSelections.web;
      if (!webSelections) return { filterIncompatible: true };

      const removed = findIncompatibleWebSkills(webSelections, state.lockedSkillIds);
      if (removed.size === 0) return { filterIncompatible: true };

      return {
        filterIncompatible: true,
        domainSelections: {
          ...state.domainSelections,
          web: removeSkillsFromSelections(webSelections, removed),
        },
        skillConfigs: state.skillConfigs.filter((sc) => !removed.has(sc.id)),
      };
    }),

  deriveInstallMode: (): InstallMode => {
    const { skillConfigs } = get();
    return sharedDeriveInstallMode(skillConfigs);
  },

  toggleSkillScope: (skillId) =>
    set((state) => {
      if (state.isEditingFromGlobalScope) return state;
      // D9: locked skills cannot have their scope toggled
      if (state.lockedSkillIds.includes(skillId)) return state;
      return {
        skillConfigs: state.skillConfigs.map((sc) =>
          sc.id === skillId ? { ...sc, scope: sc.scope === "project" ? "global" : "project" } : sc,
        ),
      };
    }),

  setSkillSource: (skillId, source) =>
    set((state) => ({
      skillConfigs: state.skillConfigs.map((sc) => (sc.id === skillId ? { ...sc, source } : sc)),
    })),

  setFocusedSkillId: (id) => set({ focusedSkillId: id }),

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
        skillConfigs: state.skillConfigs.map((sc) =>
          sc.id === skillId ? { ...sc, source: sourceId } : sc,
        ),
      };
    }),

  setCustomizeSources: (customize) => set({ customizeSources: customize }),

  toggleSettings: () => set((state) => ({ showSettings: !state.showSettings })),

  toggleInfo: () => set((state) => ({ showInfo: !state.showInfo })),

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

  toggleAgent: (agent) =>
    set((state) => {
      // D9: locked agents cannot be toggled
      if (state.lockedAgentNames.includes(agent)) return state;

      const isSelected = state.selectedAgents.includes(agent);
      if (isSelected) {
        return {
          selectedAgents: state.selectedAgents.filter((a) => a !== agent),
          agentConfigs: state.agentConfigs.filter((ac) => ac.name !== agent),
        };
      }
      return {
        selectedAgents: [...state.selectedAgents, agent],
        agentConfigs: [...state.agentConfigs, { name: agent, scope: "global" as const }],
      };
    }),

  toggleAgentScope: (agentName) =>
    set((state) => {
      if (state.isEditingFromGlobalScope) return state;
      // D9: locked agents cannot have their scope toggled
      if (state.lockedAgentNames.includes(agentName)) return state;
      return {
        agentConfigs: state.agentConfigs.map((ac) =>
          ac.name === agentName
            ? { ...ac, scope: ac.scope === "project" ? ("global" as const) : ("project" as const) }
            : ac,
        ),
      };
    }),

  setFocusedAgentId: (id) => set({ focusedAgentId: id }),

  preselectAgentsFromDomains: () =>
    set(() => {
      const agents: AgentName[] = [];
      for (const domain of get().selectedDomains) {
        const domainAgents = DOMAIN_AGENTS[domain];
        if (domainAgents) {
          agents.push(...domainAgents);
        }
      }
      const sorted = agents.sort();
      return {
        selectedAgents: sorted,
        agentConfigs: sorted.map((name) => ({ name, scope: "global" as const })),
      };
    }),

  reset: () => set(createInitialState()),

  getAllSelectedTechnologies: () => {
    const state = get();
    const technologies: SkillId[] = [];
    for (const domain of typedKeys<Domain>(state.domainSelections)) {
      const domainSel = state.domainSelections[domain];
      if (!domainSel) continue;
      for (const category of typedKeys<Category>(domainSel)) {
        const techs = domainSel[category];
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
      for (const category of typedKeys<Category>(domainSel)) {
        const subTechs = domainSel[category];
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

  getTechnologyCount: () => {
    return get().getAllSelectedTechnologies().length;
  },

  getStepProgress: () => {
    const state = get();
    const completed: WizardStep[] = [];
    const skipped: WizardStep[] = [];

    if (state.step !== "stack" && state.step !== "domains") {
      completed.push("stack");
      completed.push("domains");
    } else if (state.step === "domains") {
      completed.push("stack");
    }

    if (state.approach === "stack" && state.selectedStackId && state.stackAction === "defaults") {
      skipped.push("build");
      skipped.push("sources");
      skipped.push("agents");
    } else if (state.step === "confirm") {
      completed.push("build");
      completed.push("sources");
      completed.push("agents");
    } else if (state.step === "agents") {
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

  setAllSourcesLocal: () => {
    set((state) => ({
      skillConfigs: state.skillConfigs.map((sc) => ({ ...sc, source: "local" })),
    }));
  },

  setAllSourcesPlugin: () => {
    set((state) => ({
      skillConfigs: state.skillConfigs.map((sc) => {
        const skill = getSkillById(sc.id);
        if (skill.availableSources) {
          const marketplaceSource = skill.availableSources.find((s) => s.type !== "local");
          if (marketplaceSource) {
            return { ...sc, source: marketplaceSource.name };
          }
        }
        return sc;
      }),
    }));
  },

  buildSourceRows: () => {
    const state = get();
    const selectedTechnologies = get().getAllSelectedTechnologies();
    const { skillConfigs, boundSkills } = state;

    return selectedTechnologies.map((tech) => {
      const skillId = resolveAlias(tech);
      const skill = getSkillById(skillId);
      const configEntry = skillConfigs.find((sc) => sc.id === skillId);
      const primarySource = skill.availableSources?.find((s) => s.primary)?.name;
      const selectedSource =
        configEntry?.source ||
        skill.activeSource?.name ||
        primarySource ||
        DEFAULT_PUBLIC_SOURCE_NAME;
      const slug = skill.slug;

      const sortedSources = [...(skill.availableSources || [])].sort(
        (a, b) => getSourceSortTier(a) - getSourceSortTier(b),
      );

      const options: SourceOption[] =
        sortedSources.length > 0
          ? sortedSources.map((source) => ({
              id: source.name,
              displayName: source.displayName,
              selected: selectedSource === source.name,
              installed: source.installed,
            }))
          : [
              {
                id: DEFAULT_PUBLIC_SOURCE_NAME,
                selected: selectedSource === DEFAULT_PUBLIC_SOURCE_NAME,
                installed: false,
              },
            ];

      if (!options.some((o) => o.id === "local")) {
        options.unshift({
          id: "local",
          selected: selectedSource === "local",
          installed: false,
        });
      }

      options.push(...buildBoundSkillOptions(boundSkills, slug, selectedSource));

      return { skillId, options };
    });
  },
}));
