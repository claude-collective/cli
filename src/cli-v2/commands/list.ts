import { Flags } from "@oclif/core";
import { BaseCommand } from "../base-command.js";
import { getPluginInfo, formatPluginDisplay } from "../lib/plugin-info.js";

export default class List extends BaseCommand {
  static summary = "Show plugin information";
  static description =
    "Display details about the installed Claude Collective plugin";
  static aliases = ["ls"];

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    await this.parse(List);

    const info = await getPluginInfo();

    if (!info) {
      this.warn("No plugin found.");
      this.log("Run 'cc init' to create one.");
      return;
    }

    this.log("");
    this.log(formatPluginDisplay(info));
    this.log("");
  }
}
