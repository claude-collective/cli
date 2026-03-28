export {
  type InstallMode,
  type Installation,
  detectGlobalInstallation,
  detectInstallation,
  detectProjectInstallation,
  getInstallationOrThrow,
} from "./installation";

export {
  type EjectInstallOptions,
  type EjectInstallResult,
  type PluginConfigResult,
  installEject,
  installPluginConfig,
  buildAndMergeConfig,
  writeConfigFile,
  writeScopedConfigs,
  setConfigMetadata,
  resolveInstallPaths,
  buildEjectSkillsMap,
  buildCompileAgents,
  buildAgentScopeMap,
} from "./local-installer";

export {
  type SkillMigration,
  type MigrationPlan,
  type MigrationResult,
  detectMigrations,
  executeMigration,
} from "./mode-migrator";

export { deriveInstallMode } from "./installation";
