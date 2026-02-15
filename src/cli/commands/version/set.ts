import { Args } from "@oclif/core";

import { BaseCommand } from "../../base-command.js";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../consts.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import { findPluginManifest } from "../../lib/plugins/index.js";
import { pluginManifestSchema } from "../../lib/schemas.js";
import { readFile, writeFile } from "../../utils/fs.js";

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function isValidSemver(version: string): boolean {
  return SEMVER_REGEX.test(version);
}

export default class VersionSet extends BaseCommand {
  static summary = "Set plugin version to a specific value";
  static description = "Set the plugin version to an explicit semantic version (e.g., 1.2.3).";

  static args = {
    version: Args.string({
      description: "Version to set (semantic version format: X.Y.Z)",
      required: true,
    }),
  };

  static flags = {
    ...BaseCommand.baseFlags,
  };

  static examples = [
    "<%= config.bin %> <%= command.id %> 1.0.0",
    "<%= config.bin %> <%= command.id %> 2.1.3",
    "<%= config.bin %> <%= command.id %> 1.0.0 --dry-run",
  ];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(VersionSet);
    const newVersion = args.version;

    if (!isValidSemver(newVersion)) {
      this.error(
        `Invalid version format: "${newVersion}". Must be semantic version (e.g., 1.0.0)`,
        { exit: EXIT_CODES.INVALID_ARGS },
      );
    }

    const manifestPath = await findPluginManifest(process.cwd());

    if (!manifestPath) {
      this.error(
        `No plugin.json found in current directory or parents\nExpected location: ${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`,
        { exit: EXIT_CODES.ERROR },
      );
    }

    try {
      const content = await readFile(manifestPath);
      const manifest = pluginManifestSchema.parse(JSON.parse(content));
      const oldVersion = manifest.version || "1.0.0";
      const pluginName = manifest.name || "unknown";

      if (flags["dry-run"]) {
        this.log(`[DRY RUN] Would set ${pluginName} version: ${oldVersion} -> ${newVersion}`);
        return;
      }

      manifest.version = newVersion;
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      this.log(`${pluginName}: ${oldVersion} -> ${newVersion}`);
    } catch (error) {
      this.error(`Failed to set plugin version: ${error}`, {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
