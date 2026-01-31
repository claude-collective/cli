import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import {
  loadProjectConfig,
  saveProjectConfig,
  type ProjectConfig,
} from "../../lib/config.js";
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

    const validKeys = ["source", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      this.error(
        `Unknown configuration key: ${key}\nValid keys: ${validKeys.join(", ")}`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    const existingConfig = await loadProjectConfig(projectDir);

    if (!existingConfig) {
      this.logInfo("No project configuration exists.");
      return;
    }

    const newConfig: ProjectConfig = { ...existingConfig };
    delete newConfig[key as keyof ProjectConfig];

    await saveProjectConfig(projectDir, newConfig);

    this.logSuccess(`Removed ${key} from project configuration`);
  }
}
