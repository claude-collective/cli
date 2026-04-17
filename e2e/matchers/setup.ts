import { expect } from "vitest";
import { agentMatchers } from "./agent-matchers.js";
import { projectMatchers } from "./project-matchers.js";

expect.extend({ ...projectMatchers, ...agentMatchers });

type AgentContentExpectations = {
  contains?: string[];
  notContains?: string[];
};

type SettingsExpectations = {
  hasKey?: string;
  keyValue?: unknown;
};

type AgentFrontmatterExpectations = {
  name?: string;
  description?: string;
  model?: string;
  tools?: string[];
  skills?: string[];
  hasSkills?: boolean;
  noSkills?: boolean;
};

type AgentDynamicSkillsExpectations = {
  skillIds?: string[];
  noSkillIds?: string[];
  hasActivationProtocol?: boolean;
  allPreloaded?: boolean;
};

// Augment Vitest's expect types
declare module "vitest" {
  interface Assertion<T> {
    toHaveConfig(expectations?: import("./project-matchers.js").ConfigExpectations): Promise<void>;
    toHaveCompiledAgents(): Promise<void>;
    toHaveCompiledAgent(agentName: string): Promise<void>;
    toHaveCompiledAgentContent(
      agentName: string,
      expectations: AgentContentExpectations,
    ): Promise<void>;
    toHaveSkillCopied(skillId: string): Promise<void>;
    toHaveLocalSkills(expectedSkillIds?: string[]): Promise<void>;
    toHaveNoLocalSkills(): Promise<void>;
    toHaveNoPlugins(): Promise<void>;
    toHavePlugin(pluginKey: string): Promise<void>;
    toHavePluginInRegistry(
      pluginKey: string,
      scope?: import("./project-matchers.js").PluginScope,
    ): Promise<void>;
    toHaveEjectedTemplate(): Promise<void>;
    toHaveSettings(expectations?: SettingsExpectations): Promise<void>;
    toHaveAgentFrontmatter(
      agentName: string,
      expectations: AgentFrontmatterExpectations,
    ): Promise<void>;
    toHaveAgentDynamicSkills(
      agentName: string,
      expectations: AgentDynamicSkillsExpectations,
    ): Promise<void>;
  }
  interface AsymmetricMatchersContaining {
    toHaveConfig(expectations?: import("./project-matchers.js").ConfigExpectations): void;
    toHaveCompiledAgents(): void;
    toHaveCompiledAgent(agentName: string): void;
    toHaveCompiledAgentContent(agentName: string, expectations: AgentContentExpectations): void;
    toHaveSkillCopied(skillId: string): void;
    toHaveLocalSkills(expectedSkillIds?: string[]): void;
    toHaveNoLocalSkills(): void;
    toHaveNoPlugins(): void;
    toHavePlugin(pluginKey: string): void;
    toHavePluginInRegistry(
      pluginKey: string,
      scope?: import("./project-matchers.js").PluginScope,
    ): void;
    toHaveEjectedTemplate(): void;
    toHaveSettings(expectations?: SettingsExpectations): void;
    toHaveAgentFrontmatter(agentName: string, expectations: AgentFrontmatterExpectations): void;
    toHaveAgentDynamicSkills(agentName: string, expectations: AgentDynamicSkillsExpectations): void;
  }
}
