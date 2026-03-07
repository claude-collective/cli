import path from "path";
import { unique } from "remeda";
import type { AgentName, MergedSkillsMatrix, SkillId, Category } from "../../types";
import { CLAUDE_SRC_DIR, CLI_BIN_NAME, PROJECT_ROOT, STANDARD_FILES } from "../../consts";
import { directoryExists, writeFile } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { typedKeys } from "../../utils/typed-object";

const MULTI_LINE_THRESHOLD = 6;

/**
 * Shared ProjectConfig interface template used by both standalone and global-import config-types.ts.
 * The template includes InstallMode, SkillConfig, AgentScopeConfig, SkillAssignment,
 * StackAgentConfig, and the ProjectConfig interface itself.
 */
export const PROJECT_CONFIG_INTERFACE_TEMPLATE = `export type InstallMode = "local" | "plugin" | "mixed";

export type SkillConfig = {
  id: SkillId;
  scope: "project" | "global";
  source: string;
};

export type AgentScopeConfig = {
  name: AgentName;
  scope: "project" | "global";
};

export type SkillAssignment = SkillId | { id: SkillId; preloaded: boolean };

export type StackAgentConfig = Partial<Record<Category, SkillAssignment>>;

export interface ProjectConfig {
  /** Config version @default "1" */
  version?: "1";

  /** Project/plugin name (kebab-case) */
  name: string;

  /** Project description */
  description?: string;

  /** Per-agent configuration with scope */
  agents: AgentScopeConfig[];

  /** Per-skill configuration with scope and source */
  skills: SkillConfig[];

  /** Author handle (e.g., "@vince") */
  author?: string;

  /** Stack configuration: agent -> category -> skill assignment */
  stack?: Partial<Record<AgentName, StackAgentConfig>>;

  /** Skills source path or URL */
  source?: string;

  /** Marketplace identifier for plugin installation */
  marketplace?: string;

  /** Agents source path or URL (when agents come from a different source than skills) */
  agentsSource?: string;

  /** Selected domains from the wizard */
  domains?: Domain[];

  /** Selected agents from the wizard */
  selectedAgents?: AgentName[];
}
`;

export type ConfigTypesBackgroundData = {
  matrix: MergedSkillsMatrix;
  agentNames: AgentName[];
  customAgentNames: AgentName[];
};

/**
 * Kicks off background loading of the matrix and agents needed for config-types.ts regeneration.
 * Returns a promise that resolves with the loaded data. Callers should NOT await this immediately;
 * instead, pass the promise to `regenerateConfigTypes` after the main operation completes.
 *
 * @param sourceFlag Optional --source flag value
 * @param projectDir The project root directory
 */
export function loadConfigTypesDataInBackground(
  sourceFlag: string | undefined,
  projectDir: string,
): Promise<ConfigTypesBackgroundData> {
  // Dynamic imports to avoid circular dependency issues at module load time
  const promise = (async (): Promise<ConfigTypesBackgroundData> => {
    const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);
    if (!(await directoryExists(claudeSrcDir))) {
      throw new Error(`${CLAUDE_SRC_DIR}/ not found — run '${CLI_BIN_NAME} init' first`);
    }

    const { loadSkillsMatrixFromSource } = await import("../loading/source-loader");
    const { loadAllAgents } = await import("../loading/loader");

    const sourceResult = await loadSkillsMatrixFromSource({
      sourceFlag,
      projectDir,
      skipExtraSources: true,
    });

    const cliAgents = await loadAllAgents(PROJECT_ROOT);
    const sourceAgents = await loadAllAgents(sourceResult.sourcePath);
    const allAgents = { ...cliAgents, ...sourceAgents };
    // Boundary cast: loadAllAgents returns Record<string, AgentDefinition>, agent dirs are AgentName by convention
    const agentNames = Object.keys(allAgents) as AgentName[];
    const customAgentNames = agentNames.filter((name) => allAgents[name]?.custom === true);

    return { matrix: sourceResult.matrix, agentNames, customAgentNames };
  })();

  // Prevent unhandled rejection if the command exits before awaiting this promise
  promise.catch(() => {});

  return promise;
}

/**
 * Regenerates config-types.ts with the latest matrix data, merging in any extra entities
 * that were just created (e.g., a new skill or agent). Errors propagate to callers.
 *
 * @param projectDir The project root directory
 * @param backgroundData Promise from loadConfigTypesDataInBackground
 * @param extras Optional extra skill IDs or agent names to include (for just-created entities)
 */
