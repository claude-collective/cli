import type {
  AgentName,
  AgentScopeConfig,
  DomainSelections,
  MergedSkillsMatrix,
  ProjectConfig,
  SkillConfig,
} from "../../../types";
import type { WizardResultV2 } from "../../../components/wizard/wizard";
import type { SourceLoadResult } from "../../loading/source-loader";
import type { ResolvedConfig } from "../../configuration/config";
import type { TestProjectConfig } from "../fixtures/create-test-source";
import { buildSkillConfigs } from "../helpers/wizard-simulation.js";

export function buildSourceConfig(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    source: "github:test-org/skills",
    ...overrides,
  };
}

export function buildProjectConfig(overrides?: Partial<ProjectConfig>): ProjectConfig {
  return {
    name: "test-project",
    agents: [{ name: "web-developer", scope: "project" }],
    skills: buildSkillConfigs(["web-framework-react"]),
    ...overrides,
  };
}

export function buildWizardResult(
  skills: SkillConfig[],
  overrides?: Partial<WizardResultV2>,
): WizardResultV2 {
  return {
    skills,
    selectedAgents: [],
    agentConfigs: [],
    selectedStackId: null,
    domainSelections: {} as DomainSelections,
    selectedDomains: [],
    cancelled: false,
    validation: { valid: true, errors: [], warnings: [] },
    ...overrides,
  };
}

export function buildAgentConfigs(
  agentNames: string[],
  overrides?: Partial<Omit<AgentScopeConfig, "name">>,
): AgentScopeConfig[] {
  return agentNames.map((name) => ({
    // Boundary cast: test factory accepts arbitrary agent names for test isolation
    name: name as AgentName,
    scope: overrides?.scope ?? "project",
    ...(overrides?.excluded !== undefined && { excluded: overrides.excluded }),
  }));
}

export function buildSourceResult(
  matrix: MergedSkillsMatrix,
  sourcePath: string,
  overrides?: Partial<SourceLoadResult>,
): SourceLoadResult {
  const sourceConfig: ResolvedConfig = {
    source: sourcePath,
    sourceOrigin: "flag",
  };
  return {
    matrix,
    sourceConfig,
    sourcePath,
    isLocal: true,
    ...overrides,
  };
}

export function buildTestProjectConfig(
  agents: string[],
  skills: Array<string | { id: string }>,
  overrides?: Partial<TestProjectConfig>,
): TestProjectConfig {
  return {
    name: "test-project",
    description: "Test project",
    agents,
    skills,
    ...overrides,
  };
}
