import type { SkillId, AgentName } from "../../types/index.js";
import type { ProjectConfig } from "../../types/index.js";
import type { WizardResultV2 } from "../../components/wizard/wizard.js";

export type ConfigChanges = {
  addedSkills: SkillId[];
  removedSkills: SkillId[];
  addedAgents: AgentName[];
  removedAgents: AgentName[];
  sourceChanges: Map<SkillId, { from: string; to: string }>;
  scopeChanges: Map<SkillId, { from: "project" | "global"; to: "project" | "global" }>;
  agentScopeChanges: Map<AgentName, { from: "project" | "global"; to: "project" | "global" }>;
};

/**
 * Computes the diff between an existing project config and a new wizard result.
 *
 * Detects added/removed skills and agents, skill source changes,
 * skill scope changes, and agent scope changes.
 *
 * Pure function - no side effects, no logging.
 */
export function detectConfigChanges(
  oldConfig: ProjectConfig | null,
  wizardResult: WizardResultV2,
  currentSkillIds: SkillId[],
): ConfigChanges {
  const newSkillIds = wizardResult.skills.map((s) => s.id);
  const addedSkills = newSkillIds.filter((id) => !currentSkillIds.includes(id));
  const removedSkills = currentSkillIds.filter((id) => !newSkillIds.includes(id));

  const oldAgentNames = oldConfig?.agents?.map((a) => a.name) ?? [];
  const newAgentNames = wizardResult.agentConfigs.map((a) => a.name);
  const addedAgents = newAgentNames.filter((name) => !oldAgentNames.includes(name));
  const removedAgents = oldAgentNames.filter((name) => !newAgentNames.includes(name));

  const sourceChanges = new Map<SkillId, { from: string; to: string }>();
  const scopeChanges = new Map<
    SkillId,
    { from: "project" | "global"; to: "project" | "global" }
  >();
  if (oldConfig?.skills) {
    for (const newSkill of wizardResult.skills) {
      const oldSkill = oldConfig.skills.find((s) => s.id === newSkill.id);
      if (oldSkill && oldSkill.source !== newSkill.source) {
        sourceChanges.set(newSkill.id, {
          from: oldSkill.source,
          to: newSkill.source,
        });
      }
      if (oldSkill && oldSkill.scope !== newSkill.scope) {
        scopeChanges.set(newSkill.id, {
          from: oldSkill.scope,
          to: newSkill.scope,
        });
      }
    }
  }

  const agentScopeChanges = new Map<
    AgentName,
    { from: "project" | "global"; to: "project" | "global" }
  >();
  if (oldConfig?.agents) {
    for (const newAgent of wizardResult.agentConfigs) {
      const oldAgent = oldConfig.agents.find((a) => a.name === newAgent.name);
      if (oldAgent && oldAgent.scope !== newAgent.scope) {
        agentScopeChanges.set(newAgent.name, {
          from: oldAgent.scope,
          to: newAgent.scope,
        });
      }
    }
  }

  return {
    addedSkills,
    removedSkills,
    addedAgents,
    removedAgents,
    sourceChanges,
    scopeChanges,
    agentScopeChanges,
  };
}
