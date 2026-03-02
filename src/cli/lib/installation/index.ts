export {
  type InstallMode,
  type InstallScope,
  type Installation,
  detectGlobalInstallation,
  detectInstallation,
  detectProjectInstallation,
  getInstallationOrThrow,
} from "./installation";

export {
  type LocalInstallOptions,
  type LocalInstallResult,
  type PluginConfigResult,
  installLocal,
  installPluginConfig,
  buildAndMergeConfig,
  writeConfigFile,
  setConfigMetadata,
} from "./local-installer";

export {
  type MigrationPlan,
  type MigrationResult,
  detectMigrations,
  executeMigration,
} from "./mode-migrator";
