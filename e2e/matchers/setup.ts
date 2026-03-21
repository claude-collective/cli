import { expect } from "vitest";
import { projectMatchers } from "./project-matchers.js";

expect.extend(projectMatchers);

type AgentContentExpectations = {
  contains?: string[];
  notContains?: string[];
};

type SettingsExpectations = {
  hasKey?: string;
  keyValue?: unknown;
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
  }
}
