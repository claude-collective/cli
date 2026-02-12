import path from "path";
import { fileExists } from "../utils/fs";
import { DIRS, KEY_SUBCATEGORIES } from "../consts";
import { verbose } from "../utils/logger";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileAgentConfig,
  CompileConfig,
  ProjectConfig,
  Skill,
  SkillDefinition,
  SkillDisplayName,
  SkillId,
  SkillReference,
  Stack,
  Subcategory,
} from "../types";
import { typedEntries, typedKeys } from "../utils/typed-object";

export async function resolveTemplate(projectRoot: string, stackId: string): Promise<string> {
  const stackTemplate = path.join(projectRoot, DIRS.stacks, stackId, "agent.liquid");
  if (await fileExists(stackTemplate)) return stackTemplate;

  return path.join(projectRoot, DIRS.templates, "agent.liquid");
}

export async function resolveClaudeMd(projectRoot: string, stackId: string): Promise<string> {
  const stackClaude = path.join(projectRoot, DIRS.stacks, stackId, "CLAUDE.md");
  if (await fileExists(stackClaude)) return stackClaude;

  throw new Error(
    `Stack '${stackId}' is missing required CLAUDE.md file. Expected at: ${stackClaude}`,
  );
}

export function resolveSkillReference(
  ref: SkillReference,
  skills: Record<SkillId, SkillDefinition>,
): Skill | null {
  const definition = skills[ref.id];
  if (!definition) {
    verbose(`Skill '${ref.id}' not found in available skills, skipping`);
    return null;
  }
  return {
    ...definition,
    usage: ref.usage,
    preloaded: ref.preloaded ?? false,
  };
}

export function resolveSkillReferences(
  skillRefs: SkillReference[],
  skills: Record<SkillId, SkillDefinition>,
): Skill[] {
  return skillRefs
    .map((ref) => resolveSkillReference(ref, skills))
    .filter((skill): skill is Skill => skill !== null);
}

// Resolve skills for an agent from a Stack definition using display-name-to-ID mappings.
export function resolveAgentSkillsFromStack(
  agentName: AgentName,
  stack: Stack,
  displayNameToId: Partial<Record<SkillDisplayName, SkillId>>,
): SkillReference[] {
  const agentConfig = stack.agents[agentName];

  // Agent not in this stack
  if (!agentConfig) {
    verbose(`Agent '${agentName}' not found in stack '${stack.id}'`);
    return [];
  }

  // Empty config {} means agent has no technology-specific skills
  if (typedKeys<Subcategory>(agentConfig).length === 0) {
    verbose(`Agent '${agentName}' has no technology config in stack '${stack.id}'`);
    return [];
  }

  const skillRefs: SkillReference[] = [];

  for (const [subcategory, technologyDisplayName] of typedEntries<Subcategory, SkillDisplayName>(
    agentConfig,
  )) {
    const fullSkillId = displayNameToId[technologyDisplayName];

    if (!fullSkillId) {
      verbose(
        `Warning: No skill found for display name '${technologyDisplayName}' (agent: ${agentName}, subcategory: ${subcategory}). Skipping.`,
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

  verbose(`Resolved ${skillRefs.length} skills for agent '${agentName}' from stack '${stack.id}'`);

  return skillRefs;
}

// Priority: explicit agentConfig.skills > stack-based skills
export async function getAgentSkills(
  agentName: AgentName,
  agentConfig: CompileAgentConfig,
  stack?: Stack,
  displayNameToId?: Partial<Record<SkillDisplayName, SkillId>>,
): Promise<SkillReference[]> {
  // Priority 1: Explicit skills in compile config
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    return agentConfig.skills;
  }

  // Priority 2: Stack-based skills (Phase 7)
  if (stack && displayNameToId) {
    const stackSkills = resolveAgentSkillsFromStack(agentName, stack, displayNameToId);
    if (stackSkills.length > 0) {
      verbose(`Resolved ${stackSkills.length} skills from stack for ${agentName}`);
      return stackSkills;
    }
  }

  // No skills defined for this agent
  return [];
}

export async function resolveAgents(
  agents: Record<AgentName, AgentDefinition>,
  skills: Record<SkillId, SkillDefinition>,
  compileConfig: CompileConfig,
  _projectRoot: string,
  stack?: Stack,
  displayNameToId?: Partial<Record<SkillDisplayName, SkillId>>,
): Promise<Record<AgentName, AgentConfig>> {
  const resolved: Record<AgentName, AgentConfig> = {} as Record<AgentName, AgentConfig>;
  const agentNames = typedKeys<AgentName>(compileConfig.agents);

  for (const agentName of agentNames) {
    const definition = agents[agentName];
    if (!definition) {
      const availableAgents = typedKeys<AgentName>(agents);
      const agentList =
        availableAgents.length > 0
          ? `Available agents: ${availableAgents.slice(0, 5).join(", ")}${availableAgents.length > 5 ? ` (and ${availableAgents.length - 5} more)` : ""}`
          : "No agents found in scanned directories";
      throw new Error(
        `Agent '${agentName}' referenced in compile config but not found in scanned agents. ${agentList}. Check that src/agents/${agentName}/agent.yaml exists.`,
      );
    }

    const agentConfig = compileConfig.agents[agentName];

    const skillRefs = await getAgentSkills(agentName, agentConfig, stack, displayNameToId);

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
      agentBaseDir: definition.agentBaseDir,
    };
  }

  return resolved;
}

export function stackToCompileConfig(stackId: string, stack: ProjectConfig): CompileConfig {
  const agents: Record<AgentName, CompileAgentConfig> = {} as Record<AgentName, CompileAgentConfig>;

  for (const agentId of stack.agents) {
    agents[agentId] = {};
  }

  return {
    name: stack.name,
    description: stack.description || "",
    stack: stackId,
    agents,
  };
}
