// Re-export operation-specific types for convenience.
// Shared types (SkillConfig, ProjectConfig, etc.) stay in their original locations.

export type { BothInstallations } from "./detect-both-installations.js";
export type { LoadSourceOptions, LoadedSource } from "./load-source.js";
export type { DashboardData } from "./get-dashboard-data.js";
export type { DetectedProject } from "./detect-project.js";
export type { AgentDefs } from "./load-agent-defs.js";
export type { SkillCopyResult } from "./copy-local-skills.js";
export type { PluginInstallResult } from "./install-plugin-skills.js";
export type { PluginUninstallResult } from "./uninstall-plugin-skills.js";
export type { SkillComparisonResults } from "./compare-skills.js";
export type { MarketplaceResult } from "./ensure-marketplace.js";
export type { ConfigWriteOptions, ConfigWriteResult } from "./write-project-config.js";
export type { CompileAgentsOptions, CompilationResult } from "./compile-agents.js";
export type { ConfigChanges } from "./detect-config-changes.js";
export type {
  ExecuteInstallationOptions,
  ExecuteInstallationResult,
} from "./execute-installation.js";
export type { RecompileProjectOptions, RecompileProjectResult } from "./recompile-project.js";
export type {
  SkillUpdateResult,
  UpdateLocalSkillsResult,
  UpdateLocalSkillsOptions,
} from "./update-local-skills.js";
export type { DiscoveredSkills } from "./discover-skills.js";
export type { ScopedSkillDir, ScopedSkillDirsResult } from "./collect-scoped-skill-dirs.js";
export type { SkillMatchResult } from "./find-skill-match.js";
export type { SkillDiffResult } from "./generate-skill-diff.js";
export type {
  ResolveSkillInfoOptions,
  ResolvedSkillInfo,
  SkillInfoResult,
} from "./resolve-skill-info.js";
export type {
  EjectAgentPartialsOptions,
  EjectAgentPartialsResult,
  EjectSkillsOptions,
  EjectSkillsResult,
  EnsureMinimalConfigOptions,
  EnsureMinimalConfigResult,
} from "./eject-project.js";
export type {
  UninstallTarget,
  SkillRemovalResult,
  AgentRemovalResult,
  UninstallPluginsResult,
  CleanupResult,
} from "./uninstall-project.js";
export type {
  SourcedSkill,
  FilterSkillsOptions,
  CopySearchedSkillResult,
} from "./search-skills.js";
export type {
  ImportedForkedFromMetadata,
  ParsedGitHubSource,
  FetchSourceOptions,
  FetchedSource,
  ImportSkillOptions,
  ImportSkillResult,
} from "./import-skill.js";
export type { PluginScopeMigrationResult } from "./migrate-plugin-scope.js";
export type {
  NewAgentInput,
  LoadMetaAgentOptions,
  InvokeMetaAgentOptions,
} from "./scaffold-agent.js";
export type {
  ScaffoldSkillOptions,
  ScaffoldSkillResult,
  RegistryUpdateOptions,
  RegistryUpdateResult,
} from "./scaffold-skill.js";
