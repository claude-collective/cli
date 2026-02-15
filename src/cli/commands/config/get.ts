import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import {
  resolveSource,
  resolveAgentsSource,
  loadProjectSourceConfig,
} from "../../lib/configuration/index.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";

export default class ConfigGet extends BaseCommand {
  static summary = "Get a configuration value";
  static description =
    "Get the effective value of a configuration key (source, author, marketplace, agents_source)";

  static args = {
    key: Args.string({
      description: "Configuration key (source, author, marketplace, agents_source)",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
  };

  async run(): Promise<void> {
    const { args } = await this.parse(ConfigGet);
    const projectDir = process.cwd();

    const { key } = args;

    if (key === "source") {
      const resolved = await resolveSource(undefined, projectDir);
      this.log(resolved.source);
    } else if (key === "author") {
      const projectConfig = await loadProjectSourceConfig(projectDir);
      this.log(projectConfig?.author || "");
    } else if (key === "marketplace") {
      const resolved = await resolveSource(undefined, projectDir);
      this.log(resolved.marketplace || "");
    } else if (key === "agents_source") {
      const resolved = await resolveAgentsSource(undefined, projectDir);
      this.log(resolved.agentsSource || "");
    } else {
      this.error(
        `Unknown configuration key: ${key}\nValid keys: source, author, marketplace, agents_source`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }
  }
}
