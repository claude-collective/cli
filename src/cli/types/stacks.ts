import type { AgentName } from "./agents";
import type { SkillAssignment } from "./skills";
import type { Subcategory } from "./matrix";

/** Maps subcategory IDs to skill assignments — always arrays (normalized at parse boundary in loadStacks) */
export type StackAgentConfig = Partial<Record<Subcategory, SkillAssignment[]>>;

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
