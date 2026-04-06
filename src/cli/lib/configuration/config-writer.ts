import os from "os";
import path from "path";
import type { ProjectConfig } from "../../types";
import { CLAUDE_SRC_DIR, DEFAULT_PLUGIN_NAME, STANDARD_FILES } from "../../consts";
import { fileExists, ensureDir, writeFile } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { PROJECT_CONFIG_TYPES_BEFORE, PROJECT_CONFIG_INTERFACE_AFTER } from "./config-types-writer";

export type ConfigSourceOptions = {
  /**
   * When true, generates a project config that imports and extends the global config.
   * The global config import path is resolved internally via `getGlobalConfigImportPath()`.
   */
  isProjectConfig?: boolean;

  /**
   * When provided alongside `isProjectConfig`, inlines global skills/agents directly
   * instead of generating `import globalConfig` and spread syntax.
   * Produces a self-contained, readable config snapshot.
   */
  globalConfig?: ProjectConfig;
};

/** Fields that are extracted into typed named variables below the export default */
const EXTRACTED_FIELDS = new Set(["skills", "agents", "stack", "domains"]);

/**
 * Generates a TypeScript config file source from a ProjectConfig object.
 * The export default sits at the top as a table of contents, with typed named
 * variables (skills, agents, stack, domains) declared below it.
 *
 * When `options.isProjectConfig` is true, the generated config imports from the global
 * config and spreads global arrays into skills, agents, and domains.
 */
export function generateConfigSource(config: ProjectConfig, options?: ConfigSourceOptions): string {
  if (options?.isProjectConfig) {
    if (options.globalConfig) {
      // Inlined path: compact individual assignments (strip { id, preloaded: false } to bare strings)
      // while preserving SkillAssignment[] arrays.
      const cleanedProject: Record<string, unknown> = JSON.parse(JSON.stringify(config));
      delete cleanedProject.projects;
      const cleanedGlobal: Record<string, unknown> = JSON.parse(
        JSON.stringify(options.globalConfig),
      );
      delete cleanedGlobal.projects;
      if (cleanedProject.stack) {
        cleanedProject.stack = compactStackAssignments(
          cleanedProject.stack as Record<string, Record<string, unknown[]>>,
        );
      }
      if (cleanedGlobal.stack) {
        cleanedGlobal.stack = compactStackAssignments(
          cleanedGlobal.stack as Record<string, Record<string, unknown[]>>,
        );
      }
      return generateProjectConfigWithInlinedGlobal(cleanedProject, cleanedGlobal);
    }
  }

  // JSON.parse(JSON.stringify(x)) removes undefined values
  const cleaned: Record<string, unknown> = JSON.parse(JSON.stringify(config));
  if (cleaned.stack) {
    cleaned.stack = compactStackAssignments(
      cleaned.stack as Record<string, Record<string, unknown[]>>,
    );
  }

  if (options?.isProjectConfig) {
    delete cleaned.projects;
    return generateProjectConfigWithGlobalImport(cleaned, getGlobalConfigImportPath());
  }

  return generateStandaloneConfig(cleaned);
}

/**
 * Generates a standalone config source with typed named variables above the export default.
 * The export default at the bottom acts as a table of contents, referencing the named variables.
 */
