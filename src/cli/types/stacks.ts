import type { AgentName } from "./agents";
import type { SkillDisplayName } from "./skills";
import type { Subcategory } from "./matrix";

/** Maps subcategory IDs to technology display names (resolved to SkillId at load time) */
export type StackAgentConfig = Partial<Record<Subcategory, SkillDisplayName>>;

/** Stack definition from config/stacks.yaml */
export type Stack = {
  id: string;
  name: string;
  description: string;
  /** Agent configurations mapping agent IDs to their technology selections */
  agents: Partial<Record<AgentName, StackAgentConfig>>;
  philosophy?: string;
};

/** Top-level structure of config/stacks.yaml */
export type StacksConfig = {
  stacks: Stack[];
};
