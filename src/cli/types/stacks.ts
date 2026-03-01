import type { AgentName } from "./agents";
import type { SkillAssignment } from "./skills";
import type { Subcategory } from "./matrix";

/** Maps subcategory IDs to skill assignments — always arrays (normalized at parse boundary in loadStacks) */
export type StackAgentConfig = Partial<Record<Subcategory, SkillAssignment[]>>;

/** Stack definition from config/stacks.ts */
export type Stack = {
  id: string;
  name: string;
  description: string;
  /** Agent configurations mapping agent IDs to their technology selections */
  agents: Partial<Record<AgentName, StackAgentConfig>>;
  philosophy?: string;
};

/** Top-level structure of config/stacks.ts */
export type StacksConfig = {
  stacks: Stack[];
};

/**
 * Raw stacks config as returned by loadConfig (before normalizeAgentConfig).
 * Agent config values may be bare strings, arrays, or objects — not yet normalized to SkillAssignment[].
 */
export type RawStacksConfig = {
  stacks: Array<{
    id: string;
    name: string;
    description: string;
    agents: Record<string, Record<string, unknown>>;
    philosophy?: string;
  }>;
};