export async function regenerateConfigTypes(
  projectDir: string,
  backgroundData: Promise<ConfigTypesBackgroundData>,
  extras?: {
    extraSkillIds?: string[];
    extraAgentNames?: string[];
    extraDomains?: string[];
    extraCategories?: string[];
  },
): Promise<void> {
  const data = await backgroundData;

  const claudeSrcDir = path.join(projectDir, CLAUDE_SRC_DIR);

  const source = generateConfigTypesSource(
    data.matrix,
    data.agentNames,
    data.customAgentNames,
    extras,
  );
  const configTypesPath = path.join(claudeSrcDir, STANDARD_FILES.CONFIG_TYPES_TS);
  await writeFile(configTypesPath, source);
  verbose(`Regenerated ${STANDARD_FILES.CONFIG_TYPES_TS}`);
}

/**
 * Generates a config-types.ts source from marketplace data.
 * The generated file provides type safety for config.ts via `import type` + `satisfies`.
 *
 * @param customAgentNames Agent names that are custom (from sources with `custom: true`)
 * @param extras Optional extra skill IDs or agent names to include (for just-created entities)
 */
export function generateConfigTypesSource(
  matrix: MergedSkillsMatrix,
  agentNames: AgentName[],
  customAgentNames: AgentName[] = [],
  extras?: {
    extraSkillIds?: string[];
    extraAgentNames?: string[];
    extraDomains?: string[];
    extraCategories?: string[];
  },
): string {
  // Boundary cast: extra IDs from CLI args may not match strict union patterns
  const extraSkillIds = (extras?.extraSkillIds ?? []) as SkillId[];
  const extraAgentNamesArr = (extras?.extraAgentNames ?? []) as AgentName[];
  const extraDomainsArr = extras?.extraDomains ?? [];
  const extraCategoriesArr = (extras?.extraCategories ?? []) as Category[];

  const skillIds = unique([...typedKeys(matrix.skills), ...extraSkillIds]).sort();
  const sortedAgents = unique([...agentNames, ...extraAgentNamesArr]).sort();

  const domains = unique([...extractDomains(matrix), ...extraDomainsArr]).sort();
  const categories = unique([...typedKeys(matrix.categories), ...extraCategoriesArr]).sort();

  // Determine which skills are custom
  const customSkillSet = new Set<SkillId>(extraSkillIds);
  for (const id of typedKeys(matrix.skills)) {
    const skill = matrix.skills[id];
    if (skill?.custom === true) {
      customSkillSet.add(id);
    }
  }

  // Determine which agents are custom
  const customAgentSet = new Set<AgentName>([...customAgentNames, ...extraAgentNamesArr]);

  // Determine which categories are custom (referenced by custom skills or passed as extras)
  const customCategorySet = new Set<Category>(extraCategoriesArr);
  for (const id of typedKeys(matrix.skills)) {
    const skill = matrix.skills[id];
    if (skill?.custom === true && skill.category) {
      // Boundary cast: CategoryPath may not match Category, but categories are keyed by Category
      customCategorySet.add(skill.category as Category);
    }
  }

  // Determine which domains are custom (only appear on custom categories)
  const customDomainSet = new Set<string>();
  const marketplaceDomainSet = new Set<string>();
  for (const key of typedKeys(matrix.categories)) {
    const cat = matrix.categories[key];
    if (!cat?.domain) continue;
    if (customCategorySet.has(key)) {
      customDomainSet.add(cat.domain);
    } else {
      marketplaceDomainSet.add(cat.domain);
    }
  }
  // A domain is only custom if it NEVER appears on a non-custom category
  for (const domain of marketplaceDomainSet) {
    customDomainSet.delete(domain);
  }
  // Explicitly-passed extra domains are always treated as custom
  for (const domain of extraDomainsArr) {
    customDomainSet.add(domain);
  }

  const skillIdLine = formatMaybeSectionedUnion(skillIds, (id) => customSkillSet.has(id));
  const agentNameLine = formatMaybeSectionedUnion(sortedAgents, (name) => customAgentSet.has(name));
  const domainLine = formatMaybeSectionedUnion(domains, (d) => customDomainSet.has(d));
  const categoryLine = formatMaybeSectionedUnion(categories, (s) => customCategorySet.has(s));

  return `// AUTO-GENERATED by agentsinc — DO NOT EDIT

export type SkillId = ${skillIdLine};

export type AgentName = ${agentNameLine};

export type Domain = ${domainLine};

export type Category = ${categoryLine};

${PROJECT_CONFIG_INTERFACE_TEMPLATE}`;
}

