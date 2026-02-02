import path from "path";
import { fileExists } from "../utils/fs";
import { getDirs, type CompileMode } from "./loader";
import { verbose } from "../utils/logger";
import type {
  AgentConfig,
  AgentDefinition,
  CompileAgentConfig,
  CompileConfig,
  Skill,
  SkillAssignment,
  SkillDefinition,
  SkillReference,
  StackConfig,
} from "../types";
import type { Stack, StackAgentConfig } from "../types-stacks";

export async function resolveTemplate(
  projectRoot: string,
  stackId: string,
  mode: CompileMode = "dev",
): Promise<string> {
  const dirs = getDirs(mode);
  const stackTemplate = path.join(
    projectRoot,
    dirs.stacks,
    stackId,
    "agent.liquid",
  );
  if (await fileExists(stackTemplate)) return stackTemplate;

  return path.join(projectRoot, dirs.templates, "agent.liquid");
}

export async function resolveClaudeMd(
  projectRoot: string,
  stackId: string,
  mode: CompileMode = "dev",
): Promise<string> {
  const dirs = getDirs(mode);
  const stackClaude = path.join(projectRoot, dirs.stacks, stackId, "CLAUDE.md");
  if (await fileExists(stackClaude)) return stackClaude;

  throw new Error(
    `Stack '${stackId}' is missing required CLAUDE.md file. Expected at: ${stackClaude}`,
  );
}

export function resolveSkillReference(
  ref: SkillReference,
  skills: Record<string, SkillDefinition>,
): Skill {
  const definition = skills[ref.id];
  if (!definition) {
    const availableSkills = Object.keys(skills);
    const skillList =
      availableSkills.length > 0
        ? `Available skills: ${availableSkills.slice(0, 5).join(", ")}${availableSkills.length > 5 ? ` (and ${availableSkills.length - 5} more)` : ""}`
        : "No skills found in scanned directories";
    throw new Error(
      `Skill '${ref.id}' not found in scanned skills. ${skillList}`,
    );
  }
  return {
    id: ref.id,
    path: definition.path,
    name: definition.name,
    description: definition.description,
    usage: ref.usage,
    preloaded: ref.preloaded ?? false,
  };
}

export function resolveSkillReferences(
  skillRefs: SkillReference[],
  skills: Record<string, SkillDefinition>,
): Skill[] {
  return skillRefs.map((ref) => resolveSkillReference(ref, skills));
}

function getStackSkillIds(stackSkills: SkillAssignment[]): string[] {
  return stackSkills.map((s) => s.id);
}

function flattenAgentSkills(
  categorizedSkills: Record<string, SkillAssignment[]>,
): SkillAssignment[] {
  const assignments: SkillAssignment[] = [];
  for (const category of Object.keys(categorizedSkills)) {
    assignments.push(...categorizedSkills[category]);
  }
  return assignments;
}

function expandSkillIdIfDirectory(
  skillId: string,
  skills: Record<string, SkillDefinition>,
): string[] {
  if (skills[skillId]) {
    return [skillId];
  }

  // Use path as unique key to deduplicate (both frontmatter name and directory path map to same skill)
  const allSkillIds = Object.keys(skills);
  const seenPaths = new Set<string>();
  const matchingSkills: string[] = [];

  for (const id of allSkillIds) {
    const skillDef = skills[id];
    if (skillDef.path.startsWith(`src/skills/${skillId}/`)) {
      if (!seenPaths.has(skillDef.path)) {
        seenPaths.add(skillDef.path);
        matchingSkills.push(id);
      }
    }
  }

  if (matchingSkills.length > 0) {
    return matchingSkills;
  }

  return [skillId];
}

/**
 * Resolve skills from agent's skills field (Phase 6: agent-centric configuration)
 * Converts agent's skills Record to SkillReference array
 *
 * @deprecated Use resolveAgentSkillsFromStack for Phase 7 agent-centric configuration
 */
export function resolveAgentSkills(
  agentDef: AgentDefinition,
): SkillReference[] {
  if (!agentDef.skills) return [];

  return Object.entries(agentDef.skills).map(([category, entry]) => ({
    id: entry.id,
    usage: `when working with ${category}`,
    preloaded: entry.preloaded,
  }));
}

/**
 * Subcategories considered "key" skills that should be preloaded.
 * These are primary technology choices that define the stack's core.
 */
const KEY_SUBCATEGORIES = new Set([
  "framework",
  "api",
  "database",
  "meta-framework",
  "base-framework",
  "platform",
]);

