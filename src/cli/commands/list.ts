import { BaseCommand } from "../base-command.js";
import { getInstallationInfo, formatInstallationDisplay } from "../lib/plugins/index.js";

export default class List extends BaseCommand {
  static summary = "Show installation information";
  static description =
    "Display details about the Claude Collective installation (local or plugin mode)";
  static aliases = ["ls"];

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    await this.parse(List);

    const info = await getInstallationInfo();

    if (!info) {
      this.log("No installation found.");
      this.log("Run 'cc init' to create one.");
      return;
    }

    this.log("");
    this.log(formatInstallationDisplay(info));
    this.log("");
  }
}
