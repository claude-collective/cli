export {
  type InstallMode,
  type InstallScope,
  type Installation,
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
} from "./local-installer";