function generateStandaloneConfig(cleaned: Record<string, unknown>): string {
  // Boundary cast: cleaned comes from JSON.parse(JSON.stringify(...)) so arrays are plain JSON values
  const skillsArr = (cleaned.skills as unknown[]) ?? [];
  const agentsArr = (cleaned.agents as unknown[]) ?? [];
  const stackObj = cleaned.stack as Record<string, unknown> | undefined;
  const domainsArr = (cleaned.domains as unknown[]) ?? [];

  const hasSkills = skillsArr.length > 0;
  const hasAgents = agentsArr.length > 0;
  const hasStack = stackObj != null && Object.keys(stackObj).length > 0;
  const hasDomains = domainsArr.length > 0;

  // Build type imports based on what's used
  const typeImports = buildTypeImports({ hasSkills, hasAgents, hasStack, hasDomains });

  const lines: string[] = [`import type { ${typeImports} } from "./config-types";`];

  // Add named variable declarations above the export default
  if (hasSkills) {
    lines.push(``);
    const items = skillsArr.map((s) => `  ${JSON.stringify(s)},`).join("\n");
    lines.push(`const skills: SkillConfig[] = [`);
    lines.push(items);
    lines.push(`];`);
  }

  if (hasAgents) {
    lines.push(``);
    const items = agentsArr.map((a) => `  ${JSON.stringify(a)},`).join("\n");
    lines.push(`const agents: AgentScopeConfig[] = [`);
    lines.push(items);
    lines.push(`];`);
  }

  if (hasStack) {
    lines.push(``);
    const stackBody = JSON.stringify(stackObj, null, 2);
    lines.push(`const stack: Partial<Record<AgentName, StackAgentConfig>> = ${stackBody};`);
  }

  if (hasDomains) {
    lines.push(``);
    const items = domainsArr.map((d) => JSON.stringify(d)).join(", ");
    lines.push(`const domains: Domain[] = [${items}];`);
  }

  // Build export default fields
  const exportFields: string[] = [];
  for (const [key, value] of Object.entries(cleaned)) {
    if (EXTRACTED_FIELDS.has(key)) {
      if (key === "skills") {
        exportFields.push(`  skills${hasSkills ? "" : ": []"},`);
      } else if (key === "agents") {
        exportFields.push(`  agents${hasAgents ? "" : ": []"},`);
      } else if (key === "stack" && hasStack) {
        exportFields.push(`  stack,`);
      } else if (key === "domains") {
        exportFields.push(`  domains${hasDomains ? "" : ": []"},`);
      }
    } else {
      exportFields.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
    }
  }

  lines.push(``);
  lines.push(`export default {`);
  lines.push(...exportFields);
  lines.push(`} satisfies ProjectConfig;`);

  lines.push(``);
  return lines.join("\n");
}

/**
 * Builds the type import list based on which extracted fields are present.
 * ProjectConfig is always included. Other types are included only when used.
 */
function buildTypeImports(flags: {
  hasSkills: boolean;
  hasAgents: boolean;
  hasStack: boolean;
  hasDomains: boolean;
}): string {
  const types: string[] = [];
  if (flags.hasStack) types.push("AgentName");
  if (flags.hasAgents) types.push("AgentScopeConfig");
  if (flags.hasDomains) types.push("Domain");
  types.push("ProjectConfig");
  if (flags.hasSkills) types.push("SkillConfig");
  if (flags.hasStack) types.push("StackAgentConfig");
  return types.join(", ");
}

/**
 * Generates a project config source that imports from the global config and extends it.
 * Typed named variables are declared above the export default. The export default at
 * the bottom acts as a table of contents. Arrays (skills, agents, domains) are spread
 * with globalConfig first, then project items.
 */
