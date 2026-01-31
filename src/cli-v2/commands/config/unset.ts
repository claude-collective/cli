import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import {
  loadGlobalConfig,
  saveGlobalConfig,
  type GlobalConfig,
} from "../../lib/config.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class ConfigUnset extends BaseCommand {
  static summary = "Remove a global configuration value";
  static description = "Remove a global configuration value";

  static args = {
    key: Args.string({
      description: "Configuration key to remove",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigUnset);
    const { key } = args;

    const validKeys = ["source", "author", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      this.error(
        `Unknown configuration key: ${key}\nValid keys: ${validKeys.join(", ")}`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    const existingConfig = await loadGlobalConfig();
    if (!existingConfig) {
      this.logInfo("No global configuration exists.");
      return;
    }

    const newConfig: GlobalConfig = { ...existingConfig };
    delete newConfig[key as keyof GlobalConfig];

    await saveGlobalConfig(newConfig);

    this.logSuccess(`Removed ${key} from global configuration`);
  }
}
