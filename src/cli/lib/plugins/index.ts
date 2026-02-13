export {
  type SkillManifestOptions,
  type AgentManifestOptions,
  type StackManifestOptions,
  generateSkillPluginManifest,
  generateAgentPluginManifest,
  generateStackPluginManifest,
  writePluginManifest,
  getPluginDir,
} from "./plugin-manifest";

export { findPluginManifest } from "./plugin-manifest-finder";

export {
  getUserPluginsDir,
  getCollectivePluginDir,
  getProjectPluginsDir,
  getPluginSkillsDir,
  getPluginAgentsDir,
  getPluginManifestPath,
  readPluginManifest,
  getPluginSkillIds,
} from "./plugin-finder";

export {
  type PluginInfo,
  type InstallationInfo,
  getPluginInfo,
  formatPluginDisplay,
  getInstallationInfo,
  formatInstallationDisplay,
} from "./plugin-info";

export { type VersionBumpType, bumpPluginVersion, getPluginVersion } from "./plugin-version";

export {
  validatePluginStructure,
  validatePluginManifest,
  validateSkillFrontmatter,
  validateAgentFrontmatter,
  validatePlugin,
  validateAllPlugins,
  printPluginValidationResult,
} from "./plugin-validator";
