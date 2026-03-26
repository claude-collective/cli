// Operations — composable building blocks for CLI commands.
// Each operation wraps lower-level lib functions into a single typed call.

export { detectBothInstallations, type BothInstallations } from "./detect-both-installations.js";
export { loadSource, type LoadSourceOptions, type LoadedSource } from "./load-source.js";
export { getDashboardData, type DashboardData } from "./get-dashboard-data.js";
export { detectProject, type DetectedProject } from "./detect-project.js";
export { loadAgentDefs, type AgentDefs } from "./load-agent-defs.js";
export { copyLocalSkills, type SkillCopyResult } from "./copy-local-skills.js";
export { installPluginSkills, type PluginInstallResult } from "./install-plugin-skills.js";
export { uninstallPluginSkills, type PluginUninstallResult } from "./uninstall-plugin-skills.js";
export {
  compareSkillsWithSource,
  buildSourceSkillsMap,
  type SkillComparisonResults,
} from "./compare-skills.js";
export { ensureMarketplace, type MarketplaceResult } from "./ensure-marketplace.js";
export {
  writeProjectConfig,
  type ConfigWriteOptions,
  type ConfigWriteResult,
} from "./write-project-config.js";
export {
  compileAgents,
  type CompileAgentsOptions,
  type CompilationResult,
} from "./compile-agents.js";
export { detectConfigChanges, type ConfigChanges } from "./detect-config-changes.js";
export {
  executeInstallation,
  type ExecuteInstallationOptions,
  type ExecuteInstallationResult,
} from "./execute-installation.js";
export {
  recompileProject,
  type RecompileProjectOptions,
  type RecompileProjectResult,
} from "./recompile-project.js";
export {
  updateLocalSkills,
  type SkillUpdateResult,
  type UpdateLocalSkillsResult,
  type UpdateLocalSkillsOptions,
} from "./update-local-skills.js";
export {
  discoverInstalledSkills,
  loadSkillsFromDir,
  discoverLocalProjectSkills,
  mergeSkills,
  type DiscoveredSkills,
} from "./discover-skills.js";
export {
  collectScopedSkillDirs,
  type ScopedSkillDir,
  type ScopedSkillDirsResult,
} from "./collect-scoped-skill-dirs.js";
export { findSkillMatch, type SkillMatchResult } from "./find-skill-match.js";
export {
  generateSkillDiff,
  formatColoredDiff,
  type SkillDiffResult,
} from "./generate-skill-diff.js";
export {
  resolveSkillInfo,
  type ResolveSkillInfoOptions,
  type ResolvedSkillInfo,
  type SkillInfoResult,
} from "./resolve-skill-info.js";
export {
  ejectAgentPartials,
  ejectSkills,
  ensureMinimalConfig,
  type EjectAgentPartialsOptions,
  type EjectAgentPartialsResult,
  type EjectSkillsOptions,
  type EjectSkillsResult,
  type EnsureMinimalConfigOptions,
  type EnsureMinimalConfigResult,
} from "./eject-project.js";
export {
  detectUninstallTarget,
  removeMatchingSkills,
  removeMatchingAgents,
  uninstallPlugins,
  cleanupEmptyDirs,
  type UninstallTarget,
  type SkillRemovalResult,
  type AgentRemovalResult,
  type UninstallPluginsResult,
  type CleanupResult,
} from "./uninstall-project.js";
export {
  fetchSkillsFromExternalSource,
  filterSkillsByQuery,
  toSourcedSkill,
  copySearchedSkillsToLocal,
  type SourcedSkill,
  type FilterSkillsOptions,
  type CopySearchedSkillResult,
} from "./search-skills.js";
export {
  parseGitHubSource,
  fetchSkillSource,
  discoverValidSkills,
  importSkillFromSource,
  type ImportedForkedFromMetadata,
  type ParsedGitHubSource,
  type FetchSourceOptions,
  type FetchedSource,
  type ImportSkillOptions,
  type ImportSkillResult,
} from "./import-skill.js";
export {
  parseCompiledAgent,
  loadMetaAgent,
  buildAgentPrompt,
  invokeMetaAgent,
  type NewAgentInput,
  type LoadMetaAgentOptions,
  type InvokeMetaAgentOptions,
} from "./scaffold-agent.js";
export {
  migratePluginSkillScopes,
  type PluginScopeMigrationResult,
} from "./migrate-plugin-scope.js";
export {
  validateSkillName,
  toTitleCase,
  generateSkillMd,
  generateMetadataYaml,
  generateSkillCategoriesTs,
  generateSkillRulesTs,
  scaffoldSkillFiles,
  updateSkillRegistryConfig,
  type ScaffoldSkillOptions,
  type ScaffoldSkillResult,
  type RegistryUpdateOptions,
  type RegistryUpdateResult,
} from "./scaffold-skill.js";