function generateProjectConfigWithGlobalImport(
  cleaned: Record<string, unknown>,
  globalImportPath: string,
): string {
  const importPath = `${globalImportPath}/config`;

  // Boundary cast: cleaned comes from JSON.parse(JSON.stringify(...)) so arrays are plain JSON values
  const skillsArr = (cleaned.skills as unknown[]) ?? [];
  const agentsArr = (cleaned.agents as unknown[]) ?? [];
  const stackObj = cleaned.stack as Record<string, unknown> | undefined;
  const domainsArr = (cleaned.domains as unknown[]) ?? [];
  const selectedAgentsArr = (cleaned.selectedAgents as string[]) ?? [];

  const hasProjectDomains = domainsArr.length > 0;
  const hasStack = stackObj != null && Object.keys(stackObj).length > 0;
  const hasProjectSelectedAgents = selectedAgentsArr.length > 0;

  // Build type imports
  const typeImports = buildTypeImports({
    hasSkills: true, // Always present (spread from global)
    hasAgents: true, // Always present (spread from global)
    hasStack,
    hasDomains: hasProjectDomains,
  });

  const lines: string[] = [
    `import globalConfig from "${importPath}";`,
    `import type { ${typeImports} } from "./config-types";`,
  ];

  // Skills variable (always present with global spread)
  lines.push(``);
  const skillItems = skillsArr.map((s) => `  ${JSON.stringify(s)},`).join("\n");
  lines.push(`const skills: SkillConfig[] = [`);
  lines.push(`  ...globalConfig.skills,`);
  if (skillItems) lines.push(skillItems);
  lines.push(`];`);

  // Agents variable (always present with global spread)
  lines.push(``);
  const agentItems = agentsArr.map((a) => `  ${JSON.stringify(a)},`).join("\n");
  lines.push(`const agents: AgentScopeConfig[] = [`);
  lines.push(`  ...globalConfig.agents,`);
  if (agentItems) lines.push(agentItems);
  lines.push(`];`);

  // Stack variable (only if project has stack assignments)
  if (hasStack) {
    lines.push(``);
    const stackBody = JSON.stringify(stackObj, null, 2);
    lines.push(`const stack: Partial<Record<AgentName, StackAgentConfig>> = ${stackBody};`);
  }

  // Domains variable (only if project has domains)
  if (hasProjectDomains) {
    lines.push(``);
    const domainItems = domainsArr.map((d) => `  ${JSON.stringify(d)},`).join("\n");
    lines.push(`const domains: Domain[] = [`);
    lines.push(`  ...(globalConfig.domains ?? []),`);
    if (domainItems) lines.push(domainItems);
    lines.push(`];`);
  }

  // Build scalar fields (everything that isn't an extracted field, name, or selectedAgents)
  const scalarFields = Object.entries(cleaned)
    .filter(([key]) => !EXTRACTED_FIELDS.has(key) && key !== "name" && key !== "selectedAgents")
    .map(([key, value]) => `  ${JSON.stringify(key)}: ${JSON.stringify(value)},`)
    .join("\n");

  // Build export default (table of contents at bottom)
  const exportFields: string[] = [`  ...globalConfig,`];
  // Ensure project config never inherits "global" as its name from the globalConfig spread
  const projectName =
    cleaned.name && cleaned.name !== "global" ? cleaned.name : DEFAULT_PLUGIN_NAME;
  exportFields.push(`  name: ${JSON.stringify(projectName)},`);
  exportFields.push(`  skills,`);
  exportFields.push(`  agents,`);
  if (hasStack) {
    exportFields.push(`  stack,`);
  }
  if (hasProjectDomains) {
    exportFields.push(`  domains,`);
  }
  // selectedAgents: spread global + project-scoped agents
  if (hasProjectSelectedAgents) {
    const projectAgentItems = selectedAgentsArr.map((a) => `${JSON.stringify(a)}`).join(", ");
    exportFields.push(
      `  "selectedAgents": [...(globalConfig.selectedAgents ?? []), ${projectAgentItems}],`,
    );
  }
  if (scalarFields) {
    exportFields.push(scalarFields);
  }

  lines.push(``);
  lines.push(`export default {`);
  lines.push(...exportFields);
  lines.push(`} satisfies ProjectConfig;`);

  lines.push(``);
  return lines.join("\n");
}

/**
 * Generates a project config with global skills/agents inlined directly.
 * No `import globalConfig` — the output is a self-contained readable snapshot.
 * Global items appear first with a `// global` comment, followed by project items
 * with a `// project` comment (only when project items exist).
 */
