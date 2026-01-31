import { BaseCommand } from "../../base-command.js";
import { getGlobalConfigPath, getProjectConfigPath } from "../../lib/config.js";

export default class ConfigPath extends BaseCommand {
  static summary = "Show configuration file paths";
  static description =
    "Display the file paths for global and project configuration files";

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    await this.parse(ConfigPath);

    const projectDir = process.cwd();

    this.log("\nConfiguration File Paths:\n");
    this.log(`Global:  ${getGlobalConfigPath()}`);
    this.log(`Project: ${getProjectConfigPath(projectDir)}`);
    this.log("");
  }
}