/**
 * Resolve skills for an agent from a Stack definition (Phase 7 format).
 * Takes a stack and skill aliases, returns skill references for the specified agent.
 *
 * @param agentName - The agent ID to resolve skills for
 * @param stack - The stack definition with agent technology selections
 * @param skillAliases - Mapping from technology aliases to full skill IDs
 * @returns Array of SkillReference objects for the agent
 *
 * @example
 * ```typescript
 * const stack = {
 *   id: 'nextjs-fullstack',
 *   agents: {
 *     'web-developer': { framework: 'react', styling: 'scss-modules' }
 *   }
 * };
 *
 * const aliases = { react: 'web-framework-react', ... };
 *
 * const skills = resolveAgentSkillsFromStack('web-developer', stack, aliases);
 * // Returns: [{ id: 'web-framework-react', usage: '...', preloaded: true }, ...]
 * ```
 */
export function resolveAgentSkillsFromStack(
  agentName: string,
  stack: Stack,
  skillAliases: Record<string, string>,
): SkillReference[] {
  const agentConfig = stack.agents[agentName];

  // Agent not in this stack
  if (!agentConfig) {
    verbose(`Agent '${agentName}' not found in stack '${stack.id}'`);
    return [];
  }

  // Empty config {} means agent has no technology-specific skills
  if (Object.keys(agentConfig).length === 0) {
    verbose(
      `Agent '${agentName}' has no technology config in stack '${stack.id}'`,
    );
    return [];
  }

  const skillRefs: SkillReference[] = [];

  for (const [subcategory, technologyAlias] of Object.entries(agentConfig)) {
    const fullSkillId = skillAliases[technologyAlias];

    if (!fullSkillId) {
      verbose(
        `Warning: No skill alias found for '${technologyAlias}' (agent: ${agentName}, subcategory: ${subcategory}). Skipping.`,
      );
      continue;
    }

    const isKeySkill = KEY_SUBCATEGORIES.has(subcategory);

    skillRefs.push({
      id: fullSkillId,
      usage: `when working with ${subcategory}`,
      preloaded: isKeySkill,
    });
  }

  verbose(
    `Resolved ${skillRefs.length} skills for agent '${agentName}' from stack '${stack.id}'`,
  );

  return skillRefs;
}

export function resolveStackSkills(
  stack: StackConfig,
  agentName: string,
  skills: Record<string, SkillDefinition>,
): SkillReference[] {
  const skillRefs: SkillReference[] = [];

  const agentSkillCategories = stack.agent_skills?.[agentName];
  const assignments: SkillAssignment[] = agentSkillCategories
    ? flattenAgentSkills(agentSkillCategories)
    : stack.skills;

  const validSkillIds = new Set<string>();
  for (const s of stack.skills) {
    const expandedIds = expandSkillIdIfDirectory(s.id, skills);
    for (const id of expandedIds) {
      validSkillIds.add(id);
    }
  }

  const addedSkills = new Set<string>();

  for (const assignment of assignments) {
    const skillId = assignment.id;
    const expandedSkillIds = expandSkillIdIfDirectory(skillId, skills);

    for (const expandedId of expandedSkillIds) {
      if (addedSkills.has(expandedId)) {
        continue;
      }

      if (!skills[expandedId]) {
        throw new Error(
          `Stack "${stack.name}" references skill "${expandedId}" for agent "${agentName}" not found in scanned skills`,
        );
      }

      if (agentSkillCategories && !validSkillIds.has(expandedId)) {
        throw new Error(
          `Stack "${stack.name}" agent_skills for "${agentName}" includes skill "${expandedId}" not in stack's skills array`,
        );
      }

      const skillDef = skills[expandedId];
      skillRefs.push({
        id: expandedId,
        usage: `when working with ${skillDef.name.toLowerCase()}`,
        preloaded: assignment.preloaded ?? false,
      });

      addedSkills.add(expandedId);
    }
  }

  return skillRefs;
}

/**
 * Options for getAgentSkills function.
 * Supports both Phase 6 (agent-centric) and Phase 7 (stack-based) configurations.
 */
