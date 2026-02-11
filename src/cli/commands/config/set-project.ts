import { Args } from "@oclif/core";
import { BaseCommand } from "../../base-command.js";
import {
  loadProjectSourceConfig,
  saveProjectConfig,
  getProjectConfigPath,
  type ProjectSourceConfig,
} from "../../lib/configuration/index.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class ConfigSetProject extends BaseCommand {
  static summary = "Set a project-level configuration value";
  static description =
    "Set a project-level configuration value (source, marketplace, agents_source)";

  static args = {
    key: Args.string({
      description: "Configuration key (source, marketplace, agents_source)",
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
    const { args } = await this.parse(ConfigSetProject);
    const projectDir = process.cwd();
    const { key, value } = args;

    const validKeys = ["source", "marketplace", "agents_source"];

    if (!validKeys.includes(key)) {
      this.error(`Unknown configuration key: ${key}\nValid keys: ${validKeys.join(", ")}`, {
        exit: EXIT_CODES.INVALID_ARGS,
      });
    }

    const existingConfig = (await loadProjectSourceConfig(projectDir)) || {};

    const newConfig: ProjectSourceConfig = {
      ...existingConfig,
      [key]: value,
    };

    await saveProjectConfig(projectDir, newConfig);

    this.logSuccess(`Set ${key} = ${value} (project-level)`);
    this.logInfo(`Saved to ${getProjectConfigPath(projectDir)}`);
  }
}
