/**
 * Show current plugin version.
 */
import { BaseCommand } from "../../base-command.js";
import { getPluginVersion } from "../../lib/plugin-version.js";
import { EXIT_CODES } from "../../lib/exit-codes.js";
import path from "path";
import { PLUGIN_MANIFEST_DIR, PLUGIN_MANIFEST_FILE } from "../../consts.js";
import { findPluginManifest } from "../../lib/plugin-manifest-finder.js";

export default class VersionShow extends BaseCommand {
  static summary = "Show current plugin version";
  static description = "Display the current version of the plugin in the current directory.";

  static flags = {
    ...BaseCommand.baseFlags,
  };

  static examples = ["<%= config.bin %> <%= command.id %>"];

  async run(): Promise<void> {
    await this.parse(VersionShow);
    const manifestPath = await findPluginManifest(process.cwd());

    if (!manifestPath) {
      this.error(
        `No plugin.json found in current directory or parents\nExpected location: ${PLUGIN_MANIFEST_DIR}/${PLUGIN_MANIFEST_FILE}`,
        { exit: EXIT_CODES.ERROR },
      );
    }

    const pluginDir = path.dirname(path.dirname(manifestPath));

    try {
      const version = await getPluginVersion(pluginDir);
      this.log(version);
    } catch (error) {
      this.error(`Failed to read plugin version: ${error}`, {
        exit: EXIT_CODES.ERROR,
      });
    }
  }
}
