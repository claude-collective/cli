import ConfigShow from "./show.js";

export default class Config extends ConfigShow {
  static summary = "Show current effective configuration";
  static description =
    "Display the current effective configuration with all layers (env, project, default)";
}
