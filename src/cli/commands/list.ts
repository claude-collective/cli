import { BaseCommand } from "../base-command.js";
import { CLI_BIN_NAME, DEFAULT_BRANDING } from "../consts.js";
import { getInstallationInfo, formatInstallationDisplay } from "../lib/plugins/index.js";

export default class List extends BaseCommand {
  static summary = "Show installation information";
  static description = `Display details about the ${DEFAULT_BRANDING.NAME} installation (local or plugin mode)`;
  static aliases = ["ls"];

  static examples = [
    {
      description: "Show current installation details",
      command: "<%= config.bin %> <%= command.id %>",
    },
  ];

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    await this.parse(List);

    const info = await getInstallationInfo();

    if (!info) {
      this.log("No installation found.");
      this.log(`Run '${CLI_BIN_NAME} init' to create one.`);
      return;
    }

    this.log("");
    this.log(formatInstallationDisplay(info));
    this.log("");
  }
}
