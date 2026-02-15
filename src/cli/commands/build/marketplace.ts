import { Flags } from "@oclif/core";
import path from "path";
import { sortBy } from "remeda";

import { BaseCommand } from "../../base-command";
import { setVerbose } from "../../utils/logger";
import {
  generateMarketplace,
  writeMarketplace,
  getMarketplaceStats,
} from "../../lib/marketplace-generator";
import { DEFAULT_PLUGIN_NAME, DEFAULT_VERSION } from "../../consts";

const DEFAULT_PLUGINS_DIR = "dist/plugins";
const DEFAULT_OUTPUT_FILE = ".claude-plugin/marketplace.json";
const DEFAULT_DESCRIPTION = "Community skills and stacks for Claude Code";
const DEFAULT_OWNER_NAME = "Claude Collective";
const DEFAULT_OWNER_EMAIL = "hello@claude-collective.com";

export default class BuildMarketplace extends BaseCommand {
  static summary = "Generate marketplace.json from built plugins (requires skills repo)";

  static description =
    "Generate marketplace.json from built plugins. This command scans the plugins directory and generates a marketplace manifest file.";

  static examples = [
    "<%= config.bin %> <%= command.id %>",
    "<%= config.bin %> <%= command.id %> --plugins-dir dist/stacks",
    "<%= config.bin %> <%= command.id %> --output .claude-plugin/market.json",
    "<%= config.bin %> <%= command.id %> --name my-marketplace --version 2.0.0",
  ];

  static flags = {
    ...BaseCommand.baseFlags,
    "plugins-dir": Flags.string({
      char: "p",
      description: "Plugins directory",
      default: DEFAULT_PLUGINS_DIR,
    }),
    output: Flags.string({
      char: "o",
      description: "Output file",
      default: DEFAULT_OUTPUT_FILE,
    }),
    name: Flags.string({
      description: "Marketplace name",
      default: DEFAULT_PLUGIN_NAME,
    }),
    version: Flags.string({
      description: "Marketplace version",
      default: DEFAULT_VERSION,
    }),
    description: Flags.string({
      description: "Marketplace description",
      default: DEFAULT_DESCRIPTION,
    }),
    "owner-name": Flags.string({
      description: "Owner name",
      default: DEFAULT_OWNER_NAME,
    }),
    "owner-email": Flags.string({
      description: "Owner email",
      default: DEFAULT_OWNER_EMAIL,
    }),
    verbose: Flags.boolean({
      char: "v",
      description: "Enable verbose logging",
      default: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(BuildMarketplace);

    setVerbose(flags.verbose);

    const projectRoot = process.cwd();
    const pluginsDir = path.resolve(projectRoot, flags["plugins-dir"]);
    const outputPath = path.resolve(projectRoot, flags.output);

    this.log("");
    this.log("Generating marketplace.json");
    this.log(`  Plugins directory: ${pluginsDir}`);
    this.log(`  Output file: ${outputPath}`);
    this.log("");

    try {
      this.log("Scanning plugins...");

      const marketplace = await generateMarketplace(pluginsDir, {
        name: flags.name,
        version: flags.version,
        description: flags.description,
        ownerName: flags["owner-name"],
        ownerEmail: flags["owner-email"],
        pluginRoot: `./${flags["plugins-dir"]}`,
      });

      const stats = getMarketplaceStats(marketplace);
      this.log(`Found ${stats.total} plugins`);

      this.log("");
      this.log("Category breakdown:");
      const sortedCategories = sortBy(Object.entries(stats.byCategory), ([, count]) => -count);
      for (const [category, count] of sortedCategories) {
        this.log(`  ${category}: ${count}`);
      }

      this.log("Writing marketplace.json...");
      await writeMarketplace(outputPath, marketplace);
      this.log(`Wrote ${outputPath}`);

      this.log("");
      this.log("Sample plugins:");
      const sampleSize = 5;
      for (const plugin of marketplace.plugins.slice(0, sampleSize)) {
        const version = plugin.version ? `v${plugin.version}` : "";
        const category = plugin.category ? `[${plugin.category}]` : "";
        this.log(`  ${plugin.name} ${version} ${category}`);
        if (plugin.description) {
          this.log(`    ${plugin.description}`);
        }
      }
      if (marketplace.plugins.length > sampleSize) {
        this.log(`  ... and ${marketplace.plugins.length - sampleSize} more`);
      }

      this.log("");
      this.logSuccess(`Marketplace generated with ${stats.total} plugins!`);
      this.log("");
    } catch (error) {
      this.log("Generation failed");
      this.handleError(error);
    }
  }
}