function extractDomains(matrix: MergedSkillsMatrix): string[] {
  const domainSet = new Set<string>();
  for (const key of typedKeys(matrix.categories)) {
    const category = matrix.categories[key];
    if (category?.domain) {
      domainSet.add(category.domain);
    }
  }
  return [...domainSet].sort();
}

/**
 * Renders a union type with optional // Custom and // Marketplace section comments.
 * If all members are in one group, only that group's header is shown.
 * If both groups exist, renders with section comments and always uses multi-line format.
 */
function formatSectionedUnion(custom: string[], marketplace: string[]): string {
  if (custom.length === 0 && marketplace.length === 0) {
    return "string";
  }

  // Only one group present: show single header
  if (marketplace.length === 0) {
    const lines = custom.map((m) => `  | "${m}"`);
    return "\n  // Custom\n" + lines.join("\n");
  }
  if (custom.length === 0) {
    const lines = marketplace.map((m) => `  | "${m}"`);
    return "\n  // Marketplace\n" + lines.join("\n");
  }

  // Both groups: custom first, then marketplace
  const customLines = custom.map((m) => `  | "${m}"`);
  const marketplaceLines = marketplace.map((m) => `  | "${m}"`);
  return (
    "\n  // Custom\n" +
    customLines.join("\n") +
    "\n  // Marketplace\n" +
    marketplaceLines.join("\n")
  );
}

/**
 * Formats a union, using section comments when custom members exist,
 * or plain formatUnion when there are no custom members.
 */
function formatMaybeSectionedUnion<T extends string>(
  members: T[],
  isCustom: (member: T) => boolean,
): string {
  if (members.length === 0) {
    return "string";
  }

  const custom = members.filter(isCustom);
  const marketplace = members.filter((m) => !isCustom(m));

  // No custom members: use standard formatting (preserves single-line for small unions)
  if (custom.length === 0) {
    return formatUnion(members);
  }

  return formatSectionedUnion(custom, marketplace);
}

function formatUnion(members: string[]): string {
  if (members.length === 0) {
    return "string";
  }

  const quoted = members.map((m) => `"${m}"`);

  if (quoted.length < MULTI_LINE_THRESHOLD) {
    return quoted.join(" | ");
  }

  return "\n" + quoted.map((q) => `  | ${q}`).join("\n");
}

export type ProjectConfigTypesOptions = {
  /**
   * Absolute path to the global .claude-src directory.
   * When set, generates import statements that extend global types.
   */
  globalTypesImportPath: string;
  /** Project-only skill IDs (not including global) */
  projectSkillIds: string[];
  /** Project-only agent names (not including global) */
  projectAgentNames: string[];
  /** Project-only domains (not including global) */
  projectDomains: string[];
};

/**
 * Generates a project config-types.ts source that imports global types and extends them.
 * Each type union is `GlobalType | "project-item-1" | "project-item-2"`.
 */
export function generateProjectConfigTypesSource(options: ProjectConfigTypesOptions): string {
  const importPath = `${options.globalTypesImportPath}/config-types`;

  const skillIdUnion = formatExtendedUnion("GlobalSkillId", options.projectSkillIds);
  const agentNameUnion = formatExtendedUnion("GlobalAgentName", options.projectAgentNames);
  const domainUnion = formatExtendedUnion("GlobalDomain", options.projectDomains);

  return `// AUTO-GENERATED by agentsinc — DO NOT EDIT

import type {
  SkillId as GlobalSkillId,
  AgentName as GlobalAgentName,
  Domain as GlobalDomain,
} from "${importPath}";

export type SkillId = ${skillIdUnion};

export type AgentName = ${agentNameUnion};

export type Domain = ${domainUnion};

export type Category = string;

${PROJECT_CONFIG_INTERFACE_TEMPLATE}`;
}

/**
 * Formats a union that extends a global type alias.
 * Returns `GlobalType` when no project members exist, or `GlobalType | "a" | "b"` with members.
 */
function formatExtendedUnion(globalTypeName: string, projectMembers: string[]): string {
  if (projectMembers.length === 0) {
    return globalTypeName;
  }

  const sorted = [...projectMembers].sort();
  const quoted = sorted.map((m) => `"${m}"`);

  if (quoted.length < MULTI_LINE_THRESHOLD) {
    return `${globalTypeName} | ${quoted.join(" | ")}`;
  }

  return `\n  | ${globalTypeName}\n` + quoted.map((q) => `  | ${q}`).join("\n");
}