function generateProjectConfigWithInlinedGlobal(
  cleaned: Record<string, unknown>,
  cleanedGlobal: Record<string, unknown>,
): string {
  // Boundary cast: cleaned comes from JSON.parse(JSON.stringify(...)) so arrays are plain JSON values
  const projectSkillsArr = (cleaned.skills as unknown[]) ?? [];
  const projectAgentsArr = (cleaned.agents as unknown[]) ?? [];
  const projectStackObj = cleaned.stack as Record<string, unknown> | undefined;
  const projectDomainsArr = (cleaned.domains as unknown[]) ?? [];
  const projectSelectedAgentsArr = (cleaned.selectedAgents as string[]) ?? [];

  // Excluded globals are routed to the project partition by splitConfigByScope,
  // but should render under "// global" in the output for readability
  const excludedGlobalSkills = projectSkillsArr.filter(
    (s) => (s as { excluded?: boolean }).excluded,
  );
  const excludedGlobalAgents = projectAgentsArr.filter(
    (a) => (a as { excluded?: boolean }).excluded,
  );
  const actualProjectSkills = projectSkillsArr.filter(
    (s) => !(s as { excluded?: boolean }).excluded,
  );
  const actualProjectAgents = projectAgentsArr.filter(
    (a) => !(a as { excluded?: boolean }).excluded,
  );

  // When inlining, replace active global entries with their excluded tombstones.
  // The tombstone masks the global entry for this project; the active project entry (if any)
  // appears separately in the project section.
  const excludedSkillIds = new Set(excludedGlobalSkills.map((s) => (s as { id: string }).id));
  const excludedAgentNames = new Set(
    excludedGlobalAgents.map((a) => (a as { name: string }).name),
  );
  const globalSkillsArr = [
    ...((cleanedGlobal.skills as unknown[]) ?? []).filter(
      (s) => !excludedSkillIds.has((s as { id: string }).id),
    ),
    ...excludedGlobalSkills,
  ];
  const globalAgentsArr = [
    ...((cleanedGlobal.agents as unknown[]) ?? []).filter(
      (a) => !excludedAgentNames.has((a as { name: string }).name),
    ),
    ...excludedGlobalAgents,
  ];
  const globalDomainsArr = (cleanedGlobal.domains as unknown[]) ?? [];
  const globalSelectedAgentsArr = (cleanedGlobal.selectedAgents as string[]) ?? [];

  const hasGlobalSkills = globalSkillsArr.length > 0;
  const hasProjectSkills = actualProjectSkills.length > 0;
  const hasSkills = hasGlobalSkills || hasProjectSkills;

  const hasGlobalAgents = globalAgentsArr.length > 0;
  const hasProjectAgents = actualProjectAgents.length > 0;
  const hasAgents = hasGlobalAgents || hasProjectAgents;

  // Merge global and project stack entries — inlined config must be self-contained
  const globalStackObj = cleanedGlobal.stack as Record<string, unknown> | undefined;
  const projectAgentNames = new Set(actualProjectAgents.map((a) => (a as { name: string }).name));
  const projectOnlyStack: Record<string, unknown> = projectStackObj
    ? Object.fromEntries(
        Object.entries(projectStackObj).filter(([agent]) => projectAgentNames.has(agent)),
      )
    : {};
  const mergedStack: Record<string, unknown> = { ...(globalStackObj ?? {}), ...projectOnlyStack };
  const hasStack = Object.keys(mergedStack).length > 0;

  const hasGlobalDomains = globalDomainsArr.length > 0;
  const hasProjectDomains = projectDomainsArr.length > 0;
  const hasDomains = hasGlobalDomains || hasProjectDomains;

  const typeImports = buildTypeImports({ hasSkills, hasAgents, hasStack, hasDomains });

  const lines: string[] = [`import type { ${typeImports} } from "./config-types";`];

  // Skills variable
  if (hasSkills) {
    lines.push(``);
    lines.push(`const skills: SkillConfig[] = [`);
    if (hasGlobalSkills) {
      lines.push(`  // global`);
      for (const s of globalSkillsArr) {
        lines.push(`  ${JSON.stringify(s)},`);
      }
    }
    if (hasProjectSkills) {
      lines.push(`  // project`);
      for (const s of actualProjectSkills) {
        lines.push(`  ${JSON.stringify(s)},`);
      }
    }
    lines.push(`];`);
  }

  // Agents variable
  if (hasAgents) {
    lines.push(``);
    lines.push(`const agents: AgentScopeConfig[] = [`);
    if (hasGlobalAgents) {
      lines.push(`  // global`);
      for (const a of globalAgentsArr) {
        lines.push(`  ${JSON.stringify(a)},`);
      }
    }
    if (hasProjectAgents) {
      lines.push(`  // project`);
      for (const a of actualProjectAgents) {
        lines.push(`  ${JSON.stringify(a)},`);
      }
    }
    lines.push(`];`);
  }

  // Stack variable (merged global + project)
  if (hasStack) {
    lines.push(``);
    const stackBody = JSON.stringify(mergedStack, null, 2);
    lines.push(`const stack: Partial<Record<AgentName, StackAgentConfig>> = ${stackBody};`);
  }

  // Domains variable
  if (hasDomains) {
    lines.push(``);
    const allDomains = [...new Set([...globalDomainsArr, ...projectDomainsArr])];
    const items = allDomains.map((d) => JSON.stringify(d)).join(", ");
    lines.push(`const domains: Domain[] = [${items}];`);
  }

  // Build export default with inlined global scalar fields
  const projectName =
    cleaned.name && cleaned.name !== "global" ? cleaned.name : DEFAULT_PLUGIN_NAME;

  const exportFields: string[] = [];
  exportFields.push(`  name: ${JSON.stringify(projectName)},`);

  // Project scalar fields (these take precedence over global)
  const projectScalarFields = Object.entries(cleaned).filter(
    ([key]) => !EXTRACTED_FIELDS.has(key) && key !== "name" && key !== "selectedAgents",
  );
  const projectScalarKeys = new Set(projectScalarFields.map(([key]) => key));

  // Global scalar fields (only emit if not overridden by project)
  const globalScalarFields = Object.entries(cleanedGlobal).filter(
    ([key]) =>
      !EXTRACTED_FIELDS.has(key) &&
      key !== "name" &&
      key !== "selectedAgents" &&
      !projectScalarKeys.has(key),
  );

  for (const [key, value] of globalScalarFields) {
    exportFields.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  }
  for (const [key, value] of projectScalarFields) {
    exportFields.push(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
  }

  if (hasSkills) {
    exportFields.push(`  skills,`);
  } else {
    exportFields.push(`  skills: [],`);
  }

  if (hasAgents) {
    exportFields.push(`  agents,`);
  } else {
    exportFields.push(`  agents: [],`);
  }

  if (hasStack) {
    exportFields.push(`  stack,`);
  }

  if (hasDomains) {
    exportFields.push(`  domains,`);
  }

  // Merge selectedAgents from global + project (deduplicated)
  const allSelectedAgents = [...new Set([...globalSelectedAgentsArr, ...projectSelectedAgentsArr])];
  if (allSelectedAgents.length > 0) {
    const items = allSelectedAgents.map((a) => JSON.stringify(a)).join(", ");
    exportFields.push(`  "selectedAgents": [${items}],`);
  }

  lines.push(``);
  lines.push(`export default {`);
  lines.push(...exportFields);
  lines.push(`} satisfies ProjectConfig;`);

  lines.push(``);
  return lines.join("\n");
}

/**
 * Compacts individual SkillAssignment objects within stack arrays
 * WITHOUT collapsing single-element arrays to bare values.
 * - { id: "...", preloaded: false } → "..." (bare string in array)
 * - { id: "...", preloaded: true } → { id: "...", preloaded: true } (preserved)
 *
 * This is used for the inlined TypeScript config path where arrays must remain
 * as arrays to satisfy the StackAgentConfig type (SkillAssignment[]).
 */
function compactStackAssignments(
  stack: Record<string, Record<string, unknown[]>>,
): Record<string, Record<string, unknown[]>> {
  const result: Record<string, Record<string, unknown[]>> = {};
  for (const [agent, categories] of Object.entries(stack)) {
    const compactedCategories: Record<string, unknown[]> = {};
    for (const [category, assignments] of Object.entries(categories)) {
      if (!Array.isArray(assignments) || assignments.length === 0) continue;
      compactedCategories[category] = assignments.map((a) => {
        if (typeof a === "object" && a !== null && "id" in a && "preloaded" in a) {
          const assignment = a as { id: string; preloaded: boolean };
          return assignment.preloaded ? { id: assignment.id, preloaded: true } : assignment.id;
        }
        return a;
      });
    }
    if (Object.keys(compactedCategories).length > 0) {
      result[agent] = compactedCategories;
    }
  }
  return result;
}

/**
 * Returns the absolute path to the global .claude-src directory.
 * Used as the import path for project configs that extend global.
 */
export function getGlobalConfigImportPath(): string {
  return path.join(os.homedir(), CLAUDE_SRC_DIR);
}

/**
 * Generates a blank global config source (empty arrays, no import preamble).
 */
export function generateBlankGlobalConfigSource(): string {
  return `import type { ProjectConfig } from "./config-types";

export default {
  "name": "global",
  "skills": [],
  "agents": [],
  "domains": []
} satisfies ProjectConfig;\n`;
}

/**
 * Generates blank global config-types source (all types are `never`).
 */
export function generateBlankGlobalConfigTypesSource(): string {
  return `// AUTO-GENERATED by agentsinc — DO NOT EDIT

export type SkillId = never;

export type AgentName = never;

export type Domain = never;

export type Category = never;

${PROJECT_CONFIG_TYPES_BEFORE}
export type StackAgentConfig = Partial<Record<Category, SkillAssignment[]>>;

${PROJECT_CONFIG_INTERFACE_AFTER}`;
}

/**
 * Ensures a blank global config exists at ~/.claude-src/.
 * Creates config.ts (empty arrays) and config-types.ts (never types) if they don't exist.
 * Returns true if files were created, false if they already existed.
 */
export async function ensureBlankGlobalConfig(): Promise<boolean> {
  const globalConfigDir = path.join(os.homedir(), CLAUDE_SRC_DIR);
  const configPath = path.join(globalConfigDir, STANDARD_FILES.CONFIG_TS);

  if (await fileExists(configPath)) {
    verbose("Global config already exists, skipping blank creation");
    return false;
  }

  await ensureDir(globalConfigDir);

  const configSource = generateBlankGlobalConfigSource();
  const typesSource = generateBlankGlobalConfigTypesSource();

  await writeFile(configPath, configSource);
  await writeFile(path.join(globalConfigDir, STANDARD_FILES.CONFIG_TYPES_TS), typesSource);

  verbose(`Created blank global config at ${globalConfigDir}`);
  return true;
}
