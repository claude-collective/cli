import { BaseCommand } from "../../base-command.js";
import { getProjectConfigPath } from "../../lib/configuration/index.js";

export default class ConfigPath extends BaseCommand {
  static summary = "Show configuration file paths";
  static description = "Display the file path for the project configuration file";

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    await this.parse(ConfigPath);

    const projectDir = process.cwd();

    this.log("\nConfiguration File Paths:\n");
    this.log(`Project: ${getProjectConfigPath(projectDir)}`);
    this.log("");
  }
}
