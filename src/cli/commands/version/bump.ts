import { Args } from "@oclif/core";
import path from "path";

import { BaseCommand } from "../../base-command.js";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import {
  bumpPluginVersion,
  type VersionBumpType,
  findPluginManifest,
} from "../../lib/plugins/index.js";
import { pluginManifestSchema } from "../../lib/schemas.js";
import { readFile } from "../../utils/fs.js";

export default class VersionBump extends BaseCommand {
  static summary = "Bump plugin version";
  static description =
    "Increment the plugin version by the specified type (major, minor, or patch).";

  static args = {
    type: Args.string({
      description: "Version bump type",
      required: true,
      options: ["major", "minor", "patch"],
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
  };

  static examples = [
    "<%= config.bin %> <%= command.id %> patch",
    "<%= config.bin %> <%= command.id %> minor",
    "<%= config.bin %> <%= command.id %> major",
    "<%= config.bin %> <%= command.id %> patch --dry-run",
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(VersionBump);
    const bumpType = args.type as VersionBumpType;

    const manifestPath = await findPluginManifest(process.cwd());

    if (!manifestPath) {
      this.error(
        `No plugin.json found in current directory or parents\nExpected location: ${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`,
        { exit: EXIT_CODES.ERROR },
      );
    }

    const pluginDir = path.dirname(path.dirname(manifestPath));

    try {
      const content = await readFile(manifestPath);
      const manifest = pluginManifestSchema.parse(JSON.parse(content));
      const oldVersion = manifest.version || "1.0.0";
      const pluginName = manifest.name || "unknown";

      if (flags["dry-run"]) {
        this.log(`[DRY RUN] Would bump ${pluginName} version: ${oldVersion} -> ${bumpType}`);
        return;
      }

      const newVersion = await bumpPluginVersion(pluginDir, bumpType);
      this.log(`${pluginName}: ${oldVersion} -> ${newVersion}`);
    } catch (error) {
      this.error(`Failed to bump plugin version: ${error}`, {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
