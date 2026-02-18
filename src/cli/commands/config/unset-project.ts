import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import {
  loadProjectSourceConfig,
  saveProjectConfig,
  type ProjectSourceConfig,
} from "../../lib/configuration/index.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class ConfigUnsetProject extends BaseCommand {
  static summary = "Remove a project-level configuration value";
  static description = "Remove a project-level configuration value";

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
    const { args } = await this.parse(ConfigUnsetProject);
    const projectDir = process.cwd();
    const { key } = args;

    const validKeys = ["source", "marketplace", "agentsSource"];

    if (!validKeys.includes(key)) {
      this.error(`Unknown configuration key: ${key}\nValid keys: ${validKeys.join(", ")}`, {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    const existingConfig = await loadProjectSourceConfig(projectDir);

    if (!existingConfig) {
      this.logInfo("No project configuration exists.");
      return;
    }

    const newConfig: ProjectSourceConfig = { ...existingConfig };
    delete newConfig[key as keyof ProjectSourceConfig];

    await saveProjectConfig(projectDir, newConfig);

    this.logSuccess(`Removed ${key} from project configuration`);
  }
}
