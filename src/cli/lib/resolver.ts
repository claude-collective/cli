import path from "path";
import { fileExists } from "../utils/fs";
import { DIRS } from "../consts";
import { loadStack, getDirs, type CompileMode } from "./loader";
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

export async function getAgentSkills(
  agentName: string,
  agentConfig: CompileAgentConfig,
  compileConfig: CompileConfig,
  skills: Record<string, SkillDefinition>,
  projectRoot: string,
): Promise<SkillReference[]> {
  if (agentConfig.skills && agentConfig.skills.length > 0) {
    return agentConfig.skills;
  }

  if (compileConfig.stack) {
    console.log(
      `  Resolving skills from stack "${compileConfig.stack}" for ${agentName}`,
    );
    const stack = await loadStack(compileConfig.stack, projectRoot);
    return resolveStackSkills(stack, agentName, skills);
  }

  return [];
}

export async function resolveAgents(
  agents: Record<string, AgentDefinition>,
  skills: Record<string, SkillDefinition>,
  compileConfig: CompileConfig,
  projectRoot: string,
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
