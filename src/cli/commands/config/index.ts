import ConfigShow from "./show.js";

/**
 * Default config command - aliases to config:show
 * When user runs "cc config", this runs the show subcommand
 */
export default class Config extends ConfigShow {
  static summary = "Show current effective configuration";
  static description =
    "Display the current effective configuration with all layers (env, project, default)";
}