export interface GetAgentSkillsOptions {
  /** The agent name/ID */
  agentName: string;
  /** Per-agent compile config (may have explicit skills) */
  agentConfig: CompileAgentConfig;
  /** Overall compile config */
  compileConfig: CompileConfig;
  /** All available skill definitions */
  skills: Record<string, SkillDefinition>;
  /** Project root path */
  projectRoot: string;
  /** Agent definition (Phase 6) */
  agentDef?: AgentDefinition;
  /** Stack definition (Phase 7) */
  stack?: Stack;
  /** Skill aliases mapping (Phase 7) */
  skillAliases?: Record<string, string>;
}

/**
 * Get skill references for an agent.
 * Supports multiple resolution strategies with the following priority:
 *
 * 1. Explicit skills in compile config (agentConfig.skills)
 * 2. Stack-based skills (Phase 7) if stack and skillAliases provided
 * 3. Agent definition skills (Phase 6) if agentDef.skills provided
 *
 * @param options - Configuration options for skill resolution
 * @returns Array of SkillReference objects
 */
export async function getAgentSkills(
  agentName: string,
  agentConfig: CompileAgentConfig,
  _compileConfig: CompileConfig,
  _skills: Record<string, SkillDefinition>,
  _projectRoot: string,
  agentDef?: AgentDefinition,
  stack?: Stack,
  skillAliases?: Record<string, string>,
): Promise<SkillReference[]> {
  // Priority 1: Explicit skills in compile config
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    return agentConfig.skills;
  }

  // Priority 2: Stack-based skills (Phase 7)
  if (stack && skillAliases) {
    const stackSkills = resolveAgentSkillsFromStack(
      agentName,
      stack,
      skillAliases,
    );
    if (stackSkills.length > 0) {
      verbose(
        `Resolved ${stackSkills.length} skills from stack for ${agentName}`,
      );
      return stackSkills;
    }
  }

  // Priority 3: Agent's own skills field (Phase 6: agent-centric configuration)
  if (agentDef?.skills && Object.keys(agentDef.skills).length > 0) {
    verbose(`Resolving skills from agent definition for ${agentName}`);
    return resolveAgentSkills(agentDef);
  }

  // No skills defined for this agent
  return [];
}

/**
 * Options for resolveAgents function.
 */
export interface ResolveAgentsOptions {
  /** All loaded agent definitions */
  agents: Record<string, AgentDefinition>;
  /** All loaded skill definitions */
  skills: Record<string, SkillDefinition>;
  /** Compile configuration */
  compileConfig: CompileConfig;
  /** Project root path */
  projectRoot: string;
  /** Stack definition (Phase 7) - optional */
  stack?: Stack;
  /** Skill aliases mapping (Phase 7) - optional */
  skillAliases?: Record<string, string>;
}

export async function resolveAgents(
  agents: Record<string, AgentDefinition>,
  skills: Record<string, SkillDefinition>,
  compileConfig: CompileConfig,
  projectRoot: string,
  stack?: Stack,
  skillAliases?: Record<string, string>,
): Promise<Record<string, AgentConfig>> {
  const resolved: Record<string, AgentConfig> = {};
  const agentNames = Object.keys(compileConfig.agents);

  for (const agentName of agentNames) {
    const definition = agents[agentName];
    if (!definition) {
      const availableAgents = Object.keys(agents);
      const agentList =
        availableAgents.length > 0
          ? `Available agents: ${availableAgents.slice(0, 5).join(", ")}${availableAgents.length > 5 ? ` (and ${availableAgents.length - 5} more)` : ""}`
          : "No agents found in scanned directories";
      throw new Error(
        `Agent '${agentName}' referenced in compile config but not found in scanned agents. ${agentList}. Check that src/agents/${agentName}/agent.yaml exists.`,
      );
    }

    const agentConfig = compileConfig.agents[agentName];

    const skillRefs = await getAgentSkills(
      agentName,
      agentConfig,
      compileConfig,
      skills,
      projectRoot,
      definition,
      stack,
      skillAliases,
    );

    const resolvedSkills = resolveSkillReferences(skillRefs, skills);

    resolved[agentName] = {
      name: agentName,
      title: definition.title,
      description: definition.description,
      model: definition.model,
      tools: definition.tools,
      skills: resolvedSkills,
      path: definition.path,
      sourceRoot: definition.sourceRoot,
    };
  }

  return resolved;
}

export function stackToCompileConfig(
  stackId: string,
  stack: StackConfig,
): CompileConfig {
  const agents: Record<string, CompileAgentConfig> = {};

  for (const agentId of stack.agents) {
    agents[agentId] = {};
  }

  return {
    name: stack.name,
    description: stack.description || "",
    claude_md: "",
    stack: stackId,
    agents,
  };
}
