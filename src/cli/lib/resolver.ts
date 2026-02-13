import path from "path";
import { fileExists } from "../utils/fs";
import { DIRS } from "../consts";
import { verbose } from "../utils/logger";
import type {
  AgentConfig,
  AgentDefinition,
  AgentName,
  CompileAgentConfig,
  CompileConfig,
  ProjectConfig,
  Skill,
  SkillAssignment,
  SkillDefinition,
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

// Resolve skills for an agent from a ResolvedSubcategorySkills map (ProjectConfig.stack).
// Values are single SkillId per subcategory (post-resolution from buildStackProperty).
// Note: preloaded defaults to false here because ProjectConfig.stack loses the preloaded info
// from the original StackAgentConfig (it only stores SkillId per subcategory).
export function buildSkillRefsFromConfig(
  agentStack: Partial<Record<Subcategory, SkillId>>,
): SkillReference[] {
  const skillRefs: SkillReference[] = [];
  for (const [subcategory, skillId] of typedEntries<Subcategory, SkillId>(agentStack)) {
    if (!skillId) continue;
    skillRefs.push({
      id: skillId,
      usage: `when working with ${subcategory}`,
      preloaded: false,
    });
  }
  return skillRefs;
}

// Resolve skills for an agent from a Stack definition.
// Stack values are already SkillAssignment[] normalized by loadStacks().
export function resolveAgentSkillsFromStack(agentName: AgentName, stack: Stack): SkillReference[] {
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

  for (const [subcategory, assignments] of typedEntries<Subcategory, SkillAssignment[]>(
    agentConfig,
  )) {
    if (!assignments) continue;

    for (const assignment of assignments) {
      skillRefs.push({
        id: assignment.id,
        usage: `when working with ${subcategory}`,
        preloaded: assignment.preloaded ?? false,
      });
    }
  }

  verbose(`Resolved ${skillRefs.length} skills for agent '${agentName}' from stack '${stack.id}'`);

  return skillRefs;
}

// Priority: explicit agentConfig.skills > stack-based skills
export async function getAgentSkills(
  agentName: AgentName,
  agentConfig: CompileAgentConfig,
  stack?: Stack,
): Promise<SkillReference[]> {
  // Priority 1: Explicit skills in compile config
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    return agentConfig.skills;
  }

  // Priority 2: Stack-based skills — values are already skill IDs
  if (stack) {
    const stackSkills = resolveAgentSkillsFromStack(agentName, stack);
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

    const skillRefs = await getAgentSkills(agentName, agentConfig, stack);

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
