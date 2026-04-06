// Operations — composable building blocks for CLI commands.
// Each operation wraps lower-level lib functions into a single typed call.

export {
  loadSource,
  type LoadSourceOptions,
  type LoadedSource,
  ensureMarketplace,
  type MarketplaceResult,
} from "./source/index.js";

export {
  discoverInstalledSkills,
  loadSkillsFromDir,
  discoverLocalProjectSkills,
  mergeSkills,
  type DiscoveredSkills,
  collectScopedSkillDirs,
  type ScopedSkillDir,
  type ScopedSkillDirsResult,
  copyLocalSkills,
  type SkillCopyResult,
  compareSkillsWithSource,
  buildSourceSkillsMap,
  type SkillComparisonResults,
  findSkillMatch,
  type SkillMatchResult,
  installPluginSkills,
  type PluginInstallResult,
  uninstallPluginSkills,
  type PluginUninstallResult,
} from "./skills/index.js";

export {
  detectProject,
  type DetectedProject,
  detectBothInstallations,
  type BothInstallations,
  writeProjectConfig,
  type ConfigWriteOptions,
  type ConfigWriteResult,
  compileAgents,
  type CompileAgentsOptions,
  type CompilationResult,
  loadAgentDefs,
  type AgentDefs,
} from "./project/index.js";
