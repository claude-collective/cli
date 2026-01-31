import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import {
  loadGlobalConfig,
  saveGlobalConfig,
  getGlobalConfigPath,
  type GlobalConfig,
} from "../../lib/config.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class ConfigSet extends BaseCommand {
  static summary = "Set a global configuration value";
  static description =
    "Set a global configuration value (source, author, marketplace, agents_source)";

  static args = {
    key: Args.string({
      description:
        "Configuration key (source, author, marketplace, agents_source)",
      required: true,
    }),
    value: Args.string({
      description: "Configuration value",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigSet);
    const { key, value } = args;

    const validKeys = ["source", "author", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      this.error(
        `Unknown configuration key: ${key}\nValid keys: ${validKeys.join(", ")}`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    const existingConfig = (await loadGlobalConfig()) || {};
    const newConfig: GlobalConfig = {
      ...existingConfig,
      [key]: value,
    };

    await saveGlobalConfig(newConfig);

    this.logSuccess(`Set ${key} = ${value}`);
    this.logInfo(`Saved to ${getGlobalConfigPath()}`);
  }
}
