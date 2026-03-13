import os from "os";
import path from "path";
import type { ProjectConfig } from "../../types";
import { CLAUDE_SRC_DIR, DEFAULT_PLUGIN_NAME, STANDARD_FILES } from "../../consts";
import { fileExists, ensureDir, writeFile } from "../../utils/fs";
import { verbose } from "../../utils/logger";
import { compactStackForYaml } from "./config-generator";
import { PROJECT_CONFIG_TYPES_BEFORE, PROJECT_CONFIG_INTERFACE_AFTER } from "./config-types-writer";

export type ConfigSourceOptions = {
  /**
   * When true, generates a project config that imports and extends the global config.
   * The global config import path is resolved internally via `getGlobalConfigImportPath()`.
   */
  isProjectConfig?: boolean;
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
  const serializable = config.stack
    ? { ...config, stack: compactStackForYaml(config.stack) }
    : { ...config };

  // JSON.parse(JSON.stringify(x)) removes undefined values
  const cleaned: Record<string, unknown> = JSON.parse(JSON.stringify(serializable));

  if (options?.isProjectConfig) {
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
export type StackAgentConfig = Partial<Record<Category, SkillAssignment>>;

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
