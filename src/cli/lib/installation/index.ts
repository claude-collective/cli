export {
  type InstallMode,
  type Installation,
  detectInstallation,
  getInstallationOrThrow,
} from "./installation";

export {
  type LocalInstallOptions,
  type LocalInstallResult,
  type PluginConfigResult,
  installLocal,
  installPluginConfig,
} from "./local-installer";
