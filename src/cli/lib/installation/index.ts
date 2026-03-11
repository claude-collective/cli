export {
  type InstallMode,
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
  writeScopedConfigs,
  setConfigMetadata,
} from "./local-installer";

export {
  type SkillMigration,
  type MigrationPlan,
  type MigrationResult,
  detectMigrations,
  executeMigration,
} from "./mode-migrator";

export { deriveInstallMode } from "./installation";
