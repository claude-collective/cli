// Operations — composable building blocks for CLI commands.
// Each operation wraps lower-level lib functions into a single typed call.

export { detectBothInstallations, type BothInstallations } from "./detect-both-installations.js";
export { loadSource, type LoadSourceOptions, type LoadedSource } from "./load-source.js";
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
  resolveSkillInfo,
  type ResolveSkillInfoOptions,
  type ResolvedSkillInfo,
  type SkillInfoResult,
} from "./resolve-skill-info.js";
